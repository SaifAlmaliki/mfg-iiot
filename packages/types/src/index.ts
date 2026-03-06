/**
 * Shared Types for UNS Platform
 */

// ============================================
// ISA-95 Enums
// ============================================

export enum EquipmentLevel {
  ENTERPRISE = 'ENTERPRISE',
  SITE = 'SITE',
  AREA = 'AREA',
  PROCESS_CELL = 'PROCESS_CELL',
  UNIT = 'UNIT',
  EQUIPMENT_MODULE = 'EQUIPMENT_MODULE',
  CONTROL_MODULE = 'CONTROL_MODULE',
}

export enum ProductionState {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  HOLDING = 'HOLDING',
  HELD = 'HELD',
  RESTARTING = 'RESTARTING',
  COMPLETING = 'COMPLETING',
  COMPLETE = 'COMPLETE',
  STOPPING = 'STOPPING',
  STOPPED = 'STOPPED',
  ABORTING = 'ABORTING',
  ABORTED = 'ABORTED',
  RESETTING = 'RESETTING',
}

export enum DataQuality {
  GOOD = 'GOOD',
  BAD = 'BAD',
  UNCERTAIN = 'UNCERTAIN',
  INIT = 'INIT',
  MAINTENANCE = 'MAINTENANCE',
}

export enum AlarmType {
  HIGH = 'HIGH',
  LOW = 'LOW',
  HIGH_HIGH = 'HIGH_HIGH',
  LOW_LOW = 'LOW_LOW',
  DEVIATION = 'DEVIATION',
  RATE = 'RATE',
  BOOL_TRUE = 'BOOL_TRUE',
  BOOL_FALSE = 'BOOL_FALSE',
}

export enum AlarmState {
  ACTIVE = 'ACTIVE',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  CLEARED = 'CLEARED',
  SHELVED = 'SHELVED',
}

export enum OrderStatus {
  CREATED = 'CREATED',
  RELEASED = 'RELEASED',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  HELD = 'HELD',
}

export enum BatchStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  HELD = 'HELD',
  COMPLETE = 'COMPLETE',
  ABORTED = 'ABORTED',
}

export enum ConnectorStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  ERROR = 'ERROR',
  MAINTENANCE = 'MAINTENANCE',
}

export enum ProtocolType {
  OPC_UA = 'OPC_UA',
  MODBUS_TCP = 'MODBUS_TCP',
  MODBUS_RTU = 'MODBUS_RTU',
  S7 = 'S7',
  ETHERNET_IP = 'ETHERNET_IP',
  BACNET = 'BACNET',
  DNP3 = 'DNP3',
  MQTT = 'MQTT',
}

export enum DataType {
  BOOL = 'BOOL',
  INT8 = 'INT8',
  INT16 = 'INT16',
  INT32 = 'INT32',
  INT64 = 'INT64',
  UINT8 = 'UINT8',
  UINT16 = 'UINT16',
  UINT32 = 'UINT32',
  UINT64 = 'UINT64',
  FLOAT32 = 'FLOAT32',
  FLOAT64 = 'FLOAT64',
  STRING = 'STRING',
}

// ============================================
// Entity Types
// ============================================

export interface ISATopic {
  enterprise: string;
  site: string;
  area: string;
  workCenter: string;
  workUnit: string;
  equipment?: string;
  attribute: string;
}

export interface TagInfo {
  id: string;
  name: string;
  mqttTopic: string;
  dataType: DataType;
  engUnit?: string;
  description?: string;
  minVal?: number;
  maxVal?: number;
  isWritable: boolean;
}

export interface TagValue {
  tagId: string;
  value: number | string | boolean;
  quality: DataQuality;
  timestamp: Date;
}

export interface AlarmInfo {
  id: string;
  definitionId: string;
  tagId: string;
  type: AlarmType;
  state: AlarmState;
  message: string;
  priority: number;
  value: number;
  activatedAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

export interface ProductionOrderInfo {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  quantity: number;
  producedQty: number;
  plannedStart?: Date;
  plannedEnd?: Date;
}

export interface BatchInfo {
  id: string;
  batchNumber: string;
  status: BatchStatus;
  progress: number;
  orderId?: string;
  recipeId?: string;
}

export interface ConnectorInfo {
  id: string;
  name: string;
  code: string;
  type: ProtocolType;
  endpoint: string;
  status: ConnectorStatus;
  lastSeen?: Date;
}

export interface ConnectorMetric {
  connectorId: string;
  messagesRead: number;
  messagesError: number;
  latencyMs: number;
  timestamp: Date;
}

// ============================================
// API Types
// ============================================

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface TimeInterval {
  start: Date;
  end: Date;
}

export interface AggregationQuery {
  interval: string; // e.g., '1m', '5m', '1h', '1d'
  aggregate: 'mean' | 'max' | 'min' | 'sum' | 'count' | 'first' | 'last';
  fill?: 'null' | 'none' | 'previous' | 'linear';
}

// ============================================
// Configuration Types
// ============================================

export interface MQTTConfig {
  url: string;
  clientId?: string;
  username?: string;
  password?: string;
  clean?: boolean;
  keepalive?: number;
  reconnectPeriod?: number;
}

export interface DatabaseConfig {
  url: string;
  poolSize?: number;
  ssl?: boolean;
}

export interface InfluxDBConfig {
  url: string;
  token: string;
  org: string;
  bucket: string;
}

export interface ConnectorConfig {
  id: string;
  name: string;
  type: ProtocolType;
  endpoint: string;
  siteCode: string;
  config: Record<string, any>;
  tags: TagMappingConfig[];
}

export interface TagMappingConfig {
  tagId: string;
  sourceAddress: string;
  sourceType: string;
  scale?: number;
  offset?: number;
}

// ============================================
// Event Types
// ============================================

export interface SystemEvent {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  data: Record<string, any>;
}

export interface StateTransition {
  entityId: string;
  entityType: string;
  fromState: string;
  toState: string;
  trigger?: string;
  timestamp: Date;
  userId?: string;
}
