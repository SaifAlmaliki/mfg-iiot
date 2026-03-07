/**
 * Connector Gateway – one process, many connectors from DB.
 * No .env for endpoints: all config from platform UI (DB).
 * Platform env only: DATABASE_URL, MQTT_BROKER_URL.
 *
 * Run from repo root: npm run connector  (or bun run mini-services/connector-gateway/index.ts)
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { connectMqtt, disconnectMqtt, isMqttConnected } from './lib/mqtt';
import { db } from './lib/db';
import { Orchestrator } from './orchestrator';

// Load .env from repo root (only DATABASE_URL, MQTT_BROKER_URL)
const envPath = resolve(process.cwd(), '.env');
config({ path: envPath });

async function main(): Promise<void> {
  console.log('[Gateway] UNS Connector Gateway starting…');

  await db.$connect();
  console.log('[Gateway] DB connected');

  await connectMqtt();
  if (!isMqttConnected()) {
    console.warn('[Gateway] MQTT not connected; runners will not publish until MQTT is up.');
  }

  const orchestrator = new Orchestrator();
  orchestrator.start();

  const shutdown = async (): Promise<void> => {
    console.log('[Gateway] Shutting down…');
    await orchestrator.stop();
    disconnectMqtt();
    await db.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  console.log('[Gateway] Ready. Connectors are driven from the platform DB.');
}

main().catch((err) => {
  console.error('[Gateway] Fatal:', err);
  process.exit(1);
});
