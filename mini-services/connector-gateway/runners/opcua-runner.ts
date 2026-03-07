/**
 * OPC-UA connector runner. One instance per OPC_UA connector from DB.
 * Reusable: no env for endpoint/code; all from ConnectorConfig.
 */

import {
  OPCUAClient,
  ClientSession,
  ClientSubscription,
  ClientMonitoredItem,
  AttributeIds,
  DataType,
  DataValue,
  MessageSecurityMode,
  SecurityPolicy,
} from 'node-opcua';
import type { ConnectorConfig, ConnectorMapping, IConnectorRunner } from '../types';
import { connectorSnapshot } from '../types';
import { publish, isMqttConnected } from '../lib/mqtt';
import { updateConnectorStatus } from '../lib/db';

export class OpcuaRunner implements IConnectorRunner {
  readonly connectorId: string;
  readonly code: string;
  readonly type = 'OPC_UA';

  private client: OPCUAClient | null = null;
  private session: ClientSession | null = null;
  private subscription: ClientSubscription | null = null;
  private monitoredItems = new Map<string, ClientMonitoredItem>();
  private lastSnapshot = '';
  private status: 'running' | 'stopped' | 'error' = 'stopped';
  private startTime = new Date();
  private stats = { messagesPublished: 0, errors: 0 };
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private siteCode = 'UNKNOWN';

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

    const endpoint = (config.endpoint || '').trim();
    if (!endpoint || !endpoint.startsWith('opc.tcp://')) {
      console.error(`[OPC-UA ${this.code}] Invalid endpoint: ${endpoint}`);
      this.status = 'error';
      await updateConnectorStatus(this.connectorId, 'ERROR');
      return;
    }

    if (config.tagMappings.length === 0) {
      console.log(`[OPC-UA ${this.code}] No tag mappings; skipping.`);
      await updateConnectorStatus(this.connectorId, 'OFFLINE');
      return;
    }

    this.siteCode = config.site?.code ?? 'UNKNOWN';
    const conf = (config.config || {}) as Record<string, string>;
    const securityMode =
      MessageSecurityMode[conf.securityMode as keyof typeof MessageSecurityMode] ?? MessageSecurityMode.None;
    const securityPolicy =
      SecurityPolicy[conf.securityPolicy as keyof typeof SecurityPolicy] ?? SecurityPolicy.None;

    try {
      this.client = OPCUAClient.create({
        applicationName: `UNS-Gateway-${this.code}`,
        connectionStrategy: { initialDelay: 2000, maxDelay: 30000, maxRetry: 5 },
        securityMode,
        securityPolicy,
        endpointMustExist: false,
      });

      await this.client.connect(endpoint);
      this.session = await this.client.createSession();
      this.subscription = await this.session.createSubscription2({
        requestedPublishingInterval: 1000,
        requestedLifetimeCount: 100,
        requestedMaxKeepAliveCount: 10,
        maxNotificationsPerPublish: 100,
        publishingEnabled: true,
        priority: 10,
      });

      for (const mapping of config.tagMappings) {
        await this.monitor(mapping);
      }

      this.lastSnapshot = connectorSnapshot(config);
      this.status = 'running';
      this.startTime = new Date();
      this.stats = { messagesPublished: 0, errors: 0 };
      await updateConnectorStatus(this.connectorId, 'ONLINE');

      const heartbeatInterval = Math.max(15, config.heartbeatRate) * 1000;
      this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), heartbeatInterval);

      console.log(`[OPC-UA ${this.code}] Connected to ${endpoint}; monitoring ${config.tagMappings.length} nodes.`);
    } catch (err) {
      console.error(`[OPC-UA ${this.code}] Connection error:`, err);
      this.status = 'error';
      await updateConnectorStatus(this.connectorId, 'ERROR');
      await this.stop();
    }
  }

  private async monitor(mapping: ConnectorMapping): Promise<void> {
    if (!this.subscription) return;
    const nodeId = mapping.sourceAddress;
    try {
      const item = await this.subscription.monitor(
        { nodeId, attributeId: AttributeIds.Value },
        { samplingInterval: 1000, discardOldest: true, queueSize: 10 },
        0
      );
      item.on('changed', (dataValue: DataValue) => {
        this.onDataChange(nodeId, mapping.tag.mqttTopic, dataValue, mapping);
      });
      this.monitoredItems.set(nodeId, item);
    } catch (err) {
      console.error(`[OPC-UA ${this.code}] Failed to monitor ${nodeId}:`, err);
      this.stats.errors++;
    }
  }

  private onDataChange(
    nodeId: string,
    mqttTopic: string,
    dataValue: DataValue,
    mapping: ConnectorMapping
  ): void {
    if (!isMqttConnected()) return;
    let value = dataValue.value.value;
    if (mapping.scale != null && typeof value === 'number') {
      value = value * mapping.scale + (mapping.offset ?? 0);
    }
    const message = {
      value,
      quality: dataValue.statusCode?.name ?? 'Unknown',
      timestamp: dataValue.sourceTimestamp?.toISOString() ?? new Date().toISOString(),
      nodeId,
      source: this.code,
      dataType: DataType[dataValue.value.dataType as number] ?? 'Unknown',
    };
    publish(mqttTopic, message);
    this.stats.messagesPublished++;
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
        status: this.session ? 'HEALTHY' : 'UNHEALTHY',
        uptime: uptimeSec,
        version: '1.0.0',
        metrics: {
          messagesProcessed: this.stats.messagesPublished,
          errors: this.stats.errors,
        },
        timestamp: new Date().toISOString(),
      },
      { retain: false, qos: 1 }
    );
  }

  async stop(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    try {
      if (this.subscription) {
        await this.subscription.terminate();
        this.subscription = null;
      }
      if (this.session) {
        await this.session.close();
        this.session = null;
      }
      if (this.client) {
        await this.client.disconnect();
        this.client = null;
      }
      this.monitoredItems.clear();
      if (this.status === 'running') {
        await updateConnectorStatus(this.connectorId, 'OFFLINE');
      }
      this.status = 'stopped';
      console.log(`[OPC-UA ${this.code}] Stopped.`);
    } catch (err) {
      console.error(`[OPC-UA ${this.code}] Stop error:`, err);
      this.status = 'stopped';
    }
  }
}
