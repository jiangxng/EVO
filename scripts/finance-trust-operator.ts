/** Trusted ops-only CLI. NO public endpoint, signing private keys or Hot Reload bypass.
 * Usage:
 * node dist/scripts/finance-trust-operator.js grant /abs/installation-public.json operator-id change-ticket
 * node dist/scripts/finance-trust-operator.js revoke issuer installation-id kid operator-id change-ticket
 * Only DB credentials held by infrastructure operators may execute this command.
 * Grants must use a fresh unique kid; revoked key identities cannot be reused.
 */
import { readFileSync } from 'node:fs';
import { sql } from 'kysely';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { parseFinanceTrustedInstallationsV010 } from
  '../apps/api/src/finance-owner-delegation-route.js';
const [action,...args]=process.argv.slice(2);
const nonempty=(value: unknown,max:number):value is string=>
  typeof value === 'string' && value.trim()===value
  && value.length>0 && value.length<=max;
let issuer:string, installationId:string, keyId:string;
let actor:string,reason:string;
let grant:ReturnType<typeof parseFinanceTrustedInstallationsV010>[number]|undefined;
if(action==='grant'){
 const [file,a,r]=args;
 if(!nonempty(file,1024))throw new Error('FINANCE_TRUST_CONFIG_FILE_REQUIRED');
 const input=JSON.parse(readFileSync(file,'utf8')) as unknown;
 grant=parseFinanceTrustedInstallationsV010(JSON.stringify([input]))[0];
 if(!grant)throw new Error('FINANCE_TRUST_GRANT_INVALID');
 ({issuer,installationId,keyId}=grant);
 actor=a??''; reason=r??'';
}else if(action==='revoke'){
 const [i,id,k,a,r]=args;
 issuer=i??'';installationId=id??'';keyId=k??'';
 actor=a??'';reason=r??'';
}else{
 throw new Error('FINANCE_TRUST_USAGE_INVALID');
}
if(![issuer,installationId,keyId].every(x=>nonempty(x,512))
  || !nonempty(actor,256)||!nonempty(reason,1024)){
 throw new Error('FINANCE_TRUST_OPERATOR_SCOPE_REASON_REQUIRED');
}
const database=createDatabase(loadRuntimeConfig().databaseUrl);
try{
 await database.db.transaction().execute(async trx=>{
   await sql`select set_config('evo.finance_trust_actor',${actor},true),
     set_config('evo.finance_trust_reason',${reason},true)`.execute(trx);
   if(action==='grant'){
     await sql`insert into finance_trusted_signing_key
       (issuer,installation_id,key_id,public_key_pem,host_enterprise_id,
        context_id,evo_enterprise_id,status)
       values (${issuer},${installationId},${keyId},${grant!.publicKeyPem},
        ${grant!.hostEnterpriseId},${grant!.contextId},${grant!.evoEnterpriseId},'ACTIVE')`
       .execute(trx);
   }else{
     const change=await sql<{key_id:string}>`
       update finance_trusted_signing_key
       set status='REVOKED', revoked_at=now()
       where issuer=${issuer} and installation_id=${installationId}
         and key_id=${keyId} and status='ACTIVE'
       returning key_id
     `.execute(trx);
     if(change.rows.length!==1)throw new Error('FINANCE_TRUST_ACTIVE_KEY_NOT_FOUND');
   }
 });
 console.log(JSON.stringify({
  event:'FINANCE_TRUST_OPERATOR_CHANGE',action:action.toUpperCase(),
  issuer,installationId,keyId,operator:actor,
  audit:'DURABLE_POSTGRES_TRIGGER',financialExecutionAllowed:false
 }));
}finally{
 await database.destroy();
}
