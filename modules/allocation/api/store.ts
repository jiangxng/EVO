import type { MaterializationContext } from '../../materialization/api/context.js';
import type {
  AllocationInstruction,
  AllocationRelation,
  AllocationRun
} from './contracts.js';

export interface RecordAllocationInstructionInput
  extends Omit<AllocationInstruction, 'id' | 'recordedAt'> {}

export interface StartAllocationRunInput {
  readonly enterpriseId: string;
  readonly allocationPolicyId: string;
  readonly allocationPolicyVersion: number;
  readonly inputDigest: string;
  readonly materialization?: MaterializationContext;
}

export interface RecordAllocationRelationInput
  extends Omit<AllocationRelation, 'id'> {}

export interface AllocationStore {
  recordInstruction(
    input: RecordAllocationInstructionInput
  ): Promise<AllocationInstruction>;

  getInstruction(id: string): Promise<AllocationInstruction | null>;

  startRun(input: StartAllocationRunInput): Promise<AllocationRun>;

  recordRelation(
    input: RecordAllocationRelationInput
  ): Promise<AllocationRelation>;

  completeRun(runId: string): Promise<void>;

  failRun(runId: string, error: unknown): Promise<void>;
}
