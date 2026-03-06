/**
 * WebSocket Service for Real-time Manufacturing Data
 * Handles live tag updates, alarms, batch states, and SCADA communication
 */

import { Server } from 'socket.io';

const PORT = 3003;

const io = new Server(PORT, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  path: '/'
});

// Store for real-time data
const realtimeStore = {
  tags: new Map<string, { value: any; timestamp: number; quality: string }>(),
  alarms: new Map<string, any>(),
  batches: new Map<string, any>(),
  equipment: new Map<string, any>()
};

// Client rooms
const rooms = {
  tags: 'tags',
  alarms: 'alarms',
  batches: 'batches',
  dashboard: 'dashboard',
  hmi: 'hmi'
};

// Simulated tag data generator for demo
const simulatedTags = [
  { id: 'TIC-101', name: 'Temperature Reactor 1', unit: '°C', min: 20, max: 100, value: 65 },
  { id: 'PIC-101', name: 'Pressure Reactor 1', unit: 'bar', min: 0, max: 10, value: 3.5 },
  { id: 'FIC-101', name: 'Flow Rate Line 1', unit: 'L/min', min: 0, max: 500, value: 250 },
  { id: 'LIC-101', name: 'Level Tank 1', unit: '%', min: 0, max: 100, value: 75 },
  { id: 'TIC-102', name: 'Temperature Reactor 2', unit: '°C', min: 20, max: 100, value: 72 },
  { id: 'PIC-102', name: 'Pressure Reactor 2', unit: 'bar', min: 0, max: 10, value: 4.2 },
  { id: 'FIC-102', name: 'Flow Rate Line 2', unit: 'L/min', min: 0, max: 500, value: 180 },
  { id: 'LIC-102', name: 'Level Tank 2', unit: '%', min: 0, max: 100, value: 45 },
  { id: 'MOT-101', name: 'Motor Speed 1', unit: 'RPM', min: 0, max: 3000, value: 1450 },
  { id: 'MOT-102', name: 'Motor Speed 2', unit: 'RPM', min: 0, max: 3000, value: 1600 },
  { id: 'VIB-101', name: 'Vibration Pump 1', unit: 'mm/s', min: 0, max: 20, value: 2.5 },
  { id: 'PWR-101', name: 'Power Consumption', unit: 'kW', min: 0, max: 500, value: 125 }
];

// Initialize simulated tags
simulatedTags.forEach(tag => {
  realtimeStore.tags.set(tag.id, {
    value: tag.value,
    timestamp: Date.now(),
    quality: 'GOOD'
  });
});

console.log(`[WS] WebSocket Service started on port ${PORT}`);

