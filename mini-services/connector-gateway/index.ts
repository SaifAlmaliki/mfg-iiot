/**
 * Connector Gateway – one process, many connectors from DB.
 * Config from platform UI (DB). Env: DATABASE_URL only (MQTT from Settings > Integrations).
 *
 * Run from repo root: npm run connector  (or bun run mini-services/connector-gateway/index.ts)
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { connectMqtt, disconnectMqtt, isMqttConnected } from './lib/mqtt';
import { db, fetchPlatformMqttConfig } from './lib/db';
import { Orchestrator } from './orchestrator';

// Load .env from repo root (DATABASE_URL only)
const envPath = resolve(process.cwd(), '.env');
config({ path: envPath });

async function main(): Promise<void> {
  console.log('[Gateway] UNS Connector Gateway starting…');

  await db.$connect();
  console.log('[Gateway] DB connected');

  const mqttCfg = await fetchPlatformMqttConfig();
  if (mqttCfg) {
    await connectMqtt(mqttCfg).catch((err) => {
      console.error('[Gateway] MQTT connect failed:', err);
    });
  }
  if (!isMqttConnected()) {
    console.warn('[Gateway] MQTT not configured or not connected. Set MQTT broker URL in platform Settings > Integrations.');
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
