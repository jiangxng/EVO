import { createHash } from "node:crypto";

export function representationEtagV010(value: unknown): string {
  const serialized = JSON.stringify(value);
  return "\"" + createHash("sha256").update(serialized).digest("base64url") + "\"";
}

function weakTagValue(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("W/") ? trimmed.slice(2).trim() : trimmed;
}

export function ifNoneMatchSatisfiedV010(
  header: string | string[] | undefined,
  etag: string
): boolean {
  if (header === undefined) return false;
  const values = Array.isArray(header) ? header : [header];
  return values
    .flatMap(value => value.split(","))
    .map(value => value.trim())
    .some(value => value === "*" || weakTagValue(value) === weakTagValue(etag));
}
