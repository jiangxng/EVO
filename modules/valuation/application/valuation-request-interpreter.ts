import type { AllocationStore } from '../../allocation/api/store.js';
import type { BusinessDataReader } from '../../business-data/api/business-data-reader.js';
import type { Measurement } from '../../economic/api/contracts.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type { FxPositionResolver } from '../api/position-resolver.js';
import type {
  AcceptedValuationRequest,
  FxRealizedSettlementRequestPayload,
  SettlementMeasurementMapping,
  ValuationRequestInterpreter
} from '../api/request.js';
import type {
  FxSettlementService,
  FxValuationService
} from '../api/fx.js';

function parseDate(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid ISO date/time.`);
  }
  return date;
}

function parsePolicy(policy: Readonly<Record<string, unknown>>): {
  readonly amountScale: number;
  readonly roundingMode: 'HALF_UP';
} {
  const amountScale = policy.amountScale;
  if (!Number.isInteger(amountScale) || Number(amountScale) < 0 || Number(amountScale) > 18) {
    throw new Error('FX period-end valuation policy amountScale must be an integer from 0 to 18.');
  }
  if (policy.roundingMode !== 'HALF_UP') {
    throw new Error('FX period-end valuation currently requires roundingMode=HALF_UP.');
  }
  return {
    amountScale: Number(amountScale),
    roundingMode: 'HALF_UP'
  };
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

function settlementMeasurement(
  payload: JsonObject,
  valueField: string,
  unitField: string,
  role: Measurement['role'],
  label: string
): Measurement {
  const rawValue = field(payload,valueField);
  const rawUnit = field(payload,unitField);
  if (
    (typeof rawValue !== 'string' && typeof rawValue !== 'number') ||
    (typeof rawUnit !== 'string' && typeof rawUnit !== 'number')
  ) {
    throw new Error(
      `${label} requires numeric value field ${valueField} and unit field ${unitField}.`
    );
  }
  return {
    value: String(rawValue),
    unit: String(rawUnit),
    role
  };
}

function settlementMeasurements(
  payload: JsonObject,
  mapping: SettlementMeasurementMapping
): {
  readonly foreign: Measurement;
  readonly local: Measurement;
} {
  return {
    foreign: settlementMeasurement(
      payload,
      mapping.foreignValueField,
      mapping.foreignUnitField,
      'SETTLEMENT_QUANTITY',
      'settlement foreign measurement'
    ),
    local: settlementMeasurement(
      payload,
      mapping.localValueField,
      mapping.localUnitField,
      'DIRECT_BUSINESS_AMOUNT',
      'settlement local measurement'
    )
  };
}

export class DefaultValuationRequestInterpreter
implements ValuationRequestInterpreter {
  constructor(
    private readonly positions: FxPositionResolver,
    private readonly fx: FxValuationService,
    private readonly fxSettlement: FxSettlementService,
    private readonly businessData: BusinessDataReader,
    private readonly allocations: AllocationStore
  ) {}

  async replayAcceptedRequest(request: AcceptedValuationRequest): Promise<void> {
    const valuationAt = parseDate(request.payload.valuationAt,'valuationAt');
    if (valuationAt.getTime() !== request.effectiveAt.getTime()) {
      throw new Error(
        'Canonical valuation request effectiveAt must equal payload.valuationAt.'
      );
    }

    switch (request.payload.valuationKind) {
      case 'FX_PERIOD_END': {
        const positions = await this.positions.resolve({
          enterpriseId: request.enterpriseId,
          valuationAt,
          scope: request.payload.scope,
          positionDefinition: request.payload.positionDefinition,
          requestBusinessDataId: request.businessDataId,
          requestPayload: request.payload as unknown as JsonObject
        });

        if (positions.length === 0) {
          throw new Error('FX period-end valuation request resolved no positions.');
        }

        await this.fx.revaluePeriodEnd({
          enterpriseId: request.enterpriseId,
          requestBusinessDataId: request.businessDataId,
          valuationAt,
          rateDataset: request.payload.rateDataset,
          policy: parsePolicy(request.payload.policy),
          positions
        });
        return;
      }

      case 'FX_REALIZED_SETTLEMENT':
        await this.replayFxSettlement(request,request.payload,valuationAt);
        return;
    }
  }

  private async replayFxSettlement(
    request: AcceptedValuationRequest,
    payload: FxRealizedSettlementRequestPayload,
    valuationAt: Date
  ): Promise<void> {
    const positions = await this.positions.resolve({
      enterpriseId: request.enterpriseId,
      valuationAt,
      scope: payload.scope,
      positionDefinition: payload.positionDefinition,
      requestBusinessDataId: request.businessDataId,
      requestPayload: payload as unknown as JsonObject
    });

    if (positions.length !== 1) {
      throw new Error(
        `FX realized settlement request must resolve exactly one open position, got ${positions.length}.`
      );
    }
    const position = positions[0]!;

    const settlement = await this.businessData.getBusinessData(
      request.enterpriseId,
      payload.settlementBusinessDataId
    );
    if (settlement === null) {
      throw new Error('FX settlement request references missing canonical settlement BusinessData.');
    }
    if (settlement.effectiveAt.getTime() !== valuationAt.getTime()) {
      throw new Error(
        'FX settlement request effectiveAt must equal settlement BusinessData effectiveAt.'
      );
    }

    const instruction = await this.allocations.getInstruction(payload.instructionId);
    if (instruction === null) {
      throw new Error('FX settlement request references missing AllocationInstruction.');
    }
    if (
      instruction.enterpriseId !== request.enterpriseId ||
      instruction.consumerBusinessDataId !== settlement.id ||
      instruction.allocationPolicyId !== payload.allocationPolicy.id ||
      instruction.allocationPolicyVersion !== payload.allocationPolicy.version
    ) {
      throw new Error('FX settlement AllocationInstruction does not match the pinned request.');
    }
    if (
      instruction.sourceSelector.kind === 'BUSINESS_DATA' &&
      instruction.sourceSelector.businessDataId !== undefined &&
      !position.sourceBusinessDataIds.includes(instruction.sourceSelector.businessDataId)
    ) {
      throw new Error(
        'FX settlement AllocationInstruction selects a BusinessData source outside the resolved position.'
      );
    }

    const measurements = settlementMeasurements(
      settlement.payload,
      payload.settlementMapping
    );

    await this.fxSettlement.closePosition({
      enterpriseId: request.enterpriseId,
      requestBusinessDataId: request.businessDataId,
      settledAt: valuationAt,
      settlementBusinessDataId: settlement.id,
      position,
      settlementForeign: measurements.foreign,
      settlementLocal: measurements.local,
      allocationPolicyId: payload.allocationPolicy.id,
      allocationPolicyVersion: payload.allocationPolicy.version,
      instructionId: instruction.id
    });
  }
}