// Connection handler
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // Send initial data
  socket.emit('connected', {
    id: socket.id,
    serverTime: Date.now()
  });

  // Subscribe to tag updates
  socket.on('subscribe:tags', (tagIds?: string[]) => {
    socket.join(rooms.tags);
    
    // Send current tag values
    const tags = Array.from(realtimeStore.tags.entries())
      .filter(([id]) => !tagIds || tagIds.includes(id))
      .map(([id, data]) => ({
        id,
        ...data
      }));
    
    socket.emit('tags:initial', tags);
    console.log(`[WS] Client ${socket.id} subscribed to tags`);
  });

  // Subscribe to alarms
  socket.on('subscribe:alarms', () => {
    socket.join(rooms.alarms);
    const alarms = Array.from(realtimeStore.alarms.values());
    socket.emit('alarms:initial', alarms);
    console.log(`[WS] Client ${socket.id} subscribed to alarms`);
  });

  // Subscribe to batch updates
  socket.on('subscribe:batches', () => {
    socket.join(rooms.batches);
    const batches = Array.from(realtimeStore.batches.values());
    socket.emit('batches:initial', batches);
    console.log(`[WS] Client ${socket.id} subscribed to batches`);
  });

  // Subscribe to dashboard
  socket.on('subscribe:dashboard', () => {
    socket.join(rooms.dashboard);
    console.log(`[WS] Client ${socket.id} subscribed to dashboard`);
  });

  // Subscribe to HMI
  socket.on('subscribe:hmi', (hmiId: string) => {
    socket.join(`${rooms.hmi}:${hmiId}`);
    console.log(`[WS] Client ${socket.id} subscribed to HMI ${hmiId}`);
  });

  // Write tag value (setpoint)
  socket.on('tag:write', (data: { tagId: string; value: any }, callback) => {
    const { tagId, value } = data;
    
    console.log(`[WS] Tag write: ${tagId} = ${value}`);
    
    // Update tag value
    realtimeStore.tags.set(tagId, {
      value,
      timestamp: Date.now(),
      quality: 'GOOD'
    });
    
    // Broadcast to all subscribers
    io.to(rooms.tags).emit('tag:update', {
      id: tagId,
      value,
      timestamp: Date.now(),
      quality: 'GOOD'
    });
    
    // Log for audit
    logAudit('TAG_WRITE', tagId, value);
    
    if (callback) callback({ success: true });
  });

  // Acknowledge alarm
  socket.on('alarm:ack', (data: { alarmId: string }, callback) => {
    const { alarmId } = data;
    const alarm = realtimeStore.alarms.get(alarmId);
    
    if (alarm) {
      alarm.state = 'ACKNOWLEDGED';
      alarm.acknowledgedAt = Date.now();
      alarm.acknowledgedBy = socket.id;
      
      io.to(rooms.alarms).emit('alarm:update', alarm);
      logAudit('ALARM_ACK', alarmId, alarm);
    }
    
    if (callback) callback({ success: true });
  });

  // Batch control commands
  socket.on('batch:command', (data: { batchId: string; command: string; params?: any }, callback) => {
    const { batchId, command, params } = data;
    console.log(`[WS] Batch command: ${batchId} - ${command}`);
    
    const batch = realtimeStore.batches.get(batchId) || {
      id: batchId,
      status: 'IDLE',
      state: 'IDLE',
      progress: 0
    };
    
    switch (command) {
      case 'START':
        batch.status = 'RUNNING';
        batch.state = 'RUNNING';
        batch.startedAt = Date.now();
        break;
      case 'HOLD':
        batch.status = 'HELD';
        batch.state = 'HELD';
        break;
      case 'RESUME':
        batch.status = 'RUNNING';
        batch.state = 'RUNNING';
        break;
      case 'ABORT':
        batch.status = 'ABORTED';
        batch.state = 'ABORTED';
        break;
      case 'COMPLETE':
        batch.status = 'COMPLETE';
        batch.state = 'COMPLETE';
        batch.endedAt = Date.now();
        break;
    }
    
    realtimeStore.batches.set(batchId, batch);
    io.to(rooms.batches).emit('batch:update', batch);
    
    logAudit('BATCH_COMMAND', batchId, { command, params });
    
    if (callback) callback({ success: true, batch });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// Simulate tag updates
function simulateTagUpdates() {
  simulatedTags.forEach(tag => {
    const current = realtimeStore.tags.get(tag.id);
    if (current) {
      // Add some random variation
      const variation = (Math.random() - 0.5) * 2;
      let newValue = current.value + variation;
      newValue = Math.max(tag.min, Math.min(tag.max, newValue));
      
      // Update store
      realtimeStore.tags.set(tag.id, {
        value: Math.round(newValue * 100) / 100,
        timestamp: Date.now(),
        quality: 'GOOD'
      });
      
      // Broadcast update
      io.to(rooms.tags).emit('tag:update', {
        id: tag.id,
        value: Math.round(newValue * 100) / 100,
        timestamp: Date.now(),
        quality: 'GOOD'
      });
    }
  });
}

// Simulate alarms
function simulateAlarms() {
  // Randomly trigger/clear alarms
  const alarmId = `ALM-${Math.floor(Math.random() * 10) + 1}`;
  
  if (Math.random() > 0.7) {
    const existingAlarm = realtimeStore.alarms.get(alarmId);
    
    if (!existingAlarm || existingAlarm.state === 'CLEARED') {
      // Create new alarm
      const alarm = {
        id: alarmId,
        tagId: `TIC-${Math.floor(Math.random() * 2) + 101}`,
        type: 'HIGH',
        message: `Temperature high alarm on TIC-${Math.floor(Math.random() * 2) + 101}`,
        state: 'ACTIVE',
        priority: Math.floor(Math.random() * 3) + 1,
        value: 85 + Math.random() * 10,
        activatedAt: Date.now()
      };
      
      realtimeStore.alarms.set(alarmId, alarm);
      io.to(rooms.alarms).emit('alarm:new', alarm);
      io.to(rooms.dashboard).emit('alarm:active', alarm);
      console.log(`[WS] Alarm activated: ${alarmId}`);
    }
  }
}

// Audit logging
function logAudit(action: string, entityId: string, data: any) {
  console.log(`[AUDIT] ${action}: ${entityId}`, JSON.stringify(data).substring(0, 100));
  // In production, this would write to database
}

// Start simulation
setInterval(simulateTagUpdates, 1000);
setInterval(simulateAlarms, 5000);

// Health check endpoint
import { createServer } from 'http';
const healthServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      connections: io.sockets.sockets.size,
      tags: realtimeStore.tags.size,
      alarms: realtimeStore.alarms.size,
      uptime: process.uptime()
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(3004, () => {
  console.log('[WS] Health check server on port 3004');
});

console.log('[WS] WebSocket Service ready');
