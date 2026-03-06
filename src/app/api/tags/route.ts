import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/tags - List all tags
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unitId = searchParams.get('unitId');
    const equipmentId = searchParams.get('equipmentId');
    
    const tags = await db.tag.findMany({
      where: {
        ...(unitId && { unitId }),
        ...(equipmentId && { equipmentId })
      },
      include: {
        unit: { select: { name: true, code: true } },
        equipment: { select: { name: true, code: true } },
        values: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      },
      orderBy: { name: 'asc' }
    });
    
    return NextResponse.json(tags.map(tag => ({
      ...tag,
      currentValue: tag.values[0] || null
    })));
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}

// POST /api/tags - Create a new tag
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, address, dataType, engUnit, description, scanRate, minVal, maxVal, deadband, isWritable, unitId, equipmentId } = body;
    
    const tag = await db.tag.create({
      data: {
        name,
        address,
        dataType,
        engUnit,
        description,
        scanRate: scanRate || 1000,
        minVal,
        maxVal,
        deadband,
        isWritable: isWritable || false,
        unitId,
        equipmentId
      }
    });
    
    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error('Error creating tag:', error);
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
  }
}
