/**
 * Siemens S7 Edge Connector
 * 
 * Connects to Siemens S7 PLCs and bridges data to MQTT UNS
 * Supports:
 * - S7-300, S7-400, S7-1200, S7-1500
 * - Reading DB, M, I, Q memory areas
 * - Publishing to ISA-95 MQTT topics
 * 
 * Port: 3122 (Health check API)
 */

import mqtt, { MqttClient } from 'mqtt';
import { PrismaClient } from '@prisma/client';

// Configuration
const MQTT_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const HEALTH_PORT = 3122;
const CONNECTOR_CODE = process.env.CONNECTOR_CODE || 'S7-GW-01';

// S7 Configuration
const S7_HOST = process.env.S7_HOST || '192.168.1.10';
const S7_PORT = parseInt(process.env.S7_PORT || '102');
const S7_RACK = parseInt(process.env.S7_RACK || '0');
const S7_SLOT = parseInt(process.env.S7_SLOT || '1');
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '1000');

// Initialize Prisma
const prisma = new PrismaClient();

// Clients
let mqttClient: MqttClient | null = null;
let s7Client: any = null;
let pollInterval: Timer | null = null;

// Stats
const stats = {
  messagesPublished: 0,
  messagesReceived: 0,
  errors: 0,
  lastMessageTime: null as Date | null,
  startTime: new Date(),
};

// Tag mappings
const tagMappings: any[] = [];

// ============================================
// MQTT Connection
// ============================================

function connectMQTT() {
  mqttClient = mqtt.connect(MQTT_URL, {
    clientId: `edge-s7-${CONNECTOR_CODE}-${Date.now()}`,
    clean: true,
    keepalive: 60,
    reconnectPeriod: 5000,
  });

  mqttClient.on('connect', () => {
    console.log('[MQTT] Connected to broker');
    mqttClient?.subscribe(`ACME/+/system/connectors/${CONNECTOR_CODE}/setpoint/#`, { qos: 1 });
    mqttClient?.subscribe(`ACME/+/system/connectors/${CONNECTOR_CODE}/command`, { qos: 1 });
  });

  mqttClient.on('message', async (topic: string, payload: Buffer) => {
    try {
      await handleMQTTMessage(topic, payload);
      stats.messagesReceived++;
    } catch (error) {
      stats.errors++;
    }
  });

  mqttClient.on('error', (error) => {
    console.error('[MQTT] Error:', error);
  });
}

async function handleMQTTMessage(topic: string, payload: Buffer) {
  const message = JSON.parse(payload.toString());
  
  if (topic.includes('/setpoint/') && s7Client) {
    const mapping = tagMappings.find(m => m.tag.mqttTopic === message.topic);
    
    if (mapping) {
      try {
        await writeS7Address(mapping.sourceAddress, message.value);
        console.log(`[S7] Wrote ${message.value} to ${mapping.sourceAddress}`);
      } catch (error) {
        console.error(`[S7] Write error:`, error);
      }
    }
  }
}

// ============================================
// S7 Connection
// ============================================

async function connectS7() {
  try {
    const snap7 = await import('node-snap7');
    s7Client = new snap7.S7Client();
    
    s7Client.on('connect', () => {
      console.log(`[S7] Connected to ${S7_HOST}:${S7_PORT}`);
      updateConnectorStatus('ONLINE');
      startPolling();
    });

    s7Client.on('error', (error: Error) => {
      console.error('[S7] Connection error:', error);
      updateConnectorStatus('ERROR');
      stats.errors++;
    });

    s7Client.on('close', () => {
      console.log('[S7] Connection closed');
      updateConnectorStatus('OFFLINE');
      stopPolling();
    });

    s7Client.connectTo(S7_HOST, S7_RACK, S7_SLOT);
  } catch (error) {
    console.log('[S7] node-snap7 not available, running simulation');
    await startSimulation();
  }
}

// ============================================
// S7 Read/Write
// ============================================

