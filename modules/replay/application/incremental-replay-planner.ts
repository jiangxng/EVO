import { createHash } from 'node:crypto';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type {
  CalculationDependencyEdge,
  ImpactRoot,
  IncrementalReplayPlan,
  IncrementalReplayPlanner,
  PlanIncrementalReplayRequest,
  ReplayCheckpointDescriptor
} from '../api/contracts.js';
import type { ReplayTopologyStore } from '../api/topology-store.js';

function canonical(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as JsonObject;
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical(object[key] ?? null)}`
  ).join(',')}}`;
}

function nodeKey(kind: string, id: string): string {
  return `${kind}\u0000${id}`;
}

function edgeSortKey(edge: CalculationDependencyEdge): string {
  return [
    edge.fromKind,
    edge.fromId,
    edge.edgeKind,
    edge.toKind,
    edge.toId,
    edge.id
  ].join('\u0000');
}

function sortRoots(roots: readonly ImpactRoot[]): ImpactRoot[] {
  return [...roots].sort((left,right) =>
    left.kind.localeCompare(right.kind) ||
    left.id.localeCompare(right.id) ||
    (left.effectiveAt?.toISOString() ?? '').localeCompare(
      right.effectiveAt?.toISOString() ?? ''
    )
  );
}

function serializeRoot(root: ImpactRoot): JsonObject {
  return {
    kind: root.kind,
    id: root.id,
    effectiveAt: root.effectiveAt?.toISOString() ?? null,
    metadata: root.metadata ?? {}
  };
}

function serializeEdge(edge: CalculationDependencyEdge): JsonObject {
  return {
    id: edge.id,
    enterpriseId: edge.enterpriseId,
    graphVersion: edge.graphVersion,
    fromKind: edge.fromKind,
    fromId: edge.fromId,
    toKind: edge.toKind,
    toId: edge.toId,
    edgeKind: edge.edgeKind,
    effectiveFrom: edge.effectiveFrom?.toISOString() ?? null,
    lineage: edge.lineage
  };
}

function checkpointSafe(
  checkpoint: ReplayCheckpointDescriptor,
  request: PlanIncrementalReplayRequest
): string[] {
  const reasons: string[] = [];

  if (checkpoint.dependencyGraphVersion !== request.graphVersion) {
    reasons.push('CHECKPOINT_DEPENDENCY_GRAPH_VERSION_MISMATCH');
  }
  if (checkpoint.runtimeSemanticVersion !== request.runtimeSemanticVersion) {
    reasons.push('CHECKPOINT_RUNTIME_SEMANTIC_VERSION_MISMATCH');
  }
  if (checkpoint.boundarySequence >= request.earliestAffectedSequence) {
    reasons.push('CHECKPOINT_NOT_BEFORE_AFFECTED_BOUNDARY');
  }
  if (checkpoint.validity.safeForIncremental !== true) {
    reasons.push('CHECKPOINT_NOT_EXPLICITLY_SAFE_FOR_INCREMENTAL');
  }

  return reasons;
}

function unsafeRootReasons(roots: readonly ImpactRoot[]): string[] {
  const reasons = new Set<string>();

  for (const root of roots) {
    if (root.kind === 'RUNTIME_SEMANTIC_VERSION') {
      reasons.add('RUNTIME_SEMANTIC_VERSION_CHANGE_REQUIRES_FULL_REPLAY');
    }

    if (root.kind === 'TEMPLATE_DEFINITION' || root.kind === 'POLICY_VERSION') {
      const nonRetroactive = root.metadata?.nonRetroactive === true;
      if (!nonRetroactive) {
        reasons.add(
          root.kind === 'TEMPLATE_DEFINITION'
            ? 'RETROACTIVE_OR_UNKNOWN_TEMPLATE_CHANGE_REQUIRES_FULL_REPLAY'
            : 'RETROACTIVE_OR_UNKNOWN_POLICY_CHANGE_REQUIRES_FULL_REPLAY'
        );
      }
    }
  }

  return [...reasons].sort();
}

export class DefaultIncrementalReplayPlanner implements IncrementalReplayPlanner {
  constructor(private readonly topology: ReplayTopologyStore) {}

