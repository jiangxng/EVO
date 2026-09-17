import type { PostingProcessResult } from './contracts.js';

export interface PostingProcessor {
  processNext(enterpriseId: string): Promise<PostingProcessResult>;
}
