import type {
  PostingRuleDefinition
} from './contracts.js';

export interface PostingMetadataSnapshot {
  readonly applicationDefinitionVersionId: string;
  readonly applicationDefinitionId: string;
  readonly metadataVersion: number;
  readonly postingRules: readonly PostingRuleDefinition[];
}

export interface PostingMetadataReader {
  loadPostingMetadata(
    applicationDefinitionId: string,
    metadataVersion: number
  ): Promise<PostingMetadataSnapshot>;
}
