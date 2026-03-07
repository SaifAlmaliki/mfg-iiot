/**
 * UNS Data Persister Service
 * 
 * Subscribes to MQTT topics and persists:
 * - Telemetry data to InfluxDB (time-series)
 * - Alarm events to PostgreSQL
 * - Equipment status to PostgreSQL
 * - Batch state changes to PostgreSQL
 * 
 * Port: 3110 (Health check API)
 */

import mqtt, { MqttClient } from 'mqtt';
import { PrismaClient } from '@prisma/client';

const HEALTH_PORT = 3110;
const CONFIG_POLL_MS = 30_000;

// Initialize Prisma
const prisma = new PrismaClient();

export interface PlatformIntegrationsConfig {
  mqtt: { url: string };
  influx: { url: string; token: string; org: string; bucket: string } | null;
}

async function fetchPlatformConfig(): Promise<PlatformIntegrationsConfig | null> {
  const rows = await prisma.systemConfig.findMany({
    where: {
      key: {
        in: ['mqtt.broker.url', 'influxdb.url', 'influxdb.token', 'influxdb.org', 'influxdb.bucket'],
      },
    },
    select: { key: true, value: true },
  });
  const get = (k: string) => {
    const r = rows.find((x) => x.key === k)?.value;
    return typeof r === 'string' ? r.trim() : null;
  };
  const mqttUrl = get('mqtt.broker.url');
  if (!mqttUrl) return null;
  const influxUrl = get('influxdb.url');
  const influxToken = get('influxdb.token');
  const influxOrg = get('influxdb.org');
  const influxBucket = get('influxdb.bucket');
  const influx =
    influxUrl && influxToken && influxOrg && influxBucket
      ? { url: influxUrl, token: influxToken, org: influxOrg, bucket: influxBucket }
      : null;
  return { mqtt: { url: mqttUrl }, influx };
}

// MQTT Client
let mqttClient: MqttClient | null = null;

// InfluxDB client (optional)
let influxWriteApi: any = null;
let influxEnabled = false;

let lastConfig: PlatformIntegrationsConfig | null = null;

// Stats
const stats = {
  messagesProcessed: 0,
  messagesError: 0,
  lastMessageTime: null as Date | null,
  startTime: new Date(),
};

// ============================================
// InfluxDB Setup (Optional) – config from DB
// ============================================

async function setupInfluxDB(config: NonNullable<PlatformIntegrationsConfig['influx']>) {
  try {
    const { InfluxDB } = await import('@influxdata/influxdb-client');
    const influxDB = new InfluxDB({ url: config.url, token: config.token });
    influxWriteApi = influxDB.getWriteApi(config.org, config.bucket, 'ms');
    influxEnabled = true;
    console.log('[InfluxDB] Connected and ready');
  } catch (_error) {
    console.log('[InfluxDB] Not available - data will be stored in PostgreSQL only');
    influxEnabled = false;
    influxWriteApi = null;
  }
}

function teardownInfluxDB() {
  influxWriteApi = null;
  influxEnabled = false;
}

// ============================================
// MQTT Connection – config from DB
// ============================================

function disconnectMQTT() {
  if (mqttClient) {
    mqttClient.end();
    mqttClient = null;
    console.log('[MQTT] Disconnected');
  }
}

function connectMQTT(mqttUrl: string) {
  mqttClient = mqtt.connect(mqttUrl, {
    clientId: `data-persister-${Date.now()}`,
    clean: true,
    keepalive: 60,
    reconnectPeriod: 5000,
  });

  mqttClient.on('connect', () => {
    console.log('[MQTT] Connected to broker');
    
    // Subscribe to all topics we want to persist
    const topics = [
      'ACME/#',  // All enterprise data
    ];
    
    topics.forEach(topic => {
      mqttClient?.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`[MQTT] Failed to subscribe to ${topic}:`, err);
        } else {
          console.log(`[MQTT] Subscribed to ${topic}`);
        }
      });
    });
  });

  mqttClient.on('message', async (topic: string, payload: Buffer) => {
    try {
      await processMessage(topic, payload);
      stats.messagesProcessed++;
      stats.lastMessageTime = new Date();
    } catch (error) {
      stats.messagesError++;
      console.error('[MQTT] Error processing message:', error);
    }
  });

  mqttClient.on('error', (error) => {
    console.error('[MQTT] Error:', error);
  });

  mqttClient.on('close', () => {
    console.log('[MQTT] Connection closed');
  });
}

// ============================================
// Message Processing
// ============================================

