import type { JsonObject } from '../../metadata/api/contracts.js';

export interface AiCommandTool {
  readonly code: string;
  readonly name: string;
  readonly applicationCode: string;
  readonly inputSchema: JsonObject;
}

export interface AiCapabilityCatalog {
  list(enterpriseId: string): Promise<readonly AiCommandTool[]>;
}
