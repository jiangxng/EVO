import type { JsonObject } from '../../metadata/api/contracts.js';

export type DependencyEdgeKind =
  | 'ALLOCATION'
  | 'VALUATION'
  | 'PROJECTION'
  | 'MATERIALIZATION'
  | 'CALCULATION';

export interface CalculationDependencyEdge {
  readonly id: string;
  readonly enterpriseId: string;
  readonly graphVersion: string;
  readonly fromKind: string;
  readonly fromId: string;
  readonly toKind: string;
  readonly toId: string;
  readonly edgeKind: DependencyEdgeKind;
  readonly effectiveFrom?: Date;
  readonly lineage: JsonObject;
}

export interface RecordCalculationDependencyInput
  extends Omit<CalculationDependencyEdge, 'id'> {}

export interface CalculationDependencyStore {
  recordDependency(
    edge: RecordCalculationDependencyInput
  ): Promise<CalculationDependencyEdge>;

  listDependents(
    enterpriseId: string,
    graphVersion: string,
    fromKind: string,
    fromId: string
  ): Promise<readonly CalculationDependencyEdge[]>;
}
