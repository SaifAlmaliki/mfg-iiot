import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/monitoring-rules - List all monitoring rules
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const equipmentId = searchParams.get('equipmentId');
    const isActive = searchParams.get('isActive');

    const rules = await db.monitoringRule.findMany({
      where: {
        ...(type && { type }),
        ...(severity && { severity }),
        ...(equipmentId && { equipmentId }),
        ...(isActive !== null && { isActive: isActive === 'true' }),
      },
      include: {
        equipment: {
          select: { id: true, name: true, code: true, type: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error('Error fetching monitoring rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monitoring rules' },
      { status: 500 }
    );
  }
}

// POST /api/monitoring-rules - Create a new monitoring rule
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code, type, metric, condition, severity, equipmentId, isActive } = body;

    // Validate required fields
    if (!name || !code || !type || !metric || !condition) {
      return NextResponse.json(
        { error: 'Missing required fields: name, code, type, metric, condition' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['THRESHOLD', 'ANOMALY', 'TREND', 'COMPOSITE', 'ML_BASED'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate severity
    const validSeverities = ['INFO', 'WARNING', 'CRITICAL'];
    if (severity && !validSeverities.includes(severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 }
      );
    }

    // Check for duplicate code
    const existingRule = await db.monitoringRule.findUnique({
      where: { code },
    });

    if (existingRule) {
      return NextResponse.json(
        { error: 'A monitoring rule with this code already exists' },
        { status: 409 }
      );
    }

    const rule = await db.monitoringRule.create({
      data: {
        name,
        code,
        type,
        metric,
        condition: typeof condition === 'string' ? JSON.parse(condition) : condition,
        severity: severity || 'WARNING',
        isActive: isActive !== undefined ? isActive : true,
        equipmentId: equipmentId || null,
      },
      include: {
        equipment: {
          select: { id: true, name: true, code: true, type: true },
        },
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error('Error creating monitoring rule:', error);
    return NextResponse.json(
      { error: 'Failed to create monitoring rule' },
      { status: 500 }
    );
  }
}
