/**
 * Modbus TCP Edge Connector
 * 
 * Connects to Modbus TCP devices and bridges data to MQTT UNS
 * Supports:
 * - Reading coils, discrete inputs, input registers, holding registers
 * - Publishing to ISA-95 MQTT topics
 * - Receiving writes from MQTT
 * - Heartbeat and health monitoring
 * 
 * Port: 3121 (Health check API)
 */

import mqtt, { MqttClient } from 'mqtt';
import { PrismaClient } from '@prisma/client';

// Configuration
const MQTT_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const HEALTH_PORT = 3121;
const CONNECTOR_CODE = process.env.CONNECTOR_CODE || 'MODBUS-GW-01';

// Modbus Configuration
const MODBUS_HOST = process.env.MODBUS_HOST || 'localhost';
const MODBUS_PORT = parseInt(process.env.MODBUS_PORT || '502');
const MODBUS_UNIT_ID = parseInt(process.env.MODBUS_UNIT_ID || '1');
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '1000');

// Initialize Prisma
const prisma = new PrismaClient();

// Clients
let mqttClient: MqttClient | null = null;
let modbusClient: any = null;
let pollInterval: Timer | null = null;

// Stats
const stats = {
  messagesPublished: 0,
  messagesReceived: 0,
  errors: 0,
  lastMessageTime: null as Date | null,
  startTime: new Date(),
  reconnectAttempts: 0,
};

// Tag mappings
const tagMappings: any[] = [];

// ============================================
// MQTT Connection
// ============================================

