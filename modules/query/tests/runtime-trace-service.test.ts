import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeTraceServiceV010 } from "../application/runtime-trace-service.js";

test("runtime trace service validates window and canonical application filters", async () => {
  const calls: Array<{
    enterpriseId: string;
    startAt: Date;
    endAt: Date;
    applicationIds?: string[];
  }> = [];
  const service = new RuntimeTraceServiceV010({
    async query(input) {
      calls.push(input);
      return [{
        contractVersion: "0.1.0",
        enterpriseId: input.enterpriseId,
        flowDefinitionId: "flow:o2c",
        flowInstanceId: "fi:1",
        flowInstanceKey: "SO-1",
        status: "ACTIVE",
        steps: [{
          applicationId: "sales-order",
          stepCode: "sales-order-approved",
          businessDataId: "bd:1",
          commandExecutionId: "cmd:1",
          occurredAt: "2026-09-29T01:00:00.000Z"
        }],
        startedAt: "2026-09-29T01:00:00.000Z"
      }];
    }
  });

  const result = await service.query({
    contractVersion: "0.1.0",
    enterpriseId: "enterprise:1",
    window: {
      startAt: "2026-09-29T00:00:00.000Z",
      endAt: "2026-09-29T02:00:00.000Z"
    },
    applicationIds: ["sales-order", "sales-order"]
  });

  assert.equal(result.length, 1);
  assert.deepEqual(calls[0]!.applicationIds, ["sales-order"]);
  await assert.rejects(
    service.query({
      contractVersion: "0.1.0",
      enterpriseId: "enterprise:1",
      window: {
        startAt: "2026-09-29T02:00:00.000Z",
        endAt: "2026-09-29T01:00:00.000Z"
      }
    }),
    /EVO_RUNTIME_TRACE_WINDOW_INVALID/
  );
});
