/**
 * Platform integrations config (MQTT, InfluxDB) from SystemConfig.
 * Single source of truth for app, connector-gateway, and data-persister.
 */

import { db } from '@/lib/db';

const MQTT_URL_KEY = 'mqtt.broker.url';
const MQTT_CLIENT_ID_KEY = 'mqtt.client.id';
const INFLUX_URL_KEY = 'influxdb.url';
const INFLUX_TOKEN_KEY = 'influxdb.token';
const INFLUX_ORG_KEY = 'influxdb.org';
const INFLUX_BUCKET_KEY = 'influxdb.bucket';

export interface MqttConfig {
  url: string;
  clientId?: string;
}

export interface InfluxConfig {
  url: string;
  token: string;
  org: string;
  bucket: string;
}

function getJsonString(rows: { key: string; value: unknown }[], key: string): string | null {
  const row = rows.find((r) => r.key === key);
  if (!row || row.value == null) return null;
  const v = row.value;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

/**
 * Load MQTT and InfluxDB config rows in one query.
 */
async function loadConfigRows(): Promise<{ key: string; value: unknown }[]> {
  const rows = await db.systemConfig.findMany({
    where: {
      key: {
        in: [
          MQTT_URL_KEY,
          MQTT_CLIENT_ID_KEY,
          INFLUX_URL_KEY,
          INFLUX_TOKEN_KEY,
          INFLUX_ORG_KEY,
          INFLUX_BUCKET_KEY,
        ],
      },
    },
    select: { key: true, value: true },
  });
  return rows.map((r) => ({ key: r.key, value: r.value }));
}

/**
 * Get MQTT broker config from DB. Returns null if URL is missing.
 * When MQTT_BROKER_URL is set in env, it overrides the DB value (for local dev without Docker).
 */
export async function getMqttConfig(): Promise<MqttConfig | null> {
  const envUrl = process.env.MQTT_BROKER_URL?.trim();
  if (envUrl) {
    const clientId = process.env.MQTT_CLIENT_ID?.trim() || undefined;
    return { url: envUrl, clientId };
  }
  const rows = await loadConfigRows();
  const url = getJsonString(rows, MQTT_URL_KEY);
  if (!url) return null;
  const clientId = getJsonString(rows, MQTT_CLIENT_ID_KEY) ?? undefined;
  return { url, clientId };
}

/**
 * Get InfluxDB config from DB. Returns null if any required field is missing.
 * When INFLUXDB_URL is set in env, it overrides the DB URL (for local dev when DB has influxdb:8086).
 */
export async function getInfluxConfig(): Promise<InfluxConfig | null> {
  const rows = await loadConfigRows();
  let url = getJsonString(rows, INFLUX_URL_KEY);
  const envUrl = process.env.INFLUXDB_URL?.trim();
  if (envUrl) url = envUrl;
  const token = getJsonString(rows, INFLUX_TOKEN_KEY);
  const org = getJsonString(rows, INFLUX_ORG_KEY);
  const bucket = getJsonString(rows, INFLUX_BUCKET_KEY);
  if (!url || !token || !org || !bucket) return null;
  return { url, token, org, bucket };
}

/**
 * Check if integrations are fully configured (MQTT URL + Influx URL/token/org/bucket).
 */
export async function isIntegrationsConfigured(): Promise<boolean> {
  const [mqtt, influx] = await Promise.all([getMqttConfig(), getInfluxConfig()]);
  return !!mqtt?.url && !!influx?.url && !!influx?.token && !!influx?.org && !!influx?.bucket;
}

export interface IntegrationsConfig {
  mqtt: { url: string; clientId?: string };
  influx: { url: string; token: string; org: string; bucket: string };
}

/**
 * Get full integrations config for UI (GET). Returns partial if some keys missing.
 */
export async function getIntegrationsConfigForApi(): Promise<{
  mqtt: { url: string; clientId: string };
  influx: { url: string; token: string; org: string; bucket: string };
  configured: boolean;
}> {
  const rows = await loadConfigRows();
  const mqttUrl = getJsonString(rows, MQTT_URL_KEY) ?? '';
  const mqttClientId = getJsonString(rows, MQTT_CLIENT_ID_KEY) ?? '';
  const influxUrl = getJsonString(rows, INFLUX_URL_KEY) ?? '';
  const influxToken = getJsonString(rows, INFLUX_TOKEN_KEY) ?? '';
  const influxOrg = getJsonString(rows, INFLUX_ORG_KEY) ?? '';
  const influxBucket = getJsonString(rows, INFLUX_BUCKET_KEY) ?? '';
  const configured =
    !!mqttUrl.trim() &&
    !!influxUrl.trim() &&
    !!influxToken.trim() &&
    !!influxOrg.trim() &&
    !!influxBucket.trim();
  return {
    mqtt: { url: mqttUrl, clientId: mqttClientId },
    influx: { url: influxUrl, token: influxToken, org: influxOrg, bucket: influxBucket },
    configured,
  };
}

/**
 * Save integrations config (PUT). Upserts SystemConfig rows.
 */
export async function setIntegrationsConfig(config: IntegrationsConfig): Promise<void> {
  const { mqtt, influx } = config;
  await db.$transaction([
    db.systemConfig.upsert({
      where: { key: MQTT_URL_KEY },
      update: { value: mqtt.url },
      create: { key: MQTT_URL_KEY, value: mqtt.url, category: 'mqtt', description: 'MQTT broker URL' },
    }),
    db.systemConfig.upsert({
      where: { key: MQTT_CLIENT_ID_KEY },
      update: { value: mqtt.clientId ?? '' },
      create: { key: MQTT_CLIENT_ID_KEY, value: mqtt.clientId ?? '', category: 'mqtt', description: 'MQTT client ID' },
    }),
    db.systemConfig.upsert({
      where: { key: INFLUX_URL_KEY },
      update: { value: influx.url },
      create: { key: INFLUX_URL_KEY, value: influx.url, category: 'influxdb', description: 'InfluxDB URL' },
    }),
    db.systemConfig.upsert({
      where: { key: INFLUX_TOKEN_KEY },
      update: { value: influx.token },
      create: { key: INFLUX_TOKEN_KEY, value: influx.token, category: 'influxdb', description: 'InfluxDB token' },
    }),
    db.systemConfig.upsert({
      where: { key: INFLUX_ORG_KEY },
      update: { value: influx.org },
      create: { key: INFLUX_ORG_KEY, value: influx.org, category: 'influxdb', description: 'InfluxDB org' },
    }),
    db.systemConfig.upsert({
      where: { key: INFLUX_BUCKET_KEY },
      update: { value: influx.bucket },
      create: { key: INFLUX_BUCKET_KEY, value: influx.bucket, category: 'influxdb', description: 'InfluxDB bucket' },
    }),
  ]);
}
