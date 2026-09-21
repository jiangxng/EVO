import type { MeasurementRole } from '../../economic/api/contracts.js';
import type { JsonObject } from '../../metadata/api/contracts.js';

export type PositionDefinitionStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';

export interface PositionDefinitionPin {
  readonly definitionId: string;
  readonly version: number;
  readonly digest: string;
}

export interface PositionDimensionMapping {
  readonly code: string;
  readonly field: string;
}

export interface PositionMeasureMapping {
  readonly valueField: string;
  readonly role: MeasurementRole;
  readonly unitField?: string;
  readonly unitLiteral?: string;
}

export interface PositionSourceRule {
  readonly businessDataType: string;
  readonly direction: 'INCREASE' | 'DECREASE';
  readonly foreign: PositionMeasureMapping;
  readonly carrying: PositionMeasureMapping;
  readonly condition?: JsonObject;
}

export interface PositionDefinition {
  readonly id: string;
  readonly enterpriseId?: string;
  readonly code: string;
  readonly name: string;
  readonly version: number;
  readonly status: PositionDefinitionStatus;
  readonly digest: string;
  readonly dimensions: readonly PositionDimensionMapping[];
  readonly sourceRules: readonly PositionSourceRule[];
  readonly config: JsonObject;
}

export interface PublishPositionDefinitionInput {
  readonly enterpriseId?: string;
  readonly code: string;
  readonly name: string;
  readonly version: number;
  readonly dimensions: readonly PositionDimensionMapping[];
  readonly sourceRules: readonly PositionSourceRule[];
  readonly config?: JsonObject;
}

export interface PositionDefinitionStore {
  publish(input: PublishPositionDefinitionInput): Promise<PositionDefinition>;
  getById(definitionId: string): Promise<PositionDefinition | null>;
  get(
    code: string,
    version: number,
    enterpriseId?: string
  ): Promise<PositionDefinition | null>;
}