async function processMessage(topic: string, payload: Buffer) {
  const payloadStr = payload.toString();
  
  // Try to parse as JSON
  let message: any;
  try {
    message = JSON.parse(payloadStr);
  } catch {
    // Not JSON, treat as raw value
    message = { value: payloadStr };
  }

  // Parse topic to determine message type
  const topicParts = topic.split('/');
  
  if (topicParts.length < 6) {
    // Not an ISA-95 topic, skip
    return;
  }

  const [enterprise, site, area, workCenter, workUnit, ...attributeParts] = topicParts;
  const attribute = attributeParts.join('/');

  // Determine message category and process accordingly
  if (attribute.includes('/value') || attribute.includes('/setpoint')) {
    await processTelemetry(topic, message, { enterprise, site, area, workCenter, workUnit, attribute });
  } else if (attribute.includes('/alarm')) {
    await processAlarm(topic, message, { enterprise, site, area, workCenter, workUnit });
  } else if (attribute.includes('/status')) {
    await processEquipmentStatus(topic, message, { enterprise, site, area, workCenter, workUnit });
  } else if (attribute.includes('/batch/')) {
    await processBatchState(topic, message, { enterprise, site, area, workCenter });
  } else if (attribute.includes('/heartbeat')) {
    await processHeartbeat(topic, message, { enterprise, site });
  }

  // Always try to write to InfluxDB if enabled
  if (influxEnabled && influxWriteApi) {
    await writeToInfluxDB(topic, message, { enterprise, site, area, workCenter, workUnit, attribute });
  }
}

// ============================================
// Telemetry Processing
// ============================================

async function processTelemetry(
  topic: string, 
  message: any, 
  context: { enterprise: string; site: string; area: string; workCenter: string; workUnit: string; attribute: string }
) {
  // Find or create tag
  let tag = await prisma.tag.findFirst({
    where: { mqttTopic: topic },
  });

  if (!tag) {
    // Try to find by partial match
    const baseTopic = topic.replace('/value', '').replace('/setpoint', '');
    tag = await prisma.tag.findFirst({
      where: { mqttTopic: { contains: baseTopic } },
    });
  }

  if (tag) {
    // Store tag value
    const value = typeof message.value !== 'undefined' ? String(message.value) : String(message);
    const quality = message.quality || 'GOOD';
    
    await prisma.tagValue.create({
      data: {
        tagId: tag.id,
        value,
        quality,
        timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
      },
    });

    // Check for alarm conditions
    await checkAlarmConditions(tag, value, context);
  }
}

// ============================================
// Alarm Processing
// ============================================

async function processAlarm(
  topic: string,
  message: any,
  context: { enterprise: string; site: string; area: string; workCenter: string; workUnit: string }
) {
  if (message.state === 'ACTIVE') {
    // Create new alarm
    await prisma.alarm.create({
      data: {
        state: 'ACTIVE',
        value: message.value || 0,
        message: message.message || `Alarm from ${context.workUnit}`,
        activatedAt: new Date(message.activatedAt || Date.now()),
        definitionId: message.alarmDefinitionId || '',
      },
    });
  } else if (message.state === 'CLEARED' && message.alarmId) {
    // Clear existing alarm
    await prisma.alarm.updateMany({
      where: { id: message.alarmId },
      data: {
        state: 'CLEARED',
        clearedAt: new Date(),
      },
    });
  }
}

// ============================================
// Equipment Status Processing
// ============================================

async function processEquipmentStatus(
  topic: string,
  message: any,
  context: { enterprise: string; site: string; area: string; workCenter: string; workUnit: string }
) {
  // Find equipment by code
  const equipment = await prisma.equipment.findFirst({
    where: { code: context.workUnit },
  });

  if (equipment && message.healthScore) {
    // Record asset health
    await prisma.assetHealth.create({
      data: {
        healthScore: message.healthScore,
        status: message.status || 'NORMAL',
        metrics: message.metrics || {},
        anomalies: message.anomalies || [],
        predictions: message.predictions || {},
        recommendations: message.recommendations || [],
        equipmentId: equipment.id,
      },
    });
  }
}

// ============================================
// Batch State Processing
// ============================================

