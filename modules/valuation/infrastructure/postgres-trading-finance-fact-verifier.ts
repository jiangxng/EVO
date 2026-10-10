import Decimal from 'decimal.js';
import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';

/**
 * Plugin-owned, READ-ONLY historical financial fact/pin verification.
 * This module must NOT be mounted as an anonymous HTTP endpoint.
 * Trusted Host delegation is a separate admission gate: the caller of this
 * internal service must be an authenticated plugin or an isolated owner CI.
 */
export type TradingFinancePinV010={readonly id:string;readonly version:number};
export interface TradingFinanceFactBaseV010 {
 readonly contractVersion:'0.1.0';
 readonly evoEnterpriseId:string;
 readonly orderNo:string;
 readonly customerCounterpartyId:string;
 readonly itemId:string;
 readonly warehouseId:string;
 readonly idempotencyKey:string;
}
export interface TradingCostFactInputV010 extends TradingFinanceFactBaseV010 {
 readonly kind:'COST_VALUATION';
 readonly shipmentBusinessDataId:string;
 readonly costMethod:'FIFO'|'LIFO'|'MOVING_AVERAGE'|'SPECIFIC_IDENTIFICATION';
 readonly valuationPolicy:TradingFinancePinV010;
 readonly allocationPolicy:TradingFinancePinV010;
 readonly shipmentValuationRule:TradingFinancePinV010;
 readonly boundarySequence:string;
}
export interface TradingCashFactInputV010 extends TradingFinanceFactBaseV010 {
 readonly kind:'CASH_ALLOCATION';
 readonly sourceOrderBusinessDataId:string;
 readonly consumerReceiptBusinessDataId:string;
 readonly amount:string;
 readonly currency:string;
 readonly allocationPolicy:TradingFinancePinV010;
 readonly settlementMode:'EXPLICIT_FULL';
}
export type TradingFinanceFactInputV010=TradingCostFactInputV010|TradingCashFactInputV010;
export interface TradingFinanceFactVerdictV010 {
 readonly contractVersion:'0.1.0';
 readonly verified:true;
 readonly evoEnterpriseId:string;
 readonly orderNo:string;
 readonly reasonCodes:readonly [];
 readonly executionAllowed:false;
 readonly verificationKind:'OWNER_DATABASE_READ_ONLY';
}
/** Fail-closed validation has no successful "unknown" or soft warning state. */
function deny(reason:string):never {
 throw new Error('EVO_FINANCE_FACT_'+reason);
}
function field(value:unknown,name:string):string {
 if(typeof value!=='string'||!value.trim())deny('FIELD_REQUIRED:'+name);
 return (value as string).trim();
}
function pinned(v:TradingFinancePinV010,name:string):void {
 if(!v||typeof v.id!=='string'||!v.id.trim()||
   !Number.isSafeInteger(v.version)||v.version<=0)deny('PIN_INVALID:'+name);
}
function payloadMatches(payload:Record<string,unknown>,
 input:TradingFinanceFactBaseV010):boolean {
 return payload.orderNo===input.orderNo&&
  payload.customer===input.customerCounterpartyId&&
  payload.productId===input.itemId&&payload.warehouse===input.warehouseId;
}
function exactMoney(v:unknown):Decimal {
 if(typeof v!=='string'&&typeof v!=='number')deny('AMOUNT_MISSING');
 const result=new Decimal(String(v));
 if(!result.isFinite()||result.lte(0))deny('AMOUNT_INVALID');
 return result;
}

/**
 * Only the same-tenant immutable BusinessData, POSTED state and published
 * policy/rule rows are read. No Ledger write, CostEngine, AllocationStore,
 * Command invoker or credential/actor assertion lives in this owner service.
 */
