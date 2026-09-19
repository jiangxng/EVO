export const ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION = 'economic-runtime-v0.1';

export function versionedDependencyNodeId(id: string, version: number): string {
  if (!id) throw new Error('Dependency node id is required.');
  if (!Number.isInteger(version) || version < 1) {
    throw new Error('Dependency node version must be a positive integer.');
  }
  return `${id}@v${version}`;
}
