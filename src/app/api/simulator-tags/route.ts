import { NextRequest, NextResponse } from 'next/server';
import { createTagMappingGenerator, getSimulatorsConfigPath } from '@/lib/tag-mapping-generator';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth-config';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const simulatorId = searchParams.get('simulatorId');

    if (!siteId) {
      return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
    }

    const site = await db.site.findUnique({
      where: { id: siteId },
      include: { enterprise: true },
    });

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const configPath = getSimulatorsConfigPath();
    const generator = createTagMappingGenerator(
      {
        enterpriseCode: site.enterprise.code,
        siteCode: site.code,
      },
      configPath
    );

    let mappings = generator.generateMappings();

    if (simulatorId) {
      mappings = mappings.filter((m) => m.simulatorId === simulatorId);
    }

    const existingTags = await db.tag.findMany({
      where: { mqttTopic: { in: mappings.map((m) => m.mqttTopic) } },
      select: { mqttTopic: true },
    });

    const existingTopics = new Set(existingTags.map((t) => t.mqttTopic));

    const result = mappings.map((mapping) => ({
      ...mapping,
      exists: existingTopics.has(mapping.mqttTopic),
    }));

    return NextResponse.json({
      total: result.length,
      pending: result.filter((m) => !m.exists && m.status === 'pending').length,
      mappings: result,
    });
  } catch (error) {
    console.error('[API] GET /api/simulator-tags error:', error);
    return NextResponse.json(
      { error: 'Failed to discover simulator tags' },
      { status: 500 }
    );
  }
}
