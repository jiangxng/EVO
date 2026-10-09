import assert from 'node:assert/strict';
import { Decimal } from 'decimal.js';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import {
  PostgresApplicationAnchorRegistryV010
} from '../modules/business-data/infrastructure/postgres-application-anchor-registry.js';
import {
  PostgresBusinessDataSubmissionPortV010
} from '../modules/business-data/infrastructure/postgres-business-data-submission.js';
import {
  createEvoRuntime,
  drainPosting
} from '../apps/api/src/evo-runtime.js';
import {
  computeEconomicRuntimeDigest
} from '../modules/replay/infrastructure/postgres-replay-digest.js';

const config = loadRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const runtime = createEvoRuntime(database);

function orderNoOf(dimensions: unknown): string | undefined {
  if (
    dimensions === null
    || typeof dimensions !== 'object'
    || Array.isArray(dimensions)
  ) return undefined;
  const value = (dimensions as Record<string, unknown>).order_no;
  return typeof value === 'string' ? value : undefined;
}

async function snapshot(enterpriseId: string, orderNo: string) {
  const balances = await runtime.db
    .selectFrom('ledger_balance as b')
    .innerJoin('ledger_definition as d', 'd.id', 'b.ledger_definition_id')
    .innerJoin('ledger_dataset as ds', 'ds.id', 'b.ledger_dataset_id')
    .select([
      'd.code as ledger',
      'b.quantity',
      'b.amount',
      'b.dimensions'
    ])
    .where('b.enterprise_id', '=', enterpriseId)
    .where('ds.kind', '=', 'CURRENT')
    .where('ds.status', '=', 'ACTIVE')
    .where('d.code', 'in', ['pending_purchase', 'payable', 'inventory'])
    .execute();

  const scopedBalances = balances
    .filter(row => orderNoOf(row.dimensions) === orderNo)
    .sort((a, b) => a.ledger.localeCompare(b.ledger));
  const byLedger = new Map(scopedBalances.map(row => [row.ledger, row]));

  for (const ledger of ['pending_purchase', 'payable', 'inventory']) {
    if (!byLedger.has(ledger)) {
      throw new Error(`Missing ${ledger} balance for ${orderNo}`);
    }
  }

  const facts = await runtime.db
    .selectFrom('business_data')
    .select([
      'id',
      'business_data_type',
      'business_object_key',
      'business_object_version',
      'effective_at',
      'payload'
    ])
    .where('enterprise_id', '=', enterpriseId)
    .execute();

  const scopedFacts = facts
    .filter(row => {
      const payload = row.payload as Record<string, unknown>;
      return payload.orderNo === orderNo;
    })
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(row => ({
      id: row.id,
      type: row.business_data_type,
      key: row.business_object_key,
      version: String(row.business_object_version),
      effectiveAt: row.effective_at.toISOString(),
      payload: row.payload
    }));

  const factIds = new Set(scopedFacts.map(fact => fact.id));
  const links = (await runtime.db
    .selectFrom('business_object_link')
    .select([
      'from_business_data_id',
      'to_business_data_id',
      'relation_type'
    ])
    .where('enterprise_id', '=', enterpriseId)
    .execute())
    .filter(link =>
      factIds.has(link.from_business_data_id)
      && factIds.has(link.to_business_data_id)
    )
    .sort((a, b) =>
      a.from_business_data_id.localeCompare(b.from_business_data_id)
      || a.to_business_data_id.localeCompare(b.to_business_data_id)
      || a.relation_type.localeCompare(b.relation_type)
    );

  const work = (await runtime.db
    .selectFrom('work_item')
    .select([
      'work_type',
      'status',
      'source_ledger_code',
      'source_dimensions',
      'source_quantity',
      'source_amount'
    ])
    .where('enterprise_id', '=', enterpriseId)
    .execute())
    .filter(row => orderNoOf(row.source_dimensions) === orderNo)
    .filter(row =>
      row.source_ledger_code === 'pending_purchase'
      || row.source_ledger_code === 'payable'
    )
    .sort((a, b) =>
      a.source_ledger_code.localeCompare(b.source_ledger_code)
    )
    .map(row => ({
      workType: row.work_type,
      status: row.status,
      ledger: row.source_ledger_code,
      quantity: row.source_quantity,
      amount: row.source_amount
    }));

  return {
    balances: {
      pendingPurchaseQuantity: byLedger.get('pending_purchase')!.quantity,
      payableAmount: byLedger.get('payable')!.amount,
      inventoryQuantity: byLedger.get('inventory')!.quantity,
      inventoryAmount: byLedger.get('inventory')!.amount,
      inventoryDimensions: byLedger.get('inventory')!.dimensions
    },
    facts: scopedFacts,
    links,
    work
  };
}

