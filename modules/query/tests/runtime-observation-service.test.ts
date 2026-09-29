import { describe, expect, it } from "vitest";
import {
  RuntimeObservationServiceV010
} from "../application/runtime-observation-service.js";

describe("RuntimeObservationServiceV010", () => {
  it("derives deterministic window flow, historical balance and event frequency", async () => {
    const seen: Array<{
      enterpriseId: string;
      ledgerCode: string;
      startAt: Date;
      endAt: Date;
    }> = [];
    const service = new RuntimeObservationServiceV010(
      {
        async observeLedger(input) {
          seen.push(input);
          return {
            windowEventCount: 12,
            windowQuantity: 45,
            windowQuantityUnit: "pcs",
            windowAmount: 900,
            windowAmountCurrency: "USD",
            balanceQuantityAtEnd: 180,
            balanceQuantityUnit: "pcs",
            balanceAmountAtEnd: 3600,
            balanceAmountCurrency: "USD"
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
      metricCodes: ["flow.wip"] as unknown as [
        "event.count"
      ]
    })).rejects.toThrow("EVO_RUNTIME_OBSERVATION_METRIC_UNSUPPORTED");
  });

  it("fails closed when a requested quantity or amount unit is not unambiguous", async () => {
    const service = new RuntimeObservationServiceV010({
      async observeLedger() {
        return {
          windowEventCount: 2,
          windowQuantity: 15,
          windowQuantityUnit: null,
          windowAmount: 180,
          windowAmountCurrency: null,
          balanceQuantityAtEnd: 15,
          balanceQuantityUnit: null,
          balanceAmountAtEnd: 180,
          balanceAmountCurrency: null
        };
      }
    });

    await expect(service.query({
      contractVersion: "0.1.0",
      enterpriseId: "enterprise:demo",
      target: {
        kind: "LEDGER_DEFINITION",
        code: "mixed"
      },
      window: {
        startAt: "2026-09-28T08:00:00.000Z",
        endAt: "2026-09-28T12:00:00.000Z"
      },
      metricCodes: ["balance.quantity"]
    })).rejects.toThrow("EVO_RUNTIME_OBSERVATION_QUANTITY_UNIT_UNAVAILABLE");

    await expect(service.query({
      contractVersion: "0.1.0",
      enterpriseId: "enterprise:demo",
      target: {
        kind: "LEDGER_DEFINITION",
        code: "mixed"
      },
      window: {
        startAt: "2026-09-28T08:00:00.000Z",
        endAt: "2026-09-28T12:00:00.000Z"
      },
      metricCodes: ["flow.net_amount"]
    })).rejects.toThrow("EVO_RUNTIME_OBSERVATION_AMOUNT_CURRENCY_UNAVAILABLE");
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
