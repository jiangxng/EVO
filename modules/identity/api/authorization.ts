import type { ActorType } from '../../../platform/contracts/src/index.js';

export interface AuthorizationRequest {
  readonly enterpriseId: string;
  readonly actorType: ActorType;
  readonly actorId: string;
  readonly permissionCode: string;
}

export interface AuthorizationService {
  require(request: AuthorizationRequest): Promise<void>;
}