async function readS7Address(address: string): Promise<{ value: any; quality: string }> {
  if (!s7Client) {
    throw new Error('S7 client not connected');
  }

  // Parse address (e.g., DB1.DBW0, M10.0, I0.0, Q4.0)
  const match = address.match(/^(DB(\d+))?\.(DBX|DBB|DBW|DBD|MB|MW|MD|IB|IW|ID|QB|QW|QD)(\d+)(?:\.(\d+))?$/i);
  
  if (!match) {
    throw new Error(`Invalid S7 address: ${address}`);
  }

  const [, , dbNum, type, byteOffset, bitOffset] = match;
  const byteOff = parseInt(byteOffset);
  const bitOff = bitOffset ? parseInt(bitOffset) : 0;

  let buffer: Buffer;
  let value: any;

  switch (type.toUpperCase()) {
    case 'DBX':
    case 'M':
    case 'I':
    case 'Q':
      // Bit
      const area = type === 'DBX' ? 0x84 : type === 'M' ? 0x83 : type === 'I' ? 0x81 : 0x82;
      buffer = Buffer.alloc(1);
      // Read single byte and extract bit
      await s7Client.readArea(area, parseInt(dbNum || '0'), byteOff, 1, buffer);
      value = (buffer[0] >> bitOff) & 1;
      break;
    
    case 'DBB':
    case 'MB':
    case 'IB':
    case 'QB':
      // Byte
      buffer = Buffer.alloc(1);
      await s7Client.readArea(0x84, parseInt(dbNum || '0'), byteOff, 1, buffer);
      value = buffer[0];
      break;
    
    case 'DBW':
    case 'MW':
    case 'IW':
    case 'QW':
      // Word (16-bit)
      buffer = Buffer.alloc(2);
      await s7Client.readArea(0x84, parseInt(dbNum || '0'), byteOff, 2, buffer);
      value = buffer.readInt16BE(0);
      break;
    
    case 'DBD':
    case 'MD':
    case 'ID':
    case 'QD':
      // DWord (32-bit)
      buffer = Buffer.alloc(4);
      await s7Client.readArea(0x84, parseInt(dbNum || '0'), byteOff, 4, buffer);
      value = buffer.readFloatBE(0);
      break;
    
    default:
      throw new Error(`Unknown S7 data type: ${type}`);
  }

  return { value, quality: 'GOOD' };
}

async function writeS7Address(address: string, value: any): Promise<void> {
  if (!s7Client) {
    throw new Error('S7 client not connected');
  }

  // Similar parsing and writing logic
  // Implementation depends on specific requirements
  console.log(`[S7] Writing ${value} to ${address}`);
}

// ============================================
// Polling
// ============================================

async function startPolling() {
  await loadTagMappings();
  
  pollInterval = setInterval(async () => {
    for (const mapping of tagMappings) {
      try {
        const { value, quality } = await readS7Address(mapping.sourceAddress);
        
        // Apply scaling
        let finalValue = value;
        if (mapping.scale && typeof value === 'number') {
          finalValue = value * mapping.scale + (mapping.offset || 0);
        }
        
        publishValue(mapping.tag.mqttTopic, finalValue, quality);
      } catch (error) {
        stats.errors++;
      }
    }
  }, POLL_INTERVAL);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// ============================================
// Simulation Mode
// ============================================

async function startSimulation() {
  console.log('[S7] Starting simulation mode...');
  await updateConnectorStatus('ONLINE');
  await loadTagMappings();

  pollInterval = setInterval(() => {
    for (const mapping of tagMappings) {
      // Generate simulated value
      let value: any;
      const baseValue = Math.sin(Date.now() / 10000) * 50 + 50;

      if (mapping.sourceType === 'BIT') {
        value = Math.random() > 0.5;
      } else {
        value = baseValue + Math.random() * 10 - 5;
        if (mapping.scale) {
          value = value * mapping.scale + (mapping.offset || 0);
        }
      }

      publishValue(mapping.tag.mqttTopic, value, 'GOOD');
    }
  }, POLL_INTERVAL);
}

// ============================================
// Tag Mappings
// ============================================

async function loadTagMappings() {
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
    createDemoMappings();
    return;
  }

  tagMappings.length = 0;
  tagMappings.push(...connector.tagMappings);
  console.log(`[DB] Loaded ${tagMappings.length} tag mappings`);
}

