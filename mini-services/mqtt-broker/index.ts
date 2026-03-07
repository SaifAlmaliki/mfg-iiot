/**
 * MQTT Broker Service - Unified Data Hub
 * Self-hosted MQTT broker for OPC/PLC/ERP/batch systems
 * All services subscribe to this unified message broker
 */

import Aedes from 'aedes';
import { createServer } from 'net';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer } from 'ws';
import { Level } from 'level';

const PORT = 1883;
const WS_PORT = 9001;

// Create persistence store
const db = new Level('./mqtt-persistence');
const persistence = {
  store: db
};

// Create Aedes MQTT broker
const broker = new Aedes({
  id: 'manufacturing-mqtt-broker',
  persistence: persistence as any,
  concurrency: 100,
  heartbeatInterval: 60000,
  connectTimeout: 30000
});

// Store connected clients
const connectedClients = new Map<string, any>();

// Message statistics
const stats = {
  totalMessages: 0,
  messagesPerTopic: new Map<string, number>(),
  startTime: Date.now()
};

// Broker events
broker.on('client', (client: any) => {
  connectedClients.set(client.id, {
    id: client.id,
    connectedAt: Date.now(),
    subscriptions: []
  });
  console.log(`[MQTT] Client connected: ${client.id}`);
  broadcastStatus();
});

broker.on('clientDisconnect', (client: any) => {
  connectedClients.delete(client.id);
  console.log(`[MQTT] Client disconnected: ${client.id}`);
  broadcastStatus();
});

broker.on('publish', (packet: any, _client: any) => {
  stats.totalMessages++;
  const topic = packet.topic;
  const count = stats.messagesPerTopic.get(topic) || 0;
  stats.messagesPerTopic.set(topic, count + 1);
  
  // Log important topics
  if (topic.startsWith('tags/') || topic.startsWith('alarms/') || topic.startsWith('batches/')) {
    const payload = packet.payload?.toString() || '';
    console.log(`[MQTT] Published to ${topic}: ${payload.substring(0, 100)}`);
  }
});

broker.on('subscribe', (subscriptions: any[], client: any) => {
  const clientData = connectedClients.get(client.id);
  if (clientData) {
    subscriptions.forEach(sub => {
      clientData.subscriptions.push(sub.topic);
    });
  }
  console.log(`[MQTT] Client ${client.id} subscribed to: ${subscriptions.map(s => s.topic).join(', ')}`);
});

broker.on('unsubscribe', (subscriptions: any[], client: any) => {
  console.log(`[MQTT] Client ${client.id} unsubscribed from: ${subscriptions.join(', ')}`);
});

// TCP Server for MQTT
const server = createServer(broker.handle.bind(broker));

server.listen(PORT, () => {
  console.log(`[MQTT] Broker listening on TCP port ${PORT}`);
});

// WebSocket Server for browser clients
const httpServer = createHttpServer();
const wsServer = new WebSocketServer({ server: httpServer });

wsServer.on('connection', (ws, _req) => {
  console.log(`[MQTT-WS] WebSocket client connected`);
  
  // Simple protocol for WebSocket clients
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'subscribe') {
        // Subscribe to topic
        ws.send(JSON.stringify({ type: 'subscribed', topic: msg.topic }));
      } else if (msg.type === 'publish') {
        // Publish message
        broker.publish({
          topic: msg.topic,
          payload: Buffer.from(JSON.stringify(msg.payload)),
          cmd: 'publish' as const,
          qos: 0,
          dup: false,
          retain: false
        }, () => {
          ws.send(JSON.stringify({ type: 'published', topic: msg.topic }));
        });
      }
    } catch (e) {
      console.error('[MQTT-WS] Error parsing message:', e);
    }
  });

  // Forward MQTT messages to WebSocket clients
  const handler = (packet: any, _client: any) => {
    try {
      const payload = packet.payload?.toString() || '';
      ws.send(JSON.stringify({
        type: 'message',
        topic: packet.topic,
        payload: payload,
        retain: packet.retain,
        qos: packet.qos
      }));
    } catch (_e) {
      // Ignore
    }
  };
  
  broker.on('publish', handler);
  
  ws.on('close', () => {
    broker.off('publish', handler);
    console.log('[MQTT-WS] WebSocket client disconnected');
  });
});

httpServer.listen(WS_PORT, () => {
  console.log(`[MQTT-WS] WebSocket server listening on port ${WS_PORT}`);
});

// Broadcast broker status
function broadcastStatus() {
  const _status = {
    type: 'broker-status',
    timestamp: Date.now(),
    clients: connectedClients.size,
    uptime: Date.now() - stats.startTime,
    totalMessages: stats.totalMessages
  };
  
  // Could broadcast to admin interface
}

// API for broker management
import express from 'express';
const app = express();
app.use(express.json());

const API_PORT = 3080;

// Get broker status
app.get('/status', (req, res) => {
  res.json({
    uptime: Date.now() - stats.startTime,
    clients: connectedClients.size,
    clientList: Array.from(connectedClients.values()),
    totalMessages: stats.totalMessages,
    topics: Array.from(stats.messagesPerTopic.entries()).map(([topic, count]) => ({
      topic,
      messageCount: count
    }))
  });
});

// Publish message (REST API)
app.post('/publish', (req, res) => {
  const { topic, payload, retain = false, qos = 0 } = req.body;
  
  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' });
  }
  
  broker.publish({
    topic,
    payload: Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)),
    retain,
    qos,
    cmd: 'publish' as const,
    dup: false
  }, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, topic });
  });
});

// Get retained messages
app.get('/retained/:topic(*)', (req, res) => {
  const topic = req.params.topic;
  (broker as any).persistence?.RetainedStore?.get(topic, (err: any, packet: any) => {
    if (err || !packet) {
      return res.status(404).json({ error: 'No retained message' });
    }
    res.json({
      topic: packet.topic,
      payload: packet.payload?.toString(),
      retain: packet.retain
    });
  });
});

app.listen(API_PORT, () => {
  console.log(`[MQTT-API] Management API listening on port ${API_PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[MQTT] Shutting down...');
  server.close();
  httpServer.close();
  broker.close(() => {
    process.exit(0);
  });
});

console.log('[MQTT] Manufacturing MQTT Broker started');
console.log(`[MQTT] TCP Port: ${PORT}`);
console.log(`[MQTT] WebSocket Port: ${WS_PORT}`);
console.log(`[MQTT] API Port: ${API_PORT}`);
