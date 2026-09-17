import type { JsonObject } from '../../metadata/api/contracts.js';

/**
 * EVO built-in enterprise initialization template.
 * Business semantics are distilled from Asloop-Backend and bookkeeping, while
 * legacy physical tables, mutable balance chains, stored procedures and UI code
 * are intentionally excluded. This file is the repository-owned rebuild source.
 */
export const enterpriseCoreV1: JsonObject = {
  schemaVersion: 'enterprise-template/1.0',
  templateSemanticVersion: '1.0.0',
  code: 'enterprise-core',
  name: 'EVO Enterprise Core',
  description: 'Cross-industry operational and financial enterprise baseline distilled from legacy production ERP semantics.',
  source: {
    strategy: 'SEMANTIC_CONVERGENCE',
    systems: ['Asloop-Backend', 'bookkeeping'],
    preserve: ['business-field-semantics', 'transaction-type-semantics', 'conditional-accounting', 'auxiliary-dimensions', 'costing-semantics', 'allocation-conservation'],
    exclude: ['legacy-physical-schema', 'dynamic-sql-accounting', 'stored-procedure-accounting', 'mutable-historical-balance-chain', 'legacy-controller-dao-ui-code']
  },
  invariants: [
    'BUSINESS_HISTORY_PRESERVED', 'COMMAND_IS_CANONICAL_WRITE_BOUNDARY', 'LEDGER_ENTRIES_APPEND_ONLY',
    'BALANCE_DERIVED', 'DIMENSIONS_EXPLICIT', 'REPLAY_DETERMINISTIC', 'ALLOCATION_CONSERVES_SOURCE',
    'VERSIONS_EXPLICITLY_PINNED', 'NO_IMPLICIT_LATEST_AT_RUNTIME'
  ],
  domains: [
    { code: 'sales', name: 'Sales', capabilities: ['order-management', 'fulfillment', 'receivables'] },
    { code: 'procurement', name: 'Procurement', capabilities: ['purchase-management', 'receiving', 'payables'] },
    { code: 'production', name: 'Production', capabilities: ['production-planning', 'production-completion'] },
    { code: 'inventory', name: 'Inventory', capabilities: ['inventory-movement', 'inventory-availability', 'valuation'] },
    { code: 'finance', name: 'Finance', capabilities: ['general-accounting', 'revenue-expense', 'cost-accounting'] },
    { code: 'cash', name: 'Cash', capabilities: ['receipt', 'payment', 'cash-position'] },
    { code: 'project', name: 'Project', capabilities: ['project-accounting'] },
    { code: 'workflow', name: 'Workflow', capabilities: ['approval', 'work-items'] }
  ],
  dimensions: [
    { code: 'entity', name: 'Legal Entity', valueType: 'REFERENCE', requiredFor: ['financial'] },
    { code: 'customer', name: 'Customer', valueType: 'REFERENCE' },
    { code: 'supplier', name: 'Supplier', valueType: 'REFERENCE' },
    { code: 'material', name: 'Material', valueType: 'REFERENCE' },
    { code: 'facility', name: 'Facility', valueType: 'REFERENCE' },
    { code: 'warehouse', name: 'Warehouse', valueType: 'REFERENCE' },
    { code: 'project', name: 'Project', valueType: 'REFERENCE' },
    { code: 'department', name: 'Department', valueType: 'REFERENCE' },
    { code: 'profit-center', name: 'Profit Center', valueType: 'REFERENCE' },
    { code: 'cost-center', name: 'Cost Center', valueType: 'REFERENCE' }
  ],
  masterData: [
    { code: 'customer', name: 'Customer', fields: ['code', 'name', 'status', 'currency', 'taxId', 'paymentTerms', 'contact', 'address'] },
    { code: 'supplier', name: 'Supplier', fields: ['code', 'name', 'status', 'currency', 'taxId', 'paymentTerms', 'contact', 'address'] },
    { code: 'material', name: 'Material', fields: ['code', 'name', 'specification', 'unit', 'materialType', 'valuationMethod', 'status'] },
    { code: 'warehouse', name: 'Warehouse', fields: ['code', 'name', 'facility', 'status'] },
    { code: 'project', name: 'Project', fields: ['code', 'name', 'status', 'owner'] },
    { code: 'organization-unit', name: 'Organization Unit', fields: ['code', 'name', 'type', 'parentCode', 'status'] }
  ],
  fieldCatalog: [
    { code: 'documentNo', name: 'Document No.', type: 'STRING', required: true },
    { code: 'effectiveAt', name: 'Effective At', type: 'DATETIME', required: true },
    { code: 'currency', name: 'Currency', type: 'STRING', required: true },
    { code: 'customer', name: 'Customer', type: 'REFERENCE', reference: 'customer' },
    { code: 'supplier', name: 'Supplier', type: 'REFERENCE', reference: 'supplier' },
    { code: 'material', name: 'Material', type: 'REFERENCE', reference: 'material' },
    { code: 'warehouse', name: 'Warehouse', type: 'REFERENCE', reference: 'warehouse' },
    { code: 'quantity', name: 'Quantity', type: 'DECIMAL', scale: 6 },
    { code: 'unitPrice', name: 'Unit Price', type: 'DECIMAL', scale: 6 },
    { code: 'amount', name: 'Amount', type: 'DECIMAL', scale: 6 },
    { code: 'taxAmount', name: 'Tax Amount', type: 'DECIMAL', scale: 6 },
    { code: 'project', name: 'Project', type: 'REFERENCE', reference: 'project' },
    { code: 'department', name: 'Department', type: 'STRING' },
    { code: 'profitCenter', name: 'Profit Center', type: 'STRING' },
    { code: 'costCenter', name: 'Cost Center', type: 'STRING' }
  ],
  transactionTypes: [
    {
      code: 'sales-order', name: 'Sales Order', domain: 'sales', businessDataType: 'sales_order.approved',
      fieldGroups: [
        { code: 'header', fields: ['documentNo', 'effectiveAt', 'customer', 'currency'] },
        { code: 'lines', repeatable: true, fields: ['material', 'quantity', 'unitPrice', 'amount', 'taxAmount', 'warehouse'] },
        { code: 'accounting', fields: ['project', 'department', 'profitCenter', 'costCenter'] }
      ],
      commands: [
        { code: 'approve-sales-order', permission: 'sales.approve', produces: 'sales_order.approved', requiredFields: ['documentNo', 'customer', 'material', 'quantity', 'unitPrice', 'amount', 'currency'] }
      ]
    },
    {
      code: 'purchase-order', name: 'Purchase Order', domain: 'procurement', businessDataType: 'purchase_order.approved',
      fieldGroups: [
        { code: 'header', fields: ['documentNo', 'effectiveAt', 'supplier', 'currency'] },
        { code: 'lines', repeatable: true, fields: ['material', 'quantity', 'unitPrice', 'amount', 'taxAmount', 'warehouse'] },
        { code: 'accounting', fields: ['project', 'department', 'costCenter'] }
      ],
      commands: [{ code: 'approve-purchase-order', permission: 'purchase.approve', produces: 'purchase_order.approved', requiredFields: ['documentNo', 'supplier', 'material', 'quantity', 'unitPrice', 'amount', 'currency'] }]
    },
    {
      code: 'production-completion', name: 'Production Completion', domain: 'production', businessDataType: 'production.completed',
      fieldGroups: [{ code: 'production', fields: ['documentNo', 'effectiveAt', 'material', 'warehouse', 'quantity', 'amount', 'project', 'department', 'costCenter'] }],
      commands: [{ code: 'complete-production', permission: 'production.complete', produces: 'production.completed', requiredFields: ['documentNo', 'material', 'warehouse', 'quantity', 'amount'] }]
    },
    {
      code: 'inventory-movement', name: 'Inventory Movement', domain: 'inventory', businessDataType: 'inventory.moved',
      fieldGroups: [{ code: 'movement', fields: ['documentNo', 'effectiveAt', 'material', 'warehouse', 'quantity', 'project', 'department', 'costCenter'] }],
      commands: [{ code: 'move-inventory', permission: 'inventory.move', produces: 'inventory.moved', requiredFields: ['documentNo', 'material', 'warehouse', 'quantity'] }]
    },
    {
      code: 'sales-shipment', name: 'Sales Shipment', domain: 'sales', businessDataType: 'sales_shipment.created',
      fieldGroups: [{ code: 'shipment', fields: ['documentNo', 'effectiveAt', 'customer', 'material', 'warehouse', 'quantity', 'project', 'department', 'profitCenter', 'costCenter'] }],
      commands: [{ code: 'ship-sales-order', permission: 'inventory.ship', produces: 'sales_shipment.created', requiredFields: ['documentNo', 'customer', 'material', 'warehouse', 'quantity'] }]
    },
    {
      code: 'sales-return', name: 'Sales Return', domain: 'sales', businessDataType: 'sales_return.received',
      fieldGroups: [{ code: 'return', fields: ['documentNo', 'effectiveAt', 'customer', 'material', 'warehouse', 'quantity', 'amount', 'currency'] }],
      commands: [{ code: 'receive-sales-return', permission: 'sales.return', produces: 'sales_return.received', requiredFields: ['documentNo', 'customer', 'material', 'warehouse', 'quantity'] }]
    },
    {
      code: 'receipt', name: 'Cash Receipt', domain: 'cash', businessDataType: 'cash.received',
      fieldGroups: [{ code: 'receipt', fields: ['documentNo', 'effectiveAt', 'customer', 'amount', 'currency', 'project', 'department', 'profitCenter'] }],
      commands: [{ code: 'record-receipt', permission: 'cash.receive', produces: 'cash.received', requiredFields: ['documentNo', 'amount', 'currency'] }]
    },
    {
      code: 'payment', name: 'Cash Payment', domain: 'cash', businessDataType: 'cash.paid',
      fieldGroups: [{ code: 'payment', fields: ['documentNo', 'effectiveAt', 'supplier', 'amount', 'currency', 'project', 'department', 'costCenter'] }],
      commands: [{ code: 'record-payment', permission: 'cash.pay', produces: 'cash.paid', requiredFields: ['documentNo', 'amount', 'currency'] }]
    }
  ],
  applications: [
    { code: 'sales-order-management', name: 'Sales Order Management', transactionType: 'sales-order', commands: ['approve-sales-order'] },
    { code: 'purchase-order-management', name: 'Purchase Order Management', transactionType: 'purchase-order', commands: ['approve-purchase-order'] },
    { code: 'production-completion', name: 'Production Completion', transactionType: 'production-completion', commands: ['complete-production'] },
    { code: 'inventory-movement', name: 'Inventory Movement', transactionType: 'inventory-movement', commands: ['move-inventory'] },
    { code: 'sales-shipment', name: 'Sales Shipment', transactionType: 'sales-shipment', commands: ['ship-sales-order'] },
    { code: 'sales-return', name: 'Sales Return', transactionType: 'sales-return', commands: ['receive-sales-return'] },
    { code: 'cash-receipt', name: 'Cash Receipt', transactionType: 'receipt', commands: ['record-receipt'] },
    { code: 'cash-payment', name: 'Cash Payment', transactionType: 'payment', commands: ['record-payment'] }
  ],
  ledgers: [
    { code: 'pending-production', name: 'Pending Production', class: 'OPERATIONAL', measure: 'QUANTITY', dimensions: { required: ['entity', 'material'], allowed: ['customer', 'warehouse', 'project', 'department'] } },
    { code: 'pending-purchase', name: 'Pending Purchase', class: 'OPERATIONAL', measure: 'QUANTITY', dimensions: { required: ['entity', 'material'], allowed: ['supplier', 'warehouse', 'project', 'department'] } },
    { code: 'pending-shipment', name: 'Pending Shipment', class: 'OPERATIONAL', measure: 'QUANTITY', dimensions: { required: ['entity', 'customer', 'material'], allowed: ['warehouse', 'project', 'department', 'profit-center'] } },
    { code: 'receivable', name: 'Accounts Receivable', class: 'FINANCIAL', measure: 'AMOUNT', dimensions: { required: ['entity', 'customer'], allowed: ['project', 'department', 'profit-center'] } },
    { code: 'payable', name: 'Accounts Payable', class: 'FINANCIAL', measure: 'AMOUNT', dimensions: { required: ['entity', 'supplier'], allowed: ['project', 'department', 'cost-center'] } },
    { code: 'inventory', name: 'Inventory', class: 'FINANCIAL', measure: 'QUANTITY_AND_AMOUNT', dimensions: { required: ['entity', 'material', 'warehouse'], allowed: ['facility', 'project', 'department', 'cost-center'] } },
    { code: 'cash', name: 'Cash', class: 'FINANCIAL', measure: 'AMOUNT', dimensions: { required: ['entity'], allowed: ['customer', 'supplier', 'project', 'department'] } },
    { code: 'revenue', name: 'Revenue', class: 'FINANCIAL', measure: 'AMOUNT', dimensions: { required: ['entity'], allowed: ['customer', 'material', 'project', 'department', 'profit-center'] } },
    { code: 'expense', name: 'Expense', class: 'FINANCIAL', measure: 'AMOUNT', dimensions: { required: ['entity'], allowed: ['supplier', 'project', 'department', 'cost-center'] } },
    { code: 'cogs', name: 'Cost of Goods Sold', class: 'FINANCIAL', measure: 'AMOUNT', dimensions: { required: ['entity'], allowed: ['customer', 'material', 'project', 'department', 'profit-center', 'cost-center'] } }
  ],
  postingRules: [
    { code: 'sales-order-to-pending-production', when: { businessDataType: 'sales_order.approved', condition: "fulfillmentMode == 'MAKE'" }, ledger: 'pending-production', side: 'INCREASE', quantity: 'quantity', dimensionMap: { material: 'material', customer: 'customer', project: 'project', department: 'department' } },
    { code: 'sales-order-to-pending-shipment', when: { businessDataType: 'sales_order.approved' }, ledger: 'pending-shipment', side: 'INCREASE', quantity: 'quantity', dimensionMap: { material: 'material', customer: 'customer', warehouse: 'warehouse', project: 'project', department: 'department', 'profit-center': 'profitCenter' } },
    { code: 'sales-order-to-receivable', when: { businessDataType: 'sales_order.approved' }, ledger: 'receivable', side: 'INCREASE', amount: 'amount', dimensionMap: { customer: 'customer', project: 'project', department: 'department', 'profit-center': 'profitCenter' } },
    { code: 'purchase-order-to-pending-purchase', when: { businessDataType: 'purchase_order.approved' }, ledger: 'pending-purchase', side: 'INCREASE', quantity: 'quantity', dimensionMap: { supplier: 'supplier', material: 'material', warehouse: 'warehouse', project: 'project', department: 'department' } },
    { code: 'purchase-order-to-payable', when: { businessDataType: 'purchase_order.approved' }, ledger: 'payable', side: 'INCREASE', amount: 'amount', dimensionMap: { supplier: 'supplier', project: 'project', department: 'department', 'cost-center': 'costCenter' } },
    { code: 'production-completion-clear-pending', when: { businessDataType: 'production.completed' }, ledger: 'pending-production', side: 'DECREASE', quantity: 'quantity', dimensionMap: { material: 'material', project: 'project', department: 'department' } },
    { code: 'production-completion-to-inventory', when: { businessDataType: 'production.completed' }, ledger: 'inventory', side: 'INCREASE', quantity: 'quantity', amount: 'amount', dimensionMap: { material: 'material', warehouse: 'warehouse', project: 'project', department: 'department', 'cost-center': 'costCenter' } },
    { code: 'shipment-clear-pending', when: { businessDataType: 'sales_shipment.created' }, ledger: 'pending-shipment', side: 'DECREASE', quantity: 'quantity', dimensionMap: { customer: 'customer', material: 'material', warehouse: 'warehouse', project: 'project', department: 'department', 'profit-center': 'profitCenter' } },
    { code: 'shipment-reduce-inventory', when: { businessDataType: 'sales_shipment.created' }, ledger: 'inventory', side: 'DECREASE', quantity: 'quantity', dimensionMap: { material: 'material', warehouse: 'warehouse', project: 'project', department: 'department' }, valuationRequired: true },
    { code: 'receipt-increase-cash', when: { businessDataType: 'cash.received' }, ledger: 'cash', side: 'INCREASE', amount: 'amount', dimensionMap: { customer: 'customer', project: 'project', department: 'department' } },
    { code: 'receipt-clear-receivable', when: { businessDataType: 'cash.received', condition: 'customer != null' }, ledger: 'receivable', side: 'DECREASE', amount: 'amount', dimensionMap: { customer: 'customer', project: 'project', department: 'department', 'profit-center': 'profitCenter' } },
    { code: 'payment-decrease-cash', when: { businessDataType: 'cash.paid' }, ledger: 'cash', side: 'DECREASE', amount: 'amount', dimensionMap: { supplier: 'supplier', project: 'project', department: 'department' } },
    { code: 'payment-clear-payable', when: { businessDataType: 'cash.paid', condition: 'supplier != null' }, ledger: 'payable', side: 'DECREASE', amount: 'amount', dimensionMap: { supplier: 'supplier', project: 'project', department: 'department', 'cost-center': 'costCenter' } },
    { code: 'sales-return-to-inventory', when: { businessDataType: 'sales_return.received' }, ledger: 'inventory', side: 'INCREASE', quantity: 'quantity', dimensionMap: { material: 'material', warehouse: 'warehouse' }, valuationRequired: true },
    { code: 'sales-return-reduce-receivable', when: { businessDataType: 'sales_return.received' }, ledger: 'receivable', side: 'DECREASE', amount: 'amount', dimensionMap: { customer: 'customer' } }
  ],
  valuationPolicies: [
    { code: 'inventory-fifo', ledger: 'inventory', method: 'FIFO', supported: true },
    { code: 'inventory-lifo', ledger: 'inventory', method: 'LIFO', supported: true },
    { code: 'inventory-moving-average', ledger: 'inventory', method: 'MOVING_AVERAGE', supported: true },
    { code: 'inventory-specific-identification', ledger: 'inventory', method: 'SPECIFIC_IDENTIFICATION', supported: true }
  ],
  allocationPolicy: { precision: 6, rounding: 'HALF_UP', residual: 'LAST_ALLOCATION', invariant: 'ALLOCATED_SUM_EQUALS_SOURCE' },
  replayPolicy: { source: 'BUSINESS_DATA', executeCommands: false, deterministicOrdering: ['effectiveAt', 'postingPriority', 'sequence'], pinRuleVersions: true, pinValuationVersions: true },
  installation: { mode: 'DEFINITION_ONLY', enterpriseBinding: 'EXPLICIT_VERSION_PIN', publishedVersionImmutable: true }
};
