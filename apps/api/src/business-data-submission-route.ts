import type { FastifyInstance } from 'fastify';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { JsonObject } from '../../../modules/metadata/api/contracts.js';
import type {
  BusinessDataSubmissionPortV010
} from '../../../modules/business-data/api/contracts.js';

type BusinessDataSubmissionHttpBodyV010 = {
  contractVersion?: unknown;
  scopeKey?: unknown;
  applicationId?: unknown;
  businessDataType?: unknown;
  businessObjectKey?: unknown;
  effectiveAt?: unknown;
  payload?: unknown;
  correlationId?: unknown;
  idempotencyKey?: unknown;
  causationId?: unknown;
  relation?: unknown;
  expectedBusinessVersion?: unknown;
  postingPriority?: unknown;
};

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError({
      code: 'BUSINESS_DATA_SUBMISSION_REQUEST_INVALID',
      message: `${field} is required.`,
      module: 'api',
      operation: 'submitBusinessData',
      details: { field }
    });
  }
  return value.trim();
}

function optionalText(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  return requiredText(value, field);
}

function relation(value: unknown):
  | {
      fromBusinessDataId: string;
      relationType:
        | 'CAUSES'
        | 'FULFILLS'
        | 'ALLOCATES_TO'
        | 'DERIVES_FROM'
        | 'REFERENCES'
        | 'REVERSES';
    }
  | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError({
      code: 'BUSINESS_DATA_SUBMISSION_REQUEST_INVALID',
      message: 'relation must be an object.',
      module: 'api',
      operation: 'submitBusinessData',
      details: { field: 'relation' }
    });
  }
  const input = value as Record<string, unknown>;
  const fromBusinessDataId = requiredText(
    input.fromBusinessDataId,
    'relation.fromBusinessDataId'
  );
  const relationType = requiredText(
    input.relationType,
    'relation.relationType'
  );
  if (![
    'CAUSES',
    'FULFILLS',
    'ALLOCATES_TO',
    'DERIVES_FROM',
    'REFERENCES',
    'REVERSES'
  ].includes(relationType)) {
    throw new AppError({
      code: 'BUSINESS_DATA_SUBMISSION_REQUEST_INVALID',
      message: 'relation.relationType is invalid.',
      module: 'api',
      operation: 'submitBusinessData',
      details: { field: 'relation.relationType' }
    });
  }
  return {
    fromBusinessDataId,
    relationType: relationType as
      | 'CAUSES'
      | 'FULFILLS'
      | 'ALLOCATES_TO'
      | 'DERIVES_FROM'
      | 'REFERENCES'
  };
}

function expectedVersion(value: unknown): bigint | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/u.test(value)) {
    throw new AppError({
      code: 'BUSINESS_DATA_SUBMISSION_REQUEST_INVALID',
      message: 'expectedBusinessVersion must be a non-negative integer string.',
      module: 'api',
      operation: 'submitBusinessData',
      details: { field: 'expectedBusinessVersion' }
    });
  }
  return BigInt(value);
}

function postingPriority(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || !Number.isSafeInteger(value)
  ) {
    throw new AppError({
      code: 'BUSINESS_DATA_SUBMISSION_REQUEST_INVALID',
      message: 'postingPriority must be a safe integer.',
      module: 'api',
      operation: 'submitBusinessData',
      details: { field: 'postingPriority' }
    });
  }
  return value;
}

export function registerBusinessDataSubmissionRouteV010(
  app: FastifyInstance,
  submission: BusinessDataSubmissionPortV010
): void {
  app.post('/api/v1/business-data', async (request, reply) => {
    const body = request.body as BusinessDataSubmissionHttpBodyV010;
    if (body.contractVersion !== '0.1.0') {
      throw new AppError({
        code: 'BUSINESS_DATA_SUBMISSION_VERSION_UNSUPPORTED',
        message: 'contractVersion must be 0.1.0.',
        module: 'api',
        operation: 'submitBusinessData'
      });
    }
    if (
      body.payload === null
      || typeof body.payload !== 'object'
      || Array.isArray(body.payload)
    ) {
      throw new AppError({
        code: 'BUSINESS_DATA_SUBMISSION_REQUEST_INVALID',
        message: 'payload must be a JSON object.',
        module: 'api',
        operation: 'submitBusinessData',
        details: { field: 'payload' }
      });
    }

    const effectiveAtText = requiredText(body.effectiveAt, 'effectiveAt');
    const effectiveAt = new Date(effectiveAtText);
    if (Number.isNaN(effectiveAt.getTime())) {
      throw new AppError({
        code: 'BUSINESS_DATA_EFFECTIVE_AT_INVALID',
        message: 'effectiveAt must be a valid ISO date/time.',
        module: 'api',
        operation: 'submitBusinessData'
      });
    }

    const causationId = optionalText(body.causationId, 'causationId');
    const businessRelation = relation(body.relation);
    const expectedBusinessVersion = expectedVersion(
      body.expectedBusinessVersion
    );
    const priority = postingPriority(body.postingPriority);

    const result = await submission.submit({
      contractVersion: '0.1.0',
      scopeKey: requiredText(body.scopeKey, 'scopeKey'),
      applicationId: requiredText(body.applicationId, 'applicationId'),
      businessDataType: requiredText(body.businessDataType, 'businessDataType'),
      businessObjectKey: requiredText(
        body.businessObjectKey,
        'businessObjectKey'
      ),
      effectiveAt,
      payload: body.payload as JsonObject,
      correlationId: requiredText(body.correlationId, 'correlationId'),
      idempotencyKey: requiredText(body.idempotencyKey, 'idempotencyKey'),
      ...(causationId === undefined ? {} : { causationId }),
      ...(businessRelation === undefined ? {} : { relation: businessRelation }),
      ...(expectedBusinessVersion === undefined
        ? {}
        : { expectedBusinessVersion }),
      ...(priority === undefined ? {} : { postingPriority: priority })
    });

    return reply.code(202).send({
      ...result,
      businessObjectVersion: result.businessObjectVersion.toString(),
      postingSequence: result.postingSequence.toString()
    });
  });
}
