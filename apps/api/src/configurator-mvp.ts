import { createHash } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject, JsonValue } from '../../../modules/metadata/api/contracts.js';
import { drainPosting } from './evo-runtime.js';

type Direction = 'DEBIT' | 'CREDIT' | 'ADD' | 'SUB';

interface CompiledRule {
  sourceId: number;
  applicationId: string;
  ledgerId: number;
  ledgerTitle: string | null;
  direction: Direction;
  conditionAst: JsonObject;
  quantityAst: JsonObject | null;
  amountAst: JsonObject | null;
  source: string;
}

export interface ConfiguratorBurnBody {
  contractVersion: '0.1.0';
  kind: 'evo.ledger-runtime.compiled-configuration';
  sourceDialect: 'bookkeeping-aviator-v1';
  configurationId: string;
  semanticDigest: string;
  accounts: Array<{ id: number; title: string; isFinance: boolean }>;
  applications: Array<{ applicationId: string; title: string }>;
  rules: CompiledRule[];
  compiler: {
    expressionIrVersion: number;
    uniqueExpressionCount: number;
    compiledExpressionCount: number;
    builtinNames: string[];
  };
}

export interface ConfiguratorSubmitBody {
  applicationId: string;
  payload: JsonObject;
  businessObjectKey?: string;
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}

function appCode(applicationId: string): string {
  return `cfg_app_${shortHash(applicationId)}`;
}

function txCode(applicationId: string): string {
  return `cfg_tx_${shortHash(applicationId)}`;
}

function instanceCode(applicationId: string): string {
  return `cfg_${shortHash(applicationId)}`;
}

function ledgerCode(ledgerId: number): string {
  return `legacy_${ledgerId}`;
}

function asJsonObject(value: unknown): JsonObject {
  return value as JsonObject;
}