  async plan(
    request: PlanIncrementalReplayRequest
  ): Promise<IncrementalReplayPlan> {
    if (request.impactRoots.length === 0) {
      throw new Error('Incremental replay planning requires at least one impact root.');
    }
    if (request.earliestAffectedSequence < 0n) {
      throw new Error('earliestAffectedSequence must be non-negative.');
    }

    const roots = sortRoots(request.impactRoots);
    const visitedNodes = new Set<string>();
    const queuedNodes = new Set<string>();
    const queue: Array<{ kind: string; id: string }> = [];

    for (const root of roots) {
      const key = nodeKey(root.kind, root.id);
      if (!queuedNodes.has(key)) {
        queuedNodes.add(key);
        queue.push({ kind: root.kind, id: root.id });
      }
    }

    queue.sort((a,b) => nodeKey(a.kind,a.id).localeCompare(nodeKey(b.kind,b.id)));

    const edgesByIdentity = new Map<string, CalculationDependencyEdge>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentKey = nodeKey(current.kind,current.id);
      if (visitedNodes.has(currentKey)) continue;
      visitedNodes.add(currentKey);

      const dependents = await this.topology.listDependents(
        request.enterpriseId,
        request.graphVersion,
        current.kind,
        current.id
      );

      const ordered = [...dependents]
        .filter((edge) =>
          edge.enterpriseId === request.enterpriseId &&
          edge.graphVersion === request.graphVersion
        )
        .sort((a,b) => edgeSortKey(a).localeCompare(edgeSortKey(b)));

      for (const edge of ordered) {
        const identity = edgeSortKey(edge);
        if (!edgesByIdentity.has(identity)) {
          edgesByIdentity.set(identity, edge);
        }

        const targetKey = nodeKey(edge.toKind,edge.toId);
        if (!visitedNodes.has(targetKey) && !queuedNodes.has(targetKey)) {
          queuedNodes.add(targetKey);
          queue.push({kind:edge.toKind,id:edge.toId});
        }
      }

      queue.sort((a,b) => nodeKey(a.kind,a.id).localeCompare(nodeKey(b.kind,b.id)));
    }

    const dependencyClosure = [...edgesByIdentity.values()]
      .sort((a,b) => edgeSortKey(a).localeCompare(edgeSortKey(b)));

    const fallbackReasons = new Set<string>();

    if (!request.dependencyGraphComplete) {
      fallbackReasons.add('DEPENDENCY_GRAPH_NOT_PROVEN_COMPLETE');
    }

    for (const reason of unsafeRootReasons(roots)) {
      fallbackReasons.add(reason);
    }

    let checkpoint: ReplayCheckpointDescriptor | null = null;

    if (request.earliestAffectedSequence === 0n) {
      fallbackReasons.add('NO_CHECKPOINT_CAN_PRECEDE_SEQUENCE_ZERO');
    } else {
      checkpoint = await this.topology.getLatestValidCheckpoint(
        request.enterpriseId,
        request.consistencyDomain,
        request.earliestAffectedSequence - 1n
      );

      if (checkpoint === null) {
        fallbackReasons.add('NO_VALID_CHECKPOINT_BEFORE_AFFECTED_BOUNDARY');
      } else {
        for (const reason of checkpointSafe(checkpoint,request)) {
          fallbackReasons.add(reason);
        }
      }
    }

    const sortedReasons = [...fallbackReasons].sort();
    const fallbackToFullReplay = sortedReasons.length > 0;

    const semantic: JsonObject = {
      enterpriseId: request.enterpriseId,
      consistencyDomain: request.consistencyDomain,
      graphVersion: request.graphVersion,
      runtimeSemanticVersion: request.runtimeSemanticVersion,
      earliestAffectedSequence: request.earliestAffectedSequence.toString(),
      dependencyGraphComplete: request.dependencyGraphComplete,
      impactRoots: roots.map(serializeRoot),
      dependencyClosure: dependencyClosure.map(serializeEdge),
      checkpoint: checkpoint === null ? null : {
        id: checkpoint.id,
        boundarySequence: checkpoint.boundarySequence.toString(),
        orderedInputDigest: checkpoint.orderedInputDigest,
        templateVersion: checkpoint.templateVersion,
        runtimeSemanticVersion: checkpoint.runtimeSemanticVersion,
        dependencyGraphVersion: checkpoint.dependencyGraphVersion,
        materializationDigest: checkpoint.materializationDigest,
        validity: checkpoint.validity
      },
      fallbackToFullReplay,
      fallbackReasons: sortedReasons
    };

    const planDigest = createHash('sha256')
      .update(canonical(semantic))
      .digest('hex');

    return {
      enterpriseId: request.enterpriseId,
      consistencyDomain: request.consistencyDomain,
      graphVersion: request.graphVersion,
      impactRoots: roots,
      dependencyClosure,
      earliestAffectedSequence: request.earliestAffectedSequence,
      ...(checkpoint !== null ? { checkpoint } : {}),
      fallbackToFullReplay,
      fallbackReasons: sortedReasons,
      planDigest
    };
  }
}
