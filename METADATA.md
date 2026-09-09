# Metadata Invariants

1. `ApplicationDefinition` identity is stable across versions.
2. Published `ApplicationDefinitionVersion` is treated as immutable business metadata.
3. Only one `ApplicationDefinitionVersion` per ApplicationDefinition may be `PUBLISHED`.
4. Runtime applications use a published definition version.
5. `ApplicationInstance` is enterprise-owned.
6. Enterprise overlay is separate from base definition.
7. Only one overlay per ApplicationInstance may be `PUBLISHED`.
8. A published overlay records its `base_definition_version`.
9. Resolver must reject a published overlay whose base version differs from the selected ApplicationDefinitionVersion.
10. Persistence rows are not cross-module contracts.
11. Effective definition resolution is deterministic for the same persisted versions/configuration.
12. Field structural rebase / three-way overlay merge is not implicitly invented in M1.
