import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';

type ContextManifest = {
  readonly contextContractVersion: string;
  readonly requiredReading: readonly string[];
  readonly bootstrap: {
    readonly agentInstructions: string;
    readonly llmContract: string;
    readonly continuityProtocol: string;
    readonly currentCheckpoint: string;
    readonly currentStatus: string;
    readonly currentCertification: string;
    readonly documentationStandard: string;
    readonly projectStatus: string;
    readonly codeProgressMarkerStandard: string;
    readonly branchTopology: string;
    readonly requirementStatus: string;
    readonly businessRequirementBaseline: string;
    readonly requirementAlignmentProtocol: string;
    readonly requirementEvidenceMatrix: string;
    readonly activePacket: string;
  };
  readonly readProfiles: Record<string, {
    readonly maxInitialDocuments: number;
    readonly documents: readonly string[];
  }>;
};

const failures: string[] = [];
const manifest = JSON.parse(
  await readFile('context.manifest.json','utf8')
) as ContextManifest;

function requirePath(path: string, source: string): void {
  if (!existsSync(path)) failures.push(`${source} points to missing path: ${path}`);
}

for (const path of manifest.requiredReading) requirePath(path,'requiredReading');
for (const [key,value] of Object.entries(manifest.bootstrap)) {
  if (key !== 'activePacket') requirePath(value,`bootstrap.${key}`);
}
for (const [profile,definition] of Object.entries(manifest.readProfiles)) {
  if (!Number.isInteger(definition.maxInitialDocuments) || definition.maxInitialDocuments < 1) {
    failures.push(`readProfiles.${profile}.maxInitialDocuments must be a positive integer.`);
  }
  if (definition.documents.length > definition.maxInitialDocuments) {
    failures.push(`readProfiles.${profile} exceeds its initial document budget.`);
  }
  for (const path of definition.documents) requirePath(path,`readProfiles.${profile}`);
}

const projectStatus = JSON.parse(await readFile(manifest.bootstrap.projectStatus,'utf8')) as {
  activeWorkPacket?: { id?: string; overallClosed?: boolean; openGates?: readonly string[] };
  requirementAlignment?: { requirementStatus?: string };
};
const requirementsStatus = JSON.parse(await readFile(manifest.bootstrap.requirementStatus,'utf8')) as {
  activeRequirementSet?: {
    id?: string;
    acceptance?: readonly string[];
    verified?: readonly string[];
    open?: readonly string[];
    deferred?: readonly string[];
  };
  antiOverdesignQuestions?: readonly string[];
  alignmentTriggers?: readonly string[];
  explanationOrder?: readonly string[];
};
const branchTopology = JSON.parse(await readFile(manifest.bootstrap.branchTopology,'utf8')) as { authoritativeBranch?: string; branchClasses?: Record<string,{class?:string;mergePolicy?:string}>; allowedClasses?: readonly string[]; allowedMergePolicies?: readonly string[] };
if (projectStatus.activeWorkPacket?.id === undefined) failures.push('project.status.json lacks activeWorkPacket.id.');
if (!Array.isArray(projectStatus.activeWorkPacket?.openGates)) failures.push('project.status.json lacks activeWorkPacket.openGates array.');
if (requirementsStatus.activeRequirementSet?.id === undefined) failures.push('requirements.status.json lacks activeRequirementSet.id.');
if (requirementsStatus.activeRequirementSet?.id !== projectStatus.activeWorkPacket?.id) {
  failures.push(`requirements.status.json activeRequirementSet.id ${requirementsStatus.activeRequirementSet?.id ?? 'missing'} != project.status.json activeWorkPacket.id ${projectStatus.activeWorkPacket?.id ?? 'missing'}.`);
}
for (const key of ['acceptance','verified','open','deferred'] as const) {
  if (!Array.isArray(requirementsStatus.activeRequirementSet?.[key])) {
    failures.push(`requirements.status.json lacks activeRequirementSet.${key} array.`);
  }
}
if (!Array.isArray(requirementsStatus.antiOverdesignQuestions) || requirementsStatus.antiOverdesignQuestions.length !== 4) {
  failures.push('requirements.status.json must define exactly four antiOverdesignQuestions.');
}
if (!Array.isArray(requirementsStatus.alignmentTriggers) || requirementsStatus.alignmentTriggers.length < 1) {
  failures.push('requirements.status.json lacks alignmentTriggers.');
}
if (JSON.stringify(requirementsStatus.explanationOrder) !== JSON.stringify(['BUSINESS','PRODUCT','TECHNICAL'])) {
  failures.push('requirements.status.json explanationOrder must be BUSINESS -> PRODUCT -> TECHNICAL.');
}
if (projectStatus.requirementAlignment?.requirementStatus !== manifest.bootstrap.requirementStatus) {
  failures.push('project.status.json requirementAlignment.requirementStatus must match context.manifest bootstrap.requirementStatus.');
}
if (branchTopology.authoritativeBranch !== 'main') failures.push('branch.topology.json must identify main as authoritativeBranch.');
if (branchTopology.branchClasses?.main?.class !== 'AUTHORITATIVE') failures.push('branch.topology.json must classify main as AUTHORITATIVE.');
for (const [name,definition] of Object.entries(branchTopology.branchClasses ?? {})) {
  if (!branchTopology.allowedClasses?.includes(definition.class ?? '')) failures.push(`branch.topology.json has invalid class for ${name}.`);
  if (!branchTopology.allowedMergePolicies?.includes(definition.mergePolicy ?? '')) failures.push(`branch.topology.json has invalid mergePolicy for ${name}.`);
}

