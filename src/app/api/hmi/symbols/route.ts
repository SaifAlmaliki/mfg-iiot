import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession, hasPermission } from '@/lib/auth-config';
import { PERMISSIONS } from '@/lib/permissions';

// GET /api/hmi/symbols - List all symbols (predefined + custom) (requires scada.view)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasPermission(session, PERMISSIONS.SCADA_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const symbols = await db.hmiSymbol.findMany({
      orderBy: [{ isPredefined: 'desc' }, { category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        category: true,
        svg: true,
        isPredefined: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(symbols);
  } catch (error) {
    console.error('Error listing HMI symbols:', error);
    return NextResponse.json({ error: 'Failed to fetch symbols' }, { status: 500 });
  }
}

// POST /api/hmi/symbols - Create custom symbol (requires scada.edit)
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
    const { name, category, svg } = body;

    if (!name || !category || !svg) {
      return NextResponse.json(
        { error: 'name, category, and svg are required' },
        { status: 400 }
      );
    }

    const symbol = await db.hmiSymbol.create({
      data: {
        name,
        category,
        svg: String(svg),
        isPredefined: false,
        createdById: session.id,
      },
    });

    return NextResponse.json(symbol, { status: 201 });
  } catch (error) {
    console.error('Error creating HMI symbol:', error);
    return NextResponse.json({ error: 'Failed to create symbol' }, { status: 500 });
  }
}
