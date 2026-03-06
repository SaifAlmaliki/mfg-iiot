/**
 * Message Schemas for UNS Platform
 * JSON message definitions using Zod for validation
 */

import { z } from 'zod';

// ============================================
// Base Schemas
// ============================================

export const QualityEnum = z.enum(['GOOD', 'BAD', 'UNCERTAIN', 'INIT', 'MAINTENANCE']);
export type Quality = z.infer<typeof QualityEnum>;

export const AlarmStateEnum = z.enum(['ACTIVE', 'ACKNOWLEDGED', 'CLEARED', 'SHELVED']);
export type AlarmState = z.infer<typeof AlarmStateEnum>;

export const MessageTypeEnum = z.enum([
  'telemetry',
  'command',
  'response',
  'event',
  'alarm',
  'batch',
  'order',
  'heartbeat',
]);
export type MessageType = z.infer<typeof MessageTypeEnum>;

// ============================================
// Base Message Schema
// ============================================

export const BaseMessageSchema = z.object({
  messageId: z.string().optional(),
  timestamp: z.string().or(z.number()),
  source: z.string().optional(),
  messageType: MessageTypeEnum.optional(),
});

export type BaseMessage = z.infer<typeof BaseMessageSchema>;

// ============================================
// Telemetry Message
// ============================================

export const TelemetryMessageSchema = BaseMessageSchema.extend({
  value: z.union([z.number(), z.string(), z.boolean()]),
  quality: QualityEnum.optional().default('GOOD'),
  unit: z.string().optional(),
  dataType: z.enum(['BOOL', 'INT8', 'INT16', 'INT32', 'INT64', 'UINT8', 'UINT16', 'UINT32', 'UINT64', 'FLOAT32', 'FLOAT64', 'STRING']).optional(),
  metadata: z.record(z.any()).optional(),
});

export type TelemetryMessage = z.infer<typeof TelemetryMessageSchema>;

// ============================================
// Alarm Message
// ============================================

export const AlarmMessageSchema = BaseMessageSchema.extend({
  alarmId: z.string(),
  alarmDefinitionId: z.string().optional(),
  tagId: z.string(),
  alarmType: z.enum(['HIGH', 'LOW', 'HIGH_HIGH', 'LOW_LOW', 'DEVIATION', 'RATE', 'BOOL_TRUE', 'BOOL_FALSE']),
  state: AlarmStateEnum,
  priority: z.number().min(1).max(5),
  message: z.string(),
  value: z.number(),
  limit: z.number().optional(),
  activatedAt: z.string().or(z.number()),
  acknowledgedAt: z.string().or(z.number()).optional(),
  acknowledgedBy: z.string().optional(),
  shelvedUntil: z.string().or(z.number()).optional(),
  metadata: z.record(z.any()).optional(),
});

export type AlarmMessage = z.infer<typeof AlarmMessageSchema>;

// ============================================
// Command Message
// ============================================

export const CommandMessageSchema = BaseMessageSchema.extend({
  commandId: z.string(),
  commandType: z.string(),
  target: z.string(),
  parameters: z.record(z.any()).optional(),
  userId: z.string().optional(),
  timeout: z.number().optional(), // seconds
  priority: z.number().min(1).max(5).optional().default(3),
});

export type CommandMessage = z.infer<typeof CommandMessageSchema>;

// ============================================
// Command Response
// ============================================

export const CommandResponseSchema = BaseMessageSchema.extend({
  commandId: z.string(),
  success: z.boolean(),
  result: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
  executionTime: z.number().optional(), // milliseconds
});

export type CommandResponse = z.infer<typeof CommandResponseSchema>;

// ============================================
// Batch State Message
// ============================================

export const S88StateEnum = z.enum([
  'IDLE',
  'RUNNING',
  'HOLDING',
  'HELD',
  'RESTARTING',
  'COMPLETING',
  'COMPLETE',
  'STOPPING',
  'STOPPED',
  'ABORTING',
  'ABORTED',
  'RESETTING',
]);

export const BatchStateMessageSchema = BaseMessageSchema.extend({
  batchId: z.string(),
  batchNumber: z.string(),
  recipeId: z.string().optional(),
  orderId: z.string().optional(),
  state: S88StateEnum,
  phase: z.string().optional(),
  step: z.string().optional(),
  progress: z.number().min(0).max(100),
  parameters: z.record(z.any()).optional(),
  startedAt: z.string().or(z.number()).optional(),
  estimatedEnd: z.string().or(z.number()).optional(),
});

