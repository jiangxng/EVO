import type { FastifyInstance } from 'fastify';
import { AppError } from '../../../platform/contracts/src/index.js';
import { demoIds, type createEvoRuntime } from './evo-runtime.js';

type Runtime = ReturnType<typeof createEvoRuntime>;
const APM = {
  enterpriseId: 'APM', orderNo: 'SO-20260918-0182', customer: 'Northstar Industrial Systems',
  product: 'Critical Servo Module', promiseDate: '2026-09-18', revenueAtRisk: 280000,
  supplierA: { id: 'SUPPLIER-A', revisedDate: '2026-09-20' },
  supplierB: { id: 'SUPPLIER-B', priceDeltaPct: 8.4, qualified: true }
} as const;

function fail(code: string, message: string): never {
  throw new AppError({ code, message, module: 'integration', operation: 'apm' });
}

async function selectedSupplier(runtime: Runtime, enterpriseId: string) {
  const latest = await runtime.db.selectFrom('business_data').select(['id','payload','business_object_version','effective_at'])
    .where('enterprise_id','=',enterpriseId).where('business_data_type','=','procurement.alternate-supplier-selected')
    .where('business_object_key','=',APM.orderNo).orderBy('business_object_version','desc').executeTakeFirst();
  if (!latest) return null;
  const payload = latest.payload as Record<string, unknown>;
  return { businessDataId: latest.id, supplierId: payload.supplierId, version: latest.business_object_version.toString(), effectiveAt: latest.effective_at };
}

export async function apmObservation(runtime: Runtime) {
  const ids = await demoIds(runtime);
  const selection = await selectedSupplier(runtime, ids.enterpriseId);
  const observedAt = new Date().toISOString();
  const observationId = selection === null ? 'obs-apm-so-0182-v7' : `obs-apm-so-0182-supplier-v${selection.version}`;
  return {
    contractVersion: '1.0.0', observationId, deliveryId: `delivery:${observationId}:${observedAt}`,
    enterpriseId: APM.enterpriseId, observationType: 'BUSINESS_FACT',
    effectiveAt: selection?.effectiveAt ?? '2026-09-15T08:00:00Z', observedAt, publishedAt: observedAt,
    subject: { type: 'sales-order', key: APM.orderNo },
    facts: {
      orderNo: APM.orderNo, customer: APM.customer, product: APM.product,
      promiseDate: APM.promiseDate, revenueAtRisk: APM.revenueAtRisk,
      supplierA: APM.supplierA, supplierB: APM.supplierB,
      selectedSupplierId: selection?.supplierId ?? 'SUPPLIER-A', shortageRisk: selection === null
    },
    lineage: { sourceSystem: 'EVO', sourceBusinessDataId: selection?.businessDataId ?? null },
    correlationId: 'corr-apm-shortage-001'
  };
}

async function executeAlternateSupplier(runtime: Runtime, requestId: string, input: {
  supplierId: string; idempotencyKey: string; correlationId: string; causationId?: string;
}) {
  const ids = await demoIds(runtime);
  if (!ids.apmProcurementAppId) fail('APM_PROCUREMENT_NOT_INSTALLED', 'Run seed:apm:v03 before the APM integration demo.');
  await runtime.auth.require({ enterpriseId: ids.enterpriseId, actorType: 'HUMAN', actorId: 'demo-user', permissionCode: 'procurement.use-alternate-supplier' });
  if (input.supplierId !== 'SUPPLIER-B') fail('APM_ALTERNATE_SUPPLIER_REQUIRED', 'The reference decision admits only the qualified alternate supplier.');
  const current = await selectedSupplier(runtime, ids.enterpriseId);
  const result = await runtime.command.execute({
    enterpriseId: ids.enterpriseId, applicationInstanceId: ids.apmProcurementAppId,
    commandCode: 'procurement.use-alternate-supplier', actor: { type: 'HUMAN', id: 'demo-user' }, requestId,
    correlationId: input.correlationId, ...(input.causationId === undefined ? {} : { causationId: input.causationId }),
    idempotencyKey: input.idempotencyKey, input: { supplierId: input.supplierId }, effectiveAt: new Date(),
    businessObjectKey: APM.orderNo, expectedBusinessVersion: current === null ? 0n : BigInt(current.version)
  });
  return { command: result, outcome: { status: 'EXECUTED', businessDataId: result.businessDataId }, observation: await apmObservation(runtime) };
}

export function registerApmIntegration(app: FastifyInstance, runtime: Runtime): void {
  app.get('/api/v1/apm/observation', async () => apmObservation(runtime));

  app.post('/api/v1/apm/command-proposals/admit', async (request) => {
    const body = request.body as Record<string, unknown>;
    if (body.enterpriseId !== 'APM') fail('ENTERPRISE_SCOPE_MISMATCH', 'Proposal enterprise must be APM.');
    if (body.commandCode !== 'procurement.use-alternate-supplier') fail('COMMAND_NOT_ADMITTED', 'Command is not admitted by the APM integration profile.');
    if (body.inputSchemaVersion !== '1') fail('COMMAND_SCHEMA_VERSION_MISMATCH', 'Proposal schema version is not supported.');
    if ('authorized' in body || 'authorization' in body) fail('UNTRUSTED_AUTHORIZATION_ASSERTION', 'External proposal cannot assert EVO authorization.');
    const proposedInput = body.proposedInput as Record<string, unknown> | undefined;
    if (!proposedInput || proposedInput.supplierId !== 'SUPPLIER-B') fail('COMMAND_PROPOSAL_INPUT_INVALID', 'The qualified alternate supplier is required.');
    // Admission validates compatibility only. It MUST NOT execute; human/Eidos action remains a separate boundary.
    return {
      admitted: true, executionStatus: 'NOT_EXECUTED', proposalId: body.proposalId,
      commandCode: body.commandCode, proposedInput, correlationId: body.correlationId,
      authorization: 'EVO_REEVALUATES_AT_EXECUTION'
    };
  });

  app.post('/api/v1/apm/actions/execute', async (request) => {
    const body = request.body as Record<string, unknown>;
    if ('authorized' in body || 'authorization' in body) fail('UNTRUSTED_AUTHORIZATION_ASSERTION', 'ActionRequest cannot assert EVO authorization.');
    const targetRef = body.targetRef as Record<string, unknown> | undefined;
    if (!targetRef || targetRef.commandCode !== 'procurement.use-alternate-supplier') fail('ACTION_TARGET_NOT_MAPPABLE', 'Host cannot map this ActionRequest target.');
    const confirmation = body.confirmation as Record<string, unknown> | undefined;
    if (confirmation?.confirmed !== true) fail('HUMAN_CONFIRMATION_REQUIRED', 'Human confirmation evidence is required.');
    const input = body.input as Record<string, unknown> | undefined;
    if (!input || typeof input.supplierId !== 'string') fail('ACTION_INPUT_REQUIRED', 'supplierId is required.');
    const causationId = String(body.actionRequestId ?? '');
    return executeAlternateSupplier(runtime, request.id, {
      supplierId: input.supplierId,
      idempotencyKey: String(body.idempotencyKey ?? `eidos:${request.id}`),
      correlationId: String(body.correlationId ?? 'corr-apm-shortage-001'),
      ...(causationId.length === 0 ? {} : { causationId })
    });
  });
}
