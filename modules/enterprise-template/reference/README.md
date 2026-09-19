# Built-in Enterprise Templates

`enterprise-core-v1.ts` is EVO's repository-owned cross-industry initialization template. It is distilled from the business semantics present in Asloop-Backend and bookkeeping, but expressed only through EVO canonical concepts.

The template contains concrete domains, dimensions, master-data semantics, field catalog, transaction types, field groups, commands, applications, ledgers, conditional posting rules, valuation policies, allocation policy, replay policy and installation policy.

Legacy physical schemas, stored procedures, dynamic SQL, mutable historical balance chains and UI/controller implementations are deliberately excluded.

The Git asset is the rebuild source. PostgreSQL stores published immutable versions. Enterprises bind to an explicit published version and never implicitly follow latest.
