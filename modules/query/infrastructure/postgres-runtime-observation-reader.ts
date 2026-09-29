import { sql, type Kysely } from "kysely";
import type { Database } from "../../../platform/database/src/types.js";
import type {
  EvoApplicationObservationAggregateV010,
  EvoLedgerObservationAggregateV010,
  EvoRuntimeObservationReaderV010
} from "../api/runtime-observations.js";

function numeric(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("EVO_RUNTIME_OBSERVATION_NUMERIC_INVALID");
  }
  return parsed;
}

function singleObservedText(
  rows: readonly { value: string | null }[],
  mixedCode: string
): string | null {
  const values = [...new Set(
    rows
      .map(row => row.value?.trim())
      .filter((value): value is string => Boolean(value))
  )];
  if (values.length > 1) throw new Error(mixedCode);
  return values[0] ?? null;
}

export class PostgresRuntimeObservationReaderV010
  implements EvoRuntimeObservationReaderV010 {
  constructor(private readonly db: Kysely<Database>) {}

  private async activeLedgerDatasetId(
    enterpriseId: string
  ): Promise<{ consistencyDomain: string; ledgerDatasetId: string }> {
    const runtime = await this.db
      .selectFrom("enterprise_runtime_state")
      .select("consistency_domain")
      .where("enterprise_id", "=", enterpriseId)
      .executeTakeFirstOrThrow();

    const current = await this.db
      .selectFrom("economic_runtime_dataset")
      .select(["id", "kind", "parent_dataset_id"])
      .where("enterprise_id", "=", enterpriseId)
      .where("consistency_domain", "=", runtime.consistency_domain)
      .where("status", "=", "ACTIVE")
      .executeTakeFirst();

    if (current !== undefined && current.kind !== "CURRENT") {
      throw new Error("EVO_RUNTIME_OBSERVATION_CURRENT_DATASET_REQUIRED");
    }

    const linked = current === undefined
      ? undefined
      : await this.db
        .selectFrom("ledger_dataset")
        .select("id")
        .where("enterprise_id", "=", enterpriseId)
        .where("consistency_domain", "=", runtime.consistency_domain)
        .where("economic_runtime_dataset_id", "=", current.id)
        .where("kind", "=", "CURRENT")
        .where("status", "=", "ACTIVE")
        .executeTakeFirst();

    const ledgerDatasetId = linked?.id ?? (
      current === undefined || current.parent_dataset_id === null
        ? (
            await this.db
              .selectFrom("ledger_dataset")
              .select("id")
              .where("enterprise_id", "=", enterpriseId)
              .where("consistency_domain", "=", runtime.consistency_domain)
              .where("economic_runtime_dataset_id", "is", null)
              .where("kind", "=", "CURRENT")
              .where("status", "=", "ACTIVE")
              .executeTakeFirstOrThrow()
          ).id
        : (() => {
            throw new Error(
              "EVO_RUNTIME_OBSERVATION_LEDGER_DATASET_REQUIRED"
            );
          })()
    );

    return {
      consistencyDomain: runtime.consistency_domain,
      ledgerDatasetId
    };
  }

  async observeApplication(input: {
    enterpriseId: string;
    applicationId: string;
    startAt: Date;
    endAt: Date;
  }): Promise<EvoApplicationObservationAggregateV010> {
    const candidates = await this.db
      .selectFrom("application_instance")
      .select(["id", "config"])
      .where("enterprise_id", "=", input.enterpriseId)
      .where("status", "=", "ACTIVE")
      .execute();

    const matches = candidates.filter(row => {
      const value = row.config["sourceApplicationId"];
      return typeof value === "string"
        && value === input.applicationId;
    });
    if (matches.length === 0) {
      throw new Error("EVO_RUNTIME_OBSERVATION_APPLICATION_NOT_FOUND");
    }
    if (matches.length > 1) {
      throw new Error("EVO_RUNTIME_OBSERVATION_APPLICATION_AMBIGUOUS");
    }

    const window = await this.db
      .selectFrom("business_data")
      .select(({ fn }) => [
        fn.countAll<number>().as("event_count")
      ])
      .where("enterprise_id", "=", input.enterpriseId)
      .where("application_instance_id", "=", matches[0].id)
      .where("effective_at", ">=", input.startAt)
      .where("effective_at", "<", input.endAt)
      .executeTakeFirstOrThrow();

    return {
      windowEventCount: numeric(window.event_count)
    };
  }

  async observeLedger(input: {
    enterpriseId: string;
    ledgerCode: string;
    startAt: Date;
    endAt: Date;
  }): Promise<EvoLedgerObservationAggregateV010> {
    const dataset = await this.activeLedgerDatasetId(input.enterpriseId);
    const definition = await this.db
      .selectFrom("ledger_definition")
      .select("id")
      .where("code", "=", input.ledgerCode)
      .executeTakeFirst();

    if (!definition) {
      throw new Error("EVO_RUNTIME_OBSERVATION_LEDGER_NOT_FOUND");
    }

    const window = await this.db
      .selectFrom("ledger_entry")
      .select(({ fn }) => [
        fn.countAll<number>().as("event_count"),
        fn.coalesce(fn.sum("quantity"), sql<string>`0`).as("quantity_sum"),
        fn.coalesce(fn.sum("amount"), sql<string>`0`).as("amount_sum")
      ])
      .where("enterprise_id", "=", input.enterpriseId)
      .where("consistency_domain", "=", dataset.consistencyDomain)
      .where("ledger_dataset_id", "=", dataset.ledgerDatasetId)
      .where("ledger_definition_id", "=", definition.id)
      .where("effective_at", ">=", input.startAt)
      .where("effective_at", "<", input.endAt)
      .executeTakeFirstOrThrow();

    const balance = await this.db
      .selectFrom("ledger_entry")
      .select(({ fn }) => [
        fn.coalesce(fn.sum("quantity"), sql<string>`0`).as("quantity_sum"),
        fn.coalesce(fn.sum("amount"), sql<string>`0`).as("amount_sum")
      ])
      .where("enterprise_id", "=", input.enterpriseId)
      .where("consistency_domain", "=", dataset.consistencyDomain)
      .where("ledger_dataset_id", "=", dataset.ledgerDatasetId)
      .where("ledger_definition_id", "=", definition.id)
      .where("effective_at", "<", input.endAt)
      .executeTakeFirstOrThrow();

    const windowQuantityUnits = await this.db
      .selectFrom("ledger_entry")
      .select("unit as value")
      .distinct()
      .where("enterprise_id", "=", input.enterpriseId)
      .where("consistency_domain", "=", dataset.consistencyDomain)
      .where("ledger_dataset_id", "=", dataset.ledgerDatasetId)
      .where("ledger_definition_id", "=", definition.id)
      .where("effective_at", ">=", input.startAt)
      .where("effective_at", "<", input.endAt)
      .where("quantity", "is not", null)
      .execute();

    const windowAmountCurrencies = await this.db
      .selectFrom("ledger_entry")
      .select("currency as value")
      .distinct()
      .where("enterprise_id", "=", input.enterpriseId)
      .where("consistency_domain", "=", dataset.consistencyDomain)
      .where("ledger_dataset_id", "=", dataset.ledgerDatasetId)
      .where("ledger_definition_id", "=", definition.id)
      .where("effective_at", ">=", input.startAt)
      .where("effective_at", "<", input.endAt)
      .where("amount", "is not", null)
      .execute();

    const balanceQuantityUnits = await this.db
      .selectFrom("ledger_entry")
      .select("unit as value")
      .distinct()
      .where("enterprise_id", "=", input.enterpriseId)
      .where("consistency_domain", "=", dataset.consistencyDomain)
      .where("ledger_dataset_id", "=", dataset.ledgerDatasetId)
      .where("ledger_definition_id", "=", definition.id)
      .where("effective_at", "<", input.endAt)
      .where("quantity", "is not", null)
      .execute();

    const balanceAmountCurrencies = await this.db
      .selectFrom("ledger_entry")
      .select("currency as value")
      .distinct()
      .where("enterprise_id", "=", input.enterpriseId)
      .where("consistency_domain", "=", dataset.consistencyDomain)
      .where("ledger_dataset_id", "=", dataset.ledgerDatasetId)
      .where("ledger_definition_id", "=", definition.id)
      .where("effective_at", "<", input.endAt)
      .where("amount", "is not", null)
      .execute();

    return {
      windowEventCount: numeric(window.event_count),
      windowQuantity: numeric(window.quantity_sum),
      windowQuantityUnit: singleObservedText(
        windowQuantityUnits,
        "EVO_RUNTIME_OBSERVATION_MIXED_QUANTITY_UNITS"
      ),
      windowAmount: numeric(window.amount_sum),
      windowAmountCurrency: singleObservedText(
        windowAmountCurrencies,
        "EVO_RUNTIME_OBSERVATION_MIXED_AMOUNT_CURRENCIES"
      ),
      balanceQuantityAtEnd: numeric(balance.quantity_sum),
      balanceQuantityUnit: singleObservedText(
        balanceQuantityUnits,
        "EVO_RUNTIME_OBSERVATION_MIXED_QUANTITY_UNITS"
      ),
      balanceAmountAtEnd: numeric(balance.amount_sum),
      balanceAmountCurrency: singleObservedText(
        balanceAmountCurrencies,
        "EVO_RUNTIME_OBSERVATION_MIXED_AMOUNT_CURRENCIES"
      )
    };
  }
}
