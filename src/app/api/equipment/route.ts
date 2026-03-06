import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/equipment - List all equipment
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const workCenterId = searchParams.get('workCenterId');
    const workUnitId = searchParams.get('workUnitId');
    const isActive = searchParams.get('isActive');

    const equipment = await db.equipment.findMany({
      where: {
        ...(type && { type }),
        ...(workCenterId && { workCenterId }),
        ...(workUnitId && { workUnitId }),
        ...(isActive !== null && { isActive: isActive === 'true' }),
      },
      include: {
        workCenter: {
          select: { id: true, name: true, code: true },
        },
        workUnit: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: {
            healthRecords: true,
            maintenanceLogs: true,
            monitoringRules: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Get latest health record for each equipment
    const equipmentWithHealth = await Promise.all(
      equipment.map(async (eq) => {
        const latestHealth = await db.assetHealth.findFirst({
          where: { equipmentId: eq.id },
          orderBy: { timestamp: 'desc' },
        });

        return {
          ...eq,
          latestHealth,
        };
      })
    );

    return NextResponse.json(equipmentWithHealth);
  } catch (error) {
    console.error('Error fetching equipment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch equipment' },
      { status: 500 }
    );
  }
}
