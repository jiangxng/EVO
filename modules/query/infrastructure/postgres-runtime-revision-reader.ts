import { sql, type Kysely } from "kysely";
import type { Database } from "../../../platform/database/src/types.js";
import type {
  EvoRuntimeRevisionComponentsV010,
  EvoRuntimeRevisionReaderV010
} from "../api/runtime-revision.js";

function count(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("EVO_RUNTIME_REVISION_COUNT_INVALID");
  }
  return parsed;
}

function iso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error("EVO_RUNTIME_REVISION_TIME_INVALID");
  }
  return date.toISOString();
}

export class PostgresRuntimeRevisionReaderV010
  implements EvoRuntimeRevisionReaderV010 {
  constructor(private readonly db: Kysely<Database>) {}

  async read(enterpriseId: string): Promise<EvoRuntimeRevisionComponentsV010> {
    const runtime = await this.db
      .selectFrom("enterprise_runtime_state")
      .select([
        "consistency_domain",
        "posting_mode",
        "replay_required",
        "next_posting_sequence",
        "last_posted_sequence",
        "updated_at"
      ])
      .where("enterprise_id", "=", enterpriseId)
      .executeTakeFirst();

    if (!runtime) throw new Error("EVO_RUNTIME_REVISION_ENTERPRISE_NOT_FOUND");

    const [trace, flow, statuses] = await Promise.all([
      this.db
        .selectFrom("flow_trace")
        .select(({ fn }) => [
          fn.countAll<number>().as("count"),
          sql<Date | null>`max(created_at)`.as("latest_created_at")
        ])
        .where("enterprise_id", "=", enterpriseId)
        .executeTakeFirstOrThrow(),
      this.db
        .selectFrom("flow_instance")
        .select(({ fn }) => [
          fn.countAll<number>().as("count"),
          sql<Date | null>`max(started_at)`.as("latest_started_at"),
          sql<Date | null>`max(completed_at)`.as("latest_completed_at")
        ])
        .where("enterprise_id", "=", enterpriseId)
        .executeTakeFirstOrThrow(),
      this.db
        .selectFrom("flow_instance")
        .select(["status", ({ fn }) => fn.countAll<number>().as("count")])
        .where("enterprise_id", "=", enterpriseId)
        .groupBy("status")
        .execute()
    ]);

    const statusCounts = new Map(
      statuses.map(row => [row.status, count(row.count)])
    );

    return {
      posting: {
        consistencyDomain: runtime.consistency_domain,
        postingMode: runtime.posting_mode,
        replayRequired: runtime.replay_required,
        nextPostingSequence: String(runtime.next_posting_sequence),
        lastPostedSequence: runtime.last_posted_sequence === null
          ? null
          : String(runtime.last_posted_sequence),
        updatedAt: iso(runtime.updated_at)!
      },
      flowTrace: {
        count: count(trace.count),
        latestCreatedAt: iso(trace.latest_created_at)
      },
      flowInstance: {
        count: count(flow.count),
        activeCount: statusCounts.get("ACTIVE") ?? 0,
        completedCount: statusCounts.get("COMPLETED") ?? 0,
        cancelledCount: statusCounts.get("CANCELLED") ?? 0,
        latestStartedAt: iso(flow.latest_started_at),
        latestCompletedAt: iso(flow.latest_completed_at)
      }
    };
  }
}
