import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/genealogy - List all genealogy events
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');
    const relationship = searchParams.get('relationship');
    
    const genealogy = await db.genealogy.findMany({
      where: {
        ...(lotId && {
          OR: [
            { fromLotId: lotId },
            { toLotId: lotId }
          ]
        }),
        ...(relationship && { relationship })
      },
      include: {
        fromLot: {
          include: { product: { select: { name: true, code: true } } }
        },
        toLot: {
          include: { product: { select: { name: true, code: true } } }
        },
        run: {
          select: { runNumber: true, status: true }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 100
    });
    
    // Serialize dates
    const serialized = genealogy.map(g => ({
      ...g,
      timestamp: g.timestamp.toISOString()
    }));
    
    return NextResponse.json(serialized);
  } catch (error) {
    console.error('Error fetching genealogy:', error);
    return NextResponse.json({ error: 'Failed to fetch genealogy' }, { status: 500 });
  }
}

// POST /api/genealogy - Create a genealogy record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { relationship, quantity, notes, runId, fromLotId, toLotId } = body;
    
    if (!relationship || !fromLotId || !toLotId) {
      return NextResponse.json(
        { error: 'Relationship, fromLotId, and toLotId are required' },
        { status: 400 }
      );
    }
    
    const genealogy = await db.genealogy.create({
      data: {
        relationship,
        quantity: quantity ? parseFloat(quantity) : null,
        notes: notes || null,
        runId: runId || null,
        fromLotId,
        toLotId
      },
      include: {
        fromLot: { include: { product: true } },
        toLot: { include: { product: true } }
      }
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'Genealogy',
        entityId: genealogy.id,
        newValue: genealogy,
        details: { message: `Created genealogy record: ${relationship}` }
      }
    });
    
    return NextResponse.json({
      ...genealogy,
      timestamp: genealogy.timestamp.toISOString()
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating genealogy:', error);
    return NextResponse.json({ error: 'Failed to create genealogy record' }, { status: 500 });
  }
}
