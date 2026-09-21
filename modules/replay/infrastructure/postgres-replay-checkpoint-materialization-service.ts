import { createHash } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { CostCheckpointStateBuilder } from '../../cost/api/checkpoint-builder.js';
import type { CostMethod } from '../../cost/api/contracts.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type {
  CheckpointCostPoolMaterialization,
  CheckpointLedgerBalanceMaterialization,
  CheckpointLedgerBalanceState,
  ReplayCheckpointMaterializationService,
  RestoredLedgerPrefix
} from '../api/checkpoint-materialization.js';
import type { MaterializationContext } from '../../materialization/api/context.js';

function canonical(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as JsonObject;
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical(object[key] ?? null)}`
  ).join(',')}}`;
}

function digest(value: JsonValue): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  throw new Error('Checkpoint materialization contains an invalid timestamp.');
}

function asBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  throw new Error('Checkpoint materialization contains an invalid boundary sequence.');
}

function isCostMethod(value: string | null): value is CostMethod {
  return value === 'FIFO' ||
    value === 'LIFO' ||
    value === 'MOVING_AVERAGE' ||
    value === 'SPECIFIC_IDENTIFICATION';
}

function mapLedgerRow(row: {
  id:string;
  checkpoint_id:string;
  payload:JsonObject;
  semantic_digest:string;
  created_at:unknown;
}): CheckpointLedgerBalanceMaterialization {
  const actual = digest(row.payload as JsonValue);
  if (actual !== row.semantic_digest) {
    throw new Error(
      `Checkpoint ledger materialization ${row.id} digest mismatch; stored prefix state is not trustworthy.`
    );
  }

  return {
    id: row.id,
    checkpointId: row.checkpoint_id,
    state: row.payload as unknown as CheckpointLedgerBalanceState,
    semanticDigest: row.semantic_digest,
    createdAt: asDate(row.created_at)
  };
}

function mapRow(row: {
  id:string;
  checkpoint_id:string;
  payload:JsonObject;
  semantic_digest:string;
  created_at:unknown;
}): CheckpointCostPoolMaterialization {
  const actual = digest(row.payload as JsonValue);
  if (actual !== row.semantic_digest) {
    throw new Error(
      `Checkpoint materialization ${row.id} digest mismatch; stored prefix state is not trustworthy.`
    );
  }

  return {
    id: row.id,
    checkpointId: row.checkpoint_id,
    state: row.payload as unknown as CheckpointCostPoolMaterialization['state'],
    semanticDigest: row.semantic_digest,
    createdAt: asDate(row.created_at)
  };
}

