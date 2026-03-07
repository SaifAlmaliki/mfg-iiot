/**
 * Modbus TCP connector runner. One instance per MODBUS_TCP connector from DB.
 * All config from ConnectorConfig (endpoint = host:port).
 */

import net from 'net';
import type { ConnectorConfig, ConnectorMapping, IConnectorRunner } from '../types';
import { connectorSnapshot } from '../types';
import { publish, isMqttConnected } from '../lib/mqtt';
import { updateConnectorStatus } from '../lib/db';

const POLL_INTERVAL_MS = 1000;
const DEFAULT_UNIT_ID = 1;

export class ModbusTcpRunner implements IConnectorRunner {
  readonly connectorId: string;
  readonly code: string;
  readonly type = 'MODBUS_TCP';

  private socket: net.Socket | null = null;
  private modbusClient: unknown = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastSnapshot = '';
  private status: 'running' | 'stopped' | 'error' = 'stopped';
  private startTime = new Date();
  private siteCode = 'UNKNOWN';
  private config: ConnectorConfig | null = null;

  constructor(connectorId: string, code: string) {
    this.connectorId = connectorId;
    this.code = code;
  }

  isConfigChanged(config: ConnectorConfig): boolean {
    const snap = connectorSnapshot(config);
    const changed = snap !== this.lastSnapshot;
    if (changed) this.lastSnapshot = snap;
    return changed;
  }

  getStatus(): 'running' | 'stopped' | 'error' {
    return this.status;
  }

  async start(config: ConnectorConfig): Promise<void> {
    if (this.status === 'running') {
      if (this.isConfigChanged(config)) await this.stop();
      else return;
    }
    await this.stop();

    const endpoint = (config.endpoint || '').trim().replace(/^tcp:\/\//i, '');
    const [host, portStr] = endpoint.split(':');
    const port = portStr ? parseInt(portStr, 10) : 502;
    if (!host || !port) {
      console.error(`[Modbus ${this.code}] Invalid endpoint: ${config.endpoint}`);
      this.status = 'error';
      await updateConnectorStatus(this.connectorId, 'ERROR');
      return;
    }

    if (config.tagMappings.length === 0) {
      console.log(`[Modbus ${this.code}] No tag mappings; skipping.`);
      await updateConnectorStatus(this.connectorId, 'OFFLINE');
      return;
    }

    this.siteCode = config.site?.code ?? 'UNKNOWN';
    this.config = config;
    const unitId = DEFAULT_UNIT_ID;

    try {
      const Modbus = await import('jsmodbus').catch(() => null);
      if (!Modbus?.client?.TCP) {
        console.error(`[Modbus ${this.code}] jsmodbus not available`);
        this.status = 'error';
        await updateConnectorStatus(this.connectorId, 'ERROR');
        return;
      }

      const socket = new net.Socket();
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);
        socket.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
        socket.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
        socket.connect(port, host);
      });

      const client = new Modbus.client.TCP(socket, unitId);
      this.socket = socket;
      this.modbusClient = client;
      this.lastSnapshot = connectorSnapshot(config);
      this.status = 'running';
      this.startTime = new Date();
      await updateConnectorStatus(this.connectorId, 'ONLINE');

      this.pollTimer = setInterval(() => this.poll(config.tagMappings), POLL_INTERVAL_MS);
      const heartbeatInterval = Math.max(15, config.heartbeatRate) * 1000;
      this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), heartbeatInterval);

      console.log(`[Modbus ${this.code}] Connected to ${host}:${port}; polling ${config.tagMappings.length} addresses.`);
    } catch (err) {
      console.error(`[Modbus ${this.code}] Connection error:`, err);
      this.status = 'error';
      await updateConnectorStatus(this.connectorId, 'ERROR');
      await this.stop();
    }
  }

  private async poll(mappings: ConnectorMapping[]): Promise<void> {
    if (!this.modbusClient || !isMqttConnected()) return;
    const client = this.modbusClient as {
      readCoils: (addr: number, count: number) => Promise<{ response: { body: { values: boolean[] } } }>;
      readDiscreteInputs: (addr: number, count: number) => Promise<{ response: { body: { values: boolean[] } } }>;
      readInputRegisters: (addr: number, count: number) => Promise<{ response: { body: { values: number[] } } }>;
      readHoldingRegisters: (addr: number, count: number) => Promise<{ response: { body: { values: number[] } } }>;
    };

    for (const mapping of mappings) {
      try {
        const addr = parseInt(mapping.sourceAddress, 10);
        if (isNaN(addr)) continue;
        let value: number | boolean;
        let quality = 'GOOD';
        try {
          switch (mapping.sourceType) {
            case 'COIL': {
              const r = await client.readCoils(addr, 1);
              value = r?.response?.body?.values?.[0] ?? false;
              break;
            }
            case 'DISCRETE_INPUT': {
              const r = await client.readDiscreteInputs(addr, 1);
              value = r?.response?.body?.values?.[0] ?? false;
              break;
            }
            case 'INPUT_REGISTER': {
              const r = await client.readInputRegisters(addr, 1);
              value = r?.response?.body?.values?.[0] ?? 0;
              break;
            }
            case 'HOLDING_REGISTER': {
              const r = await client.readHoldingRegisters(addr, 1);
              value = r?.response?.body?.values?.[0] ?? 0;
              break;
            }
            default:
              continue;
          }
        } catch {
          continue;
        }
        if (mapping.scale != null && typeof value === 'number') {
          value = value * mapping.scale + (mapping.offset ?? 0);
        }
        const message = {
          value,
          quality,
          timestamp: new Date().toISOString(),
          source: this.code,
        };
        publish(mapping.tag.mqttTopic, message);
      } catch {
        // skip failed read
      }
    }
  }

  private sendHeartbeat(): void {
    if (!isMqttConnected() || this.status !== 'running') return;
    const topic = `${this.siteCode}/system/connectors/${this.code}/heartbeat`;
    const uptimeSec = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    publish(
      topic,
      {
        source: this.code,
        sourceType: 'CONNECTOR',
        status: this.socket?.writable ? 'HEALTHY' : 'UNHEALTHY',
        uptime: uptimeSec,
        version: '1.0.0',
        metrics: {},
        timestamp: new Date().toISOString(),
      },
      { retain: false, qos: 1 }
    );
  }

  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch {}
      this.socket = null;
    }
    this.modbusClient = null;
    this.config = null;
    if (this.status === 'running') {
      await updateConnectorStatus(this.connectorId, 'OFFLINE');
    }
    this.status = 'stopped';
    console.log(`[Modbus ${this.code}] Stopped.`);
  }
}
