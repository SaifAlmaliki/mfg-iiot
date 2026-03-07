import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth-config';
import { getSimulatorsConfigPath, createTagMappingGenerator } from '@/lib/tag-mapping-generator';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const status = searchParams.get('status') || 'pending';

    if (!siteId) {
      return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
    }

    const pendingMappings = await db.$queryRaw<{ id: string; data: any; status: string; createdAt: Date }[]>`
      SELECT id, data, status, "createdAt"
      FROM pending_tag_mappings
      WHERE "siteId" = ${siteId}
      AND status = ${status}
      ORDER BY "createdAt" DESC
    `;

    return NextResponse.json({
      total: pendingMappings.length,
      mappings: pendingMappings.map((m) => ({
        id: m.id,
        ...m.data,
        status: m.status,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error('[API] GET /api/mapping-review error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending mappings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, siteId, connectorId, mappings } = body;

    if (!action || !siteId || !mappings || !Array.isArray(mappings)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const site = await db.site.findUnique({
      where: { id: siteId },
      include: { enterprise: true },
    });

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    if (action === 'save_pending') {
      const results: Array<{ id: string; success: boolean; error?: string }> = [];

      for (const mapping of mappings) {
        try {
          await db.$executeRaw`
            INSERT INTO pending_tag_mappings (id, "siteId", data, status, "createdAt")
            VALUES (${mapping.id}, ${siteId}, ${JSON.stringify(mapping)}, 'pending', NOW())
            ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(mapping)}
          `;
          results.push({ id: mapping.id, success: true });
        } catch (error) {
          results.push({ id: mapping.id, success: false, error: String(error) });
        }
      }

      return NextResponse.json({
        message: `Saved ${results.filter(r => r.success).length} pending mappings`,
        results,
      });
    }

    if (action === 'approve') {
      const results: Array<{ id: string; success: boolean; tagId?: string; error?: string }> = [];
      let connector = connectorId
        ? await db.edgeConnector.findUnique({ where: { id: connectorId } })
        : null;

      for (const mapping of mappings) {
        try {
          let tag = await db.tag.findFirst({
            where: { mqttTopic: mapping.mqttTopic },
          });

          if (!tag) {
            tag = await db.tag.create({
              data: {
                name: mapping.tagName,
                mqttTopic: mapping.mqttTopic,
                dataType: mapping.dataType,
                engUnit: mapping.engUnit || null,
                description: mapping.description || null,
                scanRate: 1000,
                isActive: true,
              },
            });
          }

          if (!connector && mapping.simulatorType) {
            const connectorCode = `${mapping.simulatorId}`.toUpperCase().replace(/-/g, '_');
            const existingConnector = await db.edgeConnector.findFirst({
              where: { code: connectorCode },
            });

            if (!existingConnector) {
              connector = await db.edgeConnector.create({
                data: {
                  name: mapping.simulatorName,
                  code: connectorCode,
                  type: mapping.simulatorType,
                  endpoint: `localhost:${mapping.simulatorPort}`,
                  siteId,
                  status: 'OFFLINE',
                  heartbeatRate: 30,
                  isActive: true,
                },
              });
            } else {
              connector = existingConnector;
            }
          }

          if (connector) {
            const existingMapping = await db.tagMapping.findFirst({
              where: {
                connectorId: connector.id,
                sourceAddress: mapping.sourceAddress,
              },
            });

            if (!existingMapping) {
              await db.tagMapping.create({
                data: {
                  sourceAddress: mapping.sourceAddress,
                  sourceType: mapping.sourceType,
                  sourceDataType: mapping.sourceDataType || null,
                  scale: mapping.scale || null,
                  offset: mapping.offset || null,
                  swapBytes: false,
                  isActive: true,
                  connectorId: connector.id,
                  tagId: tag.id,
                },
              });
            }
          }

          await db.$executeRaw`
            UPDATE pending_tag_mappings
            SET status = 'approved'
            WHERE id = ${mapping.id}
          `;

          results.push({ id: mapping.id, success: true, tagId: tag.id });
        } catch (error) {
          results.push({ id: mapping.id, success: false, error: String(error) });
        }
      }

      return NextResponse.json({
        message: `Approved ${results.filter((r: any) => r.success).length} mappings`,
        results,
      });
    }

    if (action === 'reject') {
      for (const mapping of mappings) {
        await db.$executeRaw`
          UPDATE pending_tag_mappings
          SET status = 'rejected'
          WHERE id = ${mapping.id}
        `;
      }

      return NextResponse.json({
        message: `Rejected ${mappings.length} mappings`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[API] POST /api/mapping-review error:', error);
    return NextResponse.json(
      { error: 'Failed to process mapping review' },
      { status: 500 }
    );
  }
}