export class PostgresReplayCheckpointMaterializationService
implements ReplayCheckpointMaterializationService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly costStates: CostCheckpointStateBuilder
  ) {}

  async captureCostPools(
    checkpointId: string
  ): Promise<readonly CheckpointCostPoolMaterialization[]> {
    const checkpoint = await this.db.selectFrom('replay_checkpoint')
      .select([
        'id','enterprise_id','boundary_sequence','source_replay_run_id','status'
      ])
      .where('id','=',checkpointId)
      .where('status','=','ACTIVE')
      .executeTakeFirstOrThrow();

    if (checkpoint.source_replay_run_id === null) {
      throw new Error('Cost-pool checkpoint capture requires a source Full ReplayRun.');
    }

    const replay = await this.db.selectFrom('replay_run')
      .select([
        'id','mode','status','validation_status','cost_method',
        'valuation_policy_id','valuation_policy_version'
      ])
      .where('id','=',checkpoint.source_replay_run_id)
      .executeTakeFirstOrThrow();

    if (
      replay.mode !== 'FULL' ||
      replay.status !== 'COMPLETED' ||
      replay.validation_status !== 'MATCH'
    ) {
      throw new Error('Cost-pool checkpoint capture requires a completed MATCH Full Replay.');
    }

    if (replay.cost_method === null) return [];
    if (!isCostMethod(replay.cost_method)) {
      throw new Error(`Unsupported replay cost method ${replay.cost_method}.`);
    }
    if (
      replay.valuation_policy_id === null ||
      replay.valuation_policy_version === null
    ) {
      throw new Error('Cost-pool checkpoint capture requires pinned ValuationPolicy.');
    }

    const states = await this.costStates.build({
      enterpriseId: checkpoint.enterprise_id,
      method: replay.cost_method,
      valuationPolicyId: replay.valuation_policy_id,
      valuationPolicyVersion: replay.valuation_policy_version,
      boundarySequence: asBigInt(checkpoint.boundary_sequence)
    });

    for (const state of states) {
      const payload = state as unknown as JsonObject;
      const semanticDigest = digest(payload as JsonValue);

      const existing = await this.db.selectFrom('replay_checkpoint_materialization')
        .select(['id','semantic_digest'])
        .where('checkpoint_id','=',checkpoint.id)
        .where('family','=','COST_POOL')
        .where('scope_key','=',state.poolKey)
        .where('schema_version','=',state.schemaVersion)
        .executeTakeFirst();

      if (existing !== undefined) {
        if (existing.semantic_digest !== semanticDigest) {
          throw new Error(
            `Checkpoint COST_POOL ${state.poolKey} drifted after capture; create a new checkpoint.`
          );
        }
        continue;
      }

      await this.db.insertInto('replay_checkpoint_materialization')
        .values({
          enterprise_id: checkpoint.enterprise_id,
          checkpoint_id: checkpoint.id,
          family: 'COST_POOL',
          scope_key: state.poolKey,
          schema_version: state.schemaVersion,
          payload,
          semantic_digest: semanticDigest
        })
        .execute();
    }

    return this.loadCostPools(checkpoint.id);
  }

  async loadCostPools(
    checkpointId: string
  ): Promise<readonly CheckpointCostPoolMaterialization[]> {
    const rows = await this.db.selectFrom('replay_checkpoint_materialization')
      .select(['id','checkpoint_id','payload','semantic_digest','created_at'])
      .where('checkpoint_id','=',checkpointId)
      .where('family','=','COST_POOL')
      .where('schema_version','=',1)
      .orderBy('scope_key')
      .execute();

    return rows.map((row)=>mapRow({
      ...row,
      payload: row.payload as JsonObject
    }));
  }

  async captureLedgerBalances(
    checkpointId: string
  ): Promise<readonly CheckpointLedgerBalanceMaterialization[]> {
    const checkpoint = await this.db.selectFrom('replay_checkpoint')
      .select(['id','enterprise_id','consistency_domain','boundary_sequence','status'])
      .where('id','=',checkpointId)
      .where('status','=','ACTIVE')
      .executeTakeFirstOrThrow();

    const boundarySequence = asBigInt(checkpoint.boundary_sequence);

    const rows = await this.db.selectFrom('ledger_balance as b')
      .innerJoin('ledger_dataset as ds','ds.id','b.ledger_dataset_id')
      .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
      .select([
        'd.code as ledger_code',
        'b.dimension_hash',
        'b.dimensions',
        'b.quantity',
        'b.amount',
        'b.last_effective_at',
        'b.last_posting_priority',
        'b.last_posting_sequence'
      ])
      .where('b.enterprise_id','=',checkpoint.enterprise_id)
      .where('b.consistency_domain','=',checkpoint.consistency_domain)
      .where('ds.status','=','ACTIVE')
      .orderBy('d.code')
      .orderBy('b.dimension_hash')
      .execute();

    for (const row of rows) {
      const lastSequence = asBigInt(row.last_posting_sequence);
      if (lastSequence > boundarySequence) {
        throw new Error(
          `Active ledger balance ${row.ledger_code}/${row.dimension_hash} advanced beyond checkpoint boundary; create a new checkpoint.`
        );
      }

      const state: CheckpointLedgerBalanceState = {
        schemaVersion: 1,
        ledgerCode: row.ledger_code,
        dimensionHash: row.dimension_hash,
        dimensions: row.dimensions as JsonObject,
        quantity: row.quantity,
        amount: row.amount,
        lastEffectiveAt: asDate(row.last_effective_at).toISOString(),
        lastPostingPriority: row.last_posting_priority,
        lastPostingSequence: lastSequence.toString()
      };
      const payload = state as unknown as JsonObject;
      const semanticDigest = digest(payload as JsonValue);
      const scopeKey = `${state.ledgerCode}:${state.dimensionHash}`;

      const existing = await this.db.selectFrom('replay_checkpoint_materialization')
        .select(['id','semantic_digest'])
        .where('checkpoint_id','=',checkpoint.id)
        .where('family','=','LEDGER_BALANCE')
        .where('scope_key','=',scopeKey)
        .where('schema_version','=',state.schemaVersion)
        .executeTakeFirst();

      if (existing !== undefined) {
        if (existing.semantic_digest !== semanticDigest) {
          throw new Error(
            `Checkpoint LEDGER_BALANCE ${scopeKey} drifted after capture; create a new checkpoint.`
          );
        }
        continue;
      }

      await this.db.insertInto('replay_checkpoint_materialization')
        .values({
          enterprise_id: checkpoint.enterprise_id,
          checkpoint_id: checkpoint.id,
          family: 'LEDGER_BALANCE',
          scope_key: scopeKey,
          schema_version: state.schemaVersion,
          payload,
          semantic_digest: semanticDigest
        })
        .execute();
    }

    return this.loadLedgerBalances(checkpoint.id);
  }

  async loadLedgerBalances(
    checkpointId: string
  ): Promise<readonly CheckpointLedgerBalanceMaterialization[]> {
    const rows = await this.db.selectFrom('replay_checkpoint_materialization')
      .select(['id','checkpoint_id','payload','semantic_digest','created_at'])
      .where('checkpoint_id','=',checkpointId)
      .where('family','=','LEDGER_BALANCE')
      .where('schema_version','=',1)
      .orderBy('scope_key')
      .execute();

    return rows.map((row)=>mapLedgerRow({
      ...row,
      payload: row.payload as JsonObject
    }));
  }

  async restoreLedgerBalances(
    checkpointId: string,
    materialization: MaterializationContext
  ): Promise<RestoredLedgerPrefix> {
    if (materialization.mode !== 'CANDIDATE') {
      throw new Error('Ledger prefix restore requires a CANDIDATE materialization context.');
    }

    const checkpoint = await this.db.selectFrom('replay_checkpoint')
      .select(['id','enterprise_id','consistency_domain','boundary_sequence','status'])
      .where('id','=',checkpointId)
      .where('status','=','ACTIVE')
      .executeTakeFirstOrThrow();

    const runtimeDataset = await this.db.selectFrom('economic_runtime_dataset')
      .select(['id','enterprise_id','consistency_domain','kind','status','source_checkpoint_id'])
      .where('id','=',materialization.runtimeDatasetId)
      .executeTakeFirstOrThrow();

    if (
      runtimeDataset.enterprise_id !== checkpoint.enterprise_id ||
      runtimeDataset.consistency_domain !== checkpoint.consistency_domain ||
      runtimeDataset.kind !== 'CANDIDATE' ||
      runtimeDataset.status !== 'BUILDING' ||
      runtimeDataset.source_checkpoint_id !== checkpoint.id
    ) {
      throw new Error(
        'Ledger prefix restore requires a BUILDING candidate bound to the exact checkpoint.'
      );
    }

    const snapshots = await this.loadLedgerBalances(checkpoint.id);
    if (snapshots.length === 0) {
      throw new Error('Checkpoint does not contain LEDGER_BALANCE prefix state.');
    }

    return this.db.transaction().execute(async (trx) => {
      let dataset = await trx.selectFrom('ledger_dataset')
        .select(['id'])
        .where('enterprise_id','=',checkpoint.enterprise_id)
        .where('consistency_domain','=',checkpoint.consistency_domain)
        .where('economic_runtime_dataset_id','=',runtimeDataset.id)
        .where('kind','=','CANDIDATE')
        .where('status','=','BUILDING')
        .forUpdate()
        .executeTakeFirst();

      if (dataset !== undefined) {
        const [entryCount,balanceCount] = await Promise.all([
          trx.selectFrom('ledger_entry')
            .select(({fn})=>fn.countAll<number>().as('count'))
            .where('ledger_dataset_id','=',dataset.id)
            .executeTakeFirstOrThrow(),
          trx.selectFrom('ledger_balance')
            .select(({fn})=>fn.countAll<number>().as('count'))
            .where('ledger_dataset_id','=',dataset.id)
            .executeTakeFirstOrThrow()
        ]);
        if (Number(entryCount.count) > 0 || Number(balanceCount.count) > 0) {
          throw new Error(
            'Candidate ledger prefix can only be restored before suffix ledger writes begin.'
          );
        }
      } else {
        dataset = await trx.insertInto('ledger_dataset')
          .values({
            enterprise_id: checkpoint.enterprise_id,
            consistency_domain: checkpoint.consistency_domain,
            economic_runtime_dataset_id: runtimeDataset.id,
            kind: 'CANDIDATE',
            status: 'BUILDING',
            posting_boundary_sequence: asBigInt(checkpoint.boundary_sequence),
            activated_at: null
          })
          .returning(['id'])
          .executeTakeFirstOrThrow();
      }

      for (const snapshot of snapshots) {
        const ledger = await trx.selectFrom('ledger_definition')
          .select('id')
          .where('code','=',snapshot.state.ledgerCode)
          .executeTakeFirstOrThrow();

        await trx.insertInto('ledger_balance')
          .values({
            enterprise_id: checkpoint.enterprise_id,
            consistency_domain: checkpoint.consistency_domain,
            ledger_dataset_id: dataset.id,
            ledger_definition_id: ledger.id,
            dimension_hash: snapshot.state.dimensionHash,
            dimensions: snapshot.state.dimensions,
            quantity: snapshot.state.quantity,
            amount: snapshot.state.amount,
            last_effective_at: new Date(snapshot.state.lastEffectiveAt),
            last_posting_priority: snapshot.state.lastPostingPriority,
            last_posting_sequence: BigInt(snapshot.state.lastPostingSequence)
          })
          .execute();
      }

      return {
        ledgerDatasetId: dataset.id,
        balanceCount: snapshots.length
      };
    });
  }
}
