import { createHash } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type { EnterpriseTemplateBinding, EnterpriseTemplateService, EnterpriseTemplateVersion, PublishEnterpriseTemplateInput } from '../api/contracts.js';

function canonical(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as JsonObject;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key] ?? null)}`).join(',')}}`;
}
function digest(definition: JsonObject): string { return createHash('sha256').update(canonical(definition)).digest('hex'); }
function fail(code:string,message:string):never { throw new AppError({code,message,module:'enterprise-template',operation:'runtime'}); }
function asDate(value: Date | string): Date { return value instanceof Date ? value : new Date(value); }

export class PostgresEnterpriseTemplateService implements EnterpriseTemplateService {
  constructor(private readonly db: Kysely<Database>) {}

  async get(templateCode:string, version?:number):Promise<EnterpriseTemplateVersion> {
    let query=this.db.selectFrom('enterprise_template as t').innerJoin('enterprise_template_version as v','v.enterprise_template_id','t.id')
      .select(['t.code as templateCode','t.name as templateName','v.version','v.status','v.semantic_digest as semanticDigest','v.definition'])
      .where('t.code','=',templateCode);
    query=version===undefined?query.where('v.status','=','PUBLISHED').orderBy('v.version','desc'):query.where('v.version','=',version);
    const row=await query.executeTakeFirst(); if(!row) fail('ENTERPRISE_TEMPLATE_NOT_FOUND',`Template ${templateCode}${version===undefined?'':` v${version}`} was not found.`);
    return {...row,definition:row.definition as JsonObject};
  }

  async publish(input:PublishEnterpriseTemplateInput):Promise<EnterpriseTemplateVersion> {
    if(!Number.isInteger(input.version)||input.version<1) fail('ENTERPRISE_TEMPLATE_VERSION_INVALID','Template version must be a positive integer.');
    const semanticDigest=digest(input.definition);
    return this.db.transaction().execute(async trx=>{
      const template=await trx.insertInto('enterprise_template').values({code:input.templateCode,name:input.templateName,description:input.description??null})
        .onConflict(oc=>oc.column('code').doUpdateSet({name:input.templateName,description:input.description??null})).returning('id').executeTakeFirstOrThrow();
      const existing=await trx.selectFrom('enterprise_template_version').select(['semantic_digest','definition','status']).where('enterprise_template_id','=',template.id).where('version','=',input.version).executeTakeFirst();
      if(existing){ if(existing.semantic_digest!==semanticDigest) fail('ENTERPRISE_TEMPLATE_VERSION_DRIFT','A published template version is immutable; publish a new version.'); return this.get(input.templateCode,input.version); }
      await trx.insertInto('enterprise_template_version').values({enterprise_template_id:template.id,version:input.version,status:'PUBLISHED',definition:input.definition,semantic_digest:semanticDigest,published_at:sql`now()`}).execute();
      return {templateCode:input.templateCode,templateName:input.templateName,version:input.version,status:'PUBLISHED',semanticDigest,definition:input.definition};
    });
  }

  async bindEnterprise(enterpriseCode:string,templateCode:string,version:number,actorId:string,reason?:string):Promise<EnterpriseTemplateBinding>{
    return this.db.transaction().execute(async trx=>{
      const enterprise=await trx.selectFrom('enterprise').select(['id','code']).where('code','=',enterpriseCode).executeTakeFirst(); if(!enterprise) fail('ENTERPRISE_NOT_FOUND',`Enterprise ${enterpriseCode} was not found.`);
      const target=await trx.selectFrom('enterprise_template as t').innerJoin('enterprise_template_version as v','v.enterprise_template_id','t.id').select(['t.id as templateId','v.id as versionId','v.version','v.status','v.semantic_digest as semanticDigest']).where('t.code','=',templateCode).where('v.version','=',version).executeTakeFirst();
      if(!target||target.status!=='PUBLISHED') fail('ENTERPRISE_TEMPLATE_VERSION_NOT_PUBLISHED',`Template ${templateCode} v${version} is not published.`);
      const row=await trx.insertInto('enterprise_template_binding').values({enterprise_id:enterprise.id,enterprise_template_id:target.templateId,enterprise_template_version_id:target.versionId,bound_by:actorId,binding_reason:reason??null})
        .onConflict(oc=>oc.column('enterprise_id').doUpdateSet({enterprise_template_id:target.templateId,enterprise_template_version_id:target.versionId,bound_by:actorId,binding_reason:reason??null,bound_at:sql`now()`})).returning('bound_at').executeTakeFirstOrThrow();
      return {enterpriseId:enterprise.id,enterpriseCode:enterprise.code,templateCode,templateVersion:target.version,semanticDigest:target.semanticDigest,boundAt:asDate(row.bound_at)};
    });
  }

  async getEnterpriseBinding(enterpriseCode:string):Promise<EnterpriseTemplateBinding|null>{
    const row=await this.db.selectFrom('enterprise as e').innerJoin('enterprise_template_binding as b','b.enterprise_id','e.id').innerJoin('enterprise_template as t','t.id','b.enterprise_template_id').innerJoin('enterprise_template_version as v','v.id','b.enterprise_template_version_id')
      .select(['e.id as enterpriseId','e.code as enterpriseCode','t.code as templateCode','v.version as templateVersion','v.semantic_digest as semanticDigest','b.bound_at as boundAt']).where('e.code','=',enterpriseCode).executeTakeFirst();
    return row===undefined?null:{...row,boundAt:asDate(row.boundAt)};
  }
}