export async function burnConfiguratorConfiguration(
  db: Kysely<Database>,
  input: ConfiguratorBurnBody
) {
  if (
    input.contractVersion !== '0.1.0'
    || input.kind !== 'evo.ledger-runtime.compiled-configuration'
    || input.compiler.expressionIrVersion !== 1
  ) {
    throw new Error('Unsupported compiled Ledger Runtime configuration.');
  }

  return db.transaction().execute(async (trx) => {
    const enterprise = await trx
      .insertInto('enterprise')
      .values({
        code: 'EVO_CONFIG_MVP',
        name: 'EVO Configurator MVP',
        status: 'ACTIVE',
        default_timezone: 'UTC'
      })
      .onConflict((oc) => oc.column('code').doUpdateSet({
        name: 'EVO Configurator MVP',
        status: 'ACTIVE'
      }))
      .returning('id')
      .executeTakeFirstOrThrow();

    await trx
      .insertInto('enterprise_runtime_state')
      .values({
        enterprise_id: enterprise.id,
        consistency_domain: 'enterprise',
        posting_mode: 'NORMAL',
        replay_required: false,
        next_posting_sequence: 1n,
        last_posted_effective_at: null,
        last_posted_priority: null,
        last_posted_sequence: null,
        active_replay_run_id: null
      })
      .onConflict((oc) => oc.column('enterprise_id').doNothing())
      .execute();

    const domain = await trx
      .insertInto('domain_definition')
      .values({
        code: 'configurator_mvp',
        name: 'Configurator MVP',
        description: 'Railway MVP bridge for compiled Ledger Runtime configuration.'
      })
      .onConflict((oc) => oc.column('code').doUpdateSet({ name: 'Configurator MVP' }))
      .returning('id')
      .executeTakeFirstOrThrow();

    for (const account of input.accounts) {
      await trx
        .insertInto('ledger_definition')
        .values({
          code: ledgerCode(account.id),
          name: account.title,
          quantity_semantics: 'LEGACY_CONFIGURED',
          amount_semantics: account.isFinance ? 'FINANCIAL_AMOUNT' : 'BUSINESS_AMOUNT',
          dimension_schema: {},
          config: {
            source: 'bookkeeping-aviator-v1',
            legacyLedgerId: account.id,
            isFinance: account.isFinance
          }
        })
        .onConflict((oc) => oc.column('code').doUpdateSet({
          name: account.title,
          quantity_semantics: 'LEGACY_CONFIGURED',
          amount_semantics: account.isFinance ? 'FINANCIAL_AMOUNT' : 'BUSINESS_AMOUNT',
          dimension_schema: {},
          config: {
            source: 'bookkeeping-aviator-v1',
            legacyLedgerId: account.id,
            isFinance: account.isFinance
          }
        }))
        .execute();
    }

    const versionByApplication = new Map<string, string>();
    const instanceByApplication = new Map<string, string>();

    for (const app of input.applications) {
      const transactionType = await trx
        .insertInto('transaction_type')
        .values({
          domain_id: domain.id,
          code: txCode(app.applicationId),
          name: app.title,
          description: 'Configurator imported transaction type'
        })
        .onConflict((oc) => oc.column('code').doUpdateSet({ name: app.title }))
        .returning('id')
        .executeTakeFirstOrThrow();

      const application = await trx
        .insertInto('application_definition')
        .values({
          transaction_type_id: transactionType.id,
          code: appCode(app.applicationId),
          name: app.title,
          description: `Imported applicationId ${app.applicationId}`
        })
        .onConflict((oc) => oc.column('code').doUpdateSet({
          transaction_type_id: transactionType.id,
          name: app.title
        }))
        .returning('id')
        .executeTakeFirstOrThrow();

      const version = await trx
        .insertInto('application_definition_version')
        .values({
          application_definition_id: application.id,
          version: 1,
          status: 'PUBLISHED',
          schema_version: 1,
          base_config: {
            sourceApplicationId: app.applicationId,
            configurationId: input.configurationId,
            semanticDigest: input.semanticDigest
          },
          definition_hash: input.semanticDigest,
          published_at: sql`now()`
        })
        .onConflict((oc) => oc.columns(['application_definition_id', 'version']).doUpdateSet({
          status: 'PUBLISHED',
          base_config: {
            sourceApplicationId: app.applicationId,
            configurationId: input.configurationId,
            semanticDigest: input.semanticDigest
          },
          definition_hash: input.semanticDigest,
          published_at: sql`now()`
        }))
        .returning('id')
        .executeTakeFirstOrThrow();

      const instance = await trx
        .insertInto('application_instance')
        .values({
          enterprise_id: enterprise.id,
          application_definition_id: application.id,
          code: instanceCode(app.applicationId),
          name: app.title,
          pinned_definition_version: 1,
          status: 'ACTIVE',
          config: { sourceApplicationId: app.applicationId }
        })
        .onConflict((oc) => oc.columns(['enterprise_id', 'code']).doUpdateSet({
          application_definition_id: application.id,
          name: app.title,
          pinned_definition_version: 1,
          status: 'ACTIVE',
          config: { sourceApplicationId: app.applicationId }
        }))
        .returning('id')
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('command_definition')
        .values({
          application_definition_version_id: version.id,
          code: 'submit',
          name: 'Submit Configurator BusinessData',
          input_schema: { type: 'object' },
          preconditions: [],
          execution_policy: {},
          resulting_business_data_type: `configurator.${shortHash(app.applicationId)}`,
          config: { sourceApplicationId: app.applicationId }
        })
        .onConflict((oc) => oc.columns(['application_definition_version_id', 'code']).doUpdateSet({
          name: 'Submit Configurator BusinessData',
          input_schema: { type: 'object' },
          resulting_business_data_type: `configurator.${shortHash(app.applicationId)}`
        }))
        .execute();

      versionByApplication.set(app.applicationId, version.id);
      instanceByApplication.set(app.applicationId, instance.id);
    }

    for (const versionId of versionByApplication.values()) {
      await trx.deleteFrom('posting_rule')
        .where('application_definition_version_id', '=', versionId)
        .execute();
    }

    let installedRules = 0;
    for (const rule of input.rules) {
      const versionId = versionByApplication.get(rule.applicationId);
      if (versionId === undefined) {
        throw new Error(`Rule ${rule.sourceId} references unknown applicationId ${rule.applicationId}.`);
      }
      const effect: Record<string, JsonValue> = {
        ledgerCode: ledgerCode(rule.ledgerId),
        direction: rule.direction,
        dimensions: {}
      };
      if (rule.quantityAst !== null) effect.quantity = rule.quantityAst;
      if (rule.amountAst !== null) effect.amount = rule.amountAst;

      await trx
        .insertInto('posting_rule')
        .values({
          application_definition_version_id: versionId,
          code: `legacy_${rule.sourceId}`,
          priority: rule.sourceId,
          condition_ast: asJsonObject(rule.conditionAst),
          effect_ast: asJsonObject(effect),
          rule_schema_version: 2
        })
        .execute();
      installedRules += 1;
    }

    return {
      ok: true,
      enterpriseId: enterprise.id,
      enterpriseCode: 'EVO_CONFIG_MVP',
      configurationId: input.configurationId,
      semanticDigest: input.semanticDigest,
      applications: versionByApplication.size,
      ledgers: input.accounts.length,
      rules: installedRules,
      uniqueExpressions: input.compiler.uniqueExpressionCount,
      compiledExpressions: input.compiler.compiledExpressionCount,
      runtimeBuiltins: input.compiler.builtinNames,
      applicationInstances: Object.fromEntries(instanceByApplication)
    };
  });
}

