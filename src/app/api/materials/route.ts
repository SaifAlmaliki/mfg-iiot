import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/materials - List all materials
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const organizationId = searchParams.get('organizationId');
    
    const materials = await db.material.findMany({
      where: {
        ...(type && { type }),
        ...(organizationId && { organizationId })
      },
      include: {
        lots: {
          where: { remainingQty: { gt: 0 } },
          select: { id: true, lotNumber: true, remainingQty: true, status: true }
        },
        _count: {
          select: { lots: true, recipeMaterials: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    return NextResponse.json(materials);
  } catch (error) {
    console.error('Error fetching materials:', error);
    return NextResponse.json({ error: 'Failed to fetch materials' }, { status: 500 });
  }
}

// POST /api/materials - Create a new material
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code, type, unit, description, organizationId } = body;
    
    const material = await db.material.create({
      data: {
        name,
        code,
        type,
        unit,
        description,
        organizationId
      }
    });
    
    return NextResponse.json(material, { status: 201 });
  } catch (error) {
    console.error('Error creating material:', error);
    return NextResponse.json({ error: 'Failed to create material' }, { status: 500 });
  }
}
