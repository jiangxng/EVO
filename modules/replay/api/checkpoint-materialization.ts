import type { CostPoolCheckpointState } from '../../cost/api/checkpoint-state.js';
import type { JsonObject } from '../../metadata/api/contracts.js';
import type { MaterializationContext } from '../../materialization/api/context.js';

export interface CheckpointCostPoolMaterialization {
  readonly id: string;
  readonly checkpointId: string;
  readonly state: CostPoolCheckpointState;
  readonly semanticDigest: string;
  readonly createdAt: Date;
}

export interface CheckpointLedgerBalanceState {
  readonly schemaVersion: 1;
  readonly ledgerCode: string;
  readonly dimensionHash: string;
  readonly dimensions: JsonObject;
  readonly quantity: string;
  readonly amount: string;
  readonly lastEffectiveAt: string;
  readonly lastPostingPriority: number;
  readonly lastPostingSequence: string;
}

export interface CheckpointLedgerBalanceMaterialization {
  readonly id: string;
  readonly checkpointId: string;
  readonly state: CheckpointLedgerBalanceState;
  readonly semanticDigest: string;
  readonly createdAt: Date;
}

export interface RestoredLedgerPrefix {
  readonly ledgerDatasetId: string;
  readonly balanceCount: number;
}

export interface ReplayCheckpointMaterializationService {
  captureCostPools(
    checkpointId: string
  ): Promise<readonly CheckpointCostPoolMaterialization[]>;

  loadCostPools(
    checkpointId: string
  ): Promise<readonly CheckpointCostPoolMaterialization[]>;

  captureLedgerBalances(
    checkpointId: string
  ): Promise<readonly CheckpointLedgerBalanceMaterialization[]>;

  loadLedgerBalances(
    checkpointId: string
  ): Promise<readonly CheckpointLedgerBalanceMaterialization[]>;

  restoreLedgerBalances(
    checkpointId: string,
    materialization: MaterializationContext
  ): Promise<RestoredLedgerPrefix>;
}