async function processBatchState(
  topic: string,
  message: any,
  _context: { enterprise: string; site: string; area: string; workCenter: string }
) {
  if (message.batchId && message.state) {
    // Record state transition
    const run = await prisma.productionRun.findFirst({
      where: { runNumber: message.batchId },
    });

    if (run) {
      await prisma.productionRunStateTransition.create({
        data: {
          fromState: run.state || 'IDLE',
          toState: message.state,
          trigger: message.trigger,
          parameters: message.parameters || {},
          runId: run.id,
        },
      });

      // Update run state
      await prisma.productionRun.update({
        where: { id: run.id },
        data: {
          state: message.state,
          phase: message.phase,
          step: message.step,
          progress: message.progress || run.progress,
        },
      });
    }
  }
}

// ============================================
// Heartbeat Processing
// ============================================

async function processHeartbeat(
  topic: string,
  message: any,
  context: { enterprise: string; site: string }
) {
  // Find connector by code
  const connector = await prisma.edgeConnector.findFirst({
    where: { 
      code: message.source,
      site: { code: context.site },
    },
  });

  if (connector) {
    await prisma.edgeConnector.update({
      where: { id: connector.id },
      data: {
        status: message.status === 'HEALTHY' ? 'ONLINE' : 
                message.status === 'DEGRADED' ? 'MAINTENANCE' : 'ERROR',
        lastSeen: new Date(),
      },
    });

    // Record metrics
    await prisma.connectorMetric.create({
      data: {
        messagesRead: message.metrics?.messagesProcessed || 0,
        messagesError: message.metrics?.errors || 0,
        latencyMs: message.metrics?.latencyMs || 0,
        connectorId: connector.id,
      },
    });
  }
}

// ============================================
// Alarm Condition Checking
// ============================================

async function checkAlarmConditions(
  tag: any,
  value: string,
  _context: { enterprise: string; site: string; area: string; workCenter: string; workUnit: string }
) {
  const numericValue = parseFloat(value);
  if (isNaN(numericValue)) return;

  // Get alarm definitions for this tag
  const definitions = await prisma.alarmDefinition.findMany({
    where: { tagId: tag.id, isActive: true },
  });

  for (const def of definitions) {
    let shouldAlarm = false;
    
    switch (def.type) {
      case 'HIGH':
        shouldAlarm = numericValue > def.setpoint;
        break;
      case 'HIGH_HIGH':
        shouldAlarm = numericValue > def.setpoint;
        break;
      case 'LOW':
        shouldAlarm = numericValue < def.setpoint;
        break;
      case 'LOW_LOW':
        shouldAlarm = numericValue < def.setpoint;
        break;
      case 'DEVIATION':
        shouldAlarm = Math.abs(numericValue - def.setpoint) > (def.deadband || 0);
        break;
    }

    if (shouldAlarm) {
      // Check if alarm already active
      const existingAlarm = await prisma.alarm.findFirst({
        where: { definitionId: def.id, state: 'ACTIVE' },
      });

      if (!existingAlarm) {
        // Create new alarm
        await prisma.alarm.create({
          data: {
            state: 'ACTIVE',
            value: numericValue,
            message: def.message || `${tag.name} ${def.type} alarm`,
            activatedAt: new Date(),
            definitionId: def.id,
          },
        });

        console.log(`[Alarm] Created alarm for ${tag.name}: ${def.type} at ${numericValue}`);
      }
    }
  }
}

// ============================================
// InfluxDB Writing with Enrichment
// ============================================

interface TagEnrichmentInfo {
  tagId: string;
  tagName: string;
  tagDataType: string;
  tagEngUnit?: string;
  equipmentId?: string;
  equipmentCode?: string;
  equipmentName?: string;
  equipmentType?: string;
  equipmentManufacturer?: string;
  equipmentModel?: string;
  workUnitCode?: string;
  workUnitName?: string;
  workCenterCode?: string;
  workCenterName?: string;
  areaCode?: string;
  areaName?: string;
  siteCode?: string;
  siteName?: string;
}

interface ProductionContext {
  orderNumber?: string;
  orderStatus?: string;
  productCode?: string;
  productName?: string;
  recipeName?: string;
  recipeVersion?: string;
  runNumber?: string;
  runStatus?: string;
  runPhase?: string;
}

const tagCache = new Map<string, TagEnrichmentInfo>();
const productionCache = new Map<string, ProductionContext>();
const cacheExpiry = new Map<string, number>();
const CACHE_TTL_MS = 60000;

function checkCache(key: string): boolean {
  const expiry = cacheExpiry.get(key);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    cacheExpiry.delete(key);
    tagCache.delete(key);
    productionCache.delete(key);
    return false;
  }
  return true;
}