function assertReversed(
  value: Awaited<ReturnType<typeof snapshot>>,
  label: string
) {
  assert.equal(
    new Decimal(value.balances.pendingPurchaseQuantity).eq(10),
    true,
    `${label}: pending purchase must reopen to 10`
  );
  assert.equal(
    new Decimal(value.balances.payableAmount).eq(125),
    true,
    `${label}: payable must remain 125`
  );
  assert.equal(
    new Decimal(value.balances.inventoryQuantity).eq(0),
    true,
    `${label}: inventory quantity must return to zero`
  );
  assert.equal(
    new Decimal(value.balances.inventoryAmount).eq(0),
    true,
    `${label}: inventory amount must return to zero`
  );

  const dimensions = value.balances.inventoryDimensions as Record<string, unknown>;
  assert.equal(dimensions.product_id, 'P-100');
  assert.equal(dimensions.warehouse, 'HK');

  assert.equal(value.facts.length, 3);
  assert.deepEqual(
    value.facts.map(fact => fact.type).sort(),
    [
      'goods_receipt.received',
      'goods_receipt.reversed',
      'purchase_order.approved'
    ]
  );

  const reversal = value.facts.find(
    fact => fact.type === 'goods_receipt.reversed'
  );
  const receipt = value.facts.find(
    fact => fact.type === 'goods_receipt.received'
  );
  assert.ok(reversal);
  assert.ok(receipt);
  assert.equal(
    value.links.some(link =>
      link.from_business_data_id === receipt.id
      && link.to_business_data_id === reversal.id
      && link.relation_type === 'REVERSES'
    ),
    true,
    `${label}: receipt must link immutably to reversal through REVERSES`
  );

  const receive = value.work.find(row => row.ledger === 'pending_purchase');
  const pay = value.work.find(row => row.ledger === 'payable');
  assert.equal(receive?.status, 'OPEN');
  assert.equal(receive?.workType, 'RECEIVE');
  assert.equal(new Decimal(receive?.quantity ?? 0).eq(10), true);
  assert.equal(pay?.status, 'OPEN');
  assert.equal(pay?.workType, 'PAY');
  assert.equal(new Decimal(pay?.amount ?? 0).eq(125), true);
}

