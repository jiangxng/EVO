import type { JsonObject } from '../../metadata/api/contracts.js';

/**
 * Reference template distilled from Asloop-Backend/bookkeeping semantic archaeology.
 * It intentionally preserves semantic assets, not legacy tables/controllers/SQL.
 */
export const legacyEnterpriseTemplateV1: JsonObject = {
  templateSemanticVersion: '1.0.0',
  source: { kind: 'LEGACY_SEMANTIC_ARCHAEOLOGY', systems: ['Asloop-Backend', 'bookkeeping'] },
  domains: ['sales','procurement','production','inventory','finance','cash','project','workflow'],
  transactionTypes: ['sales-order','receipt','payment','purchase-order','production-completion','inventory-movement','sales-shipment','sales-return'],
  applicationSemantics: ['metadata-driven-fields','field-groups','commands','conditional-posting','explicit-dimensions'],
  ledgerClasses: ['OPERATIONAL','FINANCIAL'],
  operationalLedgers: ['pending-production','pending-purchase','pending-shipment','receivable','inventory'],
  financialLedgers: ['cash','expense','revenue','cogs'],
  dimensions: ['entity','customer','supplier','material','facility','warehouse','project','department','profit-center','cost-center'],
  costMethods: ['FIFO','LIFO','MOVING_AVERAGE','SPECIFIC_IDENTIFICATION'],
  invariants: ['BUSINESS_HISTORY_PRESERVED','LEDGER_ENTRIES_APPEND_ONLY','BALANCE_DERIVED','DIMENSIONS_EXPLICIT','REPLAY_DETERMINISTIC','ALLOCATION_CONSERVES_SOURCE'],
  excludedLegacyImplementation: ['dynamic-sql-accounting','stored-procedure-accounting','mutable-historical-balance-chain','legacy-controller-dao-ui-code']
};
