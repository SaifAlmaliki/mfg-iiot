import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-config';
import { db } from '@/lib/db';

const DATA_TYPE_MAP: Record<string, string> = {
  Double: 'FLOAT64',
  Int32: 'INT32',
  Int16: 'INT16',
  Float: 'FLOAT32',
  Boolean: 'BOOL',
  String: 'STRING',
  Int64: 'INT64',
  UInt32: 'UINT32',
};

function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();
}

function inferWorkCenter(workUnit: string): string {
  const w = workUnit.toLowerCase();
  if (w.includes('robot')) return 'ROBOTICS';
  if (w.includes('machine') || w.includes('cnc')) return 'MACHINING';
  if (w.includes('boiler') || w.includes('reactor')) return 'PROCESS';
  if (w.includes('meter') || w.includes('panel')) return 'UTILITIES';
  return 'LINE-01';
}

/**
 * Derive workUnit and attribute from OPC-UA nodeId (e.g. "ns=1;s=Machine1.FeedRate" -> Machine1, FeedRate).
 */
function deriveWorkUnitAndAttribute(nodeId: string): { workUnit: string; attribute: string } {
  const s = nodeId.replace(/^ns=\d+;s=/, '');
  const parts = s.split('.');
  if (parts.length >= 2) {
    const workUnit = parts[0];
    const attribute = parts.slice(1).join('_');
    return { workUnit, attribute: attribute || workUnit };
  }
  return { workUnit: 'Equipment', attribute: s || 'Value' };
}

/**
 * POST /api/connectors/[id]/mappings-from-browse
 * Create tag mappings from live OPC-UA browse result. Creates Tags and TagMappings for the connector.
 * Body: { nodes: { nodeId, displayName, dataType?, description? }[] }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: connectorId } = await context.params;
    const connector = await db.edgeConnector.findUnique({
      where: { id: connectorId, isActive: true },
      include: { site: { include: { enterprise: true } } },
    });

    if (!connector) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
    }

    const body = await request.json();
    const nodes = body?.nodes;
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return NextResponse.json({ error: 'nodes array is required' }, { status: 400 });
    }

    const enterpriseCode = connector.site?.enterprise?.code ?? 'ACME';
    const siteCode = connector.site?.code ?? 'SITE';
    const areaCode = 'PRODUCTION';
    const created: { tagId: string; mappingId: string; sourceAddress: string; mqttTopic: string }[] = [];
    const skipped: { sourceAddress: string; reason: string }[] = [];

    for (const node of nodes) {
      const sourceAddress = node.nodeId ?? node.sourceAddress;
      if (!sourceAddress) {
        skipped.push({ sourceAddress: '', reason: 'missing nodeId' });
        continue;
      }

      const existingMapping = await db.tagMapping.findFirst({
        where: { connectorId, sourceAddress },
      });
      if (existingMapping) {
        skipped.push({ sourceAddress, reason: 'mapping already exists' });
        continue;
      }

      const { workUnit, attribute } = deriveWorkUnitAndAttribute(sourceAddress);
      const workCenterCode = inferWorkCenter(workUnit);
      const tagName = node.displayName || node.browseName || attribute;
      const attributePart = sanitizeName(attribute || tagName);
      const workUnitPart = sanitizeName(workUnit);
      const mqttTopic = [enterpriseCode, siteCode, areaCode, workCenterCode, workUnitPart, attributePart].join('/');
      const dataType = DATA_TYPE_MAP[node.dataType] ?? 'STRING';

      // Option C enrichment: link Tag to Equipment/WorkUnit when possible for richer context in data-persister
      let equipmentId: string | null = null;
      let workUnitId: string | null = null;
      const equipment = await db.equipment.findFirst({
        where: { code: workUnit, isActive: true },
        select: { id: true, workUnitId: true },
      });
      if (equipment) {
        equipmentId = equipment.id;
        workUnitId = equipment.workUnitId;
      }

      let tag = await db.tag.findFirst({
        where: { mqttTopic },
      });
      if (!tag) {
        tag = await db.tag.create({
          data: {
            name: tagName,
            mqttTopic,
            dataType,
            engUnit: node.engUnit ?? null,
            description: node.description ?? null,
            scanRate: 1000,
            isActive: true,
            edgeConnectorId: connectorId,
            equipmentId,
            workUnitId,
          },
        });
      }

      const mapping = await db.tagMapping.create({
        data: {
          sourceAddress,
          sourceType: 'TAG',
          sourceDataType: node.dataType ?? null,
          scale: null,
          offset: null,
          swapBytes: false,
          isActive: true,
          connectorId,
          tagId: tag.id,
        },
      });

      created.push({
        tagId: tag.id,
        mappingId: mapping.id,
        sourceAddress,
        mqttTopic,
      });
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      skipped: skipped.length,
      createdItems: created,
      skippedItems: skipped,
    });
  } catch (error) {
    console.error('[API] POST /api/connectors/[id]/mappings-from-browse error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create mappings' },
      { status: 500 }
    );
  }
}