const llm = await readFile('LLM.md','utf8');
const llmVersion = llm.match(/Context Contract Version:\s*(\S+)/)?.[1];
if (llmVersion !== manifest.contextContractVersion) {
  failures.push(`LLM.md version ${llmVersion ?? 'missing'} != manifest version ${manifest.contextContractVersion}.`);
}

const agents = await readFile('AGENTS.md','utf8');
const agentsSize = (await stat('AGENTS.md')).size;
if (agentsSize > 16 * 1024) failures.push(`AGENTS.md is ${agentsSize} bytes; limit is 16384.`);
if (!agents.includes('context.manifest.json')) failures.push('AGENTS.md must route through context.manifest.json.');
if (!agents.includes('project.status.json')) failures.push('AGENTS.md must route through project.status.json.');
if (!agents.includes('branch.topology.json')) failures.push('AGENTS.md must route through branch.topology.json.');
if (!agents.includes('requirements.status.json')) failures.push('AGENTS.md must route through requirements.status.json.');
if (!agents.includes('Business → Product → Technical')) failures.push('AGENTS.md must require Business → Product → Technical progress explanation.');

const readme = await readFile('README.md','utf8');
if (!readme.includes('AGENTS.md')) failures.push('README.md must identify AGENTS.md as the AI entry point.');

const protocol = await readFile(manifest.bootstrap.continuityProtocol,'utf8');
if (!protocol.includes('ACTIVE')) failures.push('Current continuity protocol must be marked ACTIVE.');
const checkpoint = await readFile(manifest.bootstrap.currentCheckpoint,'utf8');
if (!checkpoint.includes('ACTIVE HANDOFF CHECKPOINT')) failures.push('Current checkpoint lacks ACTIVE HANDOFF CHECKPOINT marker.');
const certification = await readFile(manifest.bootstrap.currentCertification,'utf8');
if (!certification.includes('CERTIFIED')) failures.push('Current certification lacks CERTIFIED marker.');

if (failures.length > 0) {
  console.error(JSON.stringify({status:'FAIL',failures},null,2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status:'PASS',
    contextContractVersion:manifest.contextContractVersion,
    activePacket:manifest.bootstrap.activePacket,
    currentCheckpoint:manifest.bootstrap.currentCheckpoint,
    activeRequirementSet:requirementsStatus.activeRequirementSet?.id,
    antiOverdesignQuestions:requirementsStatus.antiOverdesignQuestions?.length ?? 0,
    readProfiles:Object.keys(manifest.readProfiles),
    agentsBytes:agentsSize
  },null,2));
}
