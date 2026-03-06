/**
 * MQTT (EMQX) connector: subscribe to tag topics from Postgres metadata,
 * parse messages and emit pipeline events (tagId, value, quality, timestamp).
 * Uses MQTT_BROKER_URL or EMQX_BROKER_URL and EMQX_CLIENT_ID from env.
 */

import mqtt, { MqttClient } from 'mqtt';
import { db } from '@/lib/db';

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
 * Resolve broker URL from env (MQTT_BROKER_URL or EMQX_BROKER_URL).
 */
function getBrokerUrl(): string | null {
  return (
    process.env.MQTT_BROKER_URL ||
    process.env.EMQX_BROKER_URL ||
    null
  );
}

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
 * Accepts JSON { value, quality?, timestamp? } or plain string value.
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

/**
 * Subscribe to topics and update client subscriptions (subscribe to new, optionally unsubscribe removed).
 */
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

/**
 * Start MQTT connector: connect to broker, load topics from Postgres, subscribe, and emit events via cb.
 * Reconnects with backoff on disconnect. Refreshes subscriptions on interval.
 */
export function startMqttConnector(cb: TagValueCallback): () => void {
  callback = cb;
  const url = getBrokerUrl();
  if (!url) {
    console.warn('[MQTT] No MQTT_BROKER_URL or EMQX_BROKER_URL set; connector disabled.');
    return () => {};
  }

  const clientId =
    process.env.EMQX_CLIENT_ID || `uns-platform-${Date.now()}`;

  const connect = () => {
    client = mqtt.connect(url, {
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
        if (!client?.connected) connect();
      }, delay);
    });
  };

  connect();

  refreshTimer = setInterval(() => {
    refreshSubscriptions().catch((e) => console.error('[MQTT] refresh error:', e));
  }, SUBSCRIPTION_REFRESH_MS);

  return () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    if (client) {
      client.end(true);
      client = null;
    }
    callback = null;
  };
}
