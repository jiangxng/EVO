import { sql, type Kysely } from 'kysely';
import type { Logger } from 'pino';
import type { Database } from '../../../platform/database/src/types.js';
import type { OutboxPublisher } from '../api/contracts.js';

export class LogOutboxPublisher implements OutboxPublisher {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly logger: Logger
  ) {}

  async publishBatch(limit = 100): Promise<number> {
    const rows = await this.db
      .selectFrom('outbox_event')
      .selectAll()
      .where('status', 'in', ['PENDING','FAILED'])
      .where('available_at', '<=', sql<Date>`now()`)
      .orderBy('created_at')
      .limit(limit)
      .execute();

    for (const row of rows) {
      this.logger.info({
        eventId: row.id,
        eventType: row.event_type,
        enterpriseId: row.enterprise_id,
        payload: row.payload
      }, 'EVO outbox event');

      await this.db.updateTable('outbox_event')
        .set({
          status: 'PUBLISHED',
          published_at: sql`now()`,
          attempts: row.attempts + 1
        })
        .where('id', '=', row.id)
        .execute();
    }
    return rows.length;
  }
}
