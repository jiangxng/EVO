# Capability Module

Owns stable definitions of what an enterprise can do. Capability is classification/governance context, not a transaction execution engine.

## Current implemented slice

The module now owns effective runtime capability discovery.

Public API:

- `EffectiveCapabilityDiscovery.listApplications(enterpriseId)`
- `EffectiveCapabilityDiscovery.listCapabilities(enterpriseId)`

### Alpha bootstrap source

Until an explicit Application Capability Manifest persistence contract is implemented, effective COMMAND capabilities are derived from:

```text
ACTIVE ApplicationInstance
+ effective PUBLISHED ApplicationDefinitionVersion
+ CommandDefinition
```

This is intentionally a replaceable bootstrap source. The public discovery contract must remain stable when explicit manifests replace command-derived capability discovery.

Disabled/archived application instances are not exposed as current capabilities.

Capability discovery is read-only and does not authorize execution by itself.
