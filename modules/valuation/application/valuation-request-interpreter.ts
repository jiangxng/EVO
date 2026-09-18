import type { FxPositionResolver } from '../api/position-resolver.js';
import type {
  AcceptedValuationRequest,
  ValuationRequestInterpreter
} from '../api/request.js';
import type { FxValuationService } from '../api/fx.js';

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

export class DefaultValuationRequestInterpreter
implements ValuationRequestInterpreter {
  constructor(
    private readonly positions: FxPositionResolver,
    private readonly fx: FxValuationService
  ) {}

  async replayAcceptedRequest(request: AcceptedValuationRequest): Promise<void> {
    switch (request.payload.valuationKind) {
      case 'FX_PERIOD_END': {
        const valuationAt = parseDate(request.payload.valuationAt,'valuationAt');
        if (valuationAt.getTime() !== request.effectiveAt.getTime()) {
          throw new Error(
            'Canonical valuation request effectiveAt must equal payload.valuationAt.'
          );
        }

        const positions = await this.positions.resolve({
          enterpriseId: request.enterpriseId,
          valuationAt,
          scope: request.payload.scope,
          requestBusinessDataId: request.businessDataId,
          requestPayload: request.payload as unknown as Readonly<Record<string, unknown>>
        });

        if (positions.length === 0) {
          throw new Error('FX period-end valuation request resolved no positions.');
        }

        await this.fx.revaluePeriodEnd({
          enterpriseId: request.enterpriseId,
          valuationAt,
          rateDataset: request.payload.rateDataset,
          policy: parsePolicy(request.payload.policy),
          positions
        });
        return;
      }
    }
  }
}
