/**
 * OPC UA Edge Connector
 * 
 * Connects to OPC UA servers and bridges data to MQTT UNS
 * Supports:
 * - Subscription to OPC UA nodes
 * - Publishing to ISA-95 MQTT topics
 * - Receiving setpoint writes from MQTT
 * - Heartbeat and health monitoring
 * 
 * Port: 3120 (Health check API)
 */

import {
  OPCUAClient,
  ClientSession,
  ClientSubscription,
  ClientMonitoredItem,
  AttributeIds,
  DataType,
  DataValue,
  NodeId,
  MessageSecurityMode,
  SecurityPolicy,
} from 'node-opcua';
import mqtt, { MqttClient } from 'mqtt';
import { PrismaClient } from '@prisma/client';

// Configuration
const MQTT_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const HEALTH_PORT = 3120;
const CONNECTOR_CODE = process.env.CONNECTOR_CODE || 'OPCUA-GW-01';

// OPC UA Configuration
const OPCUA_ENDPOINT = process.env.OPCUA_ENDPOINT || 'opc.tcp://localhost:4840';
const OPCUA_SECURITY_MODE = process.env.OPCUA_SECURITY_MODE || 'None';
const OPCUA_SECURITY_POLICY = process.env.OPCUA_SECURITY_POLICY || 'None';

// Initialize Prisma
const prisma = new PrismaClient();

// Clients
let mqttClient: MqttClient | null = null;
let opcuaClient: OPCUAClient | null = null;
let opcuaSession: ClientSession | null = null;
let opcuaSubscription: ClientSubscription | null = null;

// Stats
const stats = {
  messagesPublished: 0,
  messagesReceived: 0,
  errors: 0,
  lastMessageTime: null as Date | null,
  startTime: new Date(),
  reconnectAttempts: 0,
};

// Monitored items
const monitoredItems = new Map<string, ClientMonitoredItem>();

// ============================================
// MQTT Connection
// ============================================

function connectMQTT() {
  mqttClient = mqtt.connect(MQTT_URL, {
    clientId: `edge-opcua-${CONNECTOR_CODE}-${Date.now()}`,
    clean: true,
    keepalive: 60,
    reconnectPeriod: 5000,
  });

  mqttClient.on('connect', () => {
    console.log('[MQTT] Connected to broker');
    
    // Subscribe to setpoint topics for this connector
    mqttClient?.subscribe(`ACME/+/system/connectors/${CONNECTOR_CODE}/setpoint/#`, { qos: 1 });
    mqttClient?.subscribe(`ACME/+/system/connectors/${CONNECTOR_CODE}/command`, { qos: 1 });
  });

  mqttClient.on('message', async (topic: string, payload: Buffer) => {
    try {
      await handleMQTTMessage(topic, payload);
      stats.messagesReceived++;
    } catch (error) {
      stats.errors++;
      console.error('[MQTT] Error handling message:', error);
    }
  });

  mqttClient.on('error', (error) => {
    console.error('[MQTT] Error:', error);
  });
}

async function handleMQTTMessage(topic: string, payload: Buffer) {
  const message = JSON.parse(payload.toString());
  const topicParts = topic.split('/');
  
  if (topic.includes('/setpoint/')) {
    // Write to OPC UA
    const nodeId = message.nodeId || message.tagId;
    const value = message.value;
    
    if (nodeId && opcuaSession) {
      try {
        await opcuaSession.write({
          nodeId,
          attributeId: AttributeIds.Value,
          value: {
            value: convertValueToOPCUA(value),
          },
        });
        
        console.log(`[OPC UA] Wrote ${value} to ${nodeId}`);
      } catch (error) {
        console.error(`[OPC UA] Write error for ${nodeId}:`, error);
      }
    }
  } else if (topic.includes('/command')) {
    // Handle command (e.g., reconnect, rescan)
    if (message.command === 'reconnect') {
      await disconnectOPCUA();
      await connectOPCUA();
    } else if (message.command === 'rescan') {
      await scanOPCUANodes();
    }
  }
}

function convertValueToOPCUA(value: any): any {
  if (typeof value === 'boolean') {
    return { dataType: DataType.Boolean, value };
  } else if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { dataType: DataType.Int32, value };
    }
    return { dataType: DataType.Float, value };
  }
  return { dataType: DataType.String, value };
}

// ============================================
// OPC UA Connection
// ============================================

