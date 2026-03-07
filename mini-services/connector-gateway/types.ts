/**
 * Shared types for connector gateway.
 * Reusable across OPC-UA, Modbus, and future protocol runners.
 */

export interface ConnectorMapping {
  id: string;
  sourceAddress: string;
  sourceType: string;
  sourceDataType: string | null;
  scale: number | null;
  offset: number | null;
  swapBytes: boolean;
  isActive: boolean;
  tag: {
    id: string;
    name: string;
    mqttTopic: string;
    dataType: string;
    engUnit: string | null;
  };
}

export interface ConnectorConfig {
  id: string;
  code: string;
  name: string;
  type: string;
  protocol: string | null;
  endpoint: string;
  config: Record<string, unknown> | null;
  status: string;
  heartbeatRate: number;
  siteId: string;
  site: {
    id: string;
    name: string;
    code: string;
  } | null;
  tagMappings: ConnectorMapping[];
}

/** Snapshot for change detection: endpoint + sorted mapping keys. */
export function connectorSnapshot(c: ConnectorConfig): string {
  const mappingKeys = c.tagMappings
    .map((m) => `${m.sourceAddress}:${m.tag.mqttTopic}`)
    .sort()
    .join('|');
  return `${c.endpoint}|${mappingKeys}`;
}

/**
 * Runner interface: one per connector. Start/stop/update from DB config.
 * Implementations: OpcuaRunner, ModbusTcpRunner, etc.
 */
export interface IConnectorRunner {
  readonly connectorId: string;
  readonly code: string;
  readonly type: string;

  /** Start or replace with new config. Idempotent after stop. */
  start(config: ConnectorConfig): Promise<void>;

  /** Stop and release resources. */
  stop(): Promise<void>;

  /** Return true if config changed and runner should be restarted. */
  isConfigChanged(config: ConnectorConfig): boolean;

  /** Current status for health/reporting. */
  getStatus(): 'running' | 'stopped' | 'error';
}
