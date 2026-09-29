export const EVO_RUNTIME_TRACE_VERSION_V010 = "0.1.0" as const;

export interface EvoRuntimeTraceWindowV010 {
  startAt: string;
  endAt: string;
}

export interface EvoRuntimeTraceQueryV010 {
  contractVersion: typeof EVO_RUNTIME_TRACE_VERSION_V010;
  enterpriseId: string;
  window: EvoRuntimeTraceWindowV010;
  applicationIds?: string[];
}

export interface EvoRuntimeTraceStepV010 {
  applicationId: string;
  stepCode: string;
  businessDataId: string;
  commandExecutionId: string;
  occurredAt: string;
}

export interface EvoRuntimeTraceV010 {
  contractVersion: typeof EVO_RUNTIME_TRACE_VERSION_V010;
  enterpriseId: string;
  flowDefinitionId: string;
  flowInstanceId: string;
  flowInstanceKey: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  steps: EvoRuntimeTraceStepV010[];
  startedAt: string;
  completedAt?: string;
}

export interface EvoRuntimeTraceReaderV010 {
  query(input: {
    enterpriseId: string;
    startAt: Date;
    endAt: Date;
    applicationIds?: string[];
  }): Promise<EvoRuntimeTraceV010[]>;
}
