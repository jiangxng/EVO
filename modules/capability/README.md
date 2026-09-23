# Capability Module

Owns stable definitions of what an enterprise can do. Capability is classification/governance context, not a transaction execution engine.


## Effective runtime discovery

The capability module exposes read-only discovery of the capabilities that are effective for one Enterprise.

Current alpha source:

```text
ACTIVE ApplicationInstance
+ effective PUBLISHED ApplicationDefinitionVersion
+ CommandDefinition
→ EffectiveCapability
```

The public discovery contract is stable even though a future explicit Application Capability Manifest may replace this bootstrap source.

Command authorization policy is declared by command metadata (`config.permissionCode`). Discovery does not grant authority. Public execution fails closed when an effective command capability does not declare an authorization policy.
