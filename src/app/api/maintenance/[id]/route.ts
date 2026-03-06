import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/maintenance/[id] - Get a single maintenance log
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const maintenanceLog = await db.maintenanceLog.findUnique({
      where: { id },
      include: {
        equipment: {
          select: { id: true, name: true, code: true, type: true },
        },
      },
    });

    if (!maintenanceLog) {
      return NextResponse.json(
        { error: 'Maintenance log not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(maintenanceLog);
  } catch (error) {
    console.error('Error fetching maintenance log:', error);
    return NextResponse.json(
      { error: 'Failed to fetch maintenance log' },
      { status: 500 }
    );
  }
}

// PUT /api/maintenance/[id] - Update a maintenance log
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Check if maintenance log exists
    const existingLog = await db.maintenanceLog.findUnique({
      where: { id },
    });

    if (!existingLog) {
      return NextResponse.json(
        { error: 'Maintenance log not found' },
        { status: 404 }
      );
    }

    // Validate type if provided
    if (type) {
      const validTypes = ['PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE', 'EMERGENCY'];
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Verify equipment exists if equipmentId is being changed
    if (equipmentId && equipmentId !== existingLog.equipmentId) {
      const equipment = await db.equipment.findUnique({
        where: { id: equipmentId },
      });

      if (!equipment) {
        return NextResponse.json(
          { error: 'Equipment not found' },
          { status: 404 }
        );
      }
    }

    const maintenanceLog = await db.maintenanceLog.update({
      where: { id },
      data: {
        ...(type !== undefined && { type }),
        ...(workOrder !== undefined && { workOrder: workOrder || null }),
        ...(description !== undefined && { description }),
        ...(performedBy !== undefined && { performedBy: performedBy || null }),
        ...(performedAt !== undefined && {
          performedAt: performedAt ? new Date(performedAt) : existingLog.performedAt,
        }),
        ...(nextDueDate !== undefined && {
          nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
        }),
        ...(cost !== undefined && { cost: cost ? parseFloat(cost) : null }),
        ...(laborHours !== undefined && {
          laborHours: laborHours ? parseFloat(laborHours) : null,
        }),
        ...(downtimeHours !== undefined && {
          downtimeHours: downtimeHours ? parseFloat(downtimeHours) : null,
        }),
        ...(parts !== undefined && {
          parts: parts ? (typeof parts === 'string' ? JSON.parse(parts) : parts) : null,
        }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(equipmentId !== undefined && { equipmentId }),
      },
      include: {
        equipment: {
          select: { id: true, name: true, code: true, type: true },
        },
      },
    });

    return NextResponse.json(maintenanceLog);
  } catch (error) {
    console.error('Error updating maintenance log:', error);
    return NextResponse.json(
      { error: 'Failed to update maintenance log' },
      { status: 500 }
    );
  }
}

// DELETE /api/maintenance/[id] - Delete a maintenance log
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if maintenance log exists
    const existingLog = await db.maintenanceLog.findUnique({
      where: { id },
    });

    if (!existingLog) {
      return NextResponse.json(
        { error: 'Maintenance log not found' },
        { status: 404 }
      );
    }

    await db.maintenanceLog.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Maintenance log deleted successfully' });
  } catch (error) {
    console.error('Error deleting maintenance log:', error);
    return NextResponse.json(
      { error: 'Failed to delete maintenance log' },
      { status: 500 }
    );
  }
}