async function getTagEnrichmentInfo(topic: string): Promise<TagEnrichmentInfo | null> {
  const cacheKey = `tag:${topic}`;
  if (checkCache(cacheKey)) {
    return tagCache.get(cacheKey) || null;
  }

  try {
    const tag = await prisma.tag.findFirst({
      where: {
        OR: [
          { mqttTopic: topic },
          { mqttTopic: { contains: topic.replace(/\/value$/, '').replace(/\/setpoint$/, '') } },
        ],
      },
      include: {
        equipment: {
          select: { id: true, code: true, name: true, type: true, manufacturer: true, model: true },
        },
        workUnit: {
          include: {
            workCenter: {
              include: {
                area: {
                  include: {
                    site: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!tag) {
      cacheExpiry.set(cacheKey, Date.now() + 300000);
      return null;
    }

    const info: TagEnrichmentInfo = {
      tagId: tag.id,
      tagName: tag.name,
      tagDataType: tag.dataType,
      tagEngUnit: tag.engUnit || undefined,
    };

    if (tag.equipment) {
      info.equipmentId = tag.equipment.id;
      info.equipmentCode = tag.equipment.code;
      info.equipmentName = tag.equipment.name;
      info.equipmentType = tag.equipment.type;
      info.equipmentManufacturer = tag.equipment.manufacturer || undefined;
      info.equipmentModel = tag.equipment.model || undefined;
    }

    if (tag.workUnit) {
      info.workUnitCode = tag.workUnit.code;
      info.workUnitName = tag.workUnit.name;
      if (tag.workUnit.workCenter) {
        info.workCenterCode = tag.workUnit.workCenter.code;
        info.workCenterName = tag.workUnit.workCenter.name;
        if (tag.workUnit.workCenter.area) {
          info.areaCode = tag.workUnit.workCenter.area.code;
          info.areaName = tag.workUnit.workCenter.area.name;
          if (tag.workUnit.workCenter.area.site) {
            info.siteCode = tag.workUnit.workCenter.area.site.code;
            info.siteName = tag.workUnit.workCenter.area.site.name;
          }
        }
      }
    }

    tagCache.set(cacheKey, info);
    cacheExpiry.set(cacheKey, Date.now() + CACHE_TTL_MS);
    return info;
  } catch (error) {
    console.error('[Enrichment] Error fetching tag info:', error);
    return null;
  }
}

async function getProductionContext(workCenterCode: string): Promise<ProductionContext | null> {
  const cacheKey = `prod:${workCenterCode}`;
  if (checkCache(cacheKey)) {
    return productionCache.get(cacheKey) || null;
  }

  try {
    const workCenter = await prisma.workCenter.findFirst({
      where: { code: workCenterCode },
      include: {
        productionRuns: {
          where: { status: 'RUNNING' },
          take: 1,
          include: {
            order: {
              include: {
                recipe: {
                  include: { product: true },
                },
              },
            },
          },
        },
      },
    });

    if (!workCenter || workCenter.productionRuns.length === 0) {
      cacheExpiry.set(cacheKey, Date.now() + 30000);
      return null;
    }

    const run = workCenter.productionRuns[0];
    const order = run.order;
    const recipe = order?.recipe;
    const product = recipe?.product;

    const context: ProductionContext = {
      runNumber: run.runNumber,
      runStatus: run.status,
      runPhase: run.phase || undefined,
    };

    if (order) {
      context.orderNumber = order.orderNumber;
      context.orderStatus = order.status;
    }
    if (recipe) {
      context.recipeName = recipe.name;
      context.recipeVersion = recipe.version;
    }
    if (product) {
      context.productCode = product.code;
      context.productName = product.name;
    }

    productionCache.set(cacheKey, context);
    cacheExpiry.set(cacheKey, Date.now() + 30000);
    return context;
  } catch (error) {
    console.error('[Enrichment] Error fetching production context:', error);
    return null;
  }
}

async function writeToInfluxDB(
  topic: string,
  message: any,
  context: { enterprise: string; site: string; area: string; workCenter: string; workUnit: string; attribute: string }
) {
  if (!influxWriteApi) return;

  try {
    const { Point } = await import('@influxdata/influxdb-client');

    const tagInfo = await getTagEnrichmentInfo(topic);
    const productionContext = await getProductionContext(context.workCenter);

    const point = new Point('telemetry')
      .tag('enterprise', context.enterprise)
      .tag('site', tagInfo?.siteName || context.site)
      .tag('siteCode', tagInfo?.siteCode || context.site)
      .tag('area', tagInfo?.areaName || context.area)
      .tag('areaCode', tagInfo?.areaCode || context.area)
      .tag('workCenter', tagInfo?.workCenterName || context.workCenter)
      .tag('workCenterCode', tagInfo?.workCenterCode || context.workCenter)
      .tag('workUnit', tagInfo?.workUnitName || context.workUnit)
      .tag('workUnitCode', tagInfo?.workUnitCode || context.workUnit)
      .tag('topic', topic)
      .tag('attribute', context.attribute);

    if (tagInfo) {
      point.tag('tagId', tagInfo.tagId);
      point.tag('tagName', tagInfo.tagName);
      point.tag('tagDataType', tagInfo.tagDataType);
      if (tagInfo.tagEngUnit) point.tag('engUnit', tagInfo.tagEngUnit);
      if (tagInfo.equipmentCode) {
        point.tag('equipmentCode', tagInfo.equipmentCode);
        point.tag('equipmentName', tagInfo.equipmentName || '');
        point.tag('equipmentType', tagInfo.equipmentType || '');
      }
    }

    if (productionContext) {
      if (productionContext.orderNumber) point.tag('productionOrder', productionContext.orderNumber);
      if (productionContext.productCode) point.tag('productCode', productionContext.productCode);
      if (productionContext.productName) point.tag('productName', productionContext.productName);
      if (productionContext.recipeName) point.tag('recipe', productionContext.recipeName);
      if (productionContext.runNumber) point.tag('batchId', productionContext.runNumber);
      if (productionContext.runStatus) point.tag('runStatus', productionContext.runStatus);
      if (productionContext.runPhase) point.tag('runPhase', productionContext.runPhase);
    }

    const value = message.value !== undefined ? message.value : message;

    if (typeof value === 'number') {
      point.floatField('value', value);
    } else if (typeof value === 'boolean') {
      point.booleanField('value', value);
    } else if (typeof value === 'string') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        point.floatField('value', num);
      } else {
        point.stringField('value', value);
      }
    }

    if (message.quality) {
      point.stringField('quality', message.quality);
    }

    influxWriteApi.writePoint(point);
  } catch (error) {
    console.error('[InfluxDB] Write error:', error);
  }
}

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
          uptime: Math.floor((Date.now() - stats.startTime.getTime()) / 1000),
          mqtt: mqttClient?.connected ? 'connected' : 'disconnected',
          influxdb: influxEnabled ? 'enabled' : 'disabled',
          stats: {
            messagesProcessed: stats.messagesProcessed,
            messagesError: stats.messagesError,
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
// Periodic Tasks
// ============================================

async function flushInfluxDB() {
  if (influxWriteApi) {
    try {
      await influxWriteApi.flush();
    } catch (error) {
      console.error('[InfluxDB] Flush error:', error);
    }
  }
}

// Flush InfluxDB every 5 seconds
setInterval(flushInfluxDB, 5000);

// ============================================
// Start Service
// ============================================

async function applyConfig(config: PlatformIntegrationsConfig) {
  if (config.influx) {
    await setupInfluxDB(config.influx);
  } else {
    teardownInfluxDB();
  }
  disconnectMQTT();
  connectMQTT(config.mqtt.url);
}

async function start() {
  console.log('[Data Persister] Starting...');

  await prisma.$connect();
  console.log('[DB] Connected to PostgreSQL');

  const config = await fetchPlatformConfig();
  if (!config) {
    console.warn('[Data Persister] MQTT/Influx not configured in platform Settings > Integrations. Configure there and restart or wait for next poll.');
  } else {
    lastConfig = config;
    if (config.influx) await setupInfluxDB(config.influx);
    connectMQTT(config.mqtt.url);
  }

  setInterval(async () => {
    const next = await fetchPlatformConfig();
    if (!next) return;
    const prev = lastConfig;
    if (
      !prev ||
      prev.mqtt.url !== next.mqtt.url ||
      JSON.stringify(prev.influx) !== JSON.stringify(next.influx)
    ) {
      console.log('[Data Persister] Config changed; reconnecting.');
      lastConfig = next;
      await applyConfig(next);
    }
  }, CONFIG_POLL_MS);

  await startHealthServer();

  console.log('[Data Persister] Ready');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Shutdown] SIGTERM received');
  await flushInfluxDB();
  await prisma.$disconnect();
  mqttClient?.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Shutdown] SIGINT received');
  await flushInfluxDB();
  await prisma.$disconnect();
  mqttClient?.end();
  process.exit(0);
});

start();
