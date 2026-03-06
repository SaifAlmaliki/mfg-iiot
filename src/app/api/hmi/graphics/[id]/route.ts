import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession, hasPermission } from '@/lib/auth-config';
import { PERMISSIONS } from '@/lib/permissions';
import { validateElementsForWrite } from '@/lib/hmi-validation';

// GET /api/hmi/graphics/[id] - Get single graphic with elements and symbols (requires scada.view)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasPermission(session, PERMISSIONS.SCADA_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const graphic = await db.hmiGraphic.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        elements: {
          include: {
            symbol: true,
          },
          orderBy: { zIndex: 'asc' },
        },
      },
    });

    if (!graphic) {
      return NextResponse.json({ error: 'Graphic not found' }, { status: 404 });
    }

    return NextResponse.json(graphic);
  } catch (error) {
    console.error('Error fetching HMI graphic:', error);
    return NextResponse.json({ error: 'Failed to fetch graphic' }, { status: 500 });
  }
}

// PUT /api/hmi/graphics/[id] - Update graphic (requires scada.edit)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasPermission(session, PERMISSIONS.SCADA_EDIT)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, width, height, metadata, elements } = body;

    const existing = await db.hmiGraphic.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Graphic not found' }, { status: 404 });
    }

    if (elements !== undefined && Array.isArray(elements)) {
      const validationError = await validateElementsForWrite(elements);
      if (validationError) {
        return NextResponse.json(validationError, { status: 400 });
      }
    }

    // If elements provided, replace all; otherwise leave elements unchanged
    if (elements !== undefined && Array.isArray(elements)) {
      await db.hmiGraphicElement.deleteMany({ where: { graphicId: id } });
    }

    const graphic = await db.hmiGraphic.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(width !== undefined && { width: Number(width) }),
        ...(height !== undefined && { height: Number(height) }),
        ...(metadata !== undefined && { metadata }),
        ...(elements !== undefined && Array.isArray(elements) && elements.length > 0
          ? {
              elements: {
                create: elements.map(
              (el: {
                symbolId: string;
                x?: number;
                y?: number;
                width?: number;
                height?: number;
                rotation?: number;
                zIndex?: number;
                props?: object;
              }) => ({
                symbolId: el.symbolId,
                x: el.x ?? 0,
                y: el.y ?? 0,
                width: el.width ?? 100,
                height: el.height ?? 100,
                rotation: el.rotation ?? 0,
                zIndex: el.zIndex ?? 0,
                props: (el.props as object) ?? {},
              })
            ),
              },
            }
          : {}),
      },
      include: {
        elements: { include: { symbol: { select: { id: true, name: true, category: true, svg: true } } } },
      },
    });

    return NextResponse.json(graphic);
  } catch (error) {
    console.error('Error updating HMI graphic:', error);
    return NextResponse.json({ error: 'Failed to update graphic' }, { status: 500 });
  }
}

// DELETE /api/hmi/graphics/[id] (requires scada.edit)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasPermission(session, PERMISSIONS.SCADA_EDIT)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.hmiGraphic.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Graphic not found' }, { status: 404 });
    }

    await db.hmiGraphic.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting HMI graphic:', error);
    return NextResponse.json({ error: 'Failed to delete graphic' }, { status: 500 });
  }
}
