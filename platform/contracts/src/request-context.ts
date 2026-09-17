export type ActorType = 'HUMAN' | 'AI' | 'AUTOMATION' | 'EXTERNAL_SYSTEM';

export interface RequestContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly enterpriseId?: string;
  readonly actor?: {
    readonly type: ActorType;
    readonly id: string;
  };
}