export type BatchStateMessage = z.infer<typeof BatchStateMessageSchema>;

// ============================================
// Production Order Message
// ============================================

export const OrderStatusEnum = z.enum([
  'CREATED',
  'RELEASED',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'HELD',
]);

export const ProductionOrderMessageSchema = BaseMessageSchema.extend({
  orderId: z.string(),
  orderNumber: z.string(),
  productId: z.string(),
  recipeId: z.string().optional(),
  quantity: z.number(),
  producedQty: z.number(),
  scrapQty: z.number().optional(),
  status: OrderStatusEnum,
  priority: z.number().min(1).max(5),
  plannedStart: z.string().or(z.number()).optional(),
  plannedEnd: z.string().or(z.number()).optional(),
  actualStart: z.string().or(z.number()).optional(),
  actualEnd: z.string().or(z.number()).optional(),
  workCenterId: z.string().optional(),
});

export type ProductionOrderMessage = z.infer<typeof ProductionOrderMessageSchema>;

// ============================================
// Equipment Status Message
// ============================================

export const EquipmentStatusEnum = z.enum([
  'RUNNING',
  'STOPPED',
  'MAINTENANCE',
  'FAULTED',
  'STARTING',
  'STOPPING',
  'ABORTING',
  'RESETTING',
  'IDLE',
  'OFFLINE',
]);

export const EquipmentStatusMessageSchema = BaseMessageSchema.extend({
  equipmentId: z.string(),
  equipmentCode: z.string(),
  status: EquipmentStatusEnum,
  mode: z.enum(['AUTO', 'MANUAL', 'OFF', 'MAINTENANCE']).optional(),
  state: z.string().optional(),
  stateText: z.string().optional(),
  runTime: z.number().optional(), // seconds since start
  faults: z.array(z.object({
    code: z.string(),
    message: z.string(),
    timestamp: z.string().or(z.number()),
  })).optional(),
  warnings: z.array(z.object({
    code: z.string(),
    message: z.string(),
  })).optional(),
});

export type EquipmentStatusMessage = z.infer<typeof EquipmentStatusMessageSchema>;

// ============================================
// Energy Message
// ============================================

export const EnergyMessageSchema = BaseMessageSchema.extend({
  source: z.string(), // ELECTRICITY, GAS, WATER, COMPRESSED_AIR, STEAM
  value: z.number(),
  unit: z.string().default('kWh'),
  equipmentId: z.string().optional(),
  workCenterId: z.string().optional(),
  period: z.enum(['INSTANT', 'HOURLY', 'DAILY', 'MONTHLY']).optional(),
  accumulation: z.number().optional(), // cumulative value
});

export type EnergyMessage = z.infer<typeof EnergyMessageSchema>;

// ============================================
// OEE Message
// ============================================

