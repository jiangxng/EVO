import { describe, expect, it } from "vitest";
import { RuntimeRevisionServiceV010 } from "../application/runtime-revision-service.js";

describe("RuntimeRevisionServiceV010", () => {
  it("returns one canonical revision snapshot for posting and flow evidence", async () => {
    const service = new RuntimeRevisionServiceV010({
      async read(enterpriseId) {
        expect(enterpriseId).toBe("enterprise-1");
        return {
          posting: {
            consistencyDomain: "enterprise",
            postingMode: "NORMAL",
            replayRequired: false,
            nextPostingSequence: "43",
            lastPostedSequence: "42",
            updatedAt: "2026-09-29T00:00:00.000Z"
          },
          flowTrace: {
            count: 3,
            latestCreatedAt: "2026-09-29T00:00:03.000Z"
          },
          flowInstance: {
            count: 1,
            activeCount: 0,
            completedCount: 1,
            cancelledCount: 0,
            latestStartedAt: "2026-09-29T00:00:01.000Z",
            latestCompletedAt: "2026-09-29T00:00:04.000Z"
          }
        };
      }
    });

    await expect(service.get("enterprise-1")).resolves.toEqual({
      contractVersion: "0.1.0",
      enterpriseId: "enterprise-1",
      components: {
        posting: {
          consistencyDomain: "enterprise",
          postingMode: "NORMAL",
          replayRequired: false,
          nextPostingSequence: "43",
          lastPostedSequence: "42",
          updatedAt: "2026-09-29T00:00:00.000Z"
        },
        flowTrace: {
          count: 3,
          latestCreatedAt: "2026-09-29T00:00:03.000Z"
        },
        flowInstance: {
          count: 1,
          activeCount: 0,
          completedCount: 1,
          cancelledCount: 0,
          latestStartedAt: "2026-09-29T00:00:01.000Z",
          latestCompletedAt: "2026-09-29T00:00:04.000Z"
        }
      }
    });
  });

  it("fails closed without enterprise scope", async () => {
    const service = new RuntimeRevisionServiceV010({
      async read() {
        throw new Error("should not read");
      }
    });
    await expect(service.get(" ")).rejects.toThrow(
      "EVO_RUNTIME_REVISION_ENTERPRISE_REQUIRED"
    );
  });
});
