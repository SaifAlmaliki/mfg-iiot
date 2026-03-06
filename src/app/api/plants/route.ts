import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/plants - List all plants
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    
    const plants = await db.plant.findMany({
      where: organizationId ? { organizationId } : undefined,
      include: {
        _count: {
          select: { lines: true, equipment: true, edgeConnectors: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    return NextResponse.json(plants);
  } catch (error) {
    console.error('Error fetching plants:', error);
    return NextResponse.json({ error: 'Failed to fetch plants' }, { status: 500 });
  }
}

// POST /api/plants - Create a new plant
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code, location, timezone, organizationId } = body;
    
    const plant = await db.plant.create({
      data: {
        name,
        code,
        location,
        timezone: timezone || 'UTC',
        organizationId
      }
    });
    
    return NextResponse.json(plant, { status: 201 });
  } catch (error) {
    console.error('Error creating plant:', error);
    return NextResponse.json({ error: 'Failed to create plant' }, { status: 500 });
  }
}