export class PostgresTradingFinanceFactVerifierV010 {
 constructor(private readonly db:Kysely<Database>){}
 async verify(input:TradingFinanceFactInputV010):Promise<TradingFinanceFactVerdictV010>{
  if(!input||input.contractVersion!=='0.1.0')deny('CONTRACT_UNSUPPORTED');
  const enterprise=field(input.evoEnterpriseId,'evoEnterpriseId');
  field(input.idempotencyKey,'idempotencyKey');
  field(input.orderNo,'orderNo');
  field(input.customerCounterpartyId,'customerCounterpartyId');
  field(input.itemId,'itemId');
  field(input.warehouseId,'warehouseId');

  const state=await this.db.selectFrom('enterprise_runtime_state')
   .select(['next_posting_sequence','posting_mode','replay_required'])
   .where('enterprise_id','=',enterprise).executeTakeFirst();
  if(!state||state.posting_mode!=='NORMAL'||state.replay_required)deny('RUNTIME_NOT_NORMAL');

  const orders=await this.db.selectFrom('business_data')
   .select(['id','business_data_type','business_object_key','payload'])
   .where('enterprise_id','=',enterprise)
   .where('business_data_type','=','sales_order.approved')
   .where('business_object_key','=',input.orderNo)
   .execute();
  if(orders.length!==1)deny('ORDER_NOT_UNIQUE');
  const order=orders[0]!;
  if(!payloadMatches(order.payload as Record<string,unknown>,input))deny('ORDER_SCOPE_MISMATCH');

  if(input.kind==='COST_VALUATION'){
   pinned(input.valuationPolicy,'valuationPolicy');
   pinned(input.allocationPolicy,'allocationPolicy');
   pinned(input.shipmentValuationRule,'shipmentValuationRule');
   field(input.shipmentBusinessDataId,'shipmentBusinessDataId');
   if(!/^[1-9][0-9]*$/u.test(input.boundarySequence))deny('BOUNDARY_INVALID');
   const boundary=BigInt(input.boundarySequence);
   if(boundary>=BigInt(state.next_posting_sequence))deny('BOUNDARY_IN_FUTURE');

   const shipment=await this.db.selectFrom('business_data')
    .select(['id','payload'])
    .where('id','=',input.shipmentBusinessDataId)
    .where('enterprise_id','=',enterprise)
    .where('business_data_type','=','sales_shipment.created')
    .executeTakeFirst();
   if(!shipment||!payloadMatches(shipment.payload as Record<string,unknown>,input)
      ||(shipment.payload as Record<string,unknown>).movementType!=='SHIP'){
    deny('SHIPMENT_SCOPE_MISMATCH');
   }
   const posted=await this.db.selectFrom('posting_input')
    .select(['posting_sequence','status'])
    .where('enterprise_id','=',enterprise)
    .where('business_data_id','=',shipment.id)
    .execute();
   if(posted.length!==1||posted[0]?.status!=='POSTED'
     ||BigInt(posted[0].posting_sequence)>boundary)deny('SHIPMENT_NOT_POSTED_AT_BOUNDARY');

   const vp=await this.db.selectFrom('valuation_policy')
    .select(['id'])
    .where('enterprise_id','=',enterprise)
    .where('id','=',input.valuationPolicy.id)
    .where('version','=',input.valuationPolicy.version)
    .where('method','=',input.costMethod)
    .where('status','=','ACTIVE').executeTakeFirst();
   if(!vp)deny('VALUATION_POLICY_NOT_ACTIVE');
   const ap=await this.db.selectFrom('allocation_policy')
    .select(['source_ordering'])
    .where('enterprise_id','=',enterprise)
    .where('id','=',input.allocationPolicy.id)
    .where('version','=',input.allocationPolicy.version)
    .where('status','=','PUBLISHED').executeTakeFirst();
   const expectedOrdering=input.costMethod==='FIFO'?'OLDEST_FIRST'
    :input.costMethod==='LIFO'?'NEWEST_FIRST'
    :input.costMethod==='SPECIFIC_IDENTIFICATION'?'EXPLICIT_ONLY':null;
   if(!ap||ap.source_ordering!==expectedOrdering)deny('ALLOCATION_POLICY_METHOD_MISMATCH');
   const rule=await this.db.selectFrom('valuation_rule')
    .select('id')
    .where('enterprise_id','=',enterprise)
    .where('id','=',input.shipmentValuationRule.id)
    .where('version','=',input.shipmentValuationRule.version)
    .where('source_business_data_type','=','sales_shipment.created')
    .where('status','=','PUBLISHED').executeTakeFirst();
   if(!rule)deny('SHIPMENT_VALUATION_RULE_NOT_PUBLISHED');
  }else if(input.kind==='CASH_ALLOCATION'){
   pinned(input.allocationPolicy,'allocationPolicy');
   if(input.settlementMode!=='EXPLICIT_FULL')deny('SETTLEMENT_MODE_NOT_SUPPORTED');
   if(order.id!==input.sourceOrderBusinessDataId)deny('ORDER_SOURCE_ID_MISMATCH');
   if(order.id===input.consumerReceiptBusinessDataId)deny('SOURCE_CONSUMER_COLLISION');
   if(!/^[A-Z]{3}$/u.test(input.currency))deny('CURRENCY_INVALID');
   const receipt=await this.db.selectFrom('business_data')
    .select(['id','payload'])
    .where('enterprise_id','=',enterprise)
    .where('id','=',input.consumerReceiptBusinessDataId)
    .where('business_data_type','=','cash.received').executeTakeFirst();
   if(!receipt||!payloadMatches(receipt.payload as Record<string,unknown>,input))
     deny('RECEIPT_SCOPE_MISMATCH');
   const op=order.payload as Record<string,unknown>;
   const rp=receipt.payload as Record<string,unknown>;
   if(op.currency!==input.currency||op.localCurrency!==input.currency
     ||rp.settledCurrency!==input.currency||rp.cashCurrency!==input.currency)
     deny('SETTLEMENT_CURRENCY_MISMATCH');
   const desired=exactMoney(input.amount);
   if(!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/u.test(input.amount)
      ||desired.decimalPlaces()>2)deny('MONEY_PRECISION_INVALID');
   if(!desired.eq(exactMoney(op.totalAmount))||
      !desired.eq(exactMoney(op.localCarryingAmount))||
      !desired.eq(exactMoney(rp.settledAmount))||
      !desired.eq(exactMoney(rp.cashAmount)))deny('FULL_SETTLEMENT_AMOUNT_MISMATCH');
   const posted=await this.db.selectFrom('posting_input')
    .select(['business_data_id','status'])
    .where('enterprise_id','=',enterprise)
    .where('business_data_id','in',[order.id,receipt.id])
    .execute();
   if(posted.length!==2||posted.some(p=>p.status!=='POSTED'))deny('RECEIPT_OR_ORDER_NOT_POSTED');
   const policy=await this.db.selectFrom('allocation_policy')
    .select(['eligibility','source_ordering'])
    .where('enterprise_id','=',enterprise)
    .where('id','=',input.allocationPolicy.id)
    .where('version','=',input.allocationPolicy.version)
    .where('status','=','PUBLISHED').executeTakeFirst();
   const eligibility=policy?.eligibility as Record<string,unknown>|undefined;
   if(!policy||policy.source_ordering!=='EXPLICIT_ONLY'
     ||!Array.isArray(eligibility?.sourceBusinessDataTypes)
     ||!eligibility.sourceBusinessDataTypes.includes('sales_order.approved')
     ||!Array.isArray(eligibility?.consumerBusinessDataTypes)
     ||!eligibility.consumerBusinessDataTypes.includes('cash.received'))
    deny('SETTLEMENT_POLICY_NOT_ELIGIBLE');
  }else deny('INTENT_KIND_UNSUPPORTED');

  return {
   contractVersion:'0.1.0',verified:true,evoEnterpriseId:enterprise,
   orderNo:input.orderNo,reasonCodes:[],
   executionAllowed:false,verificationKind:'OWNER_DATABASE_READ_ONLY'
  };
 }
}
