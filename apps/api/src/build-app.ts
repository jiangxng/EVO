import Fastify, { type FastifyInstance } from 'fastify';
import type { DatabaseHandle } from '../../../platform/database/src/index.js';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { JsonObject, JsonValue } from '../../../modules/metadata/api/contracts.js';
import { legacyEnterpriseTemplateV1 } from '../../../modules/enterprise-template/reference/legacy-enterprise-template-v1.js';
import { enterpriseCoreV1 } from '../../../modules/enterprise-template/reference/enterprise-core-v1.js';
import { createEvoRuntime, demoIds, drainPosting } from './evo-runtime.js';
import { demoConsoleHtml } from './demo-console.js';
import {
  burnConfiguratorConfiguration,
  submitConfiguratorBusinessData,
  type ConfiguratorBurnBody,
  type ConfiguratorSubmitBody
} from './configurator-mvp.js';

export interface BuildAppOptions { readonly database?:DatabaseHandle; readonly loggerLevel?:string; }
type DemoActorBody={actor?:{type?:'HUMAN'|'AI';id?:string}};
function resolveActor(body:DemoActorBody){return body.actor?.type==='AI'?{type:'AI' as const,id:body.actor.id??'demo-agent'}:{type:'HUMAN' as const,id:body.actor?.id??'demo-user'};}
function payloadValue(payload:JsonObject,key:string):JsonValue{return payload[key]??null;}
type PublicCommandBody={
 enterpriseId?:string; capabilityCode?:string;
 actor?:{type?:'HUMAN'|'AI'|'AUTOMATION';id?:string};
 idempotencyKey?:string; correlationId?:string; effectiveAt?:string;
 businessObjectKey?:string; input?:unknown;
};
function requireText(value:unknown,field:string):string{
 if(typeof value!=='string'||value.trim().length===0)throw new AppError({code:'PUBLIC_COMMAND_FIELD_REQUIRED',message:`${field} is required.`,module:'api',operation:'invokePublicCommand',details:{field}});
 return value.trim();
}

