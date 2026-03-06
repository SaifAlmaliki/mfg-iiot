import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/lines - List all production lines
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plantId');
    
    const lines = await db.productionLine.findMany({
      where: plantId ? { plantId } : undefined,
      include: {
        plant: { select: { name: true, code: true } },
        _count: {
          select: { units: true, equipment: true, batches: true, orders: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    return NextResponse.json(lines);
  } catch (error) {
    console.error('Error fetching lines:', error);
    return NextResponse.json({ error: 'Failed to fetch production lines' }, { status: 500 });
  }
}

// POST /api/lines - Create a new production line
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code, description, capacity, plantId } = body;
    
    const line = await db.productionLine.create({
      data: {
        name,
        code,
        description,
        capacity,
        plantId
      }
    });
    
    return NextResponse.json(line, { status: 201 });
  } catch (error) {
    console.error('Error creating production line:', error);
    return NextResponse.json({ error: 'Failed to create production line' }, { status: 500 });
  }
}
