import type { JsonObject } from '../../metadata/api/contracts.js';
import type { PositionDefinitionPin } from '../../position/api/contracts.js';
import type { FxPositionSnapshot } from './fx.js';
import type { ValuationScopeSelector } from './request.js';

export interface ResolveFxPositionsRequest {
  readonly enterpriseId: string;
  readonly valuationAt: Date;
  readonly scope: ValuationScopeSelector;
  readonly positionDefinition: PositionDefinitionPin;
  readonly requestBusinessDataId: string;
  readonly requestPayload: JsonObject;
}

export interface FxPositionResolver {
  resolve(
    request: ResolveFxPositionsRequest
  ): Promise<readonly FxPositionSnapshot[]>;
}
