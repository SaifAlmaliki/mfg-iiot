import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/maintenance - List maintenance logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const equipmentId = searchParams.get('equipmentId');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');

    const maintenanceLogs = await db.maintenanceLog.findMany({
      where: {
        ...(equipmentId && { equipmentId }),
        ...(type && { type }),
      },
      include: {
        equipment: {
          select: { id: true, name: true, code: true, type: true },
        },
      },
      orderBy: { performedAt: 'desc' },
      take: limit,
    });

    return NextResponse.json(maintenanceLogs);
  } catch (error) {
    console.error('Error fetching maintenance logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch maintenance logs' },
      { status: 500 }
    );
  }
}

// POST /api/maintenance - Create a maintenance log
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type,
      workOrder,
      description,
      performedBy,
      performedAt,
      nextDueDate,
      cost,
      laborHours,
      downtimeHours,
      parts,
      notes,
      equipmentId,
    } = body;

    // Validate required fields
    if (!type || !description || !equipmentId) {
      return NextResponse.json(
        { error: 'Missing required fields: type, description, equipmentId' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE', 'EMERGENCY'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify equipment exists
    const equipment = await db.equipment.findUnique({
      where: { id: equipmentId },
    });

    if (!equipment) {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      );
    }

    const maintenanceLog = await db.maintenanceLog.create({
      data: {
        type,
        workOrder: workOrder || null,
        description,
        performedBy: performedBy || null,
        performedAt: performedAt ? new Date(performedAt) : new Date(),
        nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
        cost: cost ? parseFloat(cost) : null,
        laborHours: laborHours ? parseFloat(laborHours) : null,
        downtimeHours: downtimeHours ? parseFloat(downtimeHours) : null,
        parts: parts ? (typeof parts === 'string' ? JSON.parse(parts) : parts) : null,
        notes: notes || null,
        equipmentId,
      },
      include: {
        equipment: {
          select: { id: true, name: true, code: true, type: true },
        },
      },
    });

    return NextResponse.json(maintenanceLog, { status: 201 });
  } catch (error) {
    console.error('Error creating maintenance log:', error);
    return NextResponse.json(
      { error: 'Failed to create maintenance log' },
      { status: 500 }
    );
  }
}
