/**
 * MQTT connector: subscribe to tag topics from Postgres, emit pipeline events.
 * Config from DB (platform-config); no env. Reconnect via reconnectMqttConnector().
 */

import mqtt, { MqttClient } from 'mqtt';
import { db } from '@/lib/db';
import type { MqttConfig } from '@/lib/platform-config';

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const SUBSCRIPTION_REFRESH_MS = 60_000;

export interface TagValueEvent {
  tagId: string;
  value: string;
  quality: string;
  timestamp: Date;
  equipmentId?: string;
  workUnitId?: string;
}

export type TagValueCallback = (event: TagValueEvent) => void;

let client: MqttClient | null = null;
let reconnectAttempts = 0;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let currentTopics = new Set<string>();
let callback: TagValueCallback | null = null;
let topicToTag: Map<
  string,
  { tagId: string; equipmentId?: string; workUnitId?: string }
> = new Map();

/**
 * Load active tag MQTT topics from Postgres and return topic -> tag info map.
 */
export async function loadTagTopics(): Promise<
  Map<
    string,
    { tagId: string; equipmentId?: string; workUnitId?: string }
  >
> {
  const tags = await db.tag.findMany({
    where: { isActive: true },
    select: {
      id: true,
      mqttTopic: true,
      equipmentId: true,
      workUnitId: true,
    },
  });

  const map = new Map<
    string,
    { tagId: string; equipmentId?: string; workUnitId?: string }
  >();
  for (const t of tags) {
    if (t.mqttTopic?.trim()) {
      map.set(t.mqttTopic.trim(), {
        tagId: t.id,
        equipmentId: t.equipmentId ?? undefined,
        workUnitId: t.workUnitId ?? undefined,
      });
    }
  }
  return map;
}

/**
 * Parse MQTT payload to value, quality, optional timestamp.
 */
function parsePayload(
  payload: Buffer | string
): { value: string; quality: string; timestamp: Date } {
  const now = new Date();
  let value = '';
  let quality = 'GOOD';

  try {
    const raw = typeof payload === 'string' ? payload : payload.toString('utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    value = String(parsed.value ?? raw ?? '');
    quality = String(parsed.quality ?? 'GOOD');
    if (parsed.timestamp != null) {
      const ts = Number(parsed.timestamp);
      if (!Number.isNaN(ts)) {
        const q = ['GOOD', 'BAD', 'UNCERTAIN', 'INIT'].includes(quality) ? quality : 'GOOD';
        return {
          value,
          quality: q,
          timestamp: ts > 1e12 ? new Date(ts) : new Date(ts * 1000),
        };
      }
    }
  } catch {
    value = (typeof payload === 'string' ? payload : payload.toString('utf8')) || '';
  }
  return { value, quality, timestamp: now };
}

async function refreshSubscriptions(): Promise<void> {
  const topicMap = await loadTagTopics();
  topicToTag = topicMap;
  const newTopics = new Set(topicMap.keys());

  if (!client?.connected) return;

  for (const topic of newTopics) {
    if (!currentTopics.has(topic)) {
      client.subscribe(topic, (err) => {
        if (err) console.error('[MQTT] subscribe error:', topic, err);
        else currentTopics.add(topic);
      });
    }
  }
  currentTopics = new Set([...currentTopics].filter((t) => newTopics.has(t)));
}

function getBackoffMs(): number {
  const ms = Math.min(
    RECONNECT_MIN_MS * Math.pow(2, reconnectAttempts),
    RECONNECT_MAX_MS
  );
  reconnectAttempts += 1;
  return ms;
}

function stopTimer(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function disconnect(): void {
  stopTimer();
  if (client) {
    client.end(true);
    client = null;
  }
  currentTopics = new Set();
}

function connectWithConfig(config: MqttConfig): void {
  const clientId = config.clientId?.trim() || `uns-platform-${Date.now()}`;
  client = mqtt.connect(config.url, {
    clientId,
    reconnectPeriod: 0,
    clean: true,
  });

  client.on('connect', async () => {
    reconnectAttempts = 0;
    console.log('[MQTT] Connected to broker');
    await refreshSubscriptions();
  });

  client.on('message', (topic, payload) => {
    const info = topicToTag.get(topic);
    if (!info || !callback) return;
    const { value, quality, timestamp } = parsePayload(payload);
    callback({
      tagId: info.tagId,
      value,
      quality,
      timestamp,
      equipmentId: info.equipmentId,
      workUnitId: info.workUnitId,
    });
  });

  client.on('error', (err) => {
    console.error('[MQTT] Client error:', err);
  });

  client.on('close', () => {
    console.log('[MQTT] Connection closed');
  });

  client.on('reconnect', () => {
    console.log('[MQTT] Reconnecting...');
  });

  client.on('offline', () => {
    const delay = getBackoffMs();
    console.log(`[MQTT] Offline; reconnecting in ${delay}ms`);
    setTimeout(() => {
      if (!client?.connected) connectWithConfig(config);
    }, delay);
  });
}

/**
 * Start MQTT connector: load config from DB, connect, subscribe, emit events via cb.
 * If no config in DB, connector is not started.
 */
export function startMqttConnector(cb: TagValueCallback): () => void {
  callback = cb;
  import('@/lib/platform-config').then(({ getMqttConfig }) => {
    getMqttConfig().then((cfg) => {
      if (!cfg?.url) {
        console.warn('[MQTT] No MQTT broker URL in Settings > Integrations; connector disabled.');
        return;
      }
      connectWithConfig(cfg);
      refreshTimer = setInterval(() => {
        refreshSubscriptions().catch((e) => console.error('[MQTT] refresh error:', e));
      }, SUBSCRIPTION_REFRESH_MS);
    });
  });

  return () => {
    disconnect();
    callback = null;
  };
}

/**
 * Reconnect using current config from DB (e.g. after saving in Settings > Integrations).
 */
export function reconnectMqttConnector(): void {
  disconnect();
  import('@/lib/platform-config').then(({ getMqttConfig }) => {
    getMqttConfig().then((cfg) => {
      if (!cfg?.url || !callback) return;
      connectWithConfig(cfg);
      refreshTimer = setInterval(() => {
        refreshSubscriptions().catch((e) => console.error('[MQTT] refresh error:', e));
      }, SUBSCRIPTION_REFRESH_MS);
    });
  });
}
