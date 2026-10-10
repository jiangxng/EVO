import { createPublicKey, verify as verifySignature } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import {
  PostgresTradingFinanceFactVerifierV010,
  type TradingFinanceFactInputV010
} from '../../../modules/valuation/infrastructure/postgres-trading-finance-fact-verifier.js';

/**
 * TR-01B2D3 plugin-owner READ-only transport (independent of public demo/command).
 * No installation/trust config = NO ROUTE. A trusted installation is provisioned
 * by the EVO operator, never by headers, payload, or the requesting Host.
 * The signing private key remains with the trusted Host secret provider.
 */
export const FINANCE_OWNER_AUDIENCE_V010 = 'evo:trading-finance-owner:read-only:v0.1.0';
export const FINANCE_OWNER_PATH_V010 =
  '/api/v1/plugins/trading-finance/readonly-verifications';
export const FINANCE_OWNER_TYP_V010 = 'evo-finance-delegation+jwt';

export interface FinanceTrustedInstallationV010 {
  readonly installationId: string;
  readonly issuer: string;
  readonly keyId: string;
  readonly publicKeyPem: string;
  readonly hostEnterpriseId: string;
  readonly contextId: string;
  readonly evoEnterpriseId: string;
  readonly enabled: true;
}

interface FinanceClaimsV010 {
  readonly iss: string;
  readonly aud: string;
  readonly iat: number;
  readonly nbf: number;
  readonly exp: number;
  readonly jti: string;
  readonly purpose: 'TR01B2D3_FINANCE_READONLY';
  readonly installationId: string;
  readonly hostEnterpriseId: string;
  readonly contextId: string;
  readonly evoEnterpriseId: string;
  readonly actorSubjectId: string;
  readonly actorType: 'HUMAN' | 'AI';
  readonly correlationId: string;
  readonly intent: TradingFinanceFactInputV010;
}
function deny(code: string): never { throw new Error(code); }
function nonempty(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 512 && v.trim() === v;
}
function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function decodeJson(value: string): unknown {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) deny('EVO_FINANCE_DELEGATION_MALFORMED');
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.toString('base64url') !== value || decoded.length > 32768) {
    deny('EVO_FINANCE_DELEGATION_MALFORMED');
  }
  return JSON.parse(decoded.toString('utf8')) as unknown;
}
export function parseFinanceTrustedInstallationsV010(raw: string | undefined):
  FinanceTrustedInstallationV010[] {
  if (!raw) return []; // secure-by-default, route not registered
  let data: unknown;
  try { data = JSON.parse(raw); }
  catch { return deny('EVO_FINANCE_TRUST_CONFIG_INVALID'); }
  if (!Array.isArray(data) || data.length > 100) {
    deny('EVO_FINANCE_TRUST_CONFIG_INVALID');
  }
  const seen = new Set<string>();
  return data.map((value: unknown) => {
    if (!record(value) ||
      !['installationId','issuer','keyId','publicKeyPem',
        'hostEnterpriseId','contextId','evoEnterpriseId']
        .every(k => nonempty(value[k])) ||
      value.enabled !== true) deny('EVO_FINANCE_TRUST_CONFIG_INVALID');
    const item = value as unknown as FinanceTrustedInstallationV010;
    const unique = item.issuer + ':' + item.keyId + ':' + item.installationId;
    if (seen.has(unique)) deny('EVO_FINANCE_TRUST_CONFIG_DUPLICATE');
    seen.add(unique);
    const publicKey = createPublicKey(item.publicKeyPem);
    if (publicKey.asymmetricKeyType !== 'ed25519') {
      deny('EVO_FINANCE_TRUST_KEY_INVALID');
    }
    return item;
  });
}

