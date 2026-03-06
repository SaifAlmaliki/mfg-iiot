import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/hierarchy - Get full ISA-95 hierarchy tree
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level'); // enterprise, site, area, workcenter, workunit
    const parentId = searchParams.get('parentId');
    
    if (level === 'enterprise') {
      // Get enterprise with sites
      const enterprise = await db.enterprise.findFirst({
        include: {
          sites: {
            orderBy: { name: 'asc' }
          },
          _count: { select: { sites: true } }
        }
      });
      return NextResponse.json(enterprise);
    }
    
    if (level === 'site') {
      // Get sites with areas
      const sites = await db.site.findMany({
        where: parentId ? { enterpriseId: parentId } : undefined,
        include: {
          enterprise: { select: { id: true, name: true, code: true } },
          areas: {
            orderBy: { name: 'asc' }
          },
          _count: { select: { areas: true, users: true, edgeConnectors: true } }
        },
        orderBy: { name: 'asc' }
      });
      return NextResponse.json(sites);
    }
    
    if (level === 'area') {
      // Get areas with work centers
      const areas = await db.area.findMany({
        where: parentId ? { siteId: parentId } : undefined,
        include: {
          site: { select: { id: true, name: true, code: true } },
          workCenters: {
            orderBy: { name: 'asc' }
          },
          _count: { select: { workCenters: true } }
        },
        orderBy: { name: 'asc' }
      });
      return NextResponse.json(areas);
    }
    
    if (level === 'workcenter') {
      // Get work centers with work units
      const workCenters = await db.workCenter.findMany({
        where: parentId ? { areaId: parentId } : undefined,
        include: {
          area: { select: { id: true, name: true, code: true, siteId: true } },
          workUnits: {
            orderBy: { sequenceNumber: 'asc' }
          },
          _count: { select: { workUnits: true, equipment: true, productionOrders: true } }
        },
        orderBy: { name: 'asc' }
      });
      return NextResponse.json(workCenters);
    }
    
    if (level === 'workunit') {
      // Get work units
      const workUnits = await db.workUnit.findMany({
        where: parentId ? { workCenterId: parentId } : undefined,
        include: {
          workCenter: { select: { id: true, name: true, code: true, areaId: true } },
          _count: { select: { tags: true, equipment: true } }
        },
        orderBy: [{ sequenceNumber: 'asc' }, { name: 'asc' }]
      });
      return NextResponse.json(workUnits);
    }
    
    // Default: return full hierarchy tree
    const enterprise = await db.enterprise.findFirst({
      include: {
        sites: {
          include: {
            areas: {
              include: {
                workCenters: {
                  include: {
                    workUnits: true,
                    _count: { select: { workUnits: true, equipment: true } }
                  }
                },
                _count: { select: { workCenters: true } }
              }
            },
            _count: { select: { areas: true, users: true, edgeConnectors: true } }
          },
          orderBy: { name: 'asc' }
        },
        _count: { select: { sites: true } }
      }
    });
    
    return NextResponse.json(enterprise);
  } catch (error) {
    console.error('Error fetching hierarchy:', error);
    return NextResponse.json({ error: 'Failed to fetch hierarchy' }, { status: 500 });
  }
}
