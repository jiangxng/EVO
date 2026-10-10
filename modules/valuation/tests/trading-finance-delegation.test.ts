import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import {
  authenticateFinanceDelegationV010, parseFinanceTrustedInstallationsV010,
  FINANCE_OWNER_AUDIENCE_V010, FINANCE_OWNER_TYP_V010
} from '../../../apps/api/src/finance-owner-delegation-route.js';

const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const trust={
  installationId:'fin-test-install',
  issuer:'app-platform-finance-ci',
  keyId:'ci-key-1',
  publicKeyPem:publicKey.export({format:'pem',type:'spki'}).toString(),
  hostEnterpriseId:'host-tenant-a',contextId:'context-a',
  evoEnterpriseId:'evo-tenant-a',enabled:true as const
};
const t=1700000000;
function token(override:Record<string,unknown>={},
               headerOverride:Record<string,unknown>={},
               key=privateKey):string {
  const header={alg:'Ed25519',typ:FINANCE_OWNER_TYP_V010,kid:trust.keyId,...headerOverride};
  const payload={
    iss:trust.issuer,aud:FINANCE_OWNER_AUDIENCE_V010,
    iat:t,nbf:t,exp:t+45,jti:randomUUID(),
    purpose:'TR01B2D3_FINANCE_READONLY',
    installationId:trust.installationId,
    hostEnterpriseId:trust.hostEnterpriseId,
    contextId:trust.contextId,evoEnterpriseId:trust.evoEnterpriseId,
    actorSubjectId:'host-user-1',actorType:'HUMAN',
    correlationId:'test-correlation',
    intent:{contractVersion:'0.1.0',kind:'COST_VALUATION',
      evoEnterpriseId:trust.evoEnterpriseId,orderNo:'SO-1'},
    ...override
  };
  const part=[header,payload].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
  return part+'.'+sign(null,Buffer.from(part),key).toString('base64url');
}
describe('TR-01B2D3 trusted delegation crypto admission',()=>{
 it('is disabled without an explicit installed trusted issuer',()=>{
  expect(parseFinanceTrustedInstallationsV010(undefined)).toEqual([]);
  expect(()=>authenticateFinanceDelegationV010(token(),[],t))
    .toThrow('EVO_FINANCE_INSTALLATION_NOT_ADMITTED');
 });
 it('admits valid actor/enterprise/context pinned signed envelope only',()=>{
  expect(authenticateFinanceDelegationV010(token(),[trust],t).actorSubjectId)
    .toBe('host-user-1');
 });
 it.each([
  [{hostEnterpriseId:'host-tenant-b'},'SCOPE_INVALID'],
  [{evoEnterpriseId:'evo-tenant-b'},'SCOPE_INVALID'],
  [{contextId:'other-context'},'SCOPE_INVALID'],
  [{aud:'another-audience'},'SCOPE_INVALID'],
  [{actorSubjectId:''},'SCOPE_INVALID'],
  [{purpose:'a-write-purpose'},'SCOPE_INVALID'],
  [{iat:t-200,exp:t-180,nbf:t-200},'SCOPE_INVALID'],
  [{iat:t+15,exp:t+30,nbf:t+15},'SCOPE_INVALID'],
  [{exp:t+600},'SCOPE_INVALID']
 ])('rejects altered signed claim %o', (change,code)=>{
  expect(()=>authenticateFinanceDelegationV010(token(change),[trust],t))
   .toThrow('EVO_FINANCE_DELEGATION_'+code);
 });
 it('rejects bad signatures and wrong algorithms without fallback',()=>{
  const stranger=generateKeyPairSync('ed25519');
  expect(()=>authenticateFinanceDelegationV010(token({}, {},stranger.privateKey),[trust],t))
    .toThrow('EVO_FINANCE_DELEGATION_SIGNATURE_INVALID');
  expect(()=>authenticateFinanceDelegationV010(token({}, {alg:'none'}),[trust],t))
    .toThrow('EVO_FINANCE_DELEGATION_UNTRUSTED');
  expect(()=>authenticateFinanceDelegationV010(token({}, {alg:'EdDSA'}),[trust],t))
    .toThrow('EVO_FINANCE_DELEGATION_UNTRUSTED');
 });
 it('rejects untrusted/disabled installations and malformed trust settings',()=>{
  expect(()=>authenticateFinanceDelegationV010(token(),[{...trust,enabled:false as never}],t))
   .toThrow('EVO_FINANCE_INSTALLATION_NOT_ADMITTED');
  expect(()=>parseFinanceTrustedInstallationsV010('[{"keyId":"test"}]'))
   .toThrow('EVO_FINANCE_TRUST_CONFIG_INVALID');
 });
});
