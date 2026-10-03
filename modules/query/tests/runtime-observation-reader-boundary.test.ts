import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("PostgresRuntimeObservationReaderV010 ApplicationAnchor boundary", () => {
  it("observes canonical applicationId without compatibility ApplicationInstance lookup", async () => {
    const source = await readFile(
      new URL(
        "../infrastructure/postgres-runtime-observation-reader.ts",
        import.meta.url
      ),
      "utf8"
    );

    expect(source).toContain('.selectFrom("application_anchor")');
    expect(source).toContain('.where("application_id", "=", input.applicationId)');
    expect(source).toContain('.selectFrom("business_data")');
    expect(source).toContain('.where("application_id", "=", anchor.application_id)');
    expect(source).not.toContain('row.config["sourceApplicationId"]');
    expect(source).not.toContain(
      '.where("application_instance_id", "=", match.id)'
    );
  });
});
