import {
  EVO_RUNTIME_OBSERVATION_METRICS_V010,
  type EvoRuntimeObservationMetricCodeV010,
  type EvoRuntimeObservationQueryV010,
  type EvoRuntimeObservationReaderV010,
  type EvoRuntimeObservationV010
} from "../api/runtime-observations.js";

function requiredText(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function parseInstant(value: unknown, code: string): Date {
  if (typeof value !== "string") throw new Error(code);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(code);
  return date;
}

function validateMetricCodes(
  values: readonly unknown[]
): EvoRuntimeObservationMetricCodeV010[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("EVO_RUNTIME_OBSERVATION_METRICS_REQUIRED");
  }
  const supported = new Set<string>(EVO_RUNTIME_OBSERVATION_METRICS_V010);
  const result: EvoRuntimeObservationMetricCodeV010[] = [];
  for (const value of values) {
    if (typeof value !== "string" || !supported.has(value)) {
      throw new Error("EVO_RUNTIME_OBSERVATION_METRIC_UNSUPPORTED");
    }
    if (!result.includes(value as EvoRuntimeObservationMetricCodeV010)) {
      result.push(value as EvoRuntimeObservationMetricCodeV010);
    }
  }
  return result;
}

export class RuntimeObservationServiceV010 {
  constructor(
    private readonly reader: EvoRuntimeObservationReaderV010,
    private readonly now: () => Date = () => new Date()
  ) {}

  async query(
    request: EvoRuntimeObservationQueryV010
  ): Promise<EvoRuntimeObservationV010[]> {
    if (request?.contractVersion !== "0.1.0") {
      throw new Error("EVO_RUNTIME_OBSERVATION_VERSION_UNSUPPORTED");
    }
    const enterpriseId = requiredText(
      request.enterpriseId,
      "EVO_RUNTIME_OBSERVATION_ENTERPRISE_REQUIRED"
    );
    if (
      request.target?.kind !== "LEDGER_DEFINITION"
      || typeof request.target.code !== "string"
      || !request.target.code.trim()
    ) {
      throw new Error("EVO_RUNTIME_OBSERVATION_TARGET_INVALID");
    }
    const ledgerCode = request.target.code.trim();
    const startAt = parseInstant(
      request.window?.startAt,
      "EVO_RUNTIME_OBSERVATION_WINDOW_INVALID"
    );
    const endAt = parseInstant(
      request.window?.endAt,
      "EVO_RUNTIME_OBSERVATION_WINDOW_INVALID"
    );
    if (startAt.getTime() >= endAt.getTime()) {
      throw new Error("EVO_RUNTIME_OBSERVATION_WINDOW_INVALID");
    }
    const metricCodes = validateMetricCodes(request.metricCodes);
    const aggregate = await this.reader.observeLedger({
      enterpriseId,
      ledgerCode,
      startAt,
      endAt
    });
    for (const value of [
      aggregate.windowEventCount,
      aggregate.windowQuantity,
      aggregate.windowAmount,
      aggregate.balanceQuantityAtEnd,
      aggregate.balanceAmountAtEnd
    ]) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error("EVO_RUNTIME_OBSERVATION_READER_INVALID");
      }
    }
    if (aggregate.windowEventCount < 0) {
      throw new Error("EVO_RUNTIME_OBSERVATION_READER_INVALID");
    }

    const durationHours = (endAt.getTime() - startAt.getTime()) / 3_600_000;
    const observedAt = this.now().toISOString();
    const window = {
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString()
    };
    const source = {
      kind: "EVO_LEDGER_RUNTIME" as const,
      ref: "ledger:" + ledgerCode
    };

    const make = (
      metricCode: EvoRuntimeObservationMetricCodeV010,
      kind: EvoRuntimeObservationV010["kind"],
      unit: string,
      value: number,
      sampleCount?: number
    ): EvoRuntimeObservationV010 => ({
      contractVersion: "0.1.0",
      enterpriseId,
      target: {
        kind: "LEDGER_DEFINITION",
        code: ledgerCode
      },
      metricCode,
      kind,
      unit,
      value,
      ...(sampleCount === undefined ? {} : { sampleCount }),
      window,
      observedAt,
      source
    });

    return metricCodes.map(code => {
      switch (code) {
        case "event.count":
          return make(
            code,
            "COUNT",
            "events",
            aggregate.windowEventCount,
            aggregate.windowEventCount
          );
        case "event.frequency":
          return make(
            code,
            "RATE",
            "events/hour",
            aggregate.windowEventCount / durationHours,
            aggregate.windowEventCount
          );
        case "flow.net_quantity":
          if (!aggregate.windowQuantityUnit) {
            throw new Error("EVO_RUNTIME_OBSERVATION_QUANTITY_UNIT_UNAVAILABLE");
          }
          return make(
            code,
            "QUANTITY",
            aggregate.windowQuantityUnit,
            aggregate.windowQuantity,
            aggregate.windowEventCount
          );
        case "flow.net_amount":
          if (!aggregate.windowAmountCurrency) {
            throw new Error("EVO_RUNTIME_OBSERVATION_AMOUNT_CURRENCY_UNAVAILABLE");
          }
          return make(
            code,
            "AMOUNT",
            aggregate.windowAmountCurrency,
            aggregate.windowAmount,
            aggregate.windowEventCount
          );
        case "balance.quantity":
          if (!aggregate.balanceQuantityUnit) {
            throw new Error("EVO_RUNTIME_OBSERVATION_QUANTITY_UNIT_UNAVAILABLE");
          }
          return make(
            code,
            "QUANTITY",
            aggregate.balanceQuantityUnit,
            aggregate.balanceQuantityAtEnd
          );
        case "balance.amount":
          if (!aggregate.balanceAmountCurrency) {
            throw new Error("EVO_RUNTIME_OBSERVATION_AMOUNT_CURRENCY_UNAVAILABLE");
          }
          return make(
            code,
            "AMOUNT",
            aggregate.balanceAmountCurrency,
            aggregate.balanceAmountAtEnd
          );
      }
    });
  }
}
