// Manufacturing System Types

// Organization & Identity
export interface Organization {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  organizationId: string;
  roles: UserRole[];
}

export interface Role {
  id: string;
  name: string;
  code: string;
  permissions: string[];
  description?: string;
}

export interface UserRole {
  userId: string;
  roleId: string;
  role: Role;
}

// Plant Structure
export interface Plant {
  id: string;
  name: string;
  code: string;
  location?: string;
  timezone: string;
  isActive: boolean;
}

export interface ProductionLine {
  id: string;
  name: string;
  code: string;
  description?: string;
  capacity?: number;
  isActive: boolean;
  plantId: string;
}

export interface Unit {
  id: string;
  name: string;
  code: string;
  type: UnitType;
  description?: string;
  isActive: boolean;
  lineId: string;
}

export type UnitType = 'REACTOR' | 'MIXER' | 'CONVEYOR' | 'TANK' | 'PUMP' | 'HEAT_EXCHANGER' | 'CENTRIFUGE' | 'DRYER' | 'FILTER' | 'OTHER';

export interface Equipment {
  id: string;
  name: string;
  code: string;
  type: EquipmentType;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  installDate?: Date;
  description?: string;
  isActive: boolean;
}

export type EquipmentType = 'PUMP' | 'VALVE' | 'SENSOR' | 'MOTOR' | 'VFD' | 'PLC' | 'HMI' | 'ACTUATOR' | 'INSTRUMENT' | 'OTHER';

// SCADA
export interface Tag {
  id: string;
  name: string;
  address: string;
  dataType: DataType;
  engUnit?: string;
  description?: string;
  scanRate: number;
  minVal?: number;
  maxVal?: number;
  deadband?: number;
  isWritable: boolean;
  isActive: boolean;
  currentValue?: TagValue;
}

export type DataType = 'BOOL' | 'INT' | 'FLOAT' | 'STRING' | 'LONG' | 'DOUBLE';

export interface TagValue {
  id: string;
  tagId: string;
  value: string;
  quality: Quality;
  timestamp: Date;
}

export type Quality = 'GOOD' | 'BAD' | 'UNCERTAIN';

export interface AlarmDefinition {
  id: string;
  name: string;
  type: AlarmType;
  setpoint: number;
  deadband?: number;
  delay: number;
  priority: number;
  message?: string;
  isActive: boolean;
  tagId: string;
}

export type AlarmType = 'HIGH' | 'LOW' | 'HIGH_HIGH' | 'LOW_LOW' | 'DEVIATION' | 'RATE';

export interface Alarm {
  id: string;
  state: AlarmState;
  value: number;
  message?: string;
  activatedAt: Date;
  acknowledgedAt?: Date;
  clearedAt?: Date;
  acknowledgedBy?: string;
  definitionId: string;
  definition?: AlarmDefinition;
}

export type AlarmState = 'ACTIVE' | 'ACKNOWLEDGED' | 'CLEARED';

