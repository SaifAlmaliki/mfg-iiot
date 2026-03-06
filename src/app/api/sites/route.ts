import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/sites - List all sites
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const enterpriseId = searchParams.get('enterpriseId');
    const includeHierarchy = searchParams.get('includeHierarchy') === 'true';
    
    const sites = await db.site.findMany({
      where: enterpriseId ? { enterpriseId } : undefined,
      include: {
        enterprise: { select: { id: true, name: true, code: true } },
        ...(includeHierarchy ? {
          areas: {
            include: {
              workCenters: {
                include: {
                  workUnits: true
                }
              }
            }
          }
        } : {}),
        _count: {
          select: { areas: true, users: true, roles: true, edgeConnectors: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    return NextResponse.json(sites);
  } catch (error) {
    console.error('Error fetching sites:', error);
    return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 });
  }
}

// POST /api/sites - Create a new site
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Get or create enterprise
    let enterprise = await db.enterprise.findFirst();
    if (!enterprise) {
      enterprise = await db.enterprise.create({
        data: {
          name: 'Default Enterprise',
          code: 'DEFAULT_ENT'
        }
      });
    }
    
    const site = await db.site.create({
      data: {
        name: data.name,
        code: data.code || data.name?.toUpperCase().replace(/\s+/g, '_'),
        description: data.description,
        siteType: data.siteType || 'MANUFACTURING',
        primaryFunction: data.primaryFunction,
        address: data.address,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        latitude: data.latitude ? parseFloat(data.latitude) : null,
        longitude: data.longitude ? parseFloat(data.longitude) : null,
        phone: data.phone,
        email: data.email,
        siteManager: data.siteManager,
        timezone: data.timezone || 'UTC',
        operatingHours: data.operatingHours,
        capacity: data.capacity ? parseFloat(data.capacity) : null,
        areaSqm: data.areaSqm ? parseFloat(data.areaSqm) : null,
        regulatoryId: data.regulatoryId,
        certifications: data.certifications || [],
        isActive: data.isActive ?? true,
        enterpriseId: enterprise.id,
      },
      include: {
        enterprise: { select: { id: true, name: true, code: true } }
      }
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'Site',
        entityId: site.id,
        newValue: site,
        details: { message: `Site "${site.name}" created` }
      }
    });
    
    return NextResponse.json(site);
  } catch (error) {
    console.error('Error creating site:', error);
    return NextResponse.json({ error: 'Failed to create site' }, { status: 500 });
  }
}

// PUT /api/sites - Update a site
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    
    if (!data.id) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
    }
    
    const existing = await db.site.findUnique({
      where: { id: data.id }
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }
    
    const site = await db.site.update({
      where: { id: data.id },
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
        siteType: data.siteType,
        primaryFunction: data.primaryFunction,
        address: data.address,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        latitude: data.latitude ? parseFloat(data.latitude) : null,
        longitude: data.longitude ? parseFloat(data.longitude) : null,
        phone: data.phone,
        email: data.email,
        siteManager: data.siteManager,
        timezone: data.timezone,
        operatingHours: data.operatingHours,
        capacity: data.capacity ? parseFloat(data.capacity) : null,
        areaSqm: data.areaSqm ? parseFloat(data.areaSqm) : null,
        regulatoryId: data.regulatoryId,
        certifications: data.certifications,
        isActive: data.isActive,
      },
      include: {
        enterprise: { select: { id: true, name: true, code: true } }
      }
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'UPDATE',
        entityType: 'Site',
        entityId: site.id,
        oldValue: existing,
        newValue: site,
        details: { message: `Site "${site.name}" updated` }
      }
    });
    
    return NextResponse.json(site);
  } catch (error) {
    console.error('Error updating site:', error);
    return NextResponse.json({ error: 'Failed to update site' }, { status: 500 });
  }
}

// DELETE /api/sites - Delete a site
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
    }
    
    const existing = await db.site.findUnique({
      where: { id },
      include: { _count: { select: { areas: true, users: true } } }
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }
    
    // Check for dependencies
    if (existing._count.areas > 0) {
      return NextResponse.json({ 
        error: `Cannot delete site with ${existing._count.areas} areas. Delete areas first.` 
      }, { status: 400 });
    }
    
    await db.site.delete({ where: { id } });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'DELETE',
        entityType: 'Site',
        entityId: id,
        oldValue: existing,
        details: { message: `Site "${existing.name}" deleted` }
      }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting site:', error);
    return NextResponse.json({ error: 'Failed to delete site' }, { status: 500 });
  }
}
