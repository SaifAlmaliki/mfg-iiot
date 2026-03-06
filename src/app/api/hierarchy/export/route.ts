import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/hierarchy/export - Export hierarchy to JSON/CSV
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const level = searchParams.get('level') || 'all';
    
    // Fetch full hierarchy
    const hierarchy = await db.enterprise.findFirst({
      include: {
        sites: {
          include: {
            areas: {
              include: {
                workCenters: {
                  include: {
                    workUnits: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    if (format === 'csv') {
      // Generate CSV format
      const rows: string[] = [];
      rows.push('Level,Parent,Code,Name,Type,Description,Status');
      
      if (hierarchy) {
        rows.push(`Enterprise,,${hierarchy.code},${hierarchy.name},Enterprise,${hierarchy.description || ''},${hierarchy.isActive ? 'Active' : 'Inactive'}`);
        
        for (const site of hierarchy.sites) {
          rows.push(`Site,${hierarchy.code},${site.code},${site.name},${site.siteType},${site.description || ''},${site.isActive ? 'Active' : 'Inactive'}`);
          
          for (const area of site.areas) {
            rows.push(`Area,${site.code},${area.code},${area.name},${area.areaType},${area.description || ''},${area.isActive ? 'Active' : 'Inactive'}`);
            
            for (const wc of area.workCenters) {
              rows.push(`WorkCenter,${area.code},${wc.code},${wc.name},${wc.type},${wc.description || ''},${wc.status}`);
              
              for (const wu of wc.workUnits) {
                rows.push(`WorkUnit,${wc.code},${wu.code},${wu.name},${wu.type},${wu.description || ''},${wu.status}`);
              }
            }
          }
        }
      }
      
      return new NextResponse(rows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="hierarchy_export.csv"'
        }
      });
    }
    
    // Return JSON format
    return new NextResponse(JSON.stringify(hierarchy, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="hierarchy_export.json"'
      }
    });
  } catch (error) {
    console.error('Error exporting hierarchy:', error);
    return NextResponse.json({ error: 'Failed to export hierarchy' }, { status: 500 });
  }
}
