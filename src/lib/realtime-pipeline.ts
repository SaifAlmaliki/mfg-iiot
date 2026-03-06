/**
 * Real-time pipeline: receives tag value events from MQTT connector,
 * writes to InfluxDB, and notifies Socket.IO for subscribed clients.
 */

import { writeTagValue, type TagValuePoint } from '@/lib/influxdb';
import { getSocketIO } from '@/lib/socketio-server';
import type { TagValueEvent } from '@/lib/mqtt-connector';

const SOCKET_EVENT = 'tag:value';

/**
 * Pipeline handler: write to InfluxDB then broadcast to Socket.IO room(s).
 * Logs errors; does not throw so process stays up.
 */
export function handleTagValue(event: TagValueEvent): void {
  const point: TagValuePoint = {
    tagId: event.tagId,
    value: event.value,
    quality: event.quality,
    timestamp: event.timestamp,
    equipmentId: event.equipmentId,
    workUnitId: event.workUnitId,
  };

  try {
    writeTagValue(point);
  } catch (err) {
    console.error('[Pipeline] InfluxDB write error:', err);
  }

  const io = getSocketIO();
  if (io) {
    const payload = {
      tagId: event.tagId,
      value: event.value,
      quality: event.quality,
      timestamp: event.timestamp.toISOString(),
    };
    io.to(`tag:${event.tagId}`).emit(SOCKET_EVENT, payload);
  }
}
