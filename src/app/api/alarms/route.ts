import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/alarms - List all alarms
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const equipmentId = searchParams.get('equipmentId');
    
    const alarms = await db.alarm.findMany({
      where: {
        ...(state && { state }),
        ...(equipmentId && { equipmentId })
      },
      include: {
        definition: {
          include: {
            tag: { select: { name: true, address: true } }
          }
        },
        equipment: { select: { name: true, code: true } }
      },
      orderBy: { activatedAt: 'desc' }
    });
    
    return NextResponse.json(alarms);
  } catch (error) {
    console.error('Error fetching alarms:', error);
    return NextResponse.json({ error: 'Failed to fetch alarms' }, { status: 500 });
  }
}

// POST /api/alarms - Create a new alarm (typically from SCADA system)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { definitionId, value, message, equipmentId } = body;
    
    const alarm = await db.alarm.create({
      data: {
        definitionId,
        value,
        message,
        equipmentId,
        state: 'ACTIVE'
      },
      include: {
        definition: true
      }
    });
    
    return NextResponse.json(alarm, { status: 201 });
  } catch (error) {
    console.error('Error creating alarm:', error);
    return NextResponse.json({ error: 'Failed to create alarm' }, { status: 500 });
  }
}
