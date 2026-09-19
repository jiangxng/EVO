export type MaterializationWriteMode = 'CURRENT' | 'CANDIDATE' | 'ORACLE';

export interface MaterializationContext {
  readonly runtimeDatasetId: string;
  readonly mode: MaterializationWriteMode;
}

export interface MaterializationContextResolver {
  current(
    enterpriseId: string,
    consistencyDomain: string
  ): Promise<MaterializationContext>;

  candidate(
    runtimeDatasetId: string,
    enterpriseId: string,
    consistencyDomain: string
  ): Promise<MaterializationContext>;

  oracle(
    runtimeDatasetId: string,
    enterpriseId: string,
    consistencyDomain: string
  ): Promise<MaterializationContext>;
}
