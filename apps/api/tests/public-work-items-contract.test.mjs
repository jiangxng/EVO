import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("public WorkItem boundary is formal, scoped, cache-validatable, and does not depend on demo dashboard", async () => {
  const source = await readFile(
    new URL("../../src/build-app.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /app\.get\('\/api\/v1\/work-items'/);
  assert.match(source, /enterprise_id query parameter is required/);
  assert.match(source, /WORK_ITEM_ACTOR_FILTER_INVALID/);
  assert.match(source, /WORK_ITEM_LIMIT_INVALID/);
  assert.match(source, /runtime\.work\.listOpen/);
  assert.match(source, /private, max-age=0, must-revalidate/);
  assert.match(source, /representationEtagV010\(body\)/);

  const publicBlock = source.slice(
    source.indexOf("app.get('/api/v1/work-items'"),
    source.indexOf("app.post('/api/v1/commands'")
  );
  assert.doesNotMatch(publicBlock, /demoIds/);
  assert.doesNotMatch(publicBlock, /selectFrom\('work_item'\)/);
});

test("WorkItem public view carries assignment and freshness metadata", async () => {
  const contract = await readFile(
    new URL("../../../../modules/workflow/api/contracts.ts", import.meta.url),
    "utf8"
  );

  for (const field of [
    "assignedActorType",
    "assignedActorId",
    "createdAt",
    "updatedAt"
  ]) {
    assert.match(contract, new RegExp("readonly " + field + ":"));
  }
});
