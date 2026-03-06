import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Get basic stats for health check
    const [
      enterpriseCount,
      siteCount,
      workCenterCount,
      equipmentCount,
      tagCount,
      activeAlarms,
      runningOrders,
      connectorCount,
    ] = await Promise.all([
      db.enterprise.count(),
      db.site.count(),
      db.workCenter.count(),
      db.equipment.count(),
      db.tag.count(),
      db.alarm.count({ where: { state: 'ACTIVE' } }),
      db.productionOrder.count({ where: { status: 'IN_PROGRESS' } }),
      db.edgeConnector.count({ where: { status: 'ONLINE' } }),
    ]);

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      platform: 'UNS - Unified Namespace',
      standards: 'ISA-95 / IEC 62264',
      stats: {
        enterprises: enterpriseCount,
        sites: siteCount,
        workCenters: workCenterCount,
        equipment: equipmentCount,
        tags: tagCount,
        activeAlarms,
        runningOrders,
        onlineConnectors: connectorCount,
      },
      endpoints: {
        api: '/api',
        health: '/api/health',
        enterprises: '/api/enterprises',
        sites: '/api/sites',
        workCenters: '/api/workcenters',
        equipment: '/api/equipment',
        tags: '/api/tags',
        alarms: '/api/alarms',
        orders: '/api/orders',
        runs: '/api/runs',
        recipes: '/api/recipes',
        lots: '/api/lots',
        connectors: '/api/connectors',
        oee: '/api/oee',
        dashboard: '/api/dashboard/overview',
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { status: 'unhealthy', error: 'Database connection failed' },
      { status: 503 }
    );
  }
}