async function connectOPCUA() {
  try {
    opcuaClient = OPCUAClient.create({
      applicationName: `UNS-Edge-Connector-${CONNECTOR_CODE}`,
      connectionStrategy: {
        initialDelay: 2000,
        maxDelay: 30000,
        maxRetry: 10,
      },
      securityMode: MessageSecurityMode[OPCUA_SECURITY_MODE as keyof typeof MessageSecurityMode] || MessageSecurityMode.None,
      securityPolicy: SecurityPolicy[OPCUA_SECURITY_POLICY as keyof typeof SecurityPolicy] || SecurityPolicy.None,
    });

    opcuaClient.on('connection_failed', () => {
      console.error('[OPC UA] Connection failed');
      stats.reconnectAttempts++;
    });

    opcuaClient.on('start_reconnection', () => {
      console.log('[OPC UA] Starting reconnection...');
    });

    await opcuaClient.connect(OPCUA_ENDPOINT);
    console.log(`[OPC UA] Connected to ${OPCUA_ENDPOINT}`);

    // Create session
    opcuaSession = await opcuaClient.createSession();
    console.log('[OPC UA] Session created');

    // Create subscription
    opcuaSubscription = await opcuaSession.createSubscription2({
      requestedPublishingInterval: 1000,
      requestedLifetimeCount: 100,
      requestedMaxKeepAliveCount: 10,
      maxNotificationsPerPublish: 100,
      publishingEnabled: true,
      priority: 10,
    });
    console.log('[OPC UA] Subscription created');

    // Load tag mappings and start monitoring
    await loadTagMappings();

    // Update connector status
    await updateConnectorStatus('ONLINE');
  } catch (error) {
    console.error('[OPC UA] Connection error:', error);
    await updateConnectorStatus('ERROR');
    stats.errors++;
  }
}

async function disconnectOPCUA() {
  try {
    if (opcuaSubscription) {
      await opcuaSubscription.terminate();
      opcuaSubscription = null;
    }
    
    if (opcuaSession) {
      await opcuaSession.close();
      opcuaSession = null;
    }
    
    if (opcuaClient) {
      await opcuaClient.disconnect();
      opcuaClient = null;
    }
    
    monitoredItems.clear();
    console.log('[OPC UA] Disconnected');
  } catch (error) {
    console.error('[OPC UA] Disconnect error:', error);
  }
}

// ============================================
// Tag Mappings
// ============================================

async function loadTagMappings() {
  // Get connector from database
  const connector = await prisma.edgeConnector.findFirst({
    where: { code: CONNECTOR_CODE },
    include: {
      tagMappings: {
        include: { tag: true },
        where: { isActive: true },
      },
    },
  });

  if (!connector) {
    console.log(`[DB] Connector ${CONNECTOR_CODE} not found in database`);
    return;
  }

  console.log(`[DB] Found ${connector.tagMappings.length} tag mappings`);

  // Monitor each tag
  for (const mapping of connector.tagMappings) {
    await monitorOPCUANode(
      mapping.sourceAddress,
      mapping.tag.mqttTopic,
      mapping
    );
  }
}

async function monitorOPCUANode(
  nodeId: string,
  mqttTopic: string,
  mapping: any
) {
  if (!opcuaSubscription) return;

  try {
    const itemToMonitor = {
      nodeId,
      attributeId: AttributeIds.Value,
    };

    const monitoredItem = await opcuaSubscription.monitor(
      itemToMonitor,
      { samplingInterval: 1000, discardOldest: true, queueSize: 10 },
      0
    );

    monitoredItem.on('changed', (dataValue: DataValue) => {
      handleOPCUADataChange(nodeId, mqttTopic, dataValue, mapping);
    });

    monitoredItems.set(nodeId, monitoredItem);
    console.log(`[OPC UA] Monitoring ${nodeId} -> ${mqttTopic}`);
  } catch (error) {
    console.error(`[OPC UA] Failed to monitor ${nodeId}:`, error);
  }
}

function handleOPCUADataChange(
  nodeId: string,
  mqttTopic: string,
  dataValue: DataValue,
  mapping: any
) {
  if (!mqttClient?.connected) return;

  let value = dataValue.value.value;
  
  // Apply scaling and offset
  if (mapping.scale && typeof value === 'number') {
    value = value * mapping.scale + (mapping.offset || 0);
  }

  // Build ISA-95 compliant message
  const message = {
    value,
    quality: dataValue.statusCode.name,
    timestamp: dataValue.sourceTimestamp?.toISOString() || new Date().toISOString(),
    nodeId,
    source: CONNECTOR_CODE,
    dataType: DataType[dataValue.value.dataType as any] || 'Unknown',
  };

  // Publish to MQTT
  mqttClient.publish(mqttTopic, JSON.stringify(message), { qos: 1, retain: true });
  
  stats.messagesPublished++;
  stats.lastMessageTime = new Date();
}