// MES
export interface Recipe {
  id: string;
  name: string;
  version: string;
  description?: string;
  productCode?: string;
  status: RecipeStatus;
  parameters?: Record<string, any>;
  steps?: RecipeStep[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type RecipeStatus = 'DRAFT' | 'APPROVED' | 'ACTIVE' | 'ARCHIVED';

export interface RecipeStep {
  id: string;
  name: string;
  type: string;
  duration: number;
  parameters: Record<string, any>;
  order: number;
}

export interface Material {
  id: string;
  name: string;
  code: string;
  type: MaterialType;
  unit?: string;
  description?: string;
  isActive: boolean;
}

export type MaterialType = 'RAW' | 'INTERMEDIATE' | 'PRODUCT' | 'CONSUMABLE';

export interface MaterialLot {
  id: string;
  lotNumber: string;
  quantity: number;
  remainingQty: number;
  status: LotStatus;
  expiryDate?: Date;
  receivedDate: Date;
  supplierLot?: string;
  supplierName?: string;
  location?: string;
  notes?: string;
  materialId: string;
  material?: Material;
}

export type LotStatus = 'AVAILABLE' | 'RESERVED' | 'CONSUMED' | 'QUARANTINE';

export interface ProductionOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  quantity: number;
  producedQty: number;
  scrapQty: number;
  plannedStart?: Date;
  plannedEnd?: Date;
  actualStart?: Date;
  actualEnd?: Date;
  priority: number;
  notes?: string;
  lineId: string;
  recipeId?: string;
  recipe?: Recipe;
  batches?: Batch[];
}

export type OrderStatus = 'CREATED' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Batch {
  id: string;
  batchNumber: string;
  status: BatchStatus;
  state?: S88State;
  phase?: string;
  step?: string;
  quantity?: number;
  progress: number;
  parameters?: Record<string, any>;
  startedAt?: Date;
  endedAt?: Date;
  lineId: string;
  orderId?: string;
  recipeId?: string;
}

export type BatchStatus = 'IDLE' | 'RUNNING' | 'HELD' | 'COMPLETE' | 'ABORTED';

export type S88State = 'IDLE' | 'RUNNING' | 'HOLDING' | 'HELD' | 'RESTARTING' | 'COMPLETING' | 'COMPLETE' | 'STOPPING' | 'STOPPED' | 'ABORTING' | 'ABORTED';

// Traceability
export interface Genealogy {
  id: string;
  relationship: GenealogyRelationship;
  quantity?: number;
  timestamp: Date;
  notes?: string;
  batchId?: string;
  fromLotId?: string;
  toLotId?: string;
}

export type GenealogyRelationship = 'INPUT_TO' | 'OUTPUT_FROM' | 'TRANSFORMED_TO';

export interface Customer {
  id: string;
  name: string;
  code: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  isActive: boolean;
}

export interface Shipment {
  id: string;
  shipmentNumber: string;
  status: ShipmentStatus;
  shippedAt?: Date;
  deliveredAt?: Date;
  notes?: string;
  customerId: string;
  lots?: ShipmentLot[];
}

export type ShipmentStatus = 'PENDING' | 'SHIPPED' | 'DELIVERED';

export interface ShipmentLot {
  shipmentId: string;
  lotId: string;
  quantity: number;
  lot?: MaterialLot;
}

// Condition Monitoring
export interface AssetHealth {
  id: string;
  healthScore: number;
  status: HealthStatus;
  metrics?: Record<string, number>;
  anomalies?: string[];
  recommendations?: string[];
  timestamp: Date;
  equipmentId: string;
}

export type HealthStatus = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';

export interface MonitoringRule {
  id: string;
  name: string;
  type: RuleType;
  metric: string;
  condition: RuleCondition;
  severity: Severity;
  isActive: boolean;
}

export type RuleType = 'THRESHOLD' | 'ANOMALY' | 'TREND' | 'COMPOSITE';
export type Severity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface RuleCondition {
  operator: 'GT' | 'LT' | 'EQ' | 'GTE' | 'LTE' | 'BETWEEN';
  value: number;
  value2?: number;
}

export interface MaintenanceLog {
  id: string;
  type: MaintenanceType;
  description: string;
  performedBy?: string;
  performedAt: Date;
  nextDueDate?: Date;
  cost?: number;
  notes?: string;
  equipmentId: string;
}

export type MaintenanceType = 'PREVENTIVE' | 'CORRECTIVE' | 'PREDICTIVE';

// KPIs & OEE
export interface OEERecord {
  id: string;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  runTime?: number;
  plannedTime?: number;
  downtime?: number;
  downtimeReasons?: DowntimeReason[];
  goodUnits?: number;
  totalUnits?: number;
  idealCycleTime?: number;
  timestamp: Date;
  lineId: string;
}

export interface DowntimeReason {
  reason: string;
  duration: number;
  category: string;
}

export interface EnergyUsage {
  id: string;
  value: number;
  source?: string;
  equipmentId?: string;
  plantId?: string;
  timestamp: Date;
}

export interface QualityMetric {
  id: string;
  metricType: string;
  value: number;
  target?: number;
  unit?: string;
  batchId?: string;
  lineId?: string;
  timestamp: Date;
}

// Edge Connectors
export interface EdgeConnector {
  id: string;
  name: string;
  type: ConnectorType;
  endpoint: string;
  config?: Record<string, any>;
  status: ConnectorStatus;
  lastSeen?: Date;
  version?: string;
  isActive: boolean;
  plantId: string;
}

export type ConnectorType = 'OPC_UA' | 'MODBUS' | 'S7' | 'MQTT';
export type ConnectorStatus = 'ONLINE' | 'OFFLINE' | 'ERROR';

export interface TagMapping {
  id: string;
  sourceAddress: string;
  sourceType: string;
  tagName: string;
  scale?: number;
  offset?: number;
  isActive: boolean;
  connectorId: string;
}

// Audit
export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  userId?: string;
  organizationId: string;
}
