import { describe, expect, it } from "vitest";
import {
  ifNoneMatchSatisfiedV010,
  representationEtagV010
} from "../src/conditional-http.js";

describe("conditional HTTP helpers", () => {
  it("accepts weak If-None-Match for a strong current validator", () => {
    const etag = representationEtagV010({ revision: 7 });
    expect(ifNoneMatchSatisfiedV010("W/" + etag, etag)).toBe(true);
  });

  it("accepts validators from a comma-separated list", () => {
    const etag = representationEtagV010({ revision: 7 });
    expect(ifNoneMatchSatisfiedV010('"old", W/' + etag, etag)).toBe(true);
  });

  it("rejects a different representation", () => {
    expect(
      ifNoneMatchSatisfiedV010(
        representationEtagV010({ revision: 6 }),
        representationEtagV010({ revision: 7 })
      )
    ).toBe(false);
  });
});
