import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/workcenters - List all work centers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get('areaId');
    const siteId = searchParams.get('siteId');
    
    // If siteId is provided, get work centers for the entire site
    const whereClause = siteId ? {
      area: { siteId }
    } : areaId ? { areaId } : {};
    
    const workCenters = await db.workCenter.findMany({
      where: whereClause,
      include: {
        area: { 
          select: { id: true, name: true, code: true, siteId: true,
            site: { select: { id: true, name: true, code: true } }
          } 
        },
        workUnits: {
          select: { id: true, name: true, code: true, type: true, status: true },
          orderBy: { name: 'asc' }
        },
        _count: { select: { workUnits: true, equipment: true, productionOrders: true } }
      },
      orderBy: { name: 'asc' }
    });
    
    return NextResponse.json(workCenters);
  } catch (error) {
    console.error('Error fetching work centers:', error);
    return NextResponse.json({ error: 'Failed to fetch work centers' }, { status: 500 });
  }
}

// POST /api/workcenters - Create a new work center
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    if (!data.areaId) {
      return NextResponse.json({ error: 'Area ID is required' }, { status: 400 });
    }
    
    const workCenter = await db.workCenter.create({
      data: {
        name: data.name,
        code: data.code || data.name?.toUpperCase().replace(/\s+/g, '_'),
        description: data.description,
        type: data.type || 'PRODUCTION_LINE',
        capacity: data.capacity ? parseFloat(data.capacity) : null,
        capacityUnit: data.capacityUnit,
        efficiency: data.efficiency ? parseFloat(data.efficiency) : 100,
        operatingHours: data.operatingHours,
        shiftPattern: data.shiftPattern,
        availabilitySchedule: data.availabilitySchedule,
        processType: data.processType,
        changeoverTime: data.changeoverTime ? parseInt(data.changeoverTime) : null,
        minBatchSize: data.minBatchSize ? parseFloat(data.minBatchSize) : null,
        maxBatchSize: data.maxBatchSize ? parseFloat(data.maxBatchSize) : null,
        personnelRequired: data.personnelRequired ? parseInt(data.personnelRequired) : null,
        skillRequirements: data.skillRequirements || [],
        tooling: data.tooling || [],
        targetOEE: data.targetOEE ? parseFloat(data.targetOEE) : null,
        targetAvailability: data.targetAvailability ? parseFloat(data.targetAvailability) : null,
        targetPerformance: data.targetPerformance ? parseFloat(data.targetPerformance) : null,
        targetQuality: data.targetQuality ? parseFloat(data.targetQuality) : null,
        status: data.status || 'ACTIVE',
        statusReason: data.statusReason,
        isActive: data.isActive ?? true,
        areaId: data.areaId,
      },
      include: {
        area: { select: { id: true, name: true, code: true } }
      }
    });
    
    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'WorkCenter',
        entityId: workCenter.id,
        newValue: workCenter,
        details: { message: `Work Center "${workCenter.name}" created` }
      }
    });
    
    return NextResponse.json(workCenter);
  } catch (error) {
    console.error('Error creating work center:', error);
    return NextResponse.json({ error: 'Failed to create work center' }, { status: 500 });
  }
}

// PUT /api/workcenters - Update a work center
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    
    if (!data.id) {
      return NextResponse.json({ error: 'Work Center ID is required' }, { status: 400 });
    }
    
    const existing = await db.workCenter.findUnique({ where: { id: data.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Work Center not found' }, { status: 404 });
    }
    
    const workCenter = await db.workCenter.update({
      where: { id: data.id },
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
        type: data.type,
        capacity: data.capacity ? parseFloat(data.capacity) : null,
        capacityUnit: data.capacityUnit,
        efficiency: data.efficiency ? parseFloat(data.efficiency) : null,
        operatingHours: data.operatingHours,
        shiftPattern: data.shiftPattern,
        availabilitySchedule: data.availabilitySchedule,
        processType: data.processType,
        changeoverTime: data.changeoverTime ? parseInt(data.changeoverTime) : null,
        minBatchSize: data.minBatchSize ? parseFloat(data.minBatchSize) : null,
        maxBatchSize: data.maxBatchSize ? parseFloat(data.maxBatchSize) : null,
        personnelRequired: data.personnelRequired ? parseInt(data.personnelRequired) : null,
        skillRequirements: data.skillRequirements,
        tooling: data.tooling,
        targetOEE: data.targetOEE ? parseFloat(data.targetOEE) : null,
        targetAvailability: data.targetAvailability ? parseFloat(data.targetAvailability) : null,
        targetPerformance: data.targetPerformance ? parseFloat(data.targetPerformance) : null,
        targetQuality: data.targetQuality ? parseFloat(data.targetQuality) : null,
        status: data.status,
        statusReason: data.statusReason,
        isActive: data.isActive,
      },
      include: {
        area: { select: { id: true, name: true, code: true } }
      }
    });
    
    await db.auditLog.create({
      data: {
        action: 'UPDATE',
        entityType: 'WorkCenter',
        entityId: workCenter.id,
        oldValue: existing,
        newValue: workCenter,
        details: { message: `Work Center "${workCenter.name}" updated` }
      }
    });
    
    return NextResponse.json(workCenter);
  } catch (error) {
    console.error('Error updating work center:', error);
    return NextResponse.json({ error: 'Failed to update work center' }, { status: 500 });
  }
}

// DELETE /api/workcenters - Delete a work center
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Work Center ID is required' }, { status: 400 });
    }
    
    const existing = await db.workCenter.findUnique({
      where: { id },
      include: { _count: { select: { workUnits: true, equipment: true, productionOrders: true } } }
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Work Center not found' }, { status: 404 });
    }
    
    if (existing._count.workUnits > 0) {
      return NextResponse.json({ 
        error: `Cannot delete work center with ${existing._count.workUnits} work units. Delete work units first.` 
      }, { status: 400 });
    }
    
    await db.workCenter.delete({ where: { id } });
    
    await db.auditLog.create({
      data: {
        action: 'DELETE',
        entityType: 'WorkCenter',
        entityId: id,
        oldValue: existing,
        details: { message: `Work Center "${existing.name}" deleted` }
      }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting work center:', error);
    return NextResponse.json({ error: 'Failed to delete work center' }, { status: 500 });
  }
}
