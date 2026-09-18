export type DependencyProducerFamily =
  | 'POSTING_PROJECTION'
  | 'ALLOCATION'
  | 'COST_VALUATION'
  | 'GENERIC_VALUATION'
  | 'WORK_PROJECTION';

export interface DependencyGraphRebuildResult {
  readonly graphVersion: string;
  readonly familyCounts: Readonly<Record<DependencyProducerFamily, number>>;
  readonly missingFamilies: readonly DependencyProducerFamily[];
  readonly totalEdgesObserved: number;
}

export interface DependencyGraphRebuilder {
  rebuildEnterprise(enterpriseId: string): Promise<DependencyGraphRebuildResult>;
}
