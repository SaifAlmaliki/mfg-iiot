import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession, hasPermission } from '@/lib/auth-config';
import { PERMISSIONS } from '@/lib/permissions';

// GET /api/hmi/symbols/[id] (requires scada.view)
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
    const symbol = await db.hmiSymbol.findUnique({ where: { id } });

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol not found' }, { status: 404 });
    }

    return NextResponse.json(symbol);
  } catch (error) {
    console.error('Error fetching HMI symbol:', error);
    return NextResponse.json({ error: 'Failed to fetch symbol' }, { status: 500 });
  }
}

// PUT /api/hmi/symbols/[id] - Update custom symbol only (requires scada.edit)
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
    const existing = await db.hmiSymbol.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: 'Symbol not found' }, { status: 404 });
    }
    if (existing.isPredefined) {
      return NextResponse.json(
        { error: 'Cannot update predefined symbol' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, category, svg } = body;

    const symbol = await db.hmiSymbol.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(svg !== undefined && { svg: String(svg) }),
      },
    });

    return NextResponse.json(symbol);
  } catch (error) {
    console.error('Error updating HMI symbol:', error);
    return NextResponse.json({ error: 'Failed to update symbol' }, { status: 500 });
  }
}

// DELETE /api/hmi/symbols/[id] - Delete custom symbol only (requires scada.edit)
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
    const existing = await db.hmiSymbol.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: 'Symbol not found' }, { status: 404 });
    }
    if (existing.isPredefined) {
      return NextResponse.json(
        { error: 'Cannot delete predefined symbol' },
        { status: 400 }
      );
    }

    await db.hmiSymbol.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting HMI symbol:', error);
    return NextResponse.json({ error: 'Failed to delete symbol' }, { status: 500 });
  }
}
