import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/workunits - List all work units
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workCenterId = searchParams.get('workCenterId');
    const areaId = searchParams.get('areaId');
    const siteId = searchParams.get('siteId');
    
    // Build where clause based on hierarchy
    let whereClause: any = {};
    if (siteId) {
      whereClause = { workCenter: { area: { siteId } } };
    } else if (areaId) {
      whereClause = { workCenter: { areaId } };
    } else if (workCenterId) {
      whereClause = { workCenterId };
    }
    
    const workUnits = await db.workUnit.findMany({
      where: whereClause,
      include: {
        workCenter: { 
          select: { id: true, name: true, code: true, 
            area: { select: { id: true, name: true, code: true, siteId: true } }
          } 
        },
        _count: { select: { tags: true, equipment: true } }
      },
      orderBy: [{ sequenceNumber: 'asc' }, { name: 'asc' }]
    });
    
    return NextResponse.json(workUnits);
  } catch (error) {
    console.error('Error fetching work units:', error);
    return NextResponse.json({ error: 'Failed to fetch work units' }, { status: 500 });
  }
}

// POST /api/workunits - Create a new work unit
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    if (!data.workCenterId) {
      return NextResponse.json({ error: 'Work Center ID is required' }, { status: 400 });
    }
    
    const workUnit = await db.workUnit.create({
      data: {
        name: data.name,
        code: data.code || data.name?.toUpperCase().replace(/\s+/g, '_'),
        description: data.description,
        type: data.type || 'OTHER',
        sequenceNumber: data.sequenceNumber ? parseInt(data.sequenceNumber) : null,
        linePosition: data.linePosition,
        operations: data.operations || [],
        standardCycleTime: data.standardCycleTime ? parseFloat(data.standardCycleTime) : null,
        minCycleTime: data.minCycleTime ? parseFloat(data.minCycleTime) : null,
        maxCycleTime: data.maxCycleTime ? parseFloat(data.maxCycleTime) : null,
        volume: data.volume ? parseFloat(data.volume) : null,
        volumeUnit: data.volumeUnit,
        throughput: data.throughput ? parseFloat(data.throughput) : null,
        throughputUnit: data.throughputUnit,
        minTemperature: data.minTemperature ? parseFloat(data.minTemperature) : null,
        maxTemperature: data.maxTemperature ? parseFloat(data.maxTemperature) : null,
        minPressure: data.minPressure ? parseFloat(data.minPressure) : null,
        maxPressure: data.maxPressure ? parseFloat(data.maxPressure) : null,
        operatingSpeed: data.operatingSpeed ? parseFloat(data.operatingSpeed) : null,
        equipmentId: data.equipmentId,
        status: data.status || 'ACTIVE',
        isActive: data.isActive ?? true,
        workCenterId: data.workCenterId,
      },
      include: {
        workCenter: { select: { id: true, name: true, code: true } }
      }
    });
    
    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'WorkUnit',
        entityId: workUnit.id,
        newValue: workUnit,
        details: { message: `Work Unit "${workUnit.name}" created` }
      }
    });
    
    return NextResponse.json(workUnit);
  } catch (error) {
    console.error('Error creating work unit:', error);
    return NextResponse.json({ error: 'Failed to create work unit' }, { status: 500 });
  }
}

// PUT /api/workunits - Update a work unit
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    
    if (!data.id) {
      return NextResponse.json({ error: 'Work Unit ID is required' }, { status: 400 });
    }
    
    const existing = await db.workUnit.findUnique({ where: { id: data.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Work Unit not found' }, { status: 404 });
    }
    
    const workUnit = await db.workUnit.update({
      where: { id: data.id },
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
        type: data.type,
        sequenceNumber: data.sequenceNumber ? parseInt(data.sequenceNumber) : null,
        linePosition: data.linePosition,
        operations: data.operations,
        standardCycleTime: data.standardCycleTime ? parseFloat(data.standardCycleTime) : null,
        minCycleTime: data.minCycleTime ? parseFloat(data.minCycleTime) : null,
        maxCycleTime: data.maxCycleTime ? parseFloat(data.maxCycleTime) : null,
        volume: data.volume ? parseFloat(data.volume) : null,
        volumeUnit: data.volumeUnit,
        throughput: data.throughput ? parseFloat(data.throughput) : null,
        throughputUnit: data.throughputUnit,
        minTemperature: data.minTemperature ? parseFloat(data.minTemperature) : null,
        maxTemperature: data.maxTemperature ? parseFloat(data.maxTemperature) : null,
        minPressure: data.minPressure ? parseFloat(data.minPressure) : null,
        maxPressure: data.maxPressure ? parseFloat(data.maxPressure) : null,
        operatingSpeed: data.operatingSpeed ? parseFloat(data.operatingSpeed) : null,
        equipmentId: data.equipmentId,
        status: data.status,
        isActive: data.isActive,
      },
      include: {
        workCenter: { select: { id: true, name: true, code: true } }
      }
    });
    
    await db.auditLog.create({
      data: {
        action: 'UPDATE',
        entityType: 'WorkUnit',
        entityId: workUnit.id,
        oldValue: existing,
        newValue: workUnit,
        details: { message: `Work Unit "${workUnit.name}" updated` }
      }
    });
    
    return NextResponse.json(workUnit);
  } catch (error) {
    console.error('Error updating work unit:', error);
    return NextResponse.json({ error: 'Failed to update work unit' }, { status: 500 });
  }
}

// DELETE /api/workunits - Delete a work unit
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Work Unit ID is required' }, { status: 400 });
    }
    
    const existing = await db.workUnit.findUnique({
      where: { id },
      include: { _count: { select: { tags: true, equipment: true } } }
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Work Unit not found' }, { status: 404 });
    }
    
    await db.workUnit.delete({ where: { id } });
    
    await db.auditLog.create({
      data: {
        action: 'DELETE',
        entityType: 'WorkUnit',
        entityId: id,
        oldValue: existing,
        details: { message: `Work Unit "${existing.name}" deleted` }
      }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting work unit:', error);
    return NextResponse.json({ error: 'Failed to delete work unit' }, { status: 500 });
  }
}
