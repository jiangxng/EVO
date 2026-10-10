-- TR-01B2D3: one-use Host -> EVO signed finance read-only assertions.
-- This table stores only replay-control metadata, never financial entries.
-- Preserve rows for audit/replay resistance; cleanup requires a separate governed retention policy.
create table finance_delegation_nonce (
  issuer text not null,
  jti uuid not null,
  installation_id text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz not null default now(),
  primary key (issuer, jti)
);
create index finance_delegation_nonce_installation_time_idx
  on finance_delegation_nonce (installation_id, consumed_at);
