import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/areas - List all areas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    
    const areas = await db.area.findMany({
      where: siteId ? { siteId } : undefined,
      include: {
        site: { select: { id: true, name: true, code: true } },
        workCenters: {
          select: { id: true, name: true, code: true, type: true, status: true }
        },
        _count: { select: { workCenters: true } }
      },
      orderBy: { name: 'asc' }
    });
    
    return NextResponse.json(areas);
  } catch (error) {
    console.error('Error fetching areas:', error);
    return NextResponse.json({ error: 'Failed to fetch areas' }, { status: 500 });
  }
}

// POST /api/areas - Create a new area
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    if (!data.siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
    }
    
    const area = await db.area.create({
      data: {
        name: data.name,
        code: data.code || data.name?.toUpperCase().replace(/\s+/g, '_'),
        description: data.description,
        areaType: data.areaType || 'PRODUCTION',
        building: data.building,
        floor: data.floor,
        zone: data.zone,
        temperatureMin: data.temperatureMin ? parseFloat(data.temperatureMin) : null,
        temperatureMax: data.temperatureMax ? parseFloat(data.temperatureMax) : null,
        humidityMin: data.humidityMin ? parseFloat(data.humidityMin) : null,
        humidityMax: data.humidityMax ? parseFloat(data.humidityMax) : null,
        cleanroomClass: data.cleanroomClass,
        isHazardous: data.isHazardous ?? false,
        floorAreaSqm: data.floorAreaSqm ? parseFloat(data.floorAreaSqm) : null,
        maxPersonnel: data.maxPersonnel ? parseInt(data.maxPersonnel) : null,
        supervisor: data.supervisor,
        safetyRequirements: data.safetyRequirements || [],
        hazardousMaterials: data.hazardousMaterials || [],
        isActive: data.isActive ?? true,
        siteId: data.siteId,
      },
      include: {
        site: { select: { id: true, name: true, code: true } }
      }
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'Area',
        entityId: area.id,
        newValue: area,
        details: { message: `Area "${area.name}" created` }
      }
    });
    
    return NextResponse.json(area);
  } catch (error) {
    console.error('Error creating area:', error);
    return NextResponse.json({ error: 'Failed to create area' }, { status: 500 });
  }
}

// PUT /api/areas - Update an area
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    
    if (!data.id) {
      return NextResponse.json({ error: 'Area ID is required' }, { status: 400 });
    }
    
    const existing = await db.area.findUnique({ where: { id: data.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }
    
    const area = await db.area.update({
      where: { id: data.id },
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
        areaType: data.areaType,
        building: data.building,
        floor: data.floor,
        zone: data.zone,
        temperatureMin: data.temperatureMin ? parseFloat(data.temperatureMin) : null,
        temperatureMax: data.temperatureMax ? parseFloat(data.temperatureMax) : null,
        humidityMin: data.humidityMin ? parseFloat(data.humidityMin) : null,
        humidityMax: data.humidityMax ? parseFloat(data.humidityMax) : null,
        cleanroomClass: data.cleanroomClass,
        isHazardous: data.isHazardous,
        floorAreaSqm: data.floorAreaSqm ? parseFloat(data.floorAreaSqm) : null,
        maxPersonnel: data.maxPersonnel ? parseInt(data.maxPersonnel) : null,
        supervisor: data.supervisor,
        safetyRequirements: data.safetyRequirements,
        hazardousMaterials: data.hazardousMaterials,
        isActive: data.isActive,
      },
      include: {
        site: { select: { id: true, name: true, code: true } }
      }
    });
    
    await db.auditLog.create({
      data: {
        action: 'UPDATE',
        entityType: 'Area',
        entityId: area.id,
        oldValue: existing,
        newValue: area,
        details: { message: `Area "${area.name}" updated` }
      }
    });
    
    return NextResponse.json(area);
  } catch (error) {
    console.error('Error updating area:', error);
    return NextResponse.json({ error: 'Failed to update area' }, { status: 500 });
  }
}

// DELETE /api/areas - Delete an area
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Area ID is required' }, { status: 400 });
    }
    
    const existing = await db.area.findUnique({
      where: { id },
      include: { _count: { select: { workCenters: true } } }
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }
    
    if (existing._count.workCenters > 0) {
      return NextResponse.json({ 
        error: `Cannot delete area with ${existing._count.workCenters} work centers. Delete work centers first.` 
      }, { status: 400 });
    }
    
    await db.area.delete({ where: { id } });
    
    await db.auditLog.create({
      data: {
        action: 'DELETE',
        entityType: 'Area',
        entityId: id,
        oldValue: existing,
        details: { message: `Area "${existing.name}" deleted` }
      }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting area:', error);
    return NextResponse.json({ error: 'Failed to delete area' }, { status: 500 });
  }
}
