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

const projectStatus = JSON.parse(await readFile(manifest.bootstrap.projectStatus,'utf8')) as { activeWorkPacket?: { id?: string; overallClosed?: boolean; openGates?: readonly string[] } };
if (projectStatus.activeWorkPacket?.id === undefined) failures.push('project.status.json lacks activeWorkPacket.id.');
if (!Array.isArray(projectStatus.activeWorkPacket?.openGates)) failures.push('project.status.json lacks activeWorkPacket.openGates array.');

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
    readProfiles:Object.keys(manifest.readProfiles),
    agentsBytes:agentsSize
  },null,2));
}
