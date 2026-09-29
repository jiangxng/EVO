export const EVO_RUNTIME_REVISION_VERSION_V010 = "0.1.0" as const;

export interface EvoRuntimeRevisionComponentsV010 {
  posting: {
    consistencyDomain: string;
    postingMode: string;
    replayRequired: boolean;
    nextPostingSequence: string;
    lastPostedSequence: string | null;
    updatedAt: string;
  };
  flowTrace: {
    count: number;
    latestCreatedAt: string | null;
  };
  flowInstance: {
    count: number;
    activeCount: number;
    completedCount: number;
    cancelledCount: number;
    latestStartedAt: string | null;
    latestCompletedAt: string | null;
  };
}

export interface EvoRuntimeRevisionV010 {
  contractVersion: typeof EVO_RUNTIME_REVISION_VERSION_V010;
  enterpriseId: string;
  components: EvoRuntimeRevisionComponentsV010;
}

export interface EvoRuntimeRevisionReaderV010 {
  read(enterpriseId: string): Promise<EvoRuntimeRevisionComponentsV010>;
}
