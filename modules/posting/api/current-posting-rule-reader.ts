import type {
  PostingRuleDefinition
} from '../../metadata/api/contracts.js';

export interface CurrentPostingRuleReader {
  loadCurrentPostingRules(
    enterpriseId: string,
    applicationId: string
  ): Promise<readonly PostingRuleDefinition[]>;
}