try {
  const enterprise = await runtime.db
    .selectFrom('enterprise')
    .select(['id', 'code'])
    .where('code', '=', 'EVO_DEMO')
    .executeTakeFirstOrThrow();

  const scopeKey = 'enterprise:EVO_DEMO';
  const anchors = new PostgresApplicationAnchorRegistryV010(runtime.db);
  const submission = new PostgresBusinessDataSubmissionPortV010(
    runtime.db,
    {
      async resolveEnterpriseId(inputScopeKey) {
        assert.equal(inputScopeKey, scopeKey);
        return enterprise.id;
      }
    },
    anchors
  );

  const suffix = Date.now();
  const orderNo = `PO-TR01-REV-${suffix}`;
  const receiptNo = `GR-TR01-REV-${suffix}`;
  const reversalNo = `GRR-TR01-REV-${suffix}`;
  const common = {
    orderNo,
    supplier: 'SUPPLIER-TR01',
    productId: 'P-100',
    warehouse: 'HK',
    project: `TR01-REV-${suffix}`,
    department: 'PROCUREMENT',
    costCenter: 'CC-PROCUREMENT'
  };

  const purchase = await submission.submit({
    contractVersion: '0.1.0',
    scopeKey,
    applicationId: 'purchase_order',
    businessDataType: 'purchase_order.approved',
    businessObjectKey: orderNo,
    effectiveAt: new Date('2026-10-10T02:00:00.000Z'),
    payload: {
      ...common,
      quantity: 10,
      unitPrice: '12.50',
      totalAmount: '125.00',
      currency: 'CNY'
    },
    correlationId: `TR01:REV:${orderNo}`,
    idempotencyKey: `${orderNo}:approve`
  });
  await drainPosting(runtime, enterprise.id);

  const receipt = await submission.submit({
    contractVersion: '0.1.0',
    scopeKey,
    applicationId: 'inventory_movement',
    businessDataType: 'goods_receipt.received',
    businessObjectKey: receiptNo,
    effectiveAt: new Date('2026-10-10T02:10:00.000Z'),
    payload: {
      movementType: 'PURCHASE_RECEIPT',
      receiptNo,
      ...common,
      quantity: 10,
      totalCost: '125.00',
      currency: 'CNY'
    },
    correlationId: `TR01:REV:${orderNo}`,
    causationId: purchase.businessDataId,
    idempotencyKey: `${receiptNo}:receive`,
    relation: {
      fromBusinessDataId: purchase.businessDataId,
      relationType: 'FULFILLS'
    }
  });
  await drainPosting(runtime, enterprise.id);
  await runtime.work.refresh(enterprise.id);

  const received = await snapshot(enterprise.id, orderNo);
  assert.equal(new Decimal(received.balances.pendingPurchaseQuantity).eq(0), true);
  assert.equal(new Decimal(received.balances.payableAmount).eq(125), true);
  assert.equal(new Decimal(received.balances.inventoryQuantity).eq(10), true);
  assert.equal(new Decimal(received.balances.inventoryAmount).eq(125), true);

  const reversal = await submission.submit({
    contractVersion: '0.1.0',
    scopeKey,
    applicationId: 'inventory_movement',
    businessDataType: 'goods_receipt.reversed',
    businessObjectKey: reversalNo,
    effectiveAt: new Date('2026-10-10T02:20:00.000Z'),
    payload: {
      movementType: 'PURCHASE_RECEIPT_REVERSAL',
      reversalNo,
      originalReceiptNo: receiptNo,
      ...common,
      quantity: 10,
      totalCost: '125.00',
      currency: 'CNY'
    },
    correlationId: `TR01:REV:${orderNo}`,
    causationId: receipt.businessDataId,
    idempotencyKey: `${reversalNo}:reverse`,
    relation: {
      fromBusinessDataId: receipt.businessDataId,
      relationType: 'REVERSES'
    }
  });
  await drainPosting(runtime, enterprise.id);
  await runtime.work.refresh(enterprise.id);

  const beforeReplay = await snapshot(enterprise.id, orderNo);
  assertReversed(beforeReplay, 'Before replay');

  const runtimeState = await runtime.db
    .selectFrom('enterprise_runtime_state')
    .select(['consistency_domain', 'next_posting_sequence'])
    .where('enterprise_id', '=', enterprise.id)
    .executeTakeFirstOrThrow();
  const boundary = BigInt(runtimeState.next_posting_sequence) - 1n;
  const beforeDigest = await computeEconomicRuntimeDigest(
    runtime.db,
    enterprise.id,
    runtimeState.consistency_domain,
    boundary
  );

  const replay = await runtime.replay.prepareFullReplay(enterprise.id);
  assert.equal(replay.boundarySequence, boundary);
  await drainPosting(runtime, enterprise.id);
  if (replay.costMethod !== null) {
    await runtime.cost.recalculate(
      enterprise.id,
      replay.costMethod,
      replay.costPins ?? undefined
    );
  }
  await runtime.work.refresh(enterprise.id);

  const afterReplay = await snapshot(enterprise.id, orderNo);
  assertReversed(afterReplay, 'After replay');

  assert.equal(
    JSON.stringify(beforeReplay.facts),
    JSON.stringify(afterReplay.facts),
    'Full Replay must not mutate canonical purchase/receipt/reversal facts'
  );
  assert.equal(
    JSON.stringify(beforeReplay.links),
    JSON.stringify(afterReplay.links),
    'Full Replay must not mutate immutable BusinessData lineage'
  );
  assert.deepEqual(
    afterReplay.balances,
    beforeReplay.balances,
    'Full Replay must preserve reversed order balances'
  );
  assert.deepEqual(
    afterReplay.work,
    beforeReplay.work,
    'Full Replay must preserve reopened RECEIVE and open PAY Work'
  );

  const afterDigest = await computeEconomicRuntimeDigest(
    runtime.db,
    enterprise.id,
    runtimeState.consistency_domain,
    boundary
  );
  await runtime.replay.completeFullReplay(
    replay.replayRunId,
    enterprise.id,
    afterDigest
  );

  assert.equal(replay.beforeDigest, beforeDigest);
  assert.equal(afterDigest, beforeDigest);

  console.log(JSON.stringify({
    status: 'PASS',
    proof: 'TR01A2_PURCHASE_RECEIPT_IMMUTABLE_REVERSAL_REPLAY',
    orderNo,
    purchaseBusinessDataId: purchase.businessDataId,
    receiptBusinessDataId: receipt.businessDataId,
    reversalBusinessDataId: reversal.businessDataId,
    relationType: 'REVERSES',
    balances: afterReplay.balances,
    work: afterReplay.work,
    canonicalFactsUnchanged: true,
    lineageUnchanged: true,
    replayDeterministic: true,
    beforeDigest,
    afterDigest
  }, null, 2));
} finally {
  await database.destroy();
}