export async function submitConfiguratorBusinessData(
  runtime: {
    db: Kysely<Database>;
    command: {
      execute(input: {
        enterpriseId: string;
        applicationInstanceId: string;
        commandCode: string;
        actor: { type: 'HUMAN'; id: string };
        requestId: string;
        correlationId: string;
        idempotencyKey: string;
        input: JsonObject;
        effectiveAt: Date;
        businessObjectKey: string;
      }): Promise<{
        businessDataId: string;
        postingInputId: string;
        postingSequence: bigint;
        postingStatus: 'QUEUED' | 'BLOCKED_REPLAY_REQUIRED';
      }>;
    };
    posting: { processNext(enterpriseId: string): Promise<unknown> };
    work: { refresh(enterpriseId: string): Promise<unknown> };
  },
  requestId: string,
  input: ConfiguratorSubmitBody
) {
  const enterprise = await runtime.db
    .selectFrom('enterprise')
    .select('id')
    .where('code', '=', 'EVO_CONFIG_MVP')
    .executeTakeFirstOrThrow();

  const instance = await runtime.db
    .selectFrom('application_instance as i')
    .innerJoin('application_definition as a', 'a.id', 'i.application_definition_id')
    .select('i.id')
    .where('i.enterprise_id', '=', enterprise.id)
    .where('a.code', '=', appCode(input.applicationId))
    .where('i.status', '=', 'ACTIVE')
    .executeTakeFirstOrThrow();

  const objectKey = input.businessObjectKey?.trim() || `MVP-${Date.now()}`;
  const command = await runtime.command.execute({
    enterpriseId: enterprise.id,
    applicationInstanceId: instance.id,
    commandCode: 'submit',
    actor: { type: 'HUMAN', id: 'railway-mvp-user' },
    requestId,
    correlationId: `CFG:${objectKey}`,
    idempotencyKey: `${objectKey}:${requestId}`,
    input: input.payload,
    effectiveAt: new Date(),
    businessObjectKey: objectKey
  });

  const posted = await drainPosting(runtime as never, enterprise.id);

  const entries = await runtime.db
    .selectFrom('ledger_entry as e')
    .innerJoin('ledger_definition as d', 'd.id', 'e.ledger_definition_id')
    .select([
      'e.id',
      'd.code as ledgerCode',
      'd.name as ledgerTitle',
      'e.quantity',
      'e.amount',
      'e.posting_sequence as postingSequence'
    ])
    .where('e.business_data_id', '=', command.businessDataId)
    .orderBy('e.effect_index')
    .execute();

  const balances = await runtime.db
    .selectFrom('ledger_balance as b')
    .innerJoin('ledger_definition as d', 'd.id', 'b.ledger_definition_id')
    .select([
      'd.code as ledgerCode',
      'd.name as ledgerTitle',
      'b.quantity',
      'b.amount',
      'b.last_posting_sequence as lastPostingSequence'
    ])
    .where('b.enterprise_id', '=', enterprise.id)
    .orderBy('d.code')
    .execute();

  return {
    ok: true,
    applicationId: input.applicationId,
    businessObjectKey: objectKey,
    command: {
      businessDataId: command.businessDataId,
      postingInputId: command.postingInputId,
      postingSequence: command.postingSequence.toString(),
      postingStatus: command.postingStatus
    },
    posted,
    entries: entries.map((row) => ({
      ...row,
      postingSequence: row.postingSequence.toString()
    })),
    balances: balances.map((row) => ({
      ...row,
      lastPostingSequence: row.lastPostingSequence.toString()
    }))
  };
}
