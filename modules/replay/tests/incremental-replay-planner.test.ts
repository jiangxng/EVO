import { describe, expect, it } from 'vitest';
import type {
  CalculationDependencyEdge,
  ReplayCheckpointDescriptor
} from '../api/contracts.js';
import type { ReplayTopologyStore } from '../api/topology-store.js';
import { DefaultIncrementalReplayPlanner } from '../application/incremental-replay-planner.js';

class FakeTopology implements ReplayTopologyStore {
  constructor(
    private readonly edges: readonly CalculationDependencyEdge[],
    private readonly checkpoint: ReplayCheckpointDescriptor | null,
    private readonly reverseOrder = false
  ) {}

  async recordDependency(): Promise<void> {
    throw new Error('not used');
  }

  async listDependents(
    enterpriseId: string,
    graphVersion: string,
    fromKind: string,
    fromId: string
  ): Promise<readonly CalculationDependencyEdge[]> {
    const rows = this.edges.filter((edge) =>
      edge.enterpriseId === enterpriseId &&
      edge.graphVersion === graphVersion &&
      edge.fromKind === fromKind &&
      edge.fromId === fromId
    );
    return this.reverseOrder ? [...rows].reverse() : rows;
  }

  async saveCheckpoint(): Promise<void> {
    throw new Error('not used');
  }

  async getLatestValidCheckpoint(
    _enterpriseId: string,
    _consistencyDomain: string,
    _atOrBeforeSequence: bigint
  ): Promise<ReplayCheckpointDescriptor | null> {
    return this.checkpoint;
  }

  async invalidateCheckpoint(): Promise<void> {
    throw new Error('not used');
  }
}

function edge(
  id: string,
  fromKind: string,
  fromId: string,
  toKind: string,
  toId: string
): CalculationDependencyEdge {
  return {
    id,
    enterpriseId: 'e1',
    graphVersion: 'g1',
    fromKind,
    fromId,
    toKind,
    toId,
    edgeKind: 'CALCULATION',
    lineage: {}
  };
}

function checkpoint(
  overrides: Partial<ReplayCheckpointDescriptor> = {}
): ReplayCheckpointDescriptor {
  return {
    id: 'cp-1',
    enterpriseId: 'e1',
    consistencyDomain: 'enterprise',
    boundarySequence: 9n,
    orderedInputDigest: 'a'.repeat(64),
    templateVersion: 't1',
    postingPolicyPins: {},
    allocationPolicyPins: {},
    valuationPolicyPins: {},
    referenceDatasetPins: {},
    runtimeSemanticVersion: 'runtime-1',
    dependencyGraphVersion: 'g1',
    materializationDigest: 'b'.repeat(64),
    validity: { safeForIncremental: true },
    ...overrides
  };
}

const baseRequest = {
  enterpriseId: 'e1',
  consistencyDomain: 'enterprise',
  graphVersion: 'g1',
  runtimeSemanticVersion: 'runtime-1',
  earliestAffectedSequence: 10n,
  dependencyGraphComplete: true
} as const;

