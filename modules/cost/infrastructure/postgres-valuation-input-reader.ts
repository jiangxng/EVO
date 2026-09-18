import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type {
  ValuationInput,
  ValuationInputDefinition,
  ValuationInputReader
} from '../api/valuation-input.js';

function payloadValue(payload: JsonObject, path: string): JsonValue | undefined {
  const parts = path.split('.');
  let current: JsonValue = payload;
  for (const part of parts) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) return undefined;
    const object = current as JsonObject;
    current = object[part] ?? null;
  }
  return current;
}

function requiredNumeric(payload: JsonObject, path: string, label: string): string {
  const value = payloadValue(payload, path);
  if (value === null || value === undefined || (typeof value !== 'string' && typeof value !== 'number')) {
    throw new Error(`${label} field ${path} must contain a numeric value.`);
  }
  const numeric = String(value);
  if (!Number.isFinite(Number(numeric))) {
    throw new Error(`${label} field ${path} is not finite.`);
  }
  return numeric;
}

function optionalString(payload: JsonObject, path: string | undefined): string | undefined {
  if (path === undefined) return undefined;
  const value = payloadValue(payload, path);
  if (value === null || value === undefined || value === '') return undefined;
  return String(value);
}

function poolParts(payload: JsonObject, dimensions: readonly string[]): {
  key: string;
  dimensions: JsonObject;
} {
  const result: Record<string, JsonValue> = {};
  const parts: string[] = [];

  for (const dimension of dimensions) {
    const value = payloadValue(payload, dimension);
    if (value === null || value === undefined || value === '') {
      throw new Error(`Valuation pool dimension ${dimension} is required.`);
    }
    result[dimension] = value;
    parts.push(`${dimension}=${String(value)}`);
  }

  return { key: parts.join('|'), dimensions: result };
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  throw new Error('Database returned an invalid valuation effective time.');
}

function asBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  throw new Error('Database returned an invalid valuation posting sequence.');
}

export class PostgresValuationInputReader implements ValuationInputReader {
  constructor(private readonly db: Kysely<Database>) {}

  async list(
    enterpriseId: string,
    definition: ValuationInputDefinition
  ): Promise<readonly ValuationInput[]> {
    const types = [...new Set([
      ...definition.inboundBusinessDataTypes,
      ...definition.outboundBusinessDataTypes
    ])];

    const rows = await this.db
      .selectFrom('business_data as b')
      .innerJoin('posting_input as p','p.business_data_id','b.id')
      .select([
        'b.id',
        'b.business_data_type',
        'b.payload',
        'b.effective_at',
        'p.posting_sequence'
      ])
      .where('b.enterprise_id','=',enterpriseId)
      .where('b.business_data_type','in',types)
      .orderBy('b.effective_at')
      .orderBy('p.posting_sequence')
      .orderBy('b.id')
      .execute();

    return rows.map((row) => {
      const payload = row.payload as JsonObject;
      const pool = poolParts(payload, definition.poolDimensions);
      const inbound = definition.inboundBusinessDataTypes.includes(row.business_data_type);
      const outbound = definition.outboundBusinessDataTypes.includes(row.business_data_type);

      if (inbound === outbound) {
        throw new Error(
          `Valuation input type ${row.business_data_type} must be classified as exactly one of inbound/outbound.`
        );
      }

      const specificIdentity = optionalString(payload, definition.specificIdentityField);

      return {
        businessDataId: row.id,
        businessDataType: row.business_data_type,
        direction: inbound ? 'INBOUND' : 'OUTBOUND',
        order: {
          effectiveAt: asDate(row.effective_at),
          semanticSequence: asBigInt(row.posting_sequence),
          stableTieBreaker: row.id
        },
        poolKey: pool.key,
        poolDimensions: pool.dimensions,
        quantity: {
          value: requiredNumeric(payload, definition.quantityField, 'quantity'),
          unit: definition.quantityUnit,
          role: 'RESOURCE_QUANTITY'
        },
        ...(inbound
          ? {
              basis: {
                value: requiredNumeric(payload, definition.basisAmountField, 'basis amount'),
                unit: definition.basisUnit,
                role: 'VALUATION_AMOUNT' as const
              }
            }
          : {}),
        ...(specificIdentity !== undefined ? { specificIdentity } : {})
      };
    });
  }
}
