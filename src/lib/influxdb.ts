/**
 * InfluxDB 2.x client for tag time-series.
 * Reads config from env: INFLUXDB_URL, INFLUXDB_TOKEN, INFLUXDB_ORG, INFLUXDB_BUCKET.
 */

import {
  InfluxDB,
  Point,
  WriteApi,
  QueryApi,
} from '@influxdata/influxdb-client';

const MEASUREMENT = 'tag_value';
const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 2000;

let writeApi: WriteApi | null = null;
let queryApi: QueryApi | null = null;

function getConfig() {
  const url = process.env.INFLUXDB_URL;
  const token = process.env.INFLUXDB_TOKEN;
  const org = process.env.INFLUXDB_ORG;
  const bucket = process.env.INFLUXDB_BUCKET;
  if (!url || !token || !org || !bucket) {
    return null;
  }
  return { url, token, org, bucket };
}

function getClient(): InfluxDB | null {
  const cfg = getConfig();
  if (!cfg) return null;
  return new InfluxDB({ url: cfg.url, token: cfg.token });
}

/**
 * Get or create WriteApi. Uses batching by default.
 */
export function getInfluxWriteApi(): WriteApi | null {
  const cfg = getConfig();
  if (!cfg) return null;
  if (writeApi) return writeApi;
  const client = getClient();
  if (!client) return null;
  writeApi = client.getWriteApi(cfg.org, cfg.bucket, 'ns', {
    batchSize: BATCH_SIZE,
    flushInterval: FLUSH_INTERVAL_MS,
  });
  return writeApi;
}

/**
 * Get or create QueryApi.
 */
export function getInfluxQueryApi(): QueryApi | null {
  if (queryApi) return queryApi;
  const client = getClient();
  if (!client) return null;
  const cfg = getConfig();
  if (!cfg) return null;
  queryApi = client.getQueryApi(cfg.org);
  return queryApi;
}

export interface TagValuePoint {
  tagId: string;
  value: string;
  quality: string;
  timestamp: Date;
  equipmentId?: string;
  workUnitId?: string;
}

/**
 * Write a single tag value point to InfluxDB (or buffer for batch).
 * Measurement: tag_value; tags: tagId, optional equipmentId/workUnitId; fields: value, quality.
 */
export function writeTagValue(point: TagValuePoint): void {
  const api = getInfluxWriteApi();
  if (!api) return;

  const p = new Point(MEASUREMENT)
    .tag('tagId', point.tagId)
    .stringField('value', point.value)
    .stringField('quality', point.quality)
    .timestamp(point.timestamp);

  if (point.equipmentId) p.tag('equipmentId', point.equipmentId);
  if (point.workUnitId) p.tag('workUnitId', point.workUnitId);

  api.writePoint(p);
}

/**
 * Flush any buffered points (call on shutdown or when forcing sync).
 */
export async function flushInflux(): Promise<void> {
  if (writeApi) {
    try {
      await writeApi.close();
    } catch (e) {
      console.error('[InfluxDB] flush error:', e);
    }
    writeApi = null;
  }
}

/**
 * Last value for one or more tagIds. Returns most recent point per tag from InfluxDB.
 */
export async function getLastValues(
  tagIds: string[]
): Promise<{ tagId: string; value: string; quality: string; timestamp: string }[]> {
  const api = getInfluxQueryApi();
  const cfg = getConfig();
  if (!api || !cfg || tagIds.length === 0) return [];

  const tagList = tagIds.map((id) => `"${id}"`).join(', ');
  const fluxQuery = `
    from(bucket: "${cfg.bucket}")
      |> range(start: -30d)
      |> filter(fn: (r) => r._measurement == "${MEASUREMENT}" and r.tagId in [${tagList}])
      |> filter(fn: (r) => r._field == "value" or r._field == "quality")
      |> group(columns: ["tagId"])
      |> last()
  `;

  const results: { tagId: string; value: string; quality: string; timestamp: string }[] = [];
  const rowMap = new Map<
    string,
    { value: string; quality: string; timestamp: string }
  >();

  return new Promise((resolve, reject) => {
    api.queryRows(fluxQuery, {
      next(row, tableMeta) {
        const o = tableMeta.toObject(row);
        const tagId = o.tagId as string;
        if (!tagId) return;
        const time = (o._time as string) ?? '';
        if (o._field === 'value') {
          const existing = rowMap.get(tagId) ?? { value: '', quality: 'GOOD', timestamp: time };
          existing.value = String(o._value ?? '');
          existing.timestamp = time;
          rowMap.set(tagId, existing);
        } else if (o._field === 'quality') {
          const existing = rowMap.get(tagId) ?? { value: '', quality: 'GOOD', timestamp: time };
          existing.quality = String(o._value ?? 'GOOD');
          rowMap.set(tagId, existing);
        }
      },
      error(error) {
        console.error('[InfluxDB] last value query error:', error);
        reject(error);
      },
      complete() {
        rowMap.forEach((v, tagId) => {
          results.push({ tagId, ...v });
        });
        resolve(results);
      },
    });
  });
}

/**
 * Time-range query for one tag. Optional interval for downsampling (e.g. "1m", "5m").
 * Returns points with value, quality, timestamp.
 */
export async function getTagValuesInRange(
  tagId: string,
  start: Date,
  end: Date,
  interval?: string
): Promise<{ value: string; quality: string; timestamp: string }[]> {
  const api = getInfluxQueryApi();
  const cfg = getConfig();
  if (!api || !cfg) return [];

  const startStr = start.toISOString();
  const endStr = end.toISOString();
  let range = `|> range(start: ${startStr}, stop: ${endStr})`;
  const filter = `|> filter(fn: (r) => r._measurement == "${MEASUREMENT}" and r.tagId == "${tagId}")`;
  const fields = `|> filter(fn: (r) => r._field == "value" or r._field == "quality")`;
  const window = interval ? `|> aggregateWindow(every: ${interval}, fn: last, createEmpty: false)` : '';

  const fluxQuery = `
    from(bucket: "${cfg.bucket}")
      ${range}
      ${filter}
      ${fields}
      ${window}
      |> sort(columns: ["_time"])
  `;

  const results: { value: string; quality: string; timestamp: string }[] = [];
  const byTime = new Map<string, { value: string; quality: string }>();

  return new Promise((resolve, reject) => {
    api.queryRows(fluxQuery, {
      next(row, tableMeta) {
        const o = tableMeta.toObject(row);
        const time = (o._time as string) ?? '';
        let entry = byTime.get(time);
        if (!entry) {
          entry = { value: '', quality: 'GOOD' };
          byTime.set(time, entry);
        }
        if (o._field === 'value') entry.value = String(o._value ?? '');
        if (o._field === 'quality') entry.quality = String(o._value ?? 'GOOD');
      },
      error(error) {
        console.error('[InfluxDB] range query error:', error);
        reject(error);
      },
      complete() {
        [...byTime.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .forEach(([timestamp, v]) => {
            results.push({ ...v, timestamp });
          });
        resolve(results);
      },
    });
  });
}

export function isInfluxConfigured(): boolean {
  return getConfig() !== null;
}
