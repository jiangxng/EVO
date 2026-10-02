import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { buildApp } from '../apps/api/src/build-app.js';

const config = loadRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const app = buildApp({ database, loggerLevel: 'silent' });

const suffix = Date.now().toString(36);
const sourceRef = 'host:eog:sop:ci-o2c';
const sourceRevision = 1;
const sourceDigest = createHash('sha256')
  .update(JSON.stringify({
    sourceRef,
    sourceRevision,
    path: ['application:order', 'application:ship']
  }))
  .digest('hex');

try {
  const burn = await app.inject({
    method: 'POST',
    url: '/api/v1/configurator/burn',
    payload: {
      contractVersion: '0.1.0',
      kind: 'evo.ledger-runtime.compiled-configuration',
      sourceDialect: 'bookkeeping-aviator-v1',
      configurationId: 'ci-runtime-flow-' + suffix,
      semanticDigest: 'sha256:' + suffix,
      accounts: [],
      applications: [
        { applicationId: 'application:order', title: 'Order' },
        { applicationId: 'application:ship', title: 'Ship' }
      ],
      rules: [],
      compiler: {
        expressionIrVersion: 1,
        uniqueExpressionCount: 0,
        compiledExpressionCount: 0,
        builtinNames: []
      }
    }
  });
  assert.equal(burn.statusCode, 200, burn.body);
  const burned = burn.json() as { enterpriseId: string };

  const registered = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime-flow-definitions/register',
    payload: {
      contractVersion: '0.1.0',
      enterpriseId: burned.enterpriseId,
      code: 'host-o2c-ci',
      name: 'Host O2C CI',
      source: {
        authority: 'HOST',
        ref: sourceRef,
        revision: sourceRevision,
        digest: sourceDigest
      },
      definition: {
        graphId: 'eog:primary',
        sopId: 'sop:ci-o2c',
        path: ['application:order', 'application:ship']
      }
    }
  });
  assert.equal(registered.statusCode, 200, registered.body);
  const flow = registered.json() as {
    flowDefinitionId: string;
    version: number;
    source: { ref: string; revision: number; digest: string };
  };
  assert.ok(flow.flowDefinitionId);
  assert.equal(flow.version, sourceRevision);
  assert.equal(flow.source.ref, sourceRef);

  const idempotent = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime-flow-definitions/register',
    payload: {
      contractVersion: '0.1.0',
      enterpriseId: burned.enterpriseId,
      code: 'host-o2c-ci',
      name: 'Host O2C CI',
      source: {
        authority: 'HOST',
        ref: sourceRef,
        revision: sourceRevision,
        digest: sourceDigest
      },
      definition: {
        graphId: 'eog:primary',
        sopId: 'sop:ci-o2c',
        path: ['application:order', 'application:ship']
      }
    }
  });
  assert.equal(idempotent.statusCode, 200, idempotent.body);
  assert.equal(idempotent.json().flowDefinitionId, flow.flowDefinitionId);

  const instanceKey = 'CI-FLOW-' + suffix;
  const started = new Date(Date.now() - 60_000);

  const first = await app.inject({
    method: 'POST',
    url: '/api/v1/configurator/business-data',
    payload: {
      applicationId: 'application:order',
      businessObjectKey: instanceKey + ':order',
      payload: { kind: 'ORDER', quantity: 1 },
      lineage: {
        flowDefinitionId: flow.flowDefinitionId,
        flowInstanceKey: instanceKey,
        stepCode: 'order-created'
      }
    }
  });
  assert.equal(first.statusCode, 200, first.body);
  const firstBody = first.json() as {
    command: { commandExecutionId: string; businessDataId: string };
  };
  assert.ok(firstBody.command.commandExecutionId);
  assert.ok(firstBody.command.businessDataId);

  const second = await app.inject({
    method: 'POST',
    url: '/api/v1/configurator/business-data',
    payload: {
      applicationId: 'application:ship',
      businessObjectKey: instanceKey + ':ship',
      payload: { kind: 'SHIPMENT', quantity: 1 },
      lineage: {
        flowDefinitionId: flow.flowDefinitionId,
        flowInstanceKey: instanceKey,
        stepCode: 'shipment-created',
        parentBusinessDataId: firstBody.command.businessDataId,
        relationType: 'FULFILLS'
      }
    }
  });
  assert.equal(second.statusCode, 200, second.body);
  const secondBody = second.json() as {
    command: { commandExecutionId: string; businessDataId: string };
  };
  assert.ok(secondBody.command.commandExecutionId);
  assert.ok(secondBody.command.businessDataId);

  const ended = new Date(Date.now() + 60_000);
  const traces = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime-traces/query',
    payload: {
      contractVersion: '0.1.0',
      enterpriseId: burned.enterpriseId,
      window: {
        startAt: started.toISOString(),
        endAt: ended.toISOString()
      },
      applicationIds: ['application:order', 'application:ship']
    }
  });
  assert.equal(traces.statusCode, 200, traces.body);
  const traceBody = traces.json() as {
    traces: Array<{
      flowDefinitionId: string;
      flowInstanceKey: string;
      steps: Array<{
        applicationId: string;
        stepCode: string;
        businessDataId: string;
        commandExecutionId: string;
      }>;
    }>;
  };
  const trace = traceBody.traces.find(
    item => item.flowInstanceKey === instanceKey
  );
  assert.ok(trace, 'governed runtime flow trace must be queryable');
  assert.equal(trace.flowDefinitionId, flow.flowDefinitionId);
  assert.deepEqual(
    trace.steps.map(step => [step.applicationId, step.stepCode]),
    [
      ['application:order', 'order-created'],
      ['application:ship', 'shipment-created']
    ]
  );

  const link = await database.db
    .selectFrom('business_object_link')
    .select(['from_business_data_id','to_business_data_id','relation_type'])
    .where('enterprise_id', '=', burned.enterpriseId)
    .where('from_business_data_id', '=', firstBody.command.businessDataId)
    .where('to_business_data_id', '=', secondBody.command.businessDataId)
    .executeTakeFirstOrThrow();
  assert.equal(link.relation_type, 'FULFILLS');

  console.log(JSON.stringify({
    status: 'PASS',
    proof: 'HOST_GOVERNED_PUBLIC_RUNTIME_FLOW_EVIDENCE',
    enterpriseId: burned.enterpriseId,
    flowDefinitionId: flow.flowDefinitionId,
    flowInstanceKey: instanceKey,
    applications: trace.steps.map(step => step.applicationId),
    stepCodes: trace.steps.map(step => step.stepCode),
    businessObjectLink: link.relation_type
  }, null, 2));
} finally {
  await app.close();
  await database.destroy();
}
