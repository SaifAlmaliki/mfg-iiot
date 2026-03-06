/**
 * ISA-95 Topic Hierarchy Utilities
 * Standard topic structure following ISA-95/IEC 62264
 * 
 * Hierarchy: Enterprise → Site → Area → Work Center → Work Unit → Equipment → Attribute
 */

// ISA-95 Topic Segments
export interface TopicSegments {
  enterprise: string;
  site: string;
  area: string;
  workCenter: string;
  workUnit: string;
  equipment?: string;
  attribute: string;
}

// Data Types for different topic categories
export type TopicCategory = 
  | 'value'      // Current process value
  | 'alarm'      // Alarm status
  | 'setpoint'   // Setpoint/writable value
  | 'status'     // Equipment status
  | 'command'    // Command topic
  | 'event'      // Event notification
  | 'metadata'   // Tag metadata
  | 'history'    // Historical data
  | 'diagnostic' // Diagnostic information
  | 'energy'     // Energy consumption
  | 'maintenance'// Maintenance data
  | 'batch'      // Batch execution data
  | 'quality'    // Quality measurements
  | 'oee'        // OEE metrics
  | 'genealogy'  // Material genealogy
  | 'order';     // Production order data

// Message Types
export type MessageType = 
  | 'telemetry'   // Real-time telemetry
  | 'command'     // Command message
  | 'response'    // Command response
  | 'event'       // Event notification
  | 'alarm'       // Alarm message
  | 'batch'       // Batch data
  | 'order'       // Order data
  | 'heartbeat';  // Heartbeat/health check

/**
 * Build ISA-95 compliant MQTT topic
 */
export function buildTopic(parts: {
  enterprise: string;
  site: string;
  area?: string;
  workCenter?: string;
  workUnit?: string;
  equipment?: string;
  attribute: string;
}): string {
  const segments = [
    parts.enterprise,
    parts.site,
    parts.area || '+',
    parts.workCenter || '+',
    parts.workUnit || '+',
    parts.equipment,
    parts.attribute,
  ].filter(Boolean);
  
  return segments.join('/');
}

/**
 * Parse ISA-95 topic into segments
 */
export function parseTopic(topic: string): TopicSegments | null {
  const parts = topic.split('/');
  
  if (parts.length < 6) {
    return null;
  }
  
  return {
    enterprise: parts[0],
    site: parts[1],
    area: parts[2],
    workCenter: parts[3],
    workUnit: parts[4],
    equipment: parts[5],
    attribute: parts.slice(6).join('/'),
  };
}

/**
 * Generate topic for tag value
 */
export function tagValueTopic(
  enterprise: string,
  site: string,
  area: string,
  workCenter: string,
  workUnit: string,
  equipment: string,
  tagId: string
): string {
  return buildTopic({
    enterprise,
    site,
    area,
    workCenter,
    workUnit,
    equipment,
    attribute: `${tagId}/value`,
  });
}

/**
 * Generate topic for tag alarm
 */
export function tagAlarmTopic(
  enterprise: string,
  site: string,
  area: string,
  workCenter: string,
  workUnit: string,
  equipment: string,
  tagId: string
): string {
  return buildTopic({
    enterprise,
    site,
    area,
    workCenter,
    workUnit,
    equipment,
    attribute: `${tagId}/alarm`,
  });
}

/**
 * Generate topic for setpoint write
 */
export function setpointTopic(
  enterprise: string,
  site: string,
  area: string,
  workCenter: string,
  workUnit: string,
  equipment: string,
  tagId: string
): string {
  return buildTopic({
    enterprise,
    site,
    area,
    workCenter,
    workUnit,
    equipment,
    attribute: `${tagId}/setpoint`,
  });
}

/**
 * Generate topic for equipment status
 */
export function equipmentStatusTopic(
  enterprise: string,
  site: string,
  area: string,
  workCenter: string,
  workUnit: string,
  equipment: string
): string {
  return buildTopic({
    enterprise,
    site,
    area,
    workCenter,
    workUnit,
    equipment,
    attribute: 'status',
  });
}

/**
 * Generate topic for batch execution
 */
export function batchTopic(
  enterprise: string,
  site: string,
  area: string,
  workCenter: string,
  batchId: string,
  attribute: string
): string {
  return buildTopic({
    enterprise,
    site,
    area,
    workCenter,
    workUnit: 'batch',
    equipment: batchId,
    attribute,
  });
}

/**
 * Generate topic for production order
 */
export function orderTopic(
  enterprise: string,
  site: string,
  area: string,
  workCenter: string,
  orderId: string,
  attribute: string
): string {
  return buildTopic({
    enterprise,
    site,
    area,
    workCenter,
    workUnit: 'order',
    equipment: orderId,
    attribute,
  });
}

/**
 * Generate topic for material genealogy
 */
