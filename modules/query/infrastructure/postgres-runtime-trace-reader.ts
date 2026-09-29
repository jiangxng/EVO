import type { Kysely } from "kysely";
import type { Database } from "../../../platform/database/src/types.js";
import type {
  EvoRuntimeTraceReaderV010,
  EvoRuntimeTraceV010
} from "../api/runtime-traces.js";

interface Row {
  flow_definition_id: string;
  flow_instance_id: string;
  instance_key: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  started_at: Date;
  completed_at: Date | null;
  business_data_id: string;
  command_execution_id: string;
  step_code: string;
  effective_at: Date;
  application_config: Record<string, unknown>;
}

export class PostgresRuntimeTraceReaderV010
  implements EvoRuntimeTraceReaderV010 {
  constructor(private readonly db: Kysely<Database>) {}

  async query(input: {
    enterpriseId: string;
    startAt: Date;
    endAt: Date;
    applicationIds?: string[];
  }): Promise<EvoRuntimeTraceV010[]> {
    const rows = await this.db
      .selectFrom("flow_trace as t")
      .innerJoin("flow_instance as i", "i.id", "t.flow_instance_id")
      .innerJoin("business_data as b", "b.id", "t.business_data_id")
      .innerJoin("application_instance as a", "a.id", "b.application_instance_id")
      .select([
        "t.flow_definition_id",
        "t.flow_instance_id",
        "i.instance_key",
        "i.status",
        "i.started_at",
        "i.completed_at",
        "t.business_data_id",
        "t.command_execution_id",
        "t.step_code",
        "b.effective_at",
        "a.config as application_config"
      ])
      .where("t.enterprise_id", "=", input.enterpriseId)
      .where("b.effective_at", ">=", input.startAt)
      .where("b.effective_at", "<", input.endAt)
      .orderBy("t.flow_instance_id", "asc")
      .orderBy("b.effective_at", "asc")
      .orderBy("t.id", "asc")
      .execute() as unknown as Row[];

    const grouped = new Map<string, EvoRuntimeTraceV010>();
    for (const row of rows) {
      const sourceApplicationId = row.application_config["sourceApplicationId"];
      if (typeof sourceApplicationId !== "string" || !sourceApplicationId.trim()) {
        throw new Error("EVO_RUNTIME_TRACE_APPLICATION_ANCHOR_REQUIRED");
      }
      const applicationId = sourceApplicationId.trim();
      if (
        input.applicationIds?.length
        && !input.applicationIds.includes(applicationId)
      ) {
        continue;
      }

      let trace = grouped.get(row.flow_instance_id);
      if (!trace) {
        trace = {
          contractVersion: "0.1.0",
          enterpriseId: input.enterpriseId,
          flowDefinitionId: row.flow_definition_id,
          flowInstanceId: row.flow_instance_id,
          flowInstanceKey: row.instance_key,
          status: row.status,
          steps: [],
          startedAt: row.started_at.toISOString(),
          ...(row.completed_at
            ? { completedAt: row.completed_at.toISOString() }
            : {})
        };
        grouped.set(row.flow_instance_id, trace);
      }

      trace.steps.push({
        applicationId,
        stepCode: row.step_code,
        businessDataId: row.business_data_id,
        commandExecutionId: row.command_execution_id,
        occurredAt: row.effective_at.toISOString()
      });
    }

    return [...grouped.values()]
      .filter(trace => trace.steps.length > 0)
      .sort((a, b) =>
        a.startedAt.localeCompare(b.startedAt)
        || a.flowInstanceId.localeCompare(b.flowInstanceId)
      );
  }
}
