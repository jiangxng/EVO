# EVO Public API Documentation

**Status:** Public API documentation index

This directory documents EVO's public API architecture.

## Read order

1. `/PUBLIC-API.md` — authoritative overview and global boundary.
2. `capability-and-application-contract-v0.1.md` — normative contract for installable application APIs and capability discovery.
3. Relevant module/interface documents for Command, Query, Metadata and application runtime.

## Core principle

EVO Core exposes stable platform mechanisms. Domain applications contribute domain capabilities.

An enterprise's effective API surface is determined at runtime from its effective installed applications, application versions and authorization context.

Therefore:

- Sales Order APIs are not unconditional EVO Core APIs.
- Receipt APIs are not unconditional EVO Core APIs.
- Payment APIs are not unconditional EVO Core APIs.
- Purchase/Production APIs are not unconditional EVO Core APIs.
- Uninstalled/inactive application capabilities must not be advertised as callable.
- Removing an application capability does not erase historical business or accounting facts.

## Implementation status vocabulary

Documentation must distinguish:

- **CURRENT IMPLEMENTED** — executable in the current runtime and verified by code/tests.
- **TARGET CONTRACT** — approved public contract not yet fully implemented.
- **REFERENCE/DEMO ONLY** — validation route, not a production commitment.
- **APPLICATION-CONDITIONAL** — exists only when the owning application is effectively installed and active.

Do not present a TARGET CONTRACT or REFERENCE/DEMO ONLY route as CURRENT IMPLEMENTED.
