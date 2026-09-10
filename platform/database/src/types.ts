import type {
  ColumnType,
  Generated,
  JSONColumnType
} from 'kysely';

export type Timestamp = ColumnType<Date, Date | string, Date | string>;
export type GeneratedTimestamp = Generated<Timestamp>;
export type JsonObject = JSONColumnType<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
export type JsonArray = JSONColumnType<readonly unknown[], readonly unknown[], readonly unknown[]>;

export interface SchemaMigrationTable {
  version: string;
  checksum: string;
  applied_at: Timestamp;
}

export interface EvoRuntimeInfoTable {
  singleton: boolean;
  architecture_baseline: string;
  db_schema_version: number;
  updated_at: GeneratedTimestamp;
}

export interface EnterpriseTable {
  id: Generated<string>;
  code: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  default_timezone: string;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface DomainDefinitionTable {
  id: Generated<string>;
  code: string;
  name: string;
  description: string | null;
  created_at: GeneratedTimestamp;
}

export interface TransactionTypeTable {
  id: Generated<string>;
  domain_id: string;
  code: string;
  name: string;
  description: string | null;
  created_at: GeneratedTimestamp;
}

export interface ApplicationDefinitionTable {
  id: Generated<string>;
  transaction_type_id: string;
  code: string;
  name: string;
  description: string | null;
  created_at: GeneratedTimestamp;
}

export interface ApplicationDefinitionVersionTable {
  id: Generated<string>;
  application_definition_id: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  schema_version: number;
  base_config: JsonObject;
  definition_hash: string | null;
  published_at: Timestamp | null;
  created_at: GeneratedTimestamp;
}

export interface FieldGroupDefinitionTable {
  id: Generated<string>;
  application_definition_version_id: string;
  code: string;
  label: string;
  sort_order: number;
  config: JsonObject;
}

export interface FieldDefinitionTable {
  id: Generated<string>;
  application_definition_version_id: string;
  field_group_id: string | null;
  code: string;
  label: string;
  data_type: string;
  required: boolean;
  reference_mode: 'REFERENCE' | 'SNAPSHOT' | null;
  sort_order: number;
  config: JsonObject;
}

export interface ApplicationInstanceTable {
  id: Generated<string>;
  enterprise_id: string;
  application_definition_id: string;
  code: string;
  name: string;
  pinned_definition_version: number | null;
  status: 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
  config: JsonObject;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface EnterpriseApplicationOverlayTable {
  id: Generated<string>;
  enterprise_id: string;
  application_instance_id: string;
  base_definition_version: number;
  overlay_version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  patch: JsonObject;
  overlay_hash: string | null;
  published_at: Timestamp | null;
  created_at: GeneratedTimestamp;
}

export interface CommandDefinitionTable {
  id: Generated<string>;
  application_definition_version_id: string;
  code: string;
  name: string;
  input_schema: JsonObject;
  preconditions: JsonArray;
  execution_policy: JsonObject;
  resulting_business_data_type: string;
  config: JsonObject;
}

export interface LedgerDefinitionTable {
  id: Generated<string>;
  code: string;
  name: string;
  quantity_semantics: string | null;
  amount_semantics: string | null;
  dimension_schema: JsonObject;
  config: JsonObject;
  created_at: GeneratedTimestamp;
}

export interface PostingRuleTable {
  id: Generated<string>;
  application_definition_version_id: string;
  code: string;
  priority: number;
  condition_ast: JsonObject;
  effect_ast: JsonObject;
  rule_schema_version: number;
  created_at: GeneratedTimestamp;
}

export interface ValuationPolicyTable {
  id: Generated<string>;
  enterprise_id: string | null;
  code: string;
  name: string;
  method: 'FIFO' | 'LIFO' | 'MOVING_AVERAGE' | 'SPECIFIC_IDENTIFICATION';
  negative_inventory_policy: 'DISALLOW_NEGATIVE';
  pool_dimension_schema: JsonObject;
  config: JsonObject;
  version: number;
  status: 'ACTIVE' | 'RETIRED';
  created_at: GeneratedTimestamp;
}


export interface CommandExecutionTable {
  id: Generated<string>;
  enterprise_id: string;
  application_instance_id: string;
  command_definition_id: string;
  actor_type: 'HUMAN' | 'AI' | 'AUTOMATION' | 'EXTERNAL_SYSTEM';
  actor_id: string;
  request_id: string;
  correlation_id: string;
  causation_id: string | null;
  idempotency_scope: string;
  idempotency_key: string;
  input: JsonObject;
  status: 'RECEIVED' | 'PENDING_APPROVAL' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED';
  result: JsonObject | null;
  error: JsonObject | null;
  created_at: GeneratedTimestamp;
  completed_at: Timestamp | null;
}

export interface BusinessDataTable {
  id: Generated<string>;
  enterprise_id: string;
  application_instance_id: string;
  command_execution_id: string;
  business_data_type: string;
  business_object_key: string;
  business_object_version: ColumnType<bigint, bigint | number | string, bigint | number | string>;
  effective_at: Timestamp;
  metadata_version: number;
  payload: JsonObject;
  created_at: GeneratedTimestamp;
}

export interface EnterpriseRuntimeStateTable {
  enterprise_id: string;
  consistency_domain: string;
  posting_mode: 'NORMAL' | 'REPLAYING' | 'FAILED';
  replay_required: boolean;
  next_posting_sequence: ColumnType<bigint, bigint | number | string, bigint | number | string>;
  last_posted_effective_at: Timestamp | null;
  last_posted_priority: number | null;
  last_posted_sequence: ColumnType<bigint | null, bigint | number | string | null, bigint | number | string | null>;
  active_replay_run_id: string | null;
  updated_at: GeneratedTimestamp;
}

export interface PostingInputTable {
  id: Generated<string>;
  enterprise_id: string;
  consistency_domain: string;
  business_data_id: string;
  application_instance_id: string;
  effective_at: Timestamp;
  posting_priority: number;
  posting_sequence: ColumnType<bigint, bigint | number | string, bigint | number | string>;
  metadata_version: number;
  status: 'QUEUED' | 'BLOCKED_REPLAY_REQUIRED' | 'PROCESSING' | 'POSTED' | 'FAILED';
  retroactive: boolean;
  created_at: GeneratedTimestamp;
  posted_at: Timestamp | null;
}

export interface OutboxEventTable {
  id: Generated<string>;
  enterprise_id: string;
  event_type: string;
  event_version: number;
  aggregate_type: string;
  aggregate_id: string;
  correlation_id: string;
  causation_id: string | null;
  payload: JsonObject;
  status: 'PENDING' | 'PUBLISHED' | 'FAILED';
  attempts: number;
  available_at: Timestamp;
  created_at: GeneratedTimestamp;
  published_at: Timestamp | null;
}


export type Numeric = ColumnType<string, string, string>;

export interface LedgerDatasetTable {
  id: Generated<string>;
  enterprise_id: string;
  consistency_domain: string;
  kind: 'CURRENT' | 'CANDIDATE' | 'ARCHIVED';
  status: 'BUILDING' | 'ACTIVE' | 'FAILED' | 'ARCHIVED';
  posting_boundary_sequence: ColumnType<bigint | null, bigint | number | string | null, bigint | number | string | null>;
  created_at: GeneratedTimestamp;
  activated_at: Timestamp | null;
}

export interface PostingRunTable {
  id: Generated<string>;
  enterprise_id: string;
  consistency_domain: string;
  posting_input_id: string;
  mode: 'NORMAL' | 'REPLAY';
  metadata_version: number;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  started_at: GeneratedTimestamp;
  completed_at: Timestamp | null;
  error: JsonObject | null;
}

export interface LedgerEntryTable {
  id: Generated<string>;
  enterprise_id: string;
  consistency_domain: string;
  ledger_dataset_id: string;
  ledger_definition_id: string;
  posting_run_id: string;
  posting_input_id: string;
  business_data_id: string;
  posting_rule_id: string;
  posting_rule_schema_version: number;
  effect_index: number;
  quantity: Numeric | null;
  amount: Numeric | null;
  unit: string | null;
  currency: string | null;
  dimensions: JsonObject;
  dimension_hash: string;
  effective_at: Timestamp;
  posting_priority: number;
  posting_sequence: ColumnType<bigint, bigint | number | string, bigint | number | string>;
  created_at: GeneratedTimestamp;
}

export interface LedgerBalanceTable {
  enterprise_id: string;
  consistency_domain: string;
  ledger_dataset_id: string;
  ledger_definition_id: string;
  dimension_hash: string;
  dimensions: JsonObject;
  quantity: Numeric;
  amount: Numeric;
  last_effective_at: Timestamp;
  last_posting_priority: number;
  last_posting_sequence: ColumnType<bigint, bigint | number | string, bigint | number | string>;
  updated_at: GeneratedTimestamp;
}

export interface PostingFailureTable {
  id: Generated<string>;
  enterprise_id: string;
  posting_input_id: string;
  error_code: string;
  error_message: string;
  error_context: JsonObject;
  retryable: boolean;
  created_at: GeneratedTimestamp;
}


export interface PermissionGrantTable {
  id: Generated<string>;
  enterprise_id: string;
  actor_type: 'HUMAN' | 'AI' | 'AUTOMATION' | 'EXTERNAL_SYSTEM';
  actor_id: string;
  permission_code: string;
  resource_scope: JsonObject;
  created_at: GeneratedTimestamp;
}

export interface FeatureFlagTable {
  id: Generated<string>;
  code: string;
  enterprise_id: string | null;
  enabled: boolean;
  config: JsonObject;
  owner: string;
  introduced_in: string;
  expires_at: Timestamp | null;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface WorkItemTable {
  id: Generated<string>;
  enterprise_id: string;
  work_type: string;
  title: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  priority: number;
  source_ledger_code: string;
  source_dimension_hash: string;
  source_dimensions: JsonObject;
  source_quantity: Numeric;
  source_amount: Numeric;
  assigned_actor_type: string | null;
  assigned_actor_id: string | null;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
  completed_at: Timestamp | null;
}

export interface ReplayRunTable {
  id: Generated<string>;
  enterprise_id: string;
  consistency_domain: string;
  mode: 'FULL';
  status: 'PREPARING' | 'REBUILDING' | 'VALIDATING' | 'COMPLETED' | 'FAILED';
  boundary_sequence: ColumnType<bigint | null, bigint | number | string | null, bigint | number | string | null>;
  before_digest: string | null;
  after_digest: string | null;
  started_at: GeneratedTimestamp;
  completed_at: Timestamp | null;
  error: JsonObject | null;
}

export interface CostRunTable {
  id: Generated<string>;
  enterprise_id: string;
  method: 'FIFO' | 'LIFO' | 'MOVING_AVERAGE' | 'SPECIFIC_IDENTIFICATION';
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  started_at: GeneratedTimestamp;
  completed_at: Timestamp | null;
  error: JsonObject | null;
}

export interface CostResultTable {
  id: Generated<string>;
  enterprise_id: string;
  cost_run_id: string;
  business_data_id: string;
  pool_key: string;
  method: string;
  quantity: Numeric;
  unit_cost: Numeric | null;
  total_cost: Numeric | null;
  created_at: GeneratedTimestamp;
}

export interface Database {
  schema_migrations: SchemaMigrationTable;
  evo_runtime_info: EvoRuntimeInfoTable;
  enterprise: EnterpriseTable;
  domain_definition: DomainDefinitionTable;
  transaction_type: TransactionTypeTable;
  application_definition: ApplicationDefinitionTable;
  application_definition_version: ApplicationDefinitionVersionTable;
  field_group_definition: FieldGroupDefinitionTable;
  field_definition: FieldDefinitionTable;
  application_instance: ApplicationInstanceTable;
  enterprise_application_overlay: EnterpriseApplicationOverlayTable;
  command_definition: CommandDefinitionTable;
  ledger_definition: LedgerDefinitionTable;
  posting_rule: PostingRuleTable;
  valuation_policy: ValuationPolicyTable;
  command_execution: CommandExecutionTable;
  business_data: BusinessDataTable;
  enterprise_runtime_state: EnterpriseRuntimeStateTable;
  posting_input: PostingInputTable;
  outbox_event: OutboxEventTable;
  ledger_dataset: LedgerDatasetTable;
  posting_run: PostingRunTable;
  ledger_entry: LedgerEntryTable;
  ledger_balance: LedgerBalanceTable;
  posting_failure: PostingFailureTable;
  permission_grant: PermissionGrantTable;
  feature_flag: FeatureFlagTable;
  work_item: WorkItemTable;
  replay_run: ReplayRunTable;
  cost_run: CostRunTable;
  cost_result: CostResultTable;
}
