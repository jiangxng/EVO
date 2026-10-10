import { describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import {
  PostgresTradingFinanceFactVerifierV010,
  type TradingCostFactInputV010,
  type TradingCashFactInputV010
} from '../infrastructure/postgres-trading-finance-fact-verifier.js';

const pin={id:'pin-v1',version:1};
const common={
 contractVersion:'0.1.0' as const,
 evoEnterpriseId:'test-enterprise',
 orderNo:'SO-1',customerCounterpartyId:'CP-1',itemId:'ITEM-1',
 warehouseId:'WH-1',idempotencyKey:'no-side-effects'
};
function verifier(){
 // A strict early-validation fixture: any attempted query on malformed
 // input would throw a different error. Positive DB paths are certified by
 // TR01B2D2's real App Platform-originated PostgreSQL cross-project runner.
 return new PostgresTradingFinanceFactVerifierV010({} as Kysely<Database>);
}
function cost():TradingCostFactInputV010{return {
 ...common,kind:'COST_VALUATION',shipmentBusinessDataId:'shipment-1',
 costMethod:'FIFO',valuationPolicy:pin,allocationPolicy:pin,
 shipmentValuationRule:pin,boundarySequence:'10'
}}
function cash():TradingCashFactInputV010{return {
 ...common,kind:'CASH_ALLOCATION',sourceOrderBusinessDataId:'order-1',
 consumerReceiptBusinessDataId:'receipt-1',
 amount:'1000.00',currency:'CNY',allocationPolicy:pin,
 settlementMode:'EXPLICIT_FULL'
}}
describe('TR-01B2D2 EVO owner read-only immutable fact verifier admission',()=>{
 it('refuses missing enterprise scope before any database read',async()=>{
  await expect(verifier().verify({...cost(),evoEnterpriseId:''}))
   .rejects.toThrow('EVO_FINANCE_FACT_FIELD_REQUIRED:evoEnterpriseId');
 });
 it('refuses empty idempotency key before any database read',async()=>{
  await expect(verifier().verify({...cash(),idempotencyKey:''}))
   .rejects.toThrow('EVO_FINANCE_FACT_FIELD_REQUIRED:idempotencyKey');
 });
 it('refuses unsupported contract without attempting SQL',async()=>{
  await expect(verifier().verify({
   ...cost(),contractVersion:'0.2.0' as '0.1.0'
  })).rejects.toThrow('EVO_FINANCE_FACT_CONTRACT_UNSUPPORTED');
 });
});
