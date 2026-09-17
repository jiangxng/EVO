export interface OutboxPublisher {
  publishBatch(limit?: number): Promise<number>;
}
