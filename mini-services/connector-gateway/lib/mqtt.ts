/**
 * MQTT client singleton for the connector gateway.
 * Single connection shared by all runners; publish to UNS topics.
 * Only platform config from env: MQTT_BROKER_URL.
 */

import mqtt, { MqttClient } from 'mqtt';

const MQTT_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

let client: MqttClient | null = null;

export function getMqttClient(): MqttClient | null {
  return client;
}

export function isMqttConnected(): boolean {
  return client?.connected ?? false;
}

export function connectMqtt(): Promise<MqttClient> {
  if (client?.connected) {
    return Promise.resolve(client);
  }

  return new Promise((resolve, reject) => {
    client = mqtt.connect(MQTT_URL, {
      clientId: `uns-connector-gateway-${Date.now()}`,
      clean: true,
      keepalive: 60,
      reconnectPeriod: 5000,
    });

    client.on('connect', () => {
      console.log('[Gateway] MQTT connected');
      resolve(client!);
    });

    client.on('error', (err) => {
      console.error('[Gateway] MQTT error:', err);
      reject(err);
    });
  });
}

export function publish(topic: string, payload: object, options?: { qos?: 0 | 1 | 2; retain?: boolean }): void {
  if (!client?.connected) return;
  client.publish(topic, JSON.stringify(payload), { qos: options?.qos ?? 1, retain: options?.retain ?? true });
}

export function subscribe(topic: string, handler: (topic: string, payload: Buffer) => void): void {
  if (!client?.connected) return;
  client.subscribe(topic, { qos: 1 }, (err) => {
    if (err) console.error('[Gateway] MQTT subscribe error:', err);
  });
  client.on('message', (t, payload) => {
    if (topic === t || topicMatches(topic, t)) handler(t, payload);
  });
}

function topicMatches(pattern: string, topic: string): boolean {
  if (pattern === topic) return true;
  const re = new RegExp('^' + pattern.replace(/\/\+/g, '/[^/]+').replace(/\/#/, '/.*') + '$');
  return re.test(topic);
}

export function disconnectMqtt(): void {
  if (client) {
    client.end();
    client = null;
    console.log('[Gateway] MQTT disconnected');
  }
}