export const OEEMessageSchema = BaseMessageSchema.extend({
  workCenterId: z.string(),
  availability: z.number().min(0).max(100),
  performance: z.number().min(0).max(100),
  quality: z.number().min(0).max(100),
  oee: z.number().min(0).max(100),
  runTime: z.number().optional(), // minutes
  plannedTime: z.number().optional(), // minutes
  downtime: z.number().optional(), // minutes
  downtimeReasons: z.array(z.object({
    reason: z.string(),
    category: z.string(),
    duration: z.number(),
  })).optional(),
  goodUnits: z.number().optional(),
  totalUnits: z.number().optional(),
  scrapUnits: z.number().optional(),
  idealCycleTime: z.number().optional(), // seconds
  period: z.enum(['SHIFT', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY']).optional(),
});

export type OEEMessage = z.infer<typeof OEEMessageSchema>;

// ============================================
// Quality Message
// ============================================

export const QualityMessageSchema = BaseMessageSchema.extend({
  metricType: z.enum(['DEFECT_RATE', 'YIELD', 'FIRST_PASS_YIELD', 'CPK', 'PPM', 'CUSTOM']),
  value: z.number(),
  target: z.number().optional(),
  unit: z.string().optional(),
  batchId: z.string().optional(),
  workCenterId: z.string().optional(),
  sampleSize: z.number().optional(),
  defects: z.number().optional(),
  measurements: z.array(z.number()).optional(),
  specification: z.object({
    lsl: z.number().optional(), // lower specification limit
    usl: z.number().optional(), // upper specification limit
    target: z.number().optional(),
  }).optional(),
});

export type QualityMessage = z.infer<typeof QualityMessageSchema>;

// ============================================
// Heartbeat Message
// ============================================

export const HeartbeatMessageSchema = BaseMessageSchema.extend({
  source: z.string(),
  sourceType: z.enum(['CONNECTOR', 'GATEWAY', 'SERVICE', 'EDGE_DEVICE']),
  status: z.enum(['HEALTHY', 'DEGRADED', 'UNHEALTHY']),
  uptime: z.number(), // seconds
  version: z.string().optional(),
  metrics: z.object({
    messagesProcessed: z.number().optional(),
    messagesPerSecond: z.number().optional(),
    errors: z.number().optional(),
    lastError: z.string().optional(),
    memoryUsedMB: z.number().optional(),
    cpuPercent: z.number().optional(),
  }).optional(),
  config: z.record(z.any()).optional(),
});

export type HeartbeatMessage = z.infer<typeof HeartbeatMessageSchema>;

// ============================================
// Genealogy Message
// ============================================

export const GenealogyMessageSchema = BaseMessageSchema.extend({
  relationship: z.enum(['INPUT_TO', 'OUTPUT_FROM', 'TRANSFORMED_TO', 'MERGED_TO', 'SPLIT_FROM']),
  fromLotId: z.string().optional(),
  toLotId: z.string().optional(),
  quantity: z.number(),
  unit: z.string().optional(),
  batchId: z.string().optional(),
  operation: z.string().optional(),
  notes: z.string().optional(),
});

export type GenealogyMessage = z.infer<typeof GenealogyMessageSchema>;

// ============================================
// Setpoint Write Message
// ============================================

export const SetpointWriteSchema = BaseMessageSchema.extend({
  tagId: z.string(),
  value: z.union([z.number(), z.string(), z.boolean()]),
  userId: z.string().optional(),
  reason: z.string().optional(),
  source: z.string(),
});

export type SetpointWrite = z.infer<typeof SetpointWriteSchema>;

// ============================================
// Validation Functions
// ============================================

export function validateTelemetry(data: unknown): TelemetryMessage {
  return TelemetryMessageSchema.parse(data);
}

export function validateAlarm(data: unknown): AlarmMessage {
  return AlarmMessageSchema.parse(data);
}

export function validateCommand(data: unknown): CommandMessage {
  return CommandMessageSchema.parse(data);
}

export function validateCommandResponse(data: unknown): CommandResponse {
  return CommandResponseSchema.parse(data);
}

export function validateBatchState(data: unknown): BatchStateMessage {
  return BatchStateMessageSchema.parse(data);
}

export function validateProductionOrder(data: unknown): ProductionOrderMessage {
  return ProductionOrderMessageSchema.parse(data);
}

export function validateEquipmentStatus(data: unknown): EquipmentStatusMessage {
  return EquipmentStatusMessageSchema.parse(data);
}

export function validateEnergy(data: unknown): EnergyMessage {
  return EnergyMessageSchema.parse(data);
}

export function validateOEE(data: unknown): OEEMessage {
  return OEEMessageSchema.parse(data);
}

export function validateQuality(data: unknown): QualityMessage {
  return QualityMessageSchema.parse(data);
}

export function validateHeartbeat(data: unknown): HeartbeatMessage {
  return HeartbeatMessageSchema.parse(data);
}

export function validateGenealogy(data: unknown): GenealogyMessage {
  return GenealogyMessageSchema.parse(data);
}

export function validateSetpointWrite(data: unknown): SetpointWrite {
  return SetpointWriteSchema.parse(data);
}

// Safe parse versions (return null on error)
export function safeValidateTelemetry(data: unknown): TelemetryMessage | null {
  const result = TelemetryMessageSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function safeParseMessage(data: unknown): { success: boolean; data?: any; error?: string } {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return { success: true, data: parsed };
  } catch (error) {
    return { success: false, error: 'Invalid JSON' };
  }
}
