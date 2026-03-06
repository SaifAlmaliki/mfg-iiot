/**
 * UNS API Gateway Service
 * 
 * Provides:
 * - REST API for database operations
 * - WebSocket for real-time data streaming
 * - MQTT bridge for UNS integration
 * 
 * Port: 3100 (API), 3101 (WebSocket)
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import mqtt, { MqttClient } from 'mqtt';
import { PrismaClient } from '@prisma/client';

// Configuration
const API_PORT = 3100;
const WS_PORT = 3101;
const MQTT_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

// Initialize Prisma
const prisma = new PrismaClient();

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// MQTT Client
let mqttClient: MqttClient | null = null;

// WebSocket clients
const wsClients = new Set<WebSocket>();

// ============================================
// MQTT Connection
// ============================================

function connectMQTT() {
  mqttClient = mqtt.connect(MQTT_URL, {
    clientId: `api-gateway-${Date.now()}`,
    clean: true,
    keepalive: 60,
    reconnectPeriod: 5000,
  });

  mqttClient.on('connect', () => {
    console.log('[MQTT] Connected to broker');
    // Subscribe to all enterprise topics
    mqttClient?.subscribe('ACME/#', { qos: 1 });
  });

  mqttClient.on('message', (topic: string, payload: Buffer) => {
    // Broadcast to all WebSocket clients
    const message = JSON.stringify({
      type: 'mqtt',
      topic,
      payload: payload.toString(),
      timestamp: new Date().toISOString(),
    });
    
    wsClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  mqttClient.on('error', (error) => {
    console.error('[MQTT] Error:', error);
  });

  mqttClient.on('close', () => {
    console.log('[MQTT] Connection closed');
  });
}

// ============================================
// REST API Routes
// ============================================

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mqtt: mqttClient?.connected ? 'connected' : 'disconnected',
    wsClients: wsClients.size,
  });
});

// ============================================
// Enterprise Hierarchy Routes
// ============================================

// Enterprises
app.get('/api/enterprises', async (_req: Request, res: Response) => {
  try {
    const enterprises = await prisma.enterprise.findMany({
      include: { sites: true },
    });
    res.json(enterprises);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch enterprises' });
  }
});

app.get('/api/enterprises/:id', async (req: Request, res: Response) => {
  try {
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: req.params.id },
      include: { sites: true },
    });
    if (!enterprise) return res.status(404).json({ error: 'Enterprise not found' });
    res.json(enterprise);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch enterprise' });
  }
});

// Sites
app.get('/api/sites', async (req: Request, res: Response) => {
  try {
    const { enterpriseId } = req.query;
    const sites = await prisma.site.findMany({
      where: enterpriseId ? { enterpriseId: String(enterpriseId) } : undefined,
      include: { enterprise: true, areas: true },
    });
    res.json(sites);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

app.get('/api/sites/:id', async (req: Request, res: Response) => {
  try {
    const site = await prisma.site.findUnique({
      where: { id: req.params.id },
      include: { 
        enterprise: true, 
        areas: { include: { workCenters: true } },
        edgeConnectors: true,
        users: true,
      },
    });
    if (!site) return res.status(404).json({ error: 'Site not found' });
    res.json(site);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch site' });
  }
});

// Areas
app.get('/api/areas', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.query;
    const areas = await prisma.area.findMany({
      where: siteId ? { siteId: String(siteId) } : undefined,
      include: { site: true, workCenters: true },
    });
    res.json(areas);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch areas' });
  }
});

// Work Centers
app.get('/api/workcenters', async (req: Request, res: Response) => {
  try {
    const { areaId } = req.query;
    const workCenters = await prisma.workCenter.findMany({
      where: areaId ? { areaId: String(areaId) } : undefined,
      include: { area: true, workUnits: true, equipment: true },
    });
    res.json(workCenters);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch work centers' });
  }
});

app.get('/api/workcenters/:id', async (req: Request, res: Response) => {
  try {
    const workCenter = await prisma.workCenter.findUnique({
      where: { id: req.params.id },
      include: { 
        area: { include: { site: true } },
        workUnits: { include: { equipment: true, tags: true } },
        equipment: true,
        productionRuns: { where: { status: 'RUNNING' } },
        oeeRecords: { orderBy: { timestamp: 'desc' }, take: 24 },
      },
    });
    if (!workCenter) return res.status(404).json({ error: 'Work center not found' });
    res.json(workCenter);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch work center' });
  }
});

// Work Units
app.get('/api/workunits', async (req: Request, res: Response) => {
  try {
    const { workCenterId } = req.query;
    const workUnits = await prisma.workUnit.findMany({
      where: workCenterId ? { workCenterId: String(workCenterId) } : undefined,
      include: { workCenter: true, equipment: true, tags: true },
    });
    res.json(workUnits);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch work units' });
  }
});

// ============================================
// Equipment Routes
// ============================================

app.get('/api/equipment', async (req: Request, res: Response) => {
  try {
    const { workCenterId, workUnitId, type } = req.query;
    const equipment = await prisma.equipment.findMany({
      where: {
        ...(workCenterId ? { workCenterId: String(workCenterId) } : {}),
        ...(workUnitId ? { workUnitId: String(workUnitId) } : {}),
        ...(type ? { type: String(type) } : {}),
      },
      include: { workCenter: true, workUnit: true, tags: true },
    });
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch equipment' });
  }
});

app.get('/api/equipment/:id', async (req: Request, res: Response) => {
  try {
    const equipment = await prisma.equipment.findUnique({
      where: { id: req.params.id },
      include: { 
        workCenter: true, 
        workUnit: true, 
        tags: true,
        alarms: { where: { state: 'ACTIVE' } },
        healthRecords: { orderBy: { timestamp: 'desc' }, take: 10 },
        maintenanceLogs: { orderBy: { performedAt: 'desc' }, take: 10 },
      },
    });
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' });
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch equipment' });
  }
});

// ============================================
// Tags Routes
// ============================================

app.get('/api/tags', async (req: Request, res: Response) => {
  try {
    const { workUnitId, equipmentId, tag } = req.query;
    const tags = await prisma.tag.findMany({
      where: {
        ...(workUnitId ? { workUnitId: String(workUnitId) } : {}),
        ...(equipmentId ? { equipmentId: String(equipmentId) } : {}),
        ...(tag ? { tags: { has: String(tag) } } : {}),
      },
      include: { workUnit: true, equipment: true, alarmDefinitions: true },
    });
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

app.get('/api/tags/:id', async (req: Request, res: Response) => {
  try {
    const tag = await prisma.tag.findUnique({
      where: { id: req.params.id },
      include: { 
        workUnit: true, 
        equipment: true, 
        alarmDefinitions: true,
        tagValues: { orderBy: { timestamp: 'desc' }, take: 100 },
      },
    });
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    res.json(tag);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tag' });
  }
});

// Get tag values (time series)
app.get('/api/tags/:id/values', async (req: Request, res: Response) => {
  try {
    const { from, to, limit = 1000 } = req.query;
    const values = await prisma.tagValue.findMany({
      where: {
        tagId: req.params.id,
        ...(from ? { timestamp: { gte: new Date(String(from)) } } : {}),
        ...(to ? { timestamp: { lte: new Date(String(to)) } } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: Number(limit),
    });
    res.json(values);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tag values' });
  }
});

// Write tag value (setpoint)
app.post('/api/tags/:id/write', async (req: Request, res: Response) => {
  try {
    const { value, userId, reason } = req.body;
    const tag = await prisma.tag.findUnique({ 
      where: { id: req.params.id },
      include: { workUnit: true, equipment: true },
    });
    
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    if (!tag.isWritable) return res.status(400).json({ error: 'Tag is not writable' });

    // Publish to MQTT
    const topic = tag.mqttTopic.replace('/value', '/setpoint');
    const message = {
      tagId: tag.id,
      value,
      userId,
      reason,
      timestamp: new Date().toISOString(),
      source: 'api-gateway',
    };

    await mqttClient?.publishAsync(topic, JSON.stringify(message), { qos: 1 });
    
    res.json({ success: true, topic, message });
  } catch (error) {
    res.status(500).json({ error: 'Failed to write tag value' });
  }
});

// ============================================
// Alarm Routes
// ============================================

app.get('/api/alarms', async (req: Request, res: Response) => {
  try {
    const { state, priority, from, to } = req.query;
    const alarms = await prisma.alarm.findMany({
      where: {
        ...(state ? { state: String(state) } : {}),
        ...(priority ? { definition: { priority: Number(priority) } } : {}),
        ...(from ? { activatedAt: { gte: new Date(String(from)) } } : {}),
        ...(to ? { activatedAt: { lte: new Date(String(to)) } } : {}),
      },
      include: { definition: { include: { tag: true } }, equipment: true },
      orderBy: { activatedAt: 'desc' },
      take: 100,
    });
    res.json(alarms);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch alarms' });
  }
});

app.post('/api/alarms/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const alarm = await prisma.alarm.update({
      where: { id: req.params.id },
      data: {
        state: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
      },
      include: { definition: { include: { tag: true } } },
    });
    res.json(alarm);
  } catch (error) {
    res.status(500).json({ error: 'Failed to acknowledge alarm' });
  }
});

// ============================================
// Production Routes
// ============================================

// Production Orders
app.get('/api/orders', async (req: Request, res: Response) => {
  try {
    const { status, workCenterId } = req.query;
    const orders = await prisma.productionOrder.findMany({
      where: {
        ...(status ? { status: String(status) } : {}),
        ...(workCenterId ? { workCenterId: String(workCenterId) } : {}),
      },
      include: { 
        workCenter: true, 
        recipe: true,
        productionRuns: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.get('/api/orders/:id', async (req: Request, res: Response) => {
  try {
    const order = await prisma.productionOrder.findUnique({
      where: { id: req.params.id },
      include: { 
        workCenter: { include: { area: true } },
        recipe: true,
        productionRuns: { include: { consumptions: true } },
      },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Production Runs
app.get('/api/runs', async (req: Request, res: Response) => {
  try {
    const { status, workCenterId } = req.query;
    const runs = await prisma.productionRun.findMany({
      where: {
        ...(status ? { status: String(status) } : {}),
        ...(workCenterId ? { workCenterId: String(workCenterId) } : {}),
      },
      include: { 
        workCenter: true, 
        order: true,
        recipe: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(runs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch runs' });
  }
});

app.get('/api/runs/:id', async (req: Request, res: Response) => {
  try {
    const run = await prisma.productionRun.findUnique({
      where: { id: req.params.id },
      include: { 
        workCenter: true,
        order: true,
        recipe: true,
        batchUnits: { include: { workUnit: true } },
        consumptions: { include: { lot: { include: { product: true } } } },
        genealogy: { include: { fromLot: true, toLot: true } },
        stateTransitions: { orderBy: { timestamp: 'asc' } },
      },
    });
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json(run);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch run' });
  }
});

// Batch control commands
app.post('/api/runs/:id/command', async (req: Request, res: Response) => {
  try {
    const { command, userId, parameters } = req.body;
    const run = await prisma.productionRun.findUnique({
      where: { id: req.params.id },
      include: { workCenter: { include: { area: true } } },
    });
    
    if (!run) return res.status(404).json({ error: 'Run not found' });

    // Build command topic using ISA-95 hierarchy
    const topic = `${run.workCenter?.area?.site?.code || 'ACME'}/${run.workCenter?.area?.code || 'AREA'}/${run.workCenter?.code}/batch/${run.runNumber}/command`;
    
    const message = {
      commandId: `cmd-${Date.now()}`,
      commandType: command,
      target: run.runNumber,
      parameters,
      userId,
      timestamp: new Date().toISOString(),
    };

    await mqttClient?.publishAsync(topic, JSON.stringify(message), { qos: 1 });
    
    res.json({ success: true, topic, message });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send command' });
  }
});

// ============================================
// Recipe Routes
// ============================================

app.get('/api/recipes', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const recipes = await prisma.recipe.findMany({
      where: status ? { status: String(status) } : undefined,
      include: { product: true, recipeMaterials: { include: { material: true } } },
    });
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

app.get('/api/recipes/:id', async (req: Request, res: Response) => {
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id: req.params.id },
      include: { 
        product: true,
        recipeMaterials: { include: { material: true } },
        productionRuns: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    res.json(recipe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recipe' });
  }
});

// ============================================
// Material & Genealogy Routes
// ============================================

app.get('/api/products', async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const products = await prisma.productDefinition.findMany({
      where: type ? { productType: String(type) } : undefined,
      include: { recipes: true, materialLots: true },
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/lots', async (req: Request, res: Response) => {
  try {
    const { status, productId } = req.query;
    const lots = await prisma.materialLot.findMany({
      where: {
        ...(status ? { status: String(status) } : {}),
        ...(productId ? { productId: String(productId) } : {}),
      },
      include: { product: true },
      orderBy: { receivedDate: 'desc' },
    });
    res.json(lots);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch lots' });
  }
});

app.get('/api/lots/:id/genealogy', async (req: Request, res: Response) => {
  try {
    // Get all genealogy records for this lot
    const fromRecords = await prisma.genealogy.findMany({
      where: { fromLotId: req.params.id },
      include: { toLot: { include: { product: true } }, run: true },
    });
    
    const toRecords = await prisma.genealogy.findMany({
      where: { toLotId: req.params.id },
      include: { fromLot: { include: { product: true } }, run: true },
    });

    res.json({
      lotId: req.params.id,
      inputs: toRecords.map(r => ({
        lot: r.fromLot,
        relationship: r.relationship,
        quantity: r.quantity,
        run: r.run,
        timestamp: r.timestamp,
      })),
      outputs: fromRecords.map(r => ({
        lot: r.toLot,
        relationship: r.relationship,
        quantity: r.quantity,
        run: r.run,
        timestamp: r.timestamp,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch genealogy' });
  }
});

// ============================================
// Edge Connector Routes
// ============================================

app.get('/api/connectors', async (req: Request, res: Response) => {
  try {
    const { type, status, siteId } = req.query;
    const connectors = await prisma.edgeConnector.findMany({
      where: {
        ...(type ? { type: String(type) } : {}),
        ...(status ? { status: String(status) } : {}),
        ...(siteId ? { siteId: String(siteId) } : {}),
      },
      include: { site: true, tags: true },
    });
    res.json(connectors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch connectors' });
  }
});

app.get('/api/connectors/:id', async (req: Request, res: Response) => {
  try {
    const connector = await prisma.edgeConnector.findUnique({
      where: { id: req.params.id },
      include: { 
        site: true,
        tags: { include: { alarmDefinitions: true } },
        tagMappings: { include: { tag: true } },
        connectorMetrics: { orderBy: { timestamp: 'desc' }, take: 100 },
      },
    });
    if (!connector) return res.status(404).json({ error: 'Connector not found' });
    res.json(connector);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch connector' });
  }
});

// Create/Update connector
app.post('/api/connectors', async (req: Request, res: Response) => {
  try {
    const connector = await prisma.edgeConnector.create({
      data: req.body,
    });
    res.status(201).json(connector);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create connector' });
  }
});

app.put('/api/connectors/:id', async (req: Request, res: Response) => {
  try {
    const connector = await prisma.edgeConnector.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(connector);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update connector' });
  }
});

// ============================================
// OEE & Metrics Routes
// ============================================

app.get('/api/oee', async (req: Request, res: Response) => {
  try {
    const { workCenterId, from, to } = req.query;
    const records = await prisma.oEERecord.findMany({
      where: {
        ...(workCenterId ? { workCenterId: String(workCenterId) } : {}),
        ...(from ? { timestamp: { gte: new Date(String(from)) } } : {}),
        ...(to ? { timestamp: { lte: new Date(String(to)) } } : {}),
      },
      include: { workCenter: true },
      orderBy: { timestamp: 'desc' },
      take: 168, // Last week hourly
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch OEE records' });
  }
});

// ============================================
// User Routes
// ============================================

app.get('/api/users', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      include: { site: true, userRoles: { include: { role: true } } },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ============================================
// System Config Routes
// ============================================

app.get('/api/config', async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    const configs = await prisma.systemConfig.findMany({
      where: category ? { category: String(category) } : undefined,
    });
    res.json(configs.reduce((acc, c) => ({ ...acc, [c.key]: c.value }), {}));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// ============================================
// MQTT Publish Endpoint
// ============================================

app.post('/api/mqtt/publish', async (req: Request, res: Response) => {
  try {
    const { topic, message, qos = 1, retain = false } = req.body;
    
    if (!mqttClient?.connected) {
      return res.status(503).json({ error: 'MQTT not connected' });
    }

    await mqttClient.publishAsync(topic, JSON.stringify(message), { qos, retain });
    res.json({ success: true, topic });
  } catch (error) {
    res.status(500).json({ error: 'Failed to publish message' });
  }
});

// ============================================
// Dashboard Aggregation Routes
// ============================================

app.get('/api/dashboard/overview', async (req: Request, res: Response) => {
  try {
    // Get aggregated dashboard data
    const [
      enterprises,
      activeRuns,
      activeAlarms,
      latestOee,
      connectors,
    ] = await Promise.all([
      prisma.enterprise.count(),
      prisma.productionRun.count({ where: { status: 'RUNNING' } }),
      prisma.alarm.count({ where: { state: 'ACTIVE' } }),
      prisma.oEERecord.findFirst({ orderBy: { timestamp: 'desc' } }),
      prisma.edgeConnector.count({ where: { status: 'ONLINE' } }),
    ]);

    res.json({
      enterprises,
      activeRuns,
      activeAlarms,
      latestOee,
      onlineConnectors: connectors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ============================================
// Error Handling
// ============================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API] Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// WebSocket Server
// ============================================

const wsServer = new WebSocketServer({ port: WS_PORT });

wsServer.on('connection', (ws: WebSocket) => {
  console.log('[WS] Client connected');
  wsClients.add(ws);

  // Send initial connection message
  ws.send(JSON.stringify({
    type: 'connected',
    timestamp: new Date().toISOString(),
    mqttConnected: mqttClient?.connected || false,
  }));

  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'subscribe':
          // Subscribe to MQTT topic
          if (mqttClient?.connected && message.topic) {
            mqttClient.subscribe(message.topic, { qos: 1 });
            ws.send(JSON.stringify({ type: 'subscribed', topic: message.topic }));
          }
          break;
          
        case 'unsubscribe':
          if (mqttClient?.connected && message.topic) {
            mqttClient.unsubscribe(message.topic);
            ws.send(JSON.stringify({ type: 'unsubscribed', topic: message.topic }));
          }
          break;
          
        case 'publish':
          if (mqttClient?.connected && message.topic && message.payload) {
            mqttClient.publish(message.topic, JSON.stringify(message.payload), { qos: 1 });
          }
          break;
          
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          break;
      }
    } catch (error) {
      console.error('[WS] Message parse error:', error);
    }
  });

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
    wsClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('[WS] Error:', error);
    wsClients.delete(ws);
  });
});

// ============================================
// Start Server
// ============================================

async function start() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('[DB] Connected to PostgreSQL');

    // Connect to MQTT
    connectMQTT();

    // Start HTTP server
    app.listen(API_PORT, () => {
      console.log(`[API] REST API listening on port ${API_PORT}`);
      console.log(`[WS] WebSocket server listening on port ${WS_PORT}`);
    });
  } catch (error) {
    console.error('[Startup] Error:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Shutdown] SIGTERM received');
  await prisma.$disconnect();
  mqttClient?.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Shutdown] SIGINT received');
  await prisma.$disconnect();
  mqttClient?.end();
  process.exit(0);
});

start();