export function genealogyTopic(
  enterprise: string,
  site: string,
  lotNumber: string
): string {
  return buildTopic({
    enterprise,
    site,
    area: 'genealogy',
    workCenter: 'lot',
    workUnit: lotNumber,
    attribute: 'trace',
  });
}

/**
 * Generate topic for energy monitoring
 */
export function energyTopic(
  enterprise: string,
  site: string,
  area?: string,
  workCenter?: string,
  equipment?: string
): string {
  return buildTopic({
    enterprise,
    site,
    area: area || 'energy',
    workCenter: workCenter || 'main',
    workUnit: equipment || 'total',
    attribute: 'consumption',
  });
}

/**
 * Generate topic for OEE metrics
 */
export function oeeTopic(
  enterprise: string,
  site: string,
  area: string,
  workCenter: string
): string {
  return buildTopic({
    enterprise,
    site,
    area,
    workCenter,
    workUnit: 'oee',
    attribute: 'metrics',
  });
}

/**
 * Generate topic for quality metrics
 */
export function qualityTopic(
  enterprise: string,
  site: string,
  area: string,
  workCenter: string
): string {
  return buildTopic({
    enterprise,
    site,
    area,
    workCenter,
    workUnit: 'quality',
    attribute: 'metrics',
  });
}

/**
 * Generate topic for edge connector status
 */
export function connectorStatusTopic(
  enterprise: string,
  site: string,
  connectorCode: string
): string {
  return buildTopic({
    enterprise,
    site,
    area: 'system',
    workCenter: 'connectors',
    workUnit: connectorCode,
    attribute: 'status',
  });
}

/**
 * Generate topic for edge connector heartbeat
 */
export function connectorHeartbeatTopic(
  enterprise: string,
  site: string,
  connectorCode: string
): string {
  return buildTopic({
    enterprise,
    site,
    area: 'system',
    workCenter: 'connectors',
    workUnit: connectorCode,
    attribute: 'heartbeat',
  });
}

/**
 * Generate wildcard subscription topic
 */
export function wildcardTopic(
  enterprise: string,
  site?: string,
  area?: string,
  workCenter?: string,
  workUnit?: string
): string {
  const segments = [enterprise];
  
  if (site) {
    segments.push(site);
    if (area) {
      segments.push(area);
      if (workCenter) {
        segments.push(workCenter);
        if (workUnit) {
          segments.push(workUnit);
        } else {
          segments.push('#');
        }
      } else {
        segments.push('#');
      }
    } else {
      segments.push('#');
    }
  } else {
    segments.push('#');
  }
  
  return segments.join('/');
}

/**
 * Generate topic for command/response pattern
 */
export function commandTopic(
  enterprise: string,
  site: string,
  area: string,
  workCenter: string,
  commandType: string
): string {
  return buildTopic({
    enterprise,
    site,
    area,
    workCenter,
    workUnit: 'commands',
    attribute: commandType,
  });
}

/**
 * Generate topic for command response
 */
export function commandResponseTopic(
  enterprise: string,
  site: string,
  area: string,
  workCenter: string,
  commandType: string,
  requestId: string
): string {
  return buildTopic({
    enterprise,
    site,
    area,
    workCenter,
    workUnit: 'responses',
    equipment: commandType,
    attribute: requestId,
  });
}

/**
 * Validate topic format
 */
export function isValidTopic(topic: string): boolean {
  const segments = parseTopic(topic);
  if (!segments) return false;
  
  // Check for invalid characters
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  return (
    validPattern.test(segments.enterprise) &&
    validPattern.test(segments.site) &&
    validPattern.test(segments.area) &&
    validPattern.test(segments.workCenter) &&
    validPattern.test(segments.workUnit)
  );
}

/**
 * Get topic depth level
 */
export function getTopicDepth(topic: string): number {
  return topic.split('/').length;
}

/**
 * Extract tag ID from topic
 */
export function extractTagId(topic: string): string | null {
  const segments = parseTopic(topic);
  if (!segments?.attribute) return null;
  
  const parts = segments.attribute.split('/');
  return parts[0] || null;
}

/**
 * Extract category from topic attribute
 */
export function extractCategory(topic: string): string | null {
  const segments = parseTopic(topic);
  if (!segments?.attribute) return null;
  
  const parts = segments.attribute.split('/');
  return parts[parts.length - 1] || null;
}

// Topic constants
export const TOPIC_SEGMENTS = {
  ENTERPRISE: 0,
  SITE: 1,
  AREA: 2,
  WORK_CENTER: 3,
  WORK_UNIT: 4,
  EQUIPMENT: 5,
  ATTRIBUTE: 6,
} as const;

export const TOPIC_CATEGORIES: TopicCategory[] = [
  'value',
  'alarm',
  'setpoint',
  'status',
  'command',
  'event',
  'metadata',
  'history',
  'diagnostic',
  'energy',
  'maintenance',
  'batch',
  'quality',
  'oee',
  'genealogy',
  'order',
];
