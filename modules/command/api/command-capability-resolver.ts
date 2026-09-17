import type { CommandCapability } from './contracts.js';

export interface CommandCapabilityResolver {
  resolve(
    enterpriseId: string,
    applicationInstanceId: string,
    commandCode: string
  ): Promise<CommandCapability>;
}
