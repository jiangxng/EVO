import { createHash } from 'node:crypto';
import { Decimal } from 'decimal.js';
import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type { PositionDefinitionStore, PositionSourceRule } from '../../position/api/contracts.js';
import { evaluateExpression } from '../../posting/domain/expression-engine.js';
import type { FxPositionResolver, ResolveFxPositionsRequest } from '../api/position-resolver.js';
import type { FxPositionSnapshot } from '../api/fx.js';

function canonical(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as JsonObject;
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical(object[key] ?? null)}`
  ).join(',')}}`;
}

function field(payload: JsonObject, path: string): JsonValue | undefined {
  let current: JsonValue = payload;
  for (const part of path.split('.')) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = (current as JsonObject)[part] ?? null;
  }
  return current;
}

function requiredString(value: JsonValue | undefined, label: string): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`${label} must resolve to a string/number value.`);
  }
  const result = String(value);
  if (result.length === 0) throw new Error(`${label} must not be empty.`);
  return result;
}

function measurement(
  payload: JsonObject,
  rule: PositionSourceRule['foreign'] | PositionSourceRule['carrying'],
  label: string
): { value: Decimal; unit: string; role: typeof rule.role } {
  const raw = field(payload,rule.valueField);
  if (raw === null || raw === undefined || (typeof raw !== 'string' && typeof raw !== 'number')) {
    throw new Error(`${label}.valueField ${rule.valueField} must resolve to a numeric value.`);
  }
  const value = new Decimal(String(raw));
  if (!value.isFinite()) throw new Error(`${label} must be finite.`);

  const unit = rule.unitLiteral ??
    (rule.unitField !== undefined
      ? requiredString(field(payload,rule.unitField),`${label}.unitField`)
      : undefined);
  if (unit === undefined || unit.length === 0) {
    throw new Error(`${label} requires unitField or unitLiteral.`);
  }
  return { value, unit, role: rule.role };
}

function positionKey(definitionId: string, version: number, dimensions: JsonObject): string {
  const hash = createHash('sha256').update(canonical(dimensions)).digest('hex');
  return `${definitionId}@v${version}:${hash}`;
}

function scopeMatches(
  positionKeyValue: string,
  dimensions: JsonObject,
  request: ResolveFxPositionsRequest
): boolean {
  if (request.scope.kind === 'EXPLICIT_POSITIONS') {
    return request.scope.positionKeys.includes(positionKeyValue);
  }
  return Object.entries(request.scope.dimensions).every(([key,value]) =>
    canonical(dimensions[key] ?? null) === canonical(value)
  );
}

interface Aggregate {
  readonly positionKey: string;
  readonly dimensions: JsonObject;
  readonly sourceBusinessDataIds: Set<string>;
  foreign: Decimal;
  carrying: Decimal;
  foreignUnit: string;
  carryingUnit: string;
  foreignRole: PositionSourceRule['foreign']['role'];
  carryingRole: PositionSourceRule['carrying']['role'];
}

