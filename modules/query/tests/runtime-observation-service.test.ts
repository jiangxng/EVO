import { describe, expect, it } from "vitest";
import {
  RuntimeObservationServiceV010
} from "../application/runtime-observation-service.js";

describe("RuntimeObservationServiceV010", () => {
  it("derives deterministic window flow, historical balance and event frequency", async () => {
    const seen = [];
    const service = new RuntimeObservationServiceV010(
      {
        async observeLedger(input) {
          seen.push(input);
          return {
            windowEventCount: 12,
            windowQuantity: 45,
            windowAmount: 900,
            balanceQuantityAtEnd: 180,
            balanceAmountAtEnd: 3600
          };
        }
      },
      () => new Date("2026-09-29T00:00:00.000Z")
    );

    const result = await service.query({
      contractVersion: "0.1.0",
      enterpriseId: "enterprise:demo",
      target: {
        kind: "LEDGER_DEFINITION",
        code: "pending-production"
      },
      window: {
        startAt: "2026-09-28T08:00:00.000Z",
        endAt: "2026-09-28T12:00:00.000Z"
      },
      metricCodes: [
        "event.count",
        "event.frequency",
        "flow.net_quantity",
        "balance.quantity"
      ]
    });

    expect(seen).toHaveLength(1);
    expect(result.map(item => [item.metricCode, item.value])).toEqual([
      ["event.count", 12],
      ["event.frequency", 3],
      ["flow.net_quantity", 45],
      ["balance.quantity", 180]
    ]);
    expect(result.every(item =>
      item.window.endAt === "2026-09-28T12:00:00.000Z"
    )).toBe(true);
  });

  it("fails closed on unsupported metrics instead of inventing semantics", async () => {
    const service = new RuntimeObservationServiceV010({
      async observeLedger() {
        throw new Error("should not run");
      }
    });

    await expect(service.query({
      contractVersion: "0.1.0",
      enterpriseId: "enterprise:demo",
      target: {
        kind: "LEDGER_DEFINITION",
        code: "pending-production"
      },
      window: {
        startAt: "2026-09-28T08:00:00.000Z",
        endAt: "2026-09-28T12:00:00.000Z"
      },
      metricCodes: ["flow.wip"]
    })).rejects.toThrow("EVO_RUNTIME_OBSERVATION_METRIC_UNSUPPORTED");
  });

  it("rejects zero or negative time windows", async () => {
    const service = new RuntimeObservationServiceV010({
      async observeLedger() {
        throw new Error("should not run");
      }
    });

    await expect(service.query({
      contractVersion: "0.1.0",
      enterpriseId: "enterprise:demo",
      target: {
        kind: "LEDGER_DEFINITION",
        code: "pending-production"
      },
      window: {
        startAt: "2026-09-28T12:00:00.000Z",
        endAt: "2026-09-28T12:00:00.000Z"
      },
      metricCodes: ["event.count"]
    })).rejects.toThrow("EVO_RUNTIME_OBSERVATION_WINDOW_INVALID");
  });
});