export function authenticateFinanceDelegationV010(
  token: unknown, installations: readonly FinanceTrustedInstallationV010[],
  now = Math.floor(Date.now()/1000)
): FinanceClaimsV010 {
  if (typeof token !== 'string' || token.length > 16384 ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(token)) {
    deny('EVO_FINANCE_DELEGATION_MALFORMED');
  }
  const [head, payload, signature] = token.split('.') as [string,string,string];
  let header: unknown, claims: unknown;
  try { header = decodeJson(head); claims = decodeJson(payload); }
  catch { return deny('EVO_FINANCE_DELEGATION_MALFORMED'); }
  if (!record(header) || header.alg !== 'Ed25519' ||
    header.typ !== FINANCE_OWNER_TYP_V010 || !nonempty(header.kid) ||
    !record(claims) || !nonempty(claims.iss)) {
    deny('EVO_FINANCE_DELEGATION_UNTRUSTED');
  }
  const installation = installations.find(v =>
    v.enabled === true && v.issuer === claims.iss && v.keyId === header.kid &&
    v.installationId === claims.installationId);
  if (!installation) deny('EVO_FINANCE_INSTALLATION_NOT_ADMITTED');
  if (!verifySignature(null, Buffer.from(head+'.'+payload),
    createPublicKey(installation.publicKeyPem), Buffer.from(signature,'base64url'))) {
    deny('EVO_FINANCE_DELEGATION_SIGNATURE_INVALID');
  }
  const c = claims as unknown as FinanceClaimsV010;
  if (c.aud !== FINANCE_OWNER_AUDIENCE_V010 ||
    c.purpose !== 'TR01B2D3_FINANCE_READONLY' ||
    c.installationId !== installation.installationId ||
    c.hostEnterpriseId !== installation.hostEnterpriseId ||
    c.contextId !== installation.contextId ||
    c.evoEnterpriseId !== installation.evoEnterpriseId ||
    !nonempty(c.actorSubjectId) || !nonempty(c.correlationId) ||
    !['HUMAN','AI'].includes(c.actorType) ||
    !Number.isSafeInteger(c.iat) || !Number.isSafeInteger(c.nbf) ||
    !Number.isSafeInteger(c.exp) ||
    c.exp <= c.iat || c.exp > c.iat + 60 ||
    c.iat > now + 5 || c.nbf > now + 5 ||
    c.exp <= now || c.iat < now - 65 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(c.jti) ||
    !record(c.intent) || c.intent.contractVersion !== '0.1.0' ||
    c.intent.evoEnterpriseId !== installation.evoEnterpriseId ||
    !['COST_VALUATION','CASH_ALLOCATION'].includes(c.intent.kind)) {
    deny('EVO_FINANCE_DELEGATION_SCOPE_INVALID');
  }
  return c;
}

/** PostgreSQL UNIQUE constraint, not per-process memory, consumes a signed
 * assertion once across replicas. Denial also consumes the nonce.
 */
async function consumeOnce(db: Kysely<Database>, c: FinanceClaimsV010): Promise<void> {
  const outcome = await sql<{jti:string}>`
    insert into finance_delegation_nonce (issuer, jti, installation_id, expires_at)
    values (${c.iss}, ${c.jti}, ${c.installationId},
            to_timestamp(${c.exp}))
    on conflict (issuer,jti) do nothing returning jti
  `.execute(db);
  if (outcome.rows.length !== 1) deny('EVO_FINANCE_DELEGATION_REPLAY');
}

export function registerFinanceOwnerDelegationRouteV010(
  app: FastifyInstance, db: Kysely<Database>,
  installations: readonly FinanceTrustedInstallationV010[]
): void {
  if (!installations.length) return;
  const verifier = new PostgresTradingFinanceFactVerifierV010(db);
  app.post(FINANCE_OWNER_PATH_V010, { bodyLimit: 20000 },
    async (request, reply) => {
      const body: unknown = request.body;
      try {
        if (!record(body) || Object.keys(body).length !== 1 ||
          !Object.hasOwn(body,'assertion')) deny('EVO_FINANCE_DELEGATION_MALFORMED');
        const c = authenticateFinanceDelegationV010(body.assertion,installations);
        await consumeOnce(db,c);
        const result = await verifier.verify(c.intent);
        return reply.code(200).send({
          contractVersion:'0.1.0',verified:result.verified,
          evoEnterpriseId:result.evoEnterpriseId,orderNo:result.orderNo,
          reasonCodes:[],executionAllowed:false,
          verificationKind:'OWNER_DATABASE_READ_ONLY'
        });
      } catch(e) {
        const code = e instanceof Error && /^EVO_FINANCE_(?:FACT_|DELEGATION_|INSTALLATION_)/u.test(e.message)
          ? (e.message.split(':')[0] ?? 'EVO_FINANCE_DELEGATION_DENIED') : 'EVO_FINANCE_DELEGATION_DENIED';
        const status = code === 'EVO_FINANCE_DELEGATION_REPLAY' ? 409
          : code.startsWith('EVO_FINANCE_FACT_') ? 422 : 401;
        request.log.warn({ code }, 'Finance owner read-only delegation rejected');
        return reply.code(status).send({
          contractVersion:'0.1.0',status:'DENIED',code,executionAllowed:false
        });
      }
    });
}
