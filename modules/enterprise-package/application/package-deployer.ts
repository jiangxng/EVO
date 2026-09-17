import type { EnterpriseDefinitionSource } from '../api/definition-source.js';
import type { EnterpriseDefinitionDeployment, EnterpriseDefinitionTarget } from '../api/definition-target.js';
import type { EnterprisePackageV01 } from '../api/contracts.js';
import { planEnterprisePackageDeployment } from './package-planner.js';

export interface DeployEnterprisePackageInput {
  readonly enterpriseScope: string;
  readonly package: EnterprisePackageV01;
  readonly expectedBaseDefinitionVersion: string;
  readonly idempotencyKey: string;
  /** Authorization is evaluated by EVO before this application service is invoked. */
  readonly authorizationConfirmed: true;
  /** Human approval evidence is governance input, never authorization. */
  readonly humanApprovalConfirmed: true;
}

export async function deployEnterprisePackage(
  source: EnterpriseDefinitionSource,
  target: EnterpriseDefinitionTarget,
  input: DeployEnterprisePackageInput
): Promise<EnterpriseDefinitionDeployment> {
  if (input.idempotencyKey.trim() === '') throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  if (input.authorizationConfirmed !== true) throw new Error('EVO_AUTHORIZATION_REQUIRED');
  if (input.humanApprovalConfirmed !== true) throw new Error('HUMAN_APPROVAL_REQUIRED');

  const snapshot = {
    enterpriseScope: input.enterpriseScope,
    definitionVersion: await source.readDefinitionVersion(input.enterpriseScope),
    definitions: await source.readDefinitions(input.enterpriseScope)
  };
  const plan = planEnterprisePackageDeployment(snapshot, input.package, input.expectedBaseDefinitionVersion);
  if (plan.blockingIssues.length > 0) {
    throw new Error(`PACKAGE_DEPLOY_BLOCKED:${plan.blockingIssues.map((x) => x.code).join(',')}`);
  }

  // Target must atomically recheck expected base version and idempotency at mutation time.
  return target.publish({
    enterpriseScope: input.enterpriseScope,
    expectedBaseDefinitionVersion: input.expectedBaseDefinitionVersion,
    idempotencyKey: input.idempotencyKey,
    packageId: input.package.packageId,
    packageVersion: input.package.packageVersion,
    definitions: input.package.definitions
  });
}
