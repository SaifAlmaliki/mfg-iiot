import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession, hasPermission } from '@/lib/auth-config';
import { PERMISSIONS } from '@/lib/permissions';
import { validateElementsForWrite } from '@/lib/hmi-validation';

// GET /api/hmi/graphics - List graphics (requires scada.view)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasPermission(session, PERMISSIONS.SCADA_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    const where = name ? { name: { contains: name, mode: 'insensitive' as const } } : {};

    const [graphics, total] = await Promise.all([
      db.hmiGraphic.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          width: true,
          height: true,
          createdAt: true,
          updatedAt: true,
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      db.hmiGraphic.count({ where }),
    ]);

    return NextResponse.json({ data: graphics, total, page, limit });
  } catch (error) {
    console.error('Error listing HMI graphics:', error);
    return NextResponse.json({ error: 'Failed to fetch graphics' }, { status: 500 });
  }
}

// POST /api/hmi/graphics - Create graphic (requires scada.edit)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasPermission(session, PERMISSIONS.SCADA_EDIT)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, width, height, metadata, elements } = body;

    if (!name || width == null || height == null) {
      return NextResponse.json(
        { error: 'name, width, and height are required' },
        { status: 400 }
      );
    }

    const validationError = await validateElementsForWrite(elements);
    if (validationError) {
      return NextResponse.json(validationError, { status: 400 });
    }

    const graphic = await db.hmiGraphic.create({
      data: {
        name,
        description: description ?? null,
        width: Number(width),
        height: Number(height),
        metadata: metadata ?? undefined,
        createdById: session.id,
        elements: elements?.length
          ? {
              create: elements.map((el: { symbolId: string; x?: number; y?: number; width?: number; height?: number; rotation?: number; zIndex?: number; props?: object }) => ({
                symbolId: el.symbolId,
                x: el.x ?? 0,
                y: el.y ?? 0,
                width: el.width ?? 100,
                height: el.height ?? 100,
                rotation: el.rotation ?? 0,
                zIndex: el.zIndex ?? 0,
                props: el.props ?? {},
              })),
            }
          : undefined,
      },
      include: {
        elements: { include: { symbol: { select: { id: true, name: true, category: true, svg: true } } } },
      },
    });

    return NextResponse.json(graphic, { status: 201 });
  } catch (error) {
    console.error('Error creating HMI graphic:', error);
    return NextResponse.json({ error: 'Failed to create graphic' }, { status: 500 });
  }
}
