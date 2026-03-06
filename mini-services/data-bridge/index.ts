/**
 * Data Bridge Service
 * Provides real-time manufacturing data via WebSocket
 * Simulates PLC/OPC-UA data with realistic process behavior
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import express from 'express';

const PORT = 3005;

const app = express();
app.use(express.json());

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

// Connected clients
const clients = new Set<WebSocket>();

// Current process state
let lastUpdate = Date.now();

// Process tags with simulation
const demoTags = {
  'TIC-101': { value: 65.2, unit: '°C', min: 0, max: 200, quality: 'GOOD' },
  'PIC-101': { value: 3.5, unit: 'bar', min: 0, max: 20, quality: 'GOOD' },
  'FIC-101': { value: 250.8, unit: 'L/min', min: 0, max: 500, quality: 'GOOD' },
  'LIC-101': { value: 75.3, unit: '%', min: 0, max: 100, quality: 'GOOD' },
  'TIC-102': { value: 72.1, unit: '°C', min: 0, max: 200, quality: 'GOOD' },
  'PIC-102': { value: 4.2, unit: 'bar', min: 0, max: 20, quality: 'GOOD' },
  'FIC-102': { value: 180.5, unit: 'L/min', min: 0, max: 500, quality: 'GOOD' },
  'LIC-102': { value: 45.7, unit: '%', min: 0, max: 100, quality: 'GOOD' },
  'MOT-101': { value: 1450, unit: 'RPM', min: 0, max: 3000, quality: 'GOOD' },
  'MOT-102': { value: 1600, unit: 'RPM', min: 0, max: 3000, quality: 'GOOD' },
  'VIB-101': { value: 2.5, unit: 'mm/s', min: 0, max: 20, quality: 'GOOD' },
  'PWR-101': { value: 125.3, unit: 'kW', min: 0, max: 500, quality: 'GOOD' },
  'VLV-101': { value: 50, unit: '%', min: 0, max: 100, quality: 'GOOD' },
  'VLV-102': { value: 75, unit: '%', min: 0, max: 100, quality: 'GOOD' },
  'PMP-101-RUN': { value: 1, unit: '', min: 0, max: 1, quality: 'GOOD' },
  'PMP-102-RUN': { value: 1, unit: '', min: 0, max: 1, quality: 'GOOD' },
};

// Setpoints (writable)
const setpoints = {
  'TIC-101-SP': { value: 70.0, unit: '°C' },
  'PIC-101-SP': { value: 3.5, unit: 'bar' },
  'TIC-102-SP': { value: 75.0, unit: '°C' },
};

// Current alarms
let currentAlarms: any[] = [];

// Simulate process with realistic behavior
function simulateProcess() {
  Object.keys(demoTags).forEach(tagId => {
    const tag = demoTags[tagId as keyof typeof demoTags];
    const noiseRange = (tag.max - tag.min) * 0.02;
    const noise = (Math.random() - 0.5) * 2 * noiseRange;
    
    // Apply setpoint influence (PID-like control)
    if (tagId === 'TIC-101') {
      const sp = setpoints['TIC-101-SP'].value;
      const error = sp - tag.value;
      tag.value += error * 0.03 + noise * 0.5;
    } else if (tagId === 'TIC-102') {
      const sp = setpoints['TIC-102-SP'].value;
      const error = sp - tag.value;
      tag.value += error * 0.03 + noise * 0.5;
    } else if (tagId === 'PIC-101') {
      const sp = setpoints['PIC-101-SP'].value;
      const error = sp - tag.value;
      tag.value += error * 0.05 + noise * 0.3;
    } else if (tagId === 'PWR-101') {
      // Power depends on motors and pumps
      const pwr = demoTags['MOT-101'].value / 3000 * 75 + 
                  demoTags['MOT-102'].value / 3000 * 75 +
                  demoTags['FIC-101'].value / 500 * 25;
      tag.value = pwr + noise * 2;
    } else if (tagId === 'VIB-101') {
      // Vibration depends on motor speed
      const baseVib = 1.5 + (demoTags['MOT-101'].value / 3000) * 2;
      tag.value = baseVib + Math.random() * 0.3;
    } else if (tagId === 'LIC-101') {
      // Level depends on flow balance
      const delta = (demoTags['FIC-101'].value - demoTags['FIC-102'].value) / 500 * 0.5;
      tag.value += delta + noise * 0.1;
    } else {
      tag.value += noise;
    }
    
    // Clamp to limits
    tag.value = Math.max(tag.min, Math.min(tag.max, tag.value));
    tag.value = Math.round(tag.value * 100) / 100;
  });
  
  lastUpdate = Date.now();
}

// Check for alarms
function checkAlarms() {
  const prevAlarmCount = currentAlarms.length;
  currentAlarms = [];
  
  // Temperature high alarm
  if (demoTags['TIC-101'].value > 80) {
    currentAlarms.push({
      id: 'ALM-TIC-101-HI',
      tagId: 'TIC-101',
      type: 'HIGH',
      message: `Temperature high on TIC-101: ${demoTags['TIC-101'].value.toFixed(1)}°C`,
      state: 'ACTIVE',
      priority: demoTags['TIC-101'].value > 90 ? 1 : 2,
      value: demoTags['TIC-101'].value,
      activatedAt: Date.now()
    });
  }
  
  // Pressure high alarm
  if (demoTags['PIC-101'].value > 5.0) {
    currentAlarms.push({
      id: 'ALM-PIC-101-HI',
      tagId: 'PIC-101',
      type: 'HIGH',
      message: `Pressure high on PIC-101: ${demoTags['PIC-101'].value.toFixed(2)} bar`,
      state: 'ACTIVE',
      priority: 2,
      value: demoTags['PIC-101'].value,
      activatedAt: Date.now()
    });
  }
  
  // Level low alarm
  if (demoTags['LIC-101'].value < 20) {
    currentAlarms.push({
      id: 'ALM-LIC-101-LO',
      tagId: 'LIC-101',
      type: 'LOW',
      message: `Level low on LIC-101: ${demoTags['LIC-101'].value.toFixed(1)}%`,
      state: 'ACTIVE',
      priority: 3,
      value: demoTags['LIC-101'].value,
      activatedAt: Date.now()
    });
  }
  
  // Vibration high alarm
  if (demoTags['VIB-101'].value > 5.0) {
    currentAlarms.push({
      id: 'ALM-VIB-101-HI',
      tagId: 'VIB-101',
      type: 'HIGH',
      message: `Vibration high on Motor 1: ${demoTags['VIB-101'].value.toFixed(2)} mm/s`,
      state: 'ACTIVE',
      priority: 2,
      value: demoTags['VIB-101'].value,
      activatedAt: Date.now()
    });
  }
  
  // Log if new alarms appeared
  if (currentAlarms.length > prevAlarmCount) {
    console.log(`[BRIDGE] ${currentAlarms.length - prevAlarmCount} new alarm(s) detected`);
  }
}

// Broadcast to all connected clients
function broadcast(data: any) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Handle WebSocket connection
wss.on('connection', (ws, req) => {
  const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[BRIDGE] Client connected: ${clientId}`);
  clients.add(ws);
  
  // Send initial connection message
  ws.send(JSON.stringify({
    event: 'connected',
    data: { id: clientId, serverTime: Date.now(), source: 'DATA-BRIDGE' }
  }));
  
  // Send initial tag values
  const initialTags = Object.entries(demoTags).map(([id, data]) => ({
    id, value: data.value, unit: data.unit, quality: data.quality, timestamp: lastUpdate
  }));
  ws.send(JSON.stringify({ event: 'tags:initial', tags: initialTags }));
  
  // Send initial alarms
  ws.send(JSON.stringify({ event: 'alarms:initial', alarms: currentAlarms }));
  
  // Handle messages from client
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleMessage(ws, msg);
    } catch (e) {
      console.error('[BRIDGE] Error parsing message:', e);
    }
  });
  
  // Handle close
  ws.on('close', () => {
    console.log(`[BRIDGE] Client disconnected: ${clientId}`);
    clients.delete(ws);
  });
  
  // Handle error
  ws.on('error', (error) => {
    console.error(`[BRIDGE] WebSocket error:`, error);
    clients.delete(ws);
  });
});

// Handle incoming messages
function handleMessage(ws: WebSocket, msg: any) {
  const { event, ...payload } = msg;
  
  switch (event) {
    case 'subscribe:all':
    case 'subscribe:tags':
      // Already sent initial data on connection
      console.log(`[BRIDGE] Client subscribed to tags`);
      break;
      
    case 'tag:write':
      const { tagId, value } = payload;
      console.log(`[BRIDGE] Tag write: ${tagId} = ${value}`);
      
      // Handle setpoint writes
      if (tagId.endsWith('-SP') && setpoints[tagId as keyof typeof setpoints]) {
        setpoints[tagId as keyof typeof setpoints].value = value;
        ws.send(JSON.stringify({ event: 'tag:write:success', tagId, value }));
        return;
      }
      
      // Handle direct tag writes
      if (demoTags[tagId as keyof typeof demoTags]) {
        demoTags[tagId as keyof typeof demoTags].value = value;
        broadcast({
          event: 'tag:update',
          id: tagId, value, timestamp: Date.now(), quality: 'GOOD'
        });
        ws.send(JSON.stringify({ event: 'tag:write:success', tagId, value }));
        return;
      }
      
      ws.send(JSON.stringify({ event: 'tag:write:error', tagId, error: 'Tag not found' }));
      break;
      
    case 'alarm:ack':
      const { alarmId } = payload;
      const alarm = currentAlarms.find(a => a.id === alarmId);
      if (alarm) {
        alarm.state = 'ACKNOWLEDGED';
        alarm.acknowledgedAt = Date.now();
        broadcast({ event: 'alarm:update', ...alarm });
        console.log(`[BRIDGE] Alarm ${alarmId} acknowledged`);
      }
      ws.send(JSON.stringify({ event: 'alarm:ack:success', alarmId }));
      break;
      
    default:
      console.log(`[BRIDGE] Unknown event: ${event}`);
  }
}

// Broadcast updates to all clients
function broadcastUpdates() {
  Object.entries(demoTags).forEach(([id, data]) => {
    broadcast({
      event: 'tag:update',
      id,
      value: data.value,
      timestamp: lastUpdate,
      quality: data.quality
    });
  });
  
  // Send alarm updates if any
  if (currentAlarms.length > 0) {
    broadcast({
      event: 'alarms:update',
      alarms: currentAlarms
    });
  }
}

// REST API endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    clients: clients.size,
    lastUpdate,
    tagsCount: Object.keys(demoTags).length,
    alarmsCount: currentAlarms.length
  });
});

app.get('/tags', (req, res) => {
  res.json(Object.entries(demoTags).map(([id, data]) => ({
    id, ...data, timestamp: lastUpdate
  })));
});

app.get('/tags/:tagId', (req, res) => {
  const tag = demoTags[req.params.tagId as keyof typeof demoTags];
  if (tag) {
    res.json({ id: req.params.tagId, ...tag, timestamp: lastUpdate });
  } else {
    res.status(404).json({ error: 'Tag not found' });
  }
});

app.post('/tags/:tagId', (req, res) => {
  const { value } = req.body;
  const tagId = req.params.tagId;
  
  if (demoTags[tagId as keyof typeof demoTags]) {
    demoTags[tagId as keyof typeof demoTags].value = value;
    broadcast({ event: 'tag:update', id: tagId, value, timestamp: Date.now(), quality: 'GOOD' });
    res.json({ success: true, id: tagId, value });
  } else if (setpoints[tagId as keyof typeof setpoints]) {
    setpoints[tagId as keyof typeof setpoints].value = value;
    res.json({ success: true, id: tagId, value });
  } else {
    res.status(404).json({ error: 'Tag not found' });
  }
});

app.get('/alarms', (req, res) => {
  res.json(currentAlarms);
});

app.get('/setpoints', (req, res) => {
  res.json(setpoints);
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`[BRIDGE] Data Bridge Service started on port ${PORT}`);
  console.log(`[BRIDGE] WebSocket: ws://localhost:${PORT}`);
  console.log(`[BRIDGE] HTTP API: http://localhost:${PORT}`);
  
  // Start simulation
  console.log('[BRIDGE] Starting process simulation...');
  
  // Simulate process every second
  setInterval(() => {
    simulateProcess();
    checkAlarms();
    broadcastUpdates();
  }, 1000);
  
  // Occasionally change setpoints (simulating operator actions)
  setInterval(() => {
    if (Math.random() > 0.85) {
      setpoints['TIC-101-SP'].value = 65 + Math.random() * 25;
      console.log(`[BRIDGE] TIC-101-SP changed to ${setpoints['TIC-101-SP'].value.toFixed(1)}°C`);
    }
    
    if (Math.random() > 0.9) {
      demoTags['MOT-101'].value = 1000 + Math.random() * 1500;
      console.log(`[BRIDGE] MOT-101 changed to ${demoTags['MOT-101'].value.toFixed(0)} RPM`);
    }
    
    if (Math.random() > 0.95) {
      demoTags['FIC-101'].value = 150 + Math.random() * 250;
      console.log(`[BRIDGE] FIC-101 changed to ${demoTags['FIC-101'].value.toFixed(0)} L/min`);
    }
  }, 15000);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[BRIDGE] Shutting down...');
  
  // Notify clients
  broadcast({ event: 'server:shutdown', message: 'Server shutting down' });
  
  // Close all connections
  clients.forEach(client => client.close());
  wss.close();
  httpServer.close();
  
  process.exit(0);
});
