export const EVO_RUNTIME_OBSERVATION_VERSION_V010 = "0.1.0" as const;

export const EVO_RUNTIME_OBSERVATION_METRICS_V010 = [
  "event.count",
  "event.frequency",
  "flow.net_quantity",
  "flow.net_amount",
  "balance.quantity",
  "balance.amount"
] as const;

export type EvoRuntimeObservationMetricCodeV010 =
  typeof EVO_RUNTIME_OBSERVATION_METRICS_V010[number];

export interface EvoRuntimeObservationWindowV010 {
  startAt: string;
  endAt: string;
}

export interface EvoRuntimeObservationTargetV010 {
  kind: "LEDGER_DEFINITION";
  code: string;
}

export interface EvoRuntimeObservationQueryV010 {
  contractVersion: typeof EVO_RUNTIME_OBSERVATION_VERSION_V010;
  enterpriseId: string;
  target: EvoRuntimeObservationTargetV010;
  window: EvoRuntimeObservationWindowV010;
  metricCodes: EvoRuntimeObservationMetricCodeV010[];
}

export interface EvoRuntimeObservationV010 {
  contractVersion: typeof EVO_RUNTIME_OBSERVATION_VERSION_V010;
  enterpriseId: string;
  target: EvoRuntimeObservationTargetV010;
  metricCode: EvoRuntimeObservationMetricCodeV010;
  kind: "COUNT" | "QUANTITY" | "AMOUNT" | "RATE";
  unit: string;
  value: number;
  sampleCount?: number;
  window: EvoRuntimeObservationWindowV010;
  observedAt: string;
  source: {
    kind: "EVO_LEDGER_RUNTIME";
    ref: string;
  };
}

export interface EvoLedgerObservationAggregateV010 {
  windowEventCount: number;
  windowQuantity: number;
  windowQuantityUnit: string | null;
  windowAmount: number;
  windowAmountCurrency: string | null;
  balanceQuantityAtEnd: number;
  balanceQuantityUnit: string | null;
  balanceAmountAtEnd: number;
  balanceAmountCurrency: string | null;
}

export interface EvoRuntimeObservationReaderV010 {
  observeLedger(input: {
    enterpriseId: string;
    ledgerCode: string;
    startAt: Date;
    endAt: Date;
  }): Promise<EvoLedgerObservationAggregateV010>;
}
