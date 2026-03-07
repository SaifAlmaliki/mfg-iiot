/**
 * DB access for connector gateway. Reads connectors and updates status.
 * Only platform config from env: DATABASE_URL.
 * Prisma client resolved from repo root (run from root: npm run connector).
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client/client';

const databaseUrl = (process.env.DATABASE_URL ?? '')
  .replace(/^["']|["']$/g, '')
  .trim()
  .replace(/sslmode=(prefer|require|verify-ca)/gi, 'sslmode=verify-full');
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for the connector gateway');
}

const adapter = new PrismaPg({ connectionString: databaseUrl });

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

export type ConnectorWithMappings = Awaited<ReturnType<typeof fetchActiveConnectors>>[number];

export async function fetchActiveConnectors(): Promise<
  Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    protocol: string | null;
    endpoint: string;
    config: unknown;
    status: string;
    heartbeatRate: number;
    siteId: string;
    site: { id: string; name: string; code: string } | null;
    tagMappings: Array<{
      id: string;
      sourceAddress: string;
      sourceType: string;
      sourceDataType: string | null;
      scale: number | null;
      offset: number | null;
      swapBytes: boolean;
      isActive: boolean;
      tag: {
        id: string;
        name: string;
        mqttTopic: string;
        dataType: string;
        engUnit: string | null;
      };
    }>;
  }>
> {
  return db.edgeConnector.findMany({
    where: { isActive: true },
    include: {
      site: { select: { id: true, name: true, code: true } },
      tagMappings: {
        where: { isActive: true },
        include: {
          tag: { select: { id: true, name: true, mqttTopic: true, dataType: true, engUnit: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
}

export async function updateConnectorStatus(connectorId: string, status: string): Promise<void> {
  await db.edgeConnector.update({
    where: { id: connectorId },
    data: { status, lastSeen: new Date() },
  });
}

export async function recordConnectorMetric(
  connectorId: string,
  data: { messagesRead: number; messagesError: number; latencyMs: number }
): Promise<void> {
  await db.connectorMetric.create({
    data: {
      connectorId,
      messagesRead: data.messagesRead,
      messagesError: data.messagesError,
      latencyMs: data.latencyMs,
    },
  });
}

const MQTT_URL_KEY = 'mqtt.broker.url';
const MQTT_CLIENT_ID_KEY = 'mqtt.client.id';

export interface PlatformMqttConfig {
  url: string;
  clientId?: string;
}

export async function fetchPlatformMqttConfig(): Promise<PlatformMqttConfig | null> {
  const rows = await db.systemConfig.findMany({
    where: { key: { in: [MQTT_URL_KEY, MQTT_CLIENT_ID_KEY] } },
    select: { key: true, value: true },
  });
  const url = rows.find((r) => r.key === MQTT_URL_KEY)?.value;
  const urlStr = typeof url === 'string' ? url.trim() : null;
  if (!urlStr) return null;
  const clientIdRow = rows.find((r) => r.key === MQTT_CLIENT_ID_KEY)?.value;
  const clientId = typeof clientIdRow === 'string' ? clientIdRow.trim() || undefined : undefined;
  return { url: urlStr, clientId };
}