describe('incremental replay planner', () => {
  it('builds a transitive dependency closure', async () => {
    const planner = new DefaultIncrementalReplayPlanner(new FakeTopology([
      edge('ab','BUSINESS_FACT','A','VALUATION','B'),
      edge('bc','VALUATION','B','PROJECTION','C')
    ], checkpoint()));

    const plan = await planner.plan({
      ...baseRequest,
      impactRoots: [{ kind: 'BUSINESS_FACT', id: 'A' }]
    });

    expect(plan.dependencyClosure.map((item) => item.id)).toEqual(['ab','bc']);
    expect(plan.fallbackToFullReplay).toBe(false);
    expect(plan.checkpoint?.id).toBe('cp-1');
    expect(plan.planDigest).toHaveLength(64);
  });

  it('is cycle-safe and does not duplicate dependency edges', async () => {
    const planner = new DefaultIncrementalReplayPlanner(new FakeTopology([
      edge('ab','BUSINESS_FACT','A','VALUATION','B'),
      edge('ba','VALUATION','B','BUSINESS_FACT','A')
    ], checkpoint()));

    const plan = await planner.plan({
      ...baseRequest,
      impactRoots: [{ kind: 'BUSINESS_FACT', id: 'A' }]
    });

    expect(plan.dependencyClosure.map((item) => item.id)).toEqual(['ab','ba']);
  });

  it('produces the same digest regardless of topology return order', async () => {
    const edges = [
      edge('ab','BUSINESS_FACT','A','VALUATION','B'),
      edge('ac','BUSINESS_FACT','A','PROJECTION','C'),
      edge('bd','VALUATION','B','MATERIALIZATION','D')
    ];

    const request = {
      ...baseRequest,
      impactRoots: [
        { kind: 'BUSINESS_FACT' as const, id: 'A' },
        { kind: 'MATERIALIZATION' as const, id: 'Z' }
      ]
    };

    const normal = await new DefaultIncrementalReplayPlanner(
      new FakeTopology(edges, checkpoint(), false)
    ).plan(request);

    const reversed = await new DefaultIncrementalReplayPlanner(
      new FakeTopology(edges, checkpoint(), true)
    ).plan(request);

    expect(normal.planDigest).toBe(reversed.planDigest);
    expect(normal.dependencyClosure.map((item) => item.id))
      .toEqual(reversed.dependencyClosure.map((item) => item.id));
  });

  it('falls back when checkpoint graph version mismatches', async () => {
    const planner = new DefaultIncrementalReplayPlanner(
      new FakeTopology([], checkpoint({ dependencyGraphVersion: 'g0' }))
    );

    const plan = await planner.plan({
      ...baseRequest,
      impactRoots: [{ kind: 'BUSINESS_FACT', id: 'A' }]
    });

    expect(plan.fallbackToFullReplay).toBe(true);
    expect(plan.fallbackReasons)
      .toContain('CHECKPOINT_DEPENDENCY_GRAPH_VERSION_MISMATCH');
  });

  it('forces full replay for a runtime semantic version change', async () => {
    const planner = new DefaultIncrementalReplayPlanner(
      new FakeTopology([], checkpoint())
    );

    const plan = await planner.plan({
      ...baseRequest,
      impactRoots: [{ kind: 'RUNTIME_SEMANTIC_VERSION', id: 'runtime-2' }]
    });

    expect(plan.fallbackToFullReplay).toBe(true);
    expect(plan.fallbackReasons)
      .toContain('RUNTIME_SEMANTIC_VERSION_CHANGE_REQUIRES_FULL_REPLAY');
  });

  it('falls back when dependency completeness is not proven', async () => {
    const planner = new DefaultIncrementalReplayPlanner(
      new FakeTopology([], checkpoint())
    );

    const plan = await planner.plan({
      ...baseRequest,
      dependencyGraphComplete: false,
      impactRoots: [{ kind: 'BUSINESS_FACT', id: 'A' }]
    });

    expect(plan.fallbackToFullReplay).toBe(true);
    expect(plan.fallbackReasons)
      .toContain('DEPENDENCY_GRAPH_NOT_PROVEN_COMPLETE');
  });

  it('requires a checkpoint strictly before the affected sequence', async () => {
    const planner = new DefaultIncrementalReplayPlanner(
      new FakeTopology([], checkpoint({ boundarySequence: 10n }))
    );

    const plan = await planner.plan({
      ...baseRequest,
      impactRoots: [{ kind: 'BUSINESS_FACT', id: 'A' }]
    });

    expect(plan.fallbackToFullReplay).toBe(true);
    expect(plan.fallbackReasons)
      .toContain('CHECKPOINT_NOT_BEFORE_AFFECTED_BOUNDARY');
  });
});