export function buildApp(options:BuildAppOptions={}):FastifyInstance{
 const app=Fastify({logger:{level:options.loggerLevel??'info'},requestIdHeader:'x-request-id'});
 app.get('/health/live',async()=>({status:'ok',service:'evo-api',version:'1.0.0-alpha.2'}));
 app.get('/health/ready',async(_request,reply)=>{if(options.database===undefined)return reply.code(503).send({status:'not_ready',reason:'database_not_configured'});try{await options.database.ping();return{status:'ready',version:'1.0.0-alpha.2'};}catch{return reply.code(503).send({status:'not_ready',reason:'database_unavailable'});}});
 if(options.database!==undefined){
  const runtime=createEvoRuntime(options.database);
  app.get('/',async(_request,reply)=>reply.type('text/html; charset=utf-8').send(demoConsoleHtml));

  app.post('/api/v1/configurator/burn', async request => {
    const body = request.body as ConfiguratorBurnBody;
    return burnConfiguratorConfiguration(runtime.db, body);
  });
  app.post('/api/v1/configurator/business-data', async request => {
    const body = request.body as ConfiguratorSubmitBody;
    return submitConfiguratorBusinessData(runtime, request.id, body);
  });
  app.get('/api/v1/configurator/status', async () => {
    const enterprise = await runtime.db.selectFrom('enterprise')
      .select(['id','code','name'])
      .where('code','=','EVO_CONFIG_MVP')
      .executeTakeFirst();
    if (enterprise === undefined) return { burned:false };
    const rules = await runtime.db.selectFrom('posting_rule as r')
      .innerJoin('application_definition_version as v','v.id','r.application_definition_version_id')
      .innerJoin('application_definition as a','a.id','v.application_definition_id')
      .select(({fn}) => [fn.countAll<number>().as('count')])
      .where('a.code','like','cfg_app_%')
      .executeTakeFirstOrThrow();
    return { burned:true, enterprise, postingRules:Number(rules.count) };
  });

  app.get('/api/v1/enterprises/:enterpriseCode',async request=>{
   const code=(request.params as {enterpriseCode:string}).enterpriseCode;
   const enterprise=await runtime.metadata.getEnterpriseByCode(code);
   if(enterprise===null)throw new AppError({code:'ENTERPRISE_NOT_FOUND',message:'Enterprise was not found.',module:'api',operation:'getEnterpriseByCode',details:{enterpriseCode:code}});
   return enterprise;
  });
  app.get('/api/v1/apps',async request=>{const q=request.query as {enterprise_id?:string};if(q.enterprise_id===undefined)throw new AppError({code:'ENTERPRISE_SCOPE_REQUIRED',message:'enterprise_id query parameter is required.',module:'api',operation:'listApplications'});return runtime.capabilityDiscovery.listApplications(q.enterprise_id);});
  app.get('/api/v1/capabilities',async request=>{const q=request.query as {enterprise_id?:string};if(q.enterprise_id===undefined)throw new AppError({code:'ENTERPRISE_SCOPE_REQUIRED',message:'enterprise_id query parameter is required.',module:'api',operation:'listCapabilities'});return runtime.capabilityDiscovery.listCapabilities(q.enterprise_id);});
  app.post('/api/v1/commands',async request=>{
   const body=request.body as PublicCommandBody;
   const enterpriseId=requireText(body.enterpriseId,'enterpriseId');
   const capabilityCode=requireText(body.capabilityCode,'capabilityCode');
   const actorId=requireText(body.actor?.id,'actor.id');
   const actorType=body.actor?.type;
   if(actorType!=='HUMAN'&&actorType!=='AI'&&actorType!=='AUTOMATION')throw new AppError({code:'PUBLIC_COMMAND_ACTOR_TYPE_INVALID',message:'actor.type must be HUMAN, AI or AUTOMATION.',module:'api',operation:'invokePublicCommand'});
   const effectiveAtText=requireText(body.effectiveAt,'effectiveAt');
   const effectiveAt=new Date(effectiveAtText);
   if(Number.isNaN(effectiveAt.getTime()))throw new AppError({code:'INVALID_EFFECTIVE_TIME',message:'effectiveAt must be a valid ISO date/time.',module:'api',operation:'invokePublicCommand'});
   if(body.input===null||typeof body.input!=='object'||Array.isArray(body.input))throw new AppError({code:'PUBLIC_COMMAND_INPUT_REQUIRED',message:'input must be a JSON object.',module:'api',operation:'invokePublicCommand'});
   const result=await runtime.publicCommands.invoke({
    enterpriseId,capabilityCode,actor:{type:actorType,id:actorId},
    requestId:request.id,
    correlationId:requireText(body.correlationId,'correlationId'),
    idempotencyKey:requireText(body.idempotencyKey,'idempotencyKey'),
    effectiveAt,
    businessObjectKey:requireText(body.businessObjectKey,'businessObjectKey'),
    input:body.input as JsonObject
   });
   return {
    capabilityCode:result.capabilityCode,
    command:{
     ...result.command,
     businessObjectVersion:result.command.businessObjectVersion.toString(),
     postingSequence:result.command.postingSequence.toString()
    }
   };
  });

  app.get('/api/v1/enterprise-templates/:templateCode',async request=>{const p=request.params as {templateCode:string};const q=request.query as {version?:string};const version=q.version===undefined?undefined:Number(q.version);return runtime.enterpriseTemplates.get(p.templateCode,version);});
  app.put('/api/v1/enterprise-templates/:templateCode/versions/:version',async request=>{const p=request.params as {templateCode:string;version:string};const body=request.body as {name:string;description?:string;definition:JsonObject};const input={templateCode:p.templateCode,templateName:body.name,version:Number(p.version),definition:body.definition,...(body.description===undefined?{}:{description:body.description})};return runtime.enterpriseTemplates.publish(input);});
  app.get('/api/v1/enterprises/:enterpriseCode/template',async request=>runtime.enterpriseTemplates.getEnterpriseBinding((request.params as {enterpriseCode:string}).enterpriseCode));
  app.put('/api/v1/enterprises/:enterpriseCode/template',async request=>{const p=request.params as {enterpriseCode:string};const body=request.body as {templateCode:string;version:number;actorId?:string;reason?:string};return runtime.enterpriseTemplates.bindEnterprise(p.enterpriseCode,body.templateCode,body.version,body.actorId??'evo-admin',body.reason);});
  app.post('/api/v1/enterprise-templates/enterprise-core/initialize',async()=>runtime.enterpriseTemplates.publish({templateCode:'enterprise-core',templateName:'EVO Enterprise Core',description:'Repository-owned cross-industry initialization template distilled from Asloop-Backend and bookkeeping semantics.',version:1,definition:enterpriseCoreV1}));
  app.post('/api/v1/enterprise-templates/legacy-reference/initialize',async()=>runtime.enterpriseTemplates.publish({templateCode:'legacy-enterprise-core',templateName:'Legacy Enterprise Core',description:'Semantic template distilled from Asloop-Backend and bookkeeping; no legacy implementation copied.',version:1,definition:legacyEnterpriseTemplateV1}));

  app.get('/api/v1/demo/dashboard',async()=>{const ids=await demoIds(runtime);return runtime.query.dashboard(ids.enterpriseId);});
  app.get('/api/v1/demo/ai/catalog',async()=>{const ids=await demoIds(runtime);return{actorBoundary:'AI uses the same Command boundary as Human/Automation.',contextContract:'LLM.md + context.manifest.json',tools:await runtime.ai.list(ids.enterpriseId)};});
  app.post('/api/v1/demo/sales-orders/approve',async request=>{const ids=await demoIds(runtime);const body=request.body as DemoActorBody&{orderNo:string;customer:string;productId:string;quantity:number;unitPrice:string;totalAmount:string;currency:string;project?:string;department?:string;profitCenter?:string;costCenter?:string};const actor=resolveActor(body);await runtime.auth.require({enterpriseId:ids.enterpriseId,actorType:actor.type,actorId:actor.id,permissionCode:'sales.approve'});const result=await runtime.command.execute({enterpriseId:ids.enterpriseId,applicationInstanceId:ids.salesAppId,commandCode:'approve-sales-order',actor,requestId:request.id,correlationId:`O2C:${body.orderNo}`,idempotencyKey:`approve:${body.orderNo}`,input:{orderNo:body.orderNo,customer:body.customer,productId:body.productId,quantity:body.quantity,unitPrice:body.unitPrice,totalAmount:body.totalAmount,currency:body.currency,fulfillmentMode:'MAKE',project:body.project??null,department:body.department??null,profitCenter:body.profitCenter??null,costCenter:body.costCenter??null},effectiveAt:new Date(),businessObjectKey:body.orderNo,lineage:{flowDefinitionId:ids.flowDefinitionId,flowInstanceKey:body.orderNo,stepCode:'sales-order-approved'}});await runtime.flow.projectCommand(result.commandExecutionId);return{command:result,posted:await drainPosting(runtime,ids.enterpriseId)};});
  app.post('/api/v1/demo/production/complete',async request=>{const ids=await demoIds(runtime);const body=request.body as DemoActorBody&{orderNo:string;customer:string;productId:string;warehouse:string;quantity:number;totalCost:string;project?:string;department?:string;profitCenter?:string;costCenter?:string};const actor=resolveActor(body);await runtime.auth.require({enterpriseId:ids.enterpriseId,actorType:actor.type,actorId:actor.id,permissionCode:'production.complete'});const parent=await runtime.db.selectFrom('business_data').select(['id','payload']).where('enterprise_id','=',ids.enterpriseId).where('business_data_type','=','sales_order.approved').where('business_object_key','=',body.orderNo).orderBy('business_object_version','desc').executeTakeFirstOrThrow();const parentPayload=parent.payload as JsonObject;const result=await runtime.command.execute({enterpriseId:ids.enterpriseId,applicationInstanceId:ids.productionAppId,commandCode:'complete-production',actor,requestId:request.id,correlationId:`O2C:${body.orderNo}`,causationId:parent.id,idempotencyKey:`production-complete:${body.orderNo}:${body.productId}:${request.id}`,input:{orderNo:body.orderNo,customer:body.customer,productId:body.productId,warehouse:body.warehouse,quantity:body.quantity,totalCost:body.totalCost,project:body.project??payloadValue(parentPayload,'project'),department:body.department??payloadValue(parentPayload,'department'),profitCenter:body.profitCenter??payloadValue(parentPayload,'profitCenter'),costCenter:body.costCenter??payloadValue(parentPayload,'costCenter')},effectiveAt:new Date(),businessObjectKey:`PROD:${body.orderNo}:${body.productId}`,lineage:{flowDefinitionId:ids.flowDefinitionId,flowInstanceKey:body.orderNo,stepCode:'production-completed',parentBusinessDataId:parent.id,relationType:'FULFILLS'}});await runtime.flow.projectCommand(result.commandExecutionId);return{command:result,posted:await drainPosting(runtime,ids.enterpriseId)};});
  app.post('/api/v1/demo/shipments/create',async request=>{const ids=await demoIds(runtime);const body=request.body as DemoActorBody&{shipmentNo:string;orderNo:string;customer:string;productId:string;warehouse:string;quantity:number;lot?:string;project?:string;department?:string;profitCenter?:string;costCenter?:string};const actor=resolveActor(body);await runtime.auth.require({enterpriseId:ids.enterpriseId,actorType:actor.type,actorId:actor.id,permissionCode:'inventory.ship'});const parent=await runtime.db.selectFrom('business_data').select(['id','payload']).where('enterprise_id','=',ids.enterpriseId).where('business_data_type','=','sales_order.approved').where('business_object_key','=',body.orderNo).orderBy('business_object_version','desc').executeTakeFirstOrThrow();const parentPayload=parent.payload as JsonObject;const result=await runtime.command.execute({enterpriseId:ids.enterpriseId,applicationInstanceId:ids.inventoryAppId,commandCode:'ship-sales-order',actor,requestId:request.id,correlationId:`O2C:${body.orderNo}`,causationId:parent.id,idempotencyKey:`shipment:${body.shipmentNo}`,input:{movementType:'SHIP',shipmentNo:body.shipmentNo,orderNo:body.orderNo,customer:body.customer,productId:body.productId,warehouse:body.warehouse,quantity:body.quantity,lot:body.lot??null,project:body.project??payloadValue(parentPayload,'project'),department:body.department??payloadValue(parentPayload,'department'),profitCenter:body.profitCenter??payloadValue(parentPayload,'profitCenter'),costCenter:body.costCenter??payloadValue(parentPayload,'costCenter')},effectiveAt:new Date(),businessObjectKey:body.shipmentNo,lineage:{flowDefinitionId:ids.flowDefinitionId,flowInstanceKey:body.orderNo,stepCode:'shipment-created',parentBusinessDataId:parent.id,relationType:'FULFILLS'}});await runtime.flow.projectCommand(result.commandExecutionId);return{command:result,posted:await drainPosting(runtime,ids.enterpriseId)};});
  app.post('/api/v1/demo/cost/recalculate',async request=>{const ids=await demoIds(runtime);const body=request.body as {method?:'FIFO'|'LIFO'|'MOVING_AVERAGE'|'SPECIFIC_IDENTIFICATION'};return runtime.cost.recalculate(ids.enterpriseId,body.method??'FIFO');});
  app.post('/api/v1/demo/replay',async()=>{const ids=await demoIds(runtime);const beforeDigest=await runtime.query.balanceDigest(ids.enterpriseId);const replay=await runtime.replay.prepareFullReplay(ids.enterpriseId);const posted=await drainPosting(runtime,ids.enterpriseId);const cost=replay.costMethod===null?null:await runtime.cost.recalculate(ids.enterpriseId,replay.costMethod,replay.costPins??undefined);const afterDigest=await runtime.query.balanceDigest(ids.enterpriseId);await runtime.replay.completeFullReplay(replay.replayRunId,ids.enterpriseId,afterDigest);return{replayRunId:replay.replayRunId,boundarySequence:replay.boundarySequence.toString(),posted,cost,beforeDigest,replayRecordedBeforeDigest:replay.beforeDigest,afterDigest,deterministic:beforeDigest===afterDigest&&replay.beforeDigest===beforeDigest};});
 }
 app.setErrorHandler((error,request,reply)=>{if(error instanceof AppError)return reply.code(422).send({error:{code:error.code,message:error.message,retryable:error.retryable,details:error.details,correlation_id:request.id}});request.log.error({err:error},'Unhandled request error.');return reply.code(500).send({error:{code:'INTERNAL_ERROR',message:error instanceof Error?error.message:'Internal server error.',retryable:false,correlation_id:request.id}});});
 return app;
}