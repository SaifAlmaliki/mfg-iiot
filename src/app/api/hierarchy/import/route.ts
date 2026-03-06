import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/hierarchy/import - Import hierarchy from JSON
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Get or create enterprise
    let enterprise = await db.enterprise.findFirst();
    
    if (!enterprise && data.enterprise) {
      enterprise = await db.enterprise.create({
        data: {
          name: data.enterprise.name,
          code: data.enterprise.code || 'ENT',
          description: data.enterprise.description,
          address: data.enterprise.address,
          city: data.enterprise.city,
          state: data.enterprise.state,
          postalCode: data.enterprise.postalCode,
          country: data.enterprise.country,
          phone: data.enterprise.phone,
          email: data.enterprise.email,
          website: data.enterprise.website,
          industry: data.enterprise.industry,
          isActive: data.enterprise.isActive ?? true,
        }
      });
    }
    
    if (!enterprise) {
      return NextResponse.json({ error: 'No enterprise found or provided' }, { status: 400 });
    }
    
    const results = {
      created: { sites: 0, areas: 0, workCenters: 0, workUnits: 0 },
      updated: { sites: 0, areas: 0, workCenters: 0, workUnits: 0 },
      errors: [] as string[]
    };
    
    // Import sites
    if (data.sites && Array.isArray(data.sites)) {
      for (const siteData of data.sites) {
        try {
          const existingSite = await db.site.findUnique({ where: { code: siteData.code } });
          
          if (existingSite) {
            await db.site.update({
              where: { code: siteData.code },
              data: {
                name: siteData.name,
                description: siteData.description,
                siteType: siteData.siteType,
                address: siteData.address,
                city: siteData.city,
                state: siteData.state,
                postalCode: siteData.postalCode,
                country: siteData.country,
                phone: siteData.phone,
                email: siteData.email,
                siteManager: siteData.siteManager,
                timezone: siteData.timezone,
                isActive: siteData.isActive,
              }
            });
            results.updated.sites++;
          } else {
            await db.site.create({
              data: {
                name: siteData.name,
                code: siteData.code,
                description: siteData.description,
                siteType: siteData.siteType || 'MANUFACTURING',
                address: siteData.address,
                city: siteData.city,
                state: siteData.state,
                postalCode: siteData.postalCode,
                country: siteData.country,
                phone: siteData.phone,
                email: siteData.email,
                siteManager: siteData.siteManager,
                timezone: siteData.timezone || 'UTC',
                isActive: siteData.isActive ?? true,
                enterpriseId: enterprise.id,
              }
            });
            results.created.sites++;
          }
          
          // Get the site (existing or new) for importing areas
          const site = await db.site.findUnique({ where: { code: siteData.code } });
          
          // Import areas
          if (site && siteData.areas && Array.isArray(siteData.areas)) {
            for (const areaData of siteData.areas) {
              try {
                const existingArea = await db.area.findFirst({
                  where: { siteId: site.id, code: areaData.code }
                });
                
                if (existingArea) {
                  await db.area.update({
                    where: { id: existingArea.id },
                    data: {
                      name: areaData.name,
                      description: areaData.description,
                      areaType: areaData.areaType,
                      building: areaData.building,
                      floor: areaData.floor,
                      zone: areaData.zone,
                      supervisor: areaData.supervisor,
                      isActive: areaData.isActive,
                    }
                  });
                  results.updated.areas++;
                } else {
                  await db.area.create({
                    data: {
                      name: areaData.name,
                      code: areaData.code,
                      description: areaData.description,
                      areaType: areaData.areaType || 'PRODUCTION',
                      building: areaData.building,
                      floor: areaData.floor,
                      zone: areaData.zone,
                      supervisor: areaData.supervisor,
                      isActive: areaData.isActive ?? true,
                      siteId: site.id,
                    }
                  });
                  results.created.areas++;
                }
                
                // Get the area for importing work centers
                const area = await db.area.findFirst({
                  where: { siteId: site.id, code: areaData.code }
                });
                
                // Import work centers
                if (area && areaData.workCenters && Array.isArray(areaData.workCenters)) {
                  for (const wcData of areaData.workCenters) {
                    try {
                      const existingWc = await db.workCenter.findFirst({
                        where: { areaId: area.id, code: wcData.code }
                      });
                      
                      if (existingWc) {
                        await db.workCenter.update({
                          where: { id: existingWc.id },
                          data: {
                            name: wcData.name,
                            description: wcData.description,
                            type: wcData.type,
                            capacity: wcData.capacity,
                            status: wcData.status,
                            isActive: wcData.isActive,
                          }
                        });
                        results.updated.workCenters++;
                      } else {
                        await db.workCenter.create({
                          data: {
                            name: wcData.name,
                            code: wcData.code,
                            description: wcData.description,
                            type: wcData.type || 'PRODUCTION_LINE',
                            capacity: wcData.capacity,
                            status: wcData.status || 'ACTIVE',
                            isActive: wcData.isActive ?? true,
                            areaId: area.id,
                          }
                        });
                        results.created.workCenters++;
                      }
                      
                      // Get the work center for importing work units
                      const workCenter = await db.workCenter.findFirst({
                        where: { areaId: area.id, code: wcData.code }
                      });
                      
                      // Import work units
                      if (workCenter && wcData.workUnits && Array.isArray(wcData.workUnits)) {
                        for (const wuData of wcData.workUnits) {
                          try {
                            const existingWu = await db.workUnit.findFirst({
                              where: { workCenterId: workCenter.id, code: wuData.code }
                            });
                            
                            if (existingWu) {
                              await db.workUnit.update({
                                where: { id: existingWu.id },
                                data: {
                                  name: wuData.name,
                                  description: wuData.description,
                                  type: wuData.type,
                                  sequenceNumber: wuData.sequenceNumber,
                                  status: wuData.status,
                                  isActive: wuData.isActive,
                                }
                              });
                              results.updated.workUnits++;
                            } else {
                              await db.workUnit.create({
                                data: {
                                  name: wuData.name,
                                  code: wuData.code,
                                  description: wuData.description,
                                  type: wuData.type || 'OTHER',
                                  sequenceNumber: wuData.sequenceNumber,
                                  status: wuData.status || 'ACTIVE',
                                  isActive: wuData.isActive ?? true,
                                  workCenterId: workCenter.id,
                                }
                              });
                              results.created.workUnits++;
                            }
                          } catch (e: any) {
                            results.errors.push(`Work Unit ${wuData.code}: ${e.message}`);
                          }
                        }
                      }
                    } catch (e: any) {
                      results.errors.push(`Work Center ${wcData.code}: ${e.message}`);
                    }
                  }
                }
              } catch (e: any) {
                results.errors.push(`Area ${areaData.code}: ${e.message}`);
              }
            }
          }
        } catch (e: any) {
          results.errors.push(`Site ${siteData.code}: ${e.message}`);
        }
      }
    }
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'IMPORT',
        entityType: 'Hierarchy',
        details: { message: 'Hierarchy import completed', results }
      }
    });
    
    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Error importing hierarchy:', error);
    return NextResponse.json({ error: 'Failed to import hierarchy', details: error.message }, { status: 500 });
  }
}