function connectMQTT() {
  mqttClient = mqtt.connect(MQTT_URL, {
    clientId: `edge-modbus-${CONNECTOR_CODE}-${Date.now()}`,
    clean: true,
    keepalive: 60,
    reconnectPeriod: 5000,
  });

  mqttClient.on('connect', () => {
    console.log('[MQTT] Connected to broker');
    
    // Subscribe to setpoint topics
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
  
  if (topic.includes('/setpoint/')) {
    // Write to Modbus
    const mapping = tagMappings.find(m => m.tag.mqttTopic === message.topic);
    
    if (mapping && modbusClient) {
      try {
        let value = message.value;
        
        // Apply inverse scaling
        if (mapping.scale) {
          value = (value - (mapping.offset || 0)) / mapping.scale;
        }
        
        const address = parseInt(mapping.sourceAddress);
        
        switch (mapping.sourceType) {
          case 'COIL':
            await modbusClient.writeCoil(address, !!value);
            break;
          case 'HOLDING_REGISTER':
            await modbusClient.writeRegister(address, Math.round(value));
            break;
        }
        
        console.log(`[Modbus] Wrote ${value} to ${mapping.sourceAddress}`);
      } catch (error) {
        console.error(`[Modbus] Write error:`, error);
      }
    }
  }
}

// ============================================
// Modbus Connection
// ============================================

async function connectModbus() {
  try {
    // Dynamic import for jsmodbus
    const { ModbusTcpClient } = await import('jsmodbus');
    
    modbusClient = new ModbusTcpClient(MODBUS_HOST, MODBUS_PORT, MODBUS_UNIT_ID);
    
    modbusClient.on('connect', () => {
      console.log(`[Modbus] Connected to ${MODBUS_HOST}:${MODBUS_PORT}`);
      updateConnectorStatus('ONLINE');
      startPolling();
    });

    modbusClient.on('error', (error: Error) => {
      console.error('[Modbus] Connection error:', error);
      updateConnectorStatus('ERROR');
      stats.errors++;
    });

    modbusClient.on('close', () => {
      console.log('[Modbus] Connection closed');
      updateConnectorStatus('OFFLINE');
      stopPolling();
    });

    // Connect
    modbusClient.connect();
  } catch (error) {
    console.error('[Modbus] Failed to initialize:', error);
    // Run in simulation mode
    console.log('[Modbus] Running in simulation mode');
    await startSimulation();
  }
}

// ============================================
// Polling
// ============================================

async function startPolling() {
  // Load tag mappings
  await loadTagMappings();
  
  pollInterval = setInterval(async () => {
    for (const mapping of tagMappings) {
      try {
        await pollModbusAddress(mapping);
      } catch (_error) {
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

async function pollModbusAddress(mapping: any) {
  if (!modbusClient) return;

  const address = parseInt(mapping.sourceAddress);
  let value: any;
  let quality = 'GOOD';

  try {
    let response;
    
    switch (mapping.sourceType) {
      case 'COIL':
        response = await modbusClient.readCoils(address, 1);
        value = response.coils[0];
        break;
      case 'DISCRETE_INPUT':
        response = await modbusClient.readDiscreteInputs(address, 1);
        value = response.coils[0];
        break;
      case 'INPUT_REGISTER':
        response = await modbusClient.readInputRegisters(address, 1);
        value = response.register[0];
        break;
      case 'HOLDING_REGISTER':
        response = await modbusClient.readHoldingRegisters(address, 1);
        value = response.register[0];
        break;
      default:
        return;
    }

    // Apply scaling and offset
    if (mapping.scale && typeof value === 'number') {
      value = value * mapping.scale + (mapping.offset || 0);
    }

    // Publish to MQTT
    publishValue(mapping.tag.mqttTopic, value, quality);
  } catch (error) {
    quality = 'BAD';
    console.error(`[Modbus] Read error at ${address}:`, error);
  }
}

// ============================================
// Simulation Mode
// ============================================

async function startSimulation() {
  console.log('[Modbus] Starting simulation mode...');
  await updateConnectorStatus('ONLINE');
  await loadTagMappings();

  pollInterval = setInterval(() => {
    for (const mapping of tagMappings) {
      // Generate simulated value
      let value: any;
      const baseValue = Math.sin(Date.now() / 10000) * 50 + 50;

      switch (mapping.sourceType) {
        case 'COIL':
        case 'DISCRETE_INPUT':
          value = Math.random() > 0.5;
          break;
        case 'INPUT_REGISTER':
        case 'HOLDING_REGISTER':
          value = baseValue + Math.random() * 10 - 5;
          if (mapping.scale) {
            value = value * mapping.scale + (mapping.offset || 0);
          }
          break;
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
    console.log(`[DB] Connector ${CONNECTOR_CODE} not found`);
    // Create demo mappings
    createDemoMappings();
    return;
  }

  tagMappings.length = 0;
  tagMappings.push(...connector.tagMappings);
  console.log(`[DB] Loaded ${tagMappings.length} tag mappings`);
}

function createDemoMappings() {
  // Demo mappings for testing
  const demoMappings = [
    { sourceAddress: '0', sourceType: 'HOLDING_REGISTER', mqttTopic: 'ACME/HOUSTON/PROD-A/LINE-01/R-101/temperature', scale: 0.1 },
    { sourceAddress: '1', sourceType: 'HOLDING_REGISTER', mqttTopic: 'ACME/HOUSTON/PROD-A/LINE-01/R-101/pressure', scale: 0.01 },
    { sourceAddress: '2', sourceType: 'INPUT_REGISTER', mqttTopic: 'ACME/HOUSTON/PROD-A/LINE-01/R-101/level', scale: 0.5 },
    { sourceAddress: '0', sourceType: 'COIL', mqttTopic: 'ACME/HOUSTON/PROD-A/LINE-01/R-101/pump_running' },
  ];

  tagMappings.length = 0;
  demoMappings.forEach(m => {
    tagMappings.push({
      sourceAddress: m.sourceAddress,
      sourceType: m.sourceType,
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
  Bun.serve({
    port: HEALTH_PORT,
    async fetch(req) {
      const url = new URL(req.url);
      
      if (url.pathname === '/health') {
        return Response.json({
          status: 'healthy',
          connector: CONNECTOR_CODE,
          uptime: Math.floor((Date.now() - stats.startTime.getTime()) / 1000),
          mqtt: mqttClient?.connected ? 'connected' : 'disconnected',
          modbus: modbusClient ? 'connected' : 'simulation',
          endpoint: `${MODBUS_HOST}:${MODBUS_PORT}`,
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
  console.log(`[Modbus Connector] Starting ${CONNECTOR_CODE}...`);
  
  await prisma.$connect();
  console.log('[DB] Connected to PostgreSQL');

  connectMQTT();
  await connectModbus();
  await startHealthServer();

  console.log(`[Modbus Connector] ${CONNECTOR_CODE} ready`);
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Shutdown] SIGTERM received');
  await updateConnectorStatus('OFFLINE');
  stopPolling();
  modbusClient?.close();
  mqttClient?.end();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Shutdown] SIGINT received');
  await updateConnectorStatus('OFFLINE');
  stopPolling();
  modbusClient?.close();
  mqttClient?.end();
  await prisma.$disconnect();
  process.exit(0);
});

start();
