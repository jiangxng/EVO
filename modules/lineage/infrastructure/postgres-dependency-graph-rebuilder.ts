import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { CalculationDependencyStore } from '../api/contracts.js';
import type {
  DependencyGraphRebuilder,
  DependencyGraphRebuildResult,
  DependencyProducerFamily
} from '../api/rebuilder.js';
import {
  ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
  versionedDependencyNodeId
} from '../domain/node-identity.js';

function ledgerEntryNode(id: string): string {
  return `ledger-entry:${id}`;
}

function ledgerBalanceNode(ledgerCode: string, dimensionHash: string): string {
  return `ledger-balance:${ledgerCode}:${dimensionHash}`;
}

function valuationResultNode(id: string): string {
  return `valuation-result:${id}`;
}

function costResultNode(id: string): string {
  return `cost-result:${id}`;
}

function workItemNode(id: string): string {
  return `work-item:${id}`;
}

export class PostgresDependencyGraphRebuilder implements DependencyGraphRebuilder {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly dependencies: CalculationDependencyStore
  ) {}

  async rebuildEnterprise(enterpriseId: string): Promise<DependencyGraphRebuildResult> {
    const familyCounts: Record<DependencyProducerFamily, number> = {
      POSTING_PROJECTION: 0,
      ALLOCATION: 0,
      COST_VALUATION: 0,
      FX_PERIOD_END: 0,
      FX_REALIZED_SETTLEMENT: 0,
      WORK_PROJECTION: 0
    };

    const entries = await this.db.selectFrom('ledger_entry as e')
      .innerJoin('ledger_definition as d','d.id','e.ledger_definition_id')
      .select([
        'e.id',
        'e.business_data_id',
        'e.posting_rule_id',
        'e.posting_rule_schema_version',
        'e.entry_source_kind',
        'e.cost_result_id',
        'e.valuation_rule_id',
        'e.valuation_rule_version',
        'e.dimension_hash',
        'e.effective_at',
        'd.code as ledger_code'
      ])
      .where('e.enterprise_id','=',enterpriseId)
      .orderBy('e.posting_sequence')
      .orderBy('e.id')
      .execute();

    for (const entry of entries) {
      const target = ledgerEntryNode(entry.id);

      if (entry.entry_source_kind === 'POSTING') {
        familyCounts.POSTING_PROJECTION += 1;
        await this.dependencies.recordDependency({
          enterpriseId,
          graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
          fromKind: 'BUSINESS_FACT',
          fromId: entry.business_data_id,
          toKind: 'MATERIALIZATION',
          toId: target,
          edgeKind: 'PROJECTION',
          effectiveFrom: entry.effective_at,
          lineage: { semantic: 'POSTING_BUSINESS_FACT_TO_LEDGER_ENTRY' }
        });

        if (entry.posting_rule_id !== null) {
          await this.dependencies.recordDependency({
            enterpriseId,
            graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
            fromKind: 'POLICY_VERSION',
            fromId: versionedDependencyNodeId(
              entry.posting_rule_id,
              entry.posting_rule_schema_version
            ),
            toKind: 'MATERIALIZATION',
            toId: target,
            edgeKind: 'PROJECTION',
            effectiveFrom: entry.effective_at,
            lineage: { semantic: 'POSTING_RULE_TO_LEDGER_ENTRY' }
          });
        }
      } else {
        familyCounts.COST_VALUATION += 1;

        if (entry.cost_result_id !== null) {
          await this.dependencies.recordDependency({
            enterpriseId,
            graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
            fromKind: 'COST_RESULT',
            fromId: entry.cost_result_id,
            toKind: 'MATERIALIZATION',
            toId: target,
            edgeKind: 'PROJECTION',
            effectiveFrom: entry.effective_at,
            lineage: { semantic: 'COST_RESULT_TO_VALUATION_LEDGER_ENTRY' }
          });
        }

        if (
          entry.valuation_rule_id !== null &&
          entry.valuation_rule_version !== null
        ) {
          await this.dependencies.recordDependency({
            enterpriseId,
            graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
            fromKind: 'POLICY_VERSION',
            fromId: versionedDependencyNodeId(
              entry.valuation_rule_id,
              entry.valuation_rule_version
            ),
            toKind: 'MATERIALIZATION',
            toId: target,
            edgeKind: 'PROJECTION',
            effectiveFrom: entry.effective_at,
            lineage: { semantic: 'VALUATION_RULE_TO_LEDGER_ENTRY' }
          });
        }
      }

      await this.dependencies.recordDependency({
        enterpriseId,
        graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
        fromKind: 'MATERIALIZATION',
        fromId: target,
        toKind: 'MATERIALIZATION',
        toId: ledgerBalanceNode(entry.ledger_code, entry.dimension_hash),
        edgeKind: 'MATERIALIZATION',
        effectiveFrom: entry.effective_at,
        lineage: { semantic: 'LEDGER_ENTRY_TO_BALANCE' }
      });
    }

    const allocations = await this.db.selectFrom('allocation_relation as a')
      .innerJoin('business_data as c','c.id','a.consumer_business_data_id')
      .select([
        'a.id',
        'a.source_business_data_id',
        'a.source_position_key',
        'a.consumer_business_data_id',
        'a.allocation_policy_id',
        'a.allocation_policy_version',
        'c.effective_at'
      ])
      .where('a.enterprise_id','=',enterpriseId)
      .orderBy('a.consumer_business_data_id')
      .orderBy('a.allocation_sequence')
      .execute();

    for (const allocation of allocations) {
      familyCounts.ALLOCATION += 1;
      if (allocation.source_business_data_id !== null) {
        await this.dependencies.recordDependency({
          enterpriseId,
          graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
          fromKind: 'BUSINESS_FACT',
          fromId: allocation.source_business_data_id,
          toKind: 'BUSINESS_FACT',
          toId: allocation.consumer_business_data_id,
          edgeKind: 'ALLOCATION',
          effectiveFrom: allocation.effective_at,
          lineage: {
            semantic: 'ALLOCATION_SOURCE_TO_CONSUMER',
            allocationRelationId: allocation.id
          }
        });
      } else if (allocation.source_position_key !== null) {
        await this.dependencies.recordDependency({
          enterpriseId,
          graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
          fromKind: 'POSITION',
          fromId: allocation.source_position_key,
          toKind: 'BUSINESS_FACT',
          toId: allocation.consumer_business_data_id,
          edgeKind: 'ALLOCATION',
          effectiveFrom: allocation.effective_at,
          lineage: {
            semantic: 'ALLOCATION_POSITION_TO_CONSUMER',
            allocationRelationId: allocation.id
          }
        });
      }

      await this.dependencies.recordDependency({
        enterpriseId,
        graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
        fromKind: 'POLICY_VERSION',
        fromId: versionedDependencyNodeId(
          allocation.allocation_policy_id,
          allocation.allocation_policy_version
        ),
        toKind: 'BUSINESS_FACT',
        toId: allocation.consumer_business_data_id,
        edgeKind: 'ALLOCATION',
        effectiveFrom: allocation.effective_at,
        lineage: {
          semantic: 'ALLOCATION_POLICY_TO_CONSUMER',
          allocationRelationId: allocation.id
        }
      });
    }

    const costs = await this.db.selectFrom('cost_result as c')
      .innerJoin('business_data as b','b.id','c.business_data_id')
      .select([
        'c.id',
        'c.business_data_id',
        'c.valuation_rule_id',
        'c.valuation_rule_version',
        'b.effective_at'
      ])
      .where('c.enterprise_id','=',enterpriseId)
      .orderBy('c.business_data_id')
      .orderBy('c.id')
      .execute();

    for (const cost of costs) {
      familyCounts.COST_VALUATION += 1;
      const target = costResultNode(cost.id);

      await this.dependencies.recordDependency({
        enterpriseId,
        graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
        fromKind: 'BUSINESS_FACT',
        fromId: cost.business_data_id,
        toKind: 'COST_RESULT',
        toId: target,
        edgeKind: 'VALUATION',
        effectiveFrom: cost.effective_at,
        lineage: { semantic: 'BUSINESS_FACT_TO_COST_RESULT' }
      });

      if (cost.valuation_rule_id !== null && cost.valuation_rule_version !== null) {
        await this.dependencies.recordDependency({
          enterpriseId,
          graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
          fromKind: 'POLICY_VERSION',
          fromId: versionedDependencyNodeId(
            cost.valuation_rule_id,
            cost.valuation_rule_version
          ),
          toKind: 'COST_RESULT',
          toId: target,
          edgeKind: 'VALUATION',
          effectiveFrom: cost.effective_at,
          lineage: { semantic: 'VALUATION_RULE_TO_COST_RESULT' }
        });
      }

      await this.dependencies.recordDependency({
        enterpriseId,
        graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
        fromKind: 'COST_RESULT',
        fromId: target,
        toKind: 'MATERIALIZATION',
        toId: `valuation-position:${cost.business_data_id}`,
        edgeKind: 'MATERIALIZATION',
        effectiveFrom: cost.effective_at,
        lineage: { semantic: 'COST_RESULT_TO_VALUATION_POSITION' }
      });
    }

    const valuationRows = await this.db.selectFrom('valuation_result as r')
      .innerJoin('valuation_run as v','v.id','r.valuation_run_id')
      .select([
        'r.id',
        'r.result_kind',
        'r.position_key',
        'r.source_business_data_ids',
        'v.rate_dataset_id',
        'v.rate_dataset_version',
        'v.effective_at'
      ])
      .where('r.enterprise_id','=',enterpriseId)
      .orderBy('r.result_kind')
      .orderBy('r.position_key')
      .execute();

    for (const result of valuationRows) {
      if (result.result_kind === 'FX_PERIOD_END') {
        familyCounts.FX_PERIOD_END += 1;
      } else if (result.result_kind === 'FX_REALIZED_SETTLEMENT') {
        familyCounts.FX_REALIZED_SETTLEMENT += 1;
      } else {
        continue;
      }

      const target = valuationResultNode(result.id);

      await this.dependencies.recordDependency({
        enterpriseId,
        graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
        fromKind: 'POSITION',
        fromId: result.position_key,
        toKind: 'VALUATION_RESULT',
        toId: target,
        edgeKind: 'VALUATION',
        effectiveFrom: result.effective_at,
        lineage: { semantic: 'POSITION_TO_FX_VALUATION_RESULT' }
      });

      if (Array.isArray(result.source_business_data_ids)) {
        for (const sourceId of result.source_business_data_ids) {
          if (typeof sourceId !== 'string') continue;
          await this.dependencies.recordDependency({
            enterpriseId,
            graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
            fromKind: 'BUSINESS_FACT',
            fromId: sourceId,
            toKind: 'VALUATION_RESULT',
            toId: target,
            edgeKind: 'VALUATION',
            effectiveFrom: result.effective_at,
            lineage: { semantic: 'BUSINESS_FACT_TO_FX_VALUATION_RESULT' }
          });
        }
      }

      if (
        result.result_kind === 'FX_PERIOD_END' &&
        result.rate_dataset_id !== null &&
        result.rate_dataset_version !== null
      ) {
        await this.dependencies.recordDependency({
          enterpriseId,
          graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
          fromKind: 'REFERENCE_DATASET',
          fromId: versionedDependencyNodeId(
            result.rate_dataset_id,
            result.rate_dataset_version
          ),
          toKind: 'VALUATION_RESULT',
          toId: target,
          edgeKind: 'VALUATION',
          effectiveFrom: result.effective_at,
          lineage: { semantic: 'RATE_DATASET_TO_FX_VALUATION_RESULT' }
        });
      }
    }

    const workItems = await this.db.selectFrom('work_item')
      .select([
        'id',
        'source_ledger_code',
        'source_dimension_hash'
      ])
      .where('enterprise_id','=',enterpriseId)
      .orderBy('work_type')
      .orderBy('id')
      .execute();

    for (const work of workItems) {
      familyCounts.WORK_PROJECTION += 1;
      await this.dependencies.recordDependency({
        enterpriseId,
        graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
        fromKind: 'MATERIALIZATION',
        fromId: ledgerBalanceNode(
          work.source_ledger_code,
          work.source_dimension_hash
        ),
        toKind: 'MATERIALIZATION',
        toId: workItemNode(work.id),
        edgeKind: 'MATERIALIZATION',
        lineage: { semantic: 'LEDGER_BALANCE_TO_WORK_ITEM' }
      });
    }

    const missingFamilies = (Object.keys(familyCounts) as DependencyProducerFamily[])
      .filter((family) => familyCounts[family] === 0)
      .sort();

    const total = await this.db.selectFrom('calculation_dependency_edge')
      .select(({fn}) => fn.countAll<number>().as('count'))
      .where('enterprise_id','=',enterpriseId)
      .where('graph_version','=',ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION)
      .executeTakeFirstOrThrow();

    return {
      graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
      familyCounts,
      missingFamilies,
      totalEdgesObserved: Number(total.count)
    };
  }
}