// ============================================
// Node Scanning
// ============================================

async function scanOPCUANodes() {
  if (!opcuaSession) return;

  console.log('[OPC UA] Scanning nodes...');
  
  try {
    // Browse root folder
    const rootFolder = await opcuaSession.browse('RootFolder');
    
    for (const reference of rootFolder.references || []) {
      if (reference.nodeClass === 'Object') {
        console.log(`[OPC UA] Found object: ${reference.browseName.name} (${reference.nodeId})`);
      }
    }
  } catch (error) {
    console.error('[OPC UA] Scan error:', error);
  }
}

// ============================================
// Database Updates
// ============================================

async function updateConnectorStatus(status: string) {
  try {
    await prisma.edgeConnector.updateMany({
      where: { code: CONNECTOR_CODE },
      data: {
        status,
        lastSeen: new Date(),
      },
    });
  } catch (error) {
    console.error('[DB] Failed to update connector status:', error);
  }
}

// ============================================
// Heartbeat
// ============================================

async function sendHeartbeat() {
  if (!mqttClient?.connected) return;

  const connector = await prisma.edgeConnector.findFirst({
    where: { code: CONNECTOR_CODE },
    include: { site: true },
  });

  if (!connector) return;

  const message = {
    source: CONNECTOR_CODE,
    sourceType: 'CONNECTOR',
    status: opcuaSession ? 'HEALTHY' : 'UNHEALTHY',
    uptime: Math.floor((Date.now() - stats.startTime.getTime()) / 1000),
    version: '1.0.0',
    metrics: {
      messagesProcessed: stats.messagesPublished,
      messagesPerSecond: stats.messagesPublished / Math.max(1, (Date.now() - stats.startTime.getTime()) / 1000),
      errors: stats.errors,
    },
    timestamp: new Date().toISOString(),
  };

  const topic = `${connector.site?.code || 'UNKNOWN'}/system/connectors/${CONNECTOR_CODE}/heartbeat`;
  mqttClient.publish(topic, JSON.stringify(message), { qos: 1 });
}

// Send heartbeat every 30 seconds
setInterval(sendHeartbeat, 30000);

// ============================================
// Health Check API
// ============================================

async function startHealthServer() {
  const server = Bun.serve({
    port: HEALTH_PORT,
    async fetch(req) {
      const url = new URL(req.url);
      
      if (url.pathname === '/health') {
        return Response.json({
          status: opcuaSession ? 'healthy' : 'unhealthy',
          connector: CONNECTOR_CODE,
          uptime: Math.floor((Date.now() - stats.startTime.getTime()) / 1000),
          mqtt: mqttClient?.connected ? 'connected' : 'disconnected',
          opcua: opcuaSession ? 'connected' : 'disconnected',
          endpoint: OPCUA_ENDPOINT,
          stats: {
            messagesPublished: stats.messagesPublished,
            messagesReceived: stats.messagesReceived,
            errors: stats.errors,
            monitoredItems: monitoredItems.size,
            lastMessageTime: stats.lastMessageTime,
          },
        });
      }
      
      if (url.pathname === '/stats') {
        return Response.json(stats);
      }
      
      return new Response('Not Found', { status: 404 });
    },
  });

  console.log(`[Health] Health check server listening on port ${HEALTH_PORT}`);
}

// ============================================
// Start Service
// ============================================

async function start() {
  console.log(`[OPC UA Connector] Starting ${CONNECTOR_CODE}...`);
  
  // Connect to database
  await prisma.$connect();
  console.log('[DB] Connected to PostgreSQL');

  // Connect to MQTT
  connectMQTT();

  // Connect to OPC UA
  await connectOPCUA();

  // Start health check server
  await startHealthServer();

  console.log(`[OPC UA Connector] ${CONNECTOR_CODE} ready`);
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Shutdown] SIGTERM received');
  await updateConnectorStatus('OFFLINE');
  await disconnectOPCUA();
  mqttClient?.end();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Shutdown] SIGINT received');
  await updateConnectorStatus('OFFLINE');
  await disconnectOPCUA();
  mqttClient?.end();
  await prisma.$disconnect();
  process.exit(0);
});

start();
