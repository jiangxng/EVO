import type {
  EvoRuntimeTraceQueryV010,
  EvoRuntimeTraceReaderV010,
  EvoRuntimeTraceV010
} from "../api/runtime-traces.js";

function requiredText(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function instant(value: unknown, code: string): Date {
  const text = requiredText(value, code);
  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) throw new Error(code);
  return date;
}

export class RuntimeTraceServiceV010 {
  constructor(private readonly reader: EvoRuntimeTraceReaderV010) {}

  async query(request: EvoRuntimeTraceQueryV010): Promise<EvoRuntimeTraceV010[]> {
    if (request?.contractVersion !== "0.1.0") {
      throw new Error("EVO_RUNTIME_TRACE_VERSION_UNSUPPORTED");
    }
    const enterpriseId = requiredText(
      request.enterpriseId,
      "EVO_RUNTIME_TRACE_ENTERPRISE_REQUIRED"
    );
    const startAt = instant(
      request.window?.startAt,
      "EVO_RUNTIME_TRACE_WINDOW_INVALID"
    );
    const endAt = instant(
      request.window?.endAt,
      "EVO_RUNTIME_TRACE_WINDOW_INVALID"
    );
    if (startAt.getTime() >= endAt.getTime()) {
      throw new Error("EVO_RUNTIME_TRACE_WINDOW_INVALID");
    }

    let applicationIds: string[] | undefined;
    if (request.applicationIds !== undefined) {
      if (!Array.isArray(request.applicationIds)) {
        throw new Error("EVO_RUNTIME_TRACE_APPLICATION_FILTER_INVALID");
      }
      applicationIds = [...new Set(
        request.applicationIds.map(value =>
          requiredText(value, "EVO_RUNTIME_TRACE_APPLICATION_FILTER_INVALID")
        )
      )].sort();
    }

    return this.reader.query({
      enterpriseId,
      startAt,
      endAt,
      ...(applicationIds?.length ? { applicationIds } : {})
    });
  }
}
