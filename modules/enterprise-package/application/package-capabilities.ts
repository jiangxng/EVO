import { enterprisePackageDefinitionKinds } from '../api/contracts.js';

export const enterprisePackageCapabilities = Object.freeze({
  packageSchemaVersions: ['0.1'] as const,
  exportModes: ['DEFINITION_ONLY'] as const,
  definitionKinds: enterprisePackageDefinitionKinds,
  operations: ['SCHEMA', 'CAPABILITIES', 'VALIDATE', 'PLAN', 'DEPLOY', 'EXPORT'] as const,
  plan: { deterministic: true, sideEffectFree: true, intendedAudience: 'HUMAN' as const },
  runtime: { llmRequired: false, ecRequired: false },
  deploy: { authorizationRequired: true, humanApprovalRequired: true, idempotencyRequired: true, expectedBaseVersionRequired: true }
});
