# ADR — Plugin-Oriented Development Model v0.1

**Status: ACCEPTED**  
**Date: 2026-09-24**

## Decision

EVO product development does not have one mandatory product-development mainline.

The Git branch `main` remains the authoritative integration branch only.

Product development proceeds by independent plugin workstreams. Each plugin may have its own:

- product goal;
- capability boundary;
- dependency contract;
- implementation status;
- verification evidence;
- release cadence;
- backlog;
- pause/resume state.

No plugin must be "finished" before unrelated plugins can advance.

## Ledger Runtime status

**EVO Ledger Runtime** is one plugin in this portfolio.

It already has substantial implemented and verified assets around:

- BusinessData → Posting;
- Ledger / Balance;
- recalculation / replay;
- adjacent cost / valuation experiments and implementation evidence.

Further architectural simplification of Ledger Runtime is **not a default priority**.

Resume Ledger Runtime convergence only when:

- a concrete product/plugin requirement is blocked by its current interface;
- reliability/performance defects require it;
- a plugin dependency needs a cleaner public contract;
- deployment/release separation requires extraction.

Do not spend primary engineering effort on cleanup for architectural purity alone.

## Broader EVO development

The EVO repository may contain requirements for many plugins and broader product capabilities.

A future development portfolio may include, for example:

- EVO Ledger Runtime;
- business application plugins;
- cost / valuation plugins;
- finance/accounting plugins;
- workflow / SOP / metric plugins;
- audit / archive / jurisdiction plugins;
- integration plugins;
- management intelligence plugins.

This list is illustrative, not a fixed plugin taxonomy.

Each plugin should be selected and developed according to concrete product value and acceptance criteria.

## Integration rule

Cross-plugin dependencies must be explicit.

A plugin may depend on another plugin's public capability contract, but should not require that dependency's internal architecture to be fully converged first.

Integration proof should validate the composed business outcome.

## Status model

Project status should distinguish:

```text
Git integration branch
≠
product development mainline
```

Preferred project model:

```text
main
= authoritative integration branch

plugin portfolio
= independent plugin workstreams
```

The repository's compatibility validator may still require one `activeWorkPacket`; when present it represents portfolio coordination/status maintenance, not a single product mainline.

## Consequence

Future planning should answer:

> Which plugin or set of plugins should we advance next, and what business/product value does that unlock?

It should not ask:

> What is the one EVO mainline that everything else must wait behind?
