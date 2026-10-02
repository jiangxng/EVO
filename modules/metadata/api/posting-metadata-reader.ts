import type {
  PostingRuleDefinition
} from './contracts.js';

export interface PostingMetadataSnapshot {
  readonly applicationId: string;
  readonly applicationDefinitionVersionId?: string;
  readonly applicationDefinitionId?: string;
  readonly metadataVersion: number;
  readonly postingRules: readonly PostingRuleDefinition[];
}

export interface PostingMetadataReader {
  loadPostingMetadata(
    applicationId: string,
    metadataVersion: number
  ): Promise<PostingMetadataSnapshot>;
}