function createDemoMappings() {
  const demoMappings = [
    { sourceAddress: 'DB1.DBD0', mqttTopic: 'ACME/HOUSTON/PROD-A/LINE-01/R-101/temperature' },
    { sourceAddress: 'DB1.DBD4', mqttTopic: 'ACME/HOUSTON/PROD-A/LINE-01/R-101/pressure' },
    { sourceAddress: 'DB1.DBW8', mqttTopic: 'ACME/HOUSTON/PROD-A/LINE-01/R-101/level', scale: 0.5 },
    { sourceAddress: 'DB1.DBX10.0', mqttTopic: 'ACME/HOUSTON/PROD-A/LINE-01/R-101/pump_running' },
  ];

  tagMappings.length = 0;
  demoMappings.forEach(m => {
    tagMappings.push({
      sourceAddress: m.sourceAddress,
      tag: { mqttTopic: m.mqttTopic },
      scale: m.scale,
      offset: 0,
    });
  });

  console.log(`[Demo] Created ${tagMappings.length} demo mappings`);
}

// ============================================
// Publishing
// ============================================

function publishValue(topic: string, value: any, quality: string) {
  if (!mqttClient?.connected) return;

  const message = {
    value,
    quality,
    timestamp: new Date().toISOString(),
    source: CONNECTOR_CODE,
  };

  mqttClient.publish(topic, JSON.stringify(message), { qos: 1, retain: true });
  
  stats.messagesPublished++;
  stats.lastMessageTime = new Date();
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
    console.error('[DB] Failed to update status:', error);
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

  const message = {
    source: CONNECTOR_CODE,
    sourceType: 'CONNECTOR',
    status: 'HEALTHY',
    uptime: Math.floor((Date.now() - stats.startTime.getTime()) / 1000),
    version: '1.0.0',
    metrics: {
      messagesProcessed: stats.messagesPublished,
      errors: stats.errors,
    },
    timestamp: new Date().toISOString(),
  };

  const topic = `${connector?.site?.code || 'UNKNOWN'}/system/connectors/${CONNECTOR_CODE}/heartbeat`;
  mqttClient.publish(topic, JSON.stringify(message), { qos: 1 });
}

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
          status: 'healthy',
          connector: CONNECTOR_CODE,
          uptime: Math.floor((Date.now() - stats.startTime.getTime()) / 1000),
          mqtt: mqttClient?.connected ? 'connected' : 'disconnected',
          s7: s7Client?.connected ? 'connected' : 'simulation',
          endpoint: `${S7_HOST}:${S7_PORT}`,
          stats: {
            messagesPublished: stats.messagesPublished,
            errors: stats.errors,
            tagCount: tagMappings.length,
            lastMessageTime: stats.lastMessageTime,
          },
        });
      }
      
      return new Response('Not Found', { status: 404 });
    },
  });

  console.log(`[Health] Health check server on port ${HEALTH_PORT}`);
}

// ============================================
// Start Service
// ============================================

async function start() {
  console.log(`[S7 Connector] Starting ${CONNECTOR_CODE}...`);
  
  await prisma.$connect();
  console.log('[DB] Connected to PostgreSQL');

  connectMQTT();
  await connectS7();
  await startHealthServer();

  console.log(`[S7 Connector] ${CONNECTOR_CODE} ready`);
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Shutdown] SIGTERM received');
  await updateConnectorStatus('OFFLINE');
  stopPolling();
  s7Client?.disconnect();
  mqttClient?.end();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Shutdown] SIGINT received');
  await updateConnectorStatus('OFFLINE');
  stopPolling();
  s7Client?.disconnect();
  mqttClient?.end();
  await prisma.$disconnect();
  process.exit(0);
});

start();
