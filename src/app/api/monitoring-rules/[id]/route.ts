import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/monitoring-rules/[id] - Get a single monitoring rule
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rule = await db.monitoringRule.findUnique({
      where: { id },
      include: {
        equipment: {
          select: { id: true, name: true, code: true, type: true },
        },
      },
    });

    if (!rule) {
      return NextResponse.json(
        { error: 'Monitoring rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error fetching monitoring rule:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monitoring rule' },
      { status: 500 }
    );
  }
}

// PUT /api/monitoring-rules/[id] - Update a monitoring rule
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, code, type, metric, condition, severity, equipmentId, isActive } = body;

    // Check if rule exists
    const existingRule = await db.monitoringRule.findUnique({
      where: { id },
    });

    if (!existingRule) {
      return NextResponse.json(
        { error: 'Monitoring rule not found' },
        { status: 404 }
      );
    }

    // Validate type if provided
    if (type) {
      const validTypes = ['THRESHOLD', 'ANOMALY', 'TREND', 'COMPOSITE', 'ML_BASED'];
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate severity if provided
    if (severity) {
      const validSeverities = ['INFO', 'WARNING', 'CRITICAL'];
      if (!validSeverities.includes(severity)) {
        return NextResponse.json(
          { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Check for duplicate code if code is being changed
    if (code && code !== existingRule.code) {
      const duplicateCode = await db.monitoringRule.findUnique({
        where: { code },
      });
      if (duplicateCode) {
        return NextResponse.json(
          { error: 'A monitoring rule with this code already exists' },
          { status: 409 }
        );
      }
    }

    const rule = await db.monitoringRule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(type !== undefined && { type }),
        ...(metric !== undefined && { metric }),
        ...(condition !== undefined && {
          condition: typeof condition === 'string' ? JSON.parse(condition) : condition,
        }),
        ...(severity !== undefined && { severity }),
        ...(equipmentId !== undefined && { equipmentId: equipmentId || null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        equipment: {
          select: { id: true, name: true, code: true, type: true },
        },
      },
    });

    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error updating monitoring rule:', error);
    return NextResponse.json(
      { error: 'Failed to update monitoring rule' },
      { status: 500 }
    );
  }
}

// DELETE /api/monitoring-rules/[id] - Delete a monitoring rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if rule exists
    const existingRule = await db.monitoringRule.findUnique({
      where: { id },
    });

    if (!existingRule) {
      return NextResponse.json(
        { error: 'Monitoring rule not found' },
        { status: 404 }
      );
    }

    await db.monitoringRule.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Monitoring rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting monitoring rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete monitoring rule' },
      { status: 500 }
    );
  }
}