export class PostgresFxPositionResolver implements FxPositionResolver {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly definitions: PositionDefinitionStore
  ) {}

  async resolve(request: ResolveFxPositionsRequest): Promise<readonly FxPositionSnapshot[]> {
    const definition = await this.definitions.getById(request.positionDefinition.definitionId);
    if (
      definition === null ||
      definition.version !== request.positionDefinition.version ||
      definition.digest !== request.positionDefinition.digest ||
      definition.status !== 'PUBLISHED'
    ) {
      throw new Error('Pinned PositionDefinition does not match a published immutable definition.');
    }
    if (
      definition.enterpriseId !== undefined &&
      definition.enterpriseId !== request.enterpriseId
    ) {
      throw new Error('Pinned PositionDefinition belongs to another enterprise.');
    }

    const sourceTypes = [...new Set(definition.sourceRules.map((rule) => rule.businessDataType))];
    const rows = await this.db.selectFrom('business_data')
      .select(['id','business_data_type','payload','effective_at'])
      .where('enterprise_id','=',request.enterpriseId)
      .where('business_data_type','in',sourceTypes)
      .where('effective_at','<=',request.valuationAt)
      .orderBy('effective_at')
      .orderBy('id')
      .execute();

    const aggregates = new Map<string,Aggregate>();

    for (const row of rows) {
      const payload = row.payload as JsonObject;
      const rules = definition.sourceRules.filter((rule) =>
        rule.businessDataType === row.business_data_type
      );

      for (const rule of rules) {
        if (
          rule.condition !== undefined &&
          evaluateExpression(rule.condition,{ payload }) !== true
        ) {
          continue;
        }

        const dimensions: Record<string,JsonValue> = {};
        for (const mapping of definition.dimensions) {
          const value = field(payload,mapping.field);
          if (value === undefined || value === null || value === '') {
            throw new Error(
              `Position dimension ${mapping.code} requires field ${mapping.field}.`
            );
          }
          dimensions[mapping.code] = value;
        }

        const dimensionObject = dimensions as JsonObject;
        const key = positionKey(definition.id,definition.version,dimensionObject);
        const foreign = measurement(payload,rule.foreign,'foreign measurement');
        const carrying = measurement(payload,rule.carrying,'carrying measurement');
        const sign = rule.direction === 'INCREASE' ? new Decimal(1) : new Decimal(-1);

        const current = aggregates.get(key);
        if (current === undefined) {
          aggregates.set(key,{
            positionKey:key,
            dimensions:dimensionObject,
            sourceBusinessDataIds:new Set([row.id]),
            foreign:foreign.value.times(sign),
            carrying:carrying.value.times(sign),
            foreignUnit:foreign.unit,
            carryingUnit:carrying.unit,
            foreignRole:foreign.role,
            carryingRole:carrying.role
          });
        } else {
          if (current.foreignUnit !== foreign.unit || current.carryingUnit !== carrying.unit) {
            throw new Error(`Position ${key} mixes incompatible measurement units.`);
          }
          current.sourceBusinessDataIds.add(row.id);
          current.foreign = current.foreign.plus(foreign.value.times(sign));
          current.carrying = current.carrying.plus(carrying.value.times(sign));
        }
      }
    }

    const selected = [...aggregates.values()]
      .filter((aggregate) =>
        (!aggregate.foreign.isZero() || !aggregate.carrying.isZero()) &&
        scopeMatches(aggregate.positionKey,aggregate.dimensions,request)
      )
      .sort((a,b) => a.positionKey.localeCompare(b.positionKey));

    if (selected.length > 0) {
      const priorResults = await this.db.selectFrom('valuation_result as r')
        .innerJoin('valuation_run as v','v.id','r.valuation_run_id')
        .select([
          'r.position_key',
          'r.target_measurements',
          'v.effective_at',
          'v.completed_at'
        ])
        .where('r.enterprise_id','=',request.enterpriseId)
        .where('r.result_kind','=','FX_PERIOD_END')
        .where('r.position_key','in',selected.map((item) => item.positionKey))
        .where('v.status','=','COMPLETED')
        .where('v.effective_at','<',request.valuationAt)
        .orderBy('v.effective_at','desc')
        .orderBy('v.completed_at','desc')
        .execute();

      const applied = new Set<string>();
      for (const row of priorResults) {
        if (applied.has(row.position_key)) continue;
        const aggregate = selected.find((item) => item.positionKey === row.position_key);
        if (aggregate === undefined || !Array.isArray(row.target_measurements)) continue;
        const carryingAfter = row.target_measurements[0];
        if (
          carryingAfter === null ||
          typeof carryingAfter !== 'object' ||
          Array.isArray(carryingAfter)
        ) {
          continue;
        }
        const measurement = carryingAfter as Record<string,unknown>;
        if (
          measurement.role !== 'VALUATION_AMOUNT' ||
          measurement.unit !== aggregate.carryingUnit ||
          (typeof measurement.value !== 'string' && typeof measurement.value !== 'number')
        ) {
          continue;
        }
        const value = new Decimal(String(measurement.value));
        if (!value.isFinite()) continue;
        aggregate.carrying = value;
        applied.add(row.position_key);
      }
    }

    return selected.map((aggregate) => ({
      positionKey: aggregate.positionKey,
      sourceBusinessDataIds: [...aggregate.sourceBusinessDataIds].sort(),
      dimensions: aggregate.dimensions,
      foreign: {
        value: aggregate.foreign.toString(),
        unit: aggregate.foreignUnit,
        role: aggregate.foreignRole
      },
      carrying: {
        value: aggregate.carrying.toString(),
        unit: aggregate.carryingUnit,
        role: aggregate.carryingRole
      }
    }));
  }
}
