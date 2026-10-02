import type {
  PostingRuleDefinition
} from '../../metadata/api/contracts.js';

export interface CurrentPostingRuleReader {
  loadCurrentPostingRules(
    applicationId: string
  ): Promise<readonly PostingRuleDefinition[]>;
}
