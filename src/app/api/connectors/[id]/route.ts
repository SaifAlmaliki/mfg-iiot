import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/connectors/[id] - Get a single connector
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const connector = await db.edgeConnector.findUnique({
      where: { id },
      include: {
        site: { 
          select: { 
            id: true,
            name: true, 
            code: true 
          } 
        },
        tagMappings: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                mqttTopic: true,
                dataType: true
              }
            }
          }
        },
        connectorMetrics: {
          orderBy: { timestamp: 'desc' },
          take: 10
        },
        _count: {
          select: { tagMappings: true }
        }
      }
    });
    
    if (!connector) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
    }
    
    return NextResponse.json(connector);
  } catch (error) {
    console.error('Error fetching connector:', error);
    return NextResponse.json({ error: 'Failed to fetch connector' }, { status: 500 });
  }
}

// PUT /api/connectors/[id] - Update a connector
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { 
      name, 
      code, 
      type, 
      protocol, 
      endpoint, 
      config, 
      status,
      siteId,
      heartbeatRate,
      version,
      isActive
    } = body;
    
    // Check if connector exists
    const existingConnector = await db.edgeConnector.findUnique({
      where: { id }
    });
    
    if (!existingConnector) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
    }
    
    // If code is being changed, check for duplicates
    if (code && code !== existingConnector.code) {
      const duplicateCode = await db.edgeConnector.findUnique({
        where: { code }
      });
      
      if (duplicateCode) {
        return NextResponse.json({ 
          error: 'Connector with this code already exists' 
        }, { status: 400 });
      }
    }
    
    const connector = await db.edgeConnector.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(type !== undefined && { type }),
        ...(protocol !== undefined && { protocol }),
        ...(endpoint !== undefined && { endpoint }),
        ...(config !== undefined && { config }),
        ...(status !== undefined && { status }),
        ...(siteId !== undefined && { siteId }),
        ...(heartbeatRate !== undefined && { heartbeatRate }),
        ...(version !== undefined && { version }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date()
      },
      include: {
        site: { 
          select: { 
            id: true,
            name: true, 
            code: true 
          } 
        }
      }
    });
    
    return NextResponse.json(connector);
  } catch (error) {
    console.error('Error updating connector:', error);
    return NextResponse.json({ error: 'Failed to update connector' }, { status: 500 });
  }
}

// DELETE /api/connectors/[id] - Delete a connector (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if connector exists
    const existingConnector = await db.edgeConnector.findUnique({
      where: { id }
    });
    
    if (!existingConnector) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
    }
    
    // Soft delete by setting isActive to false
    await db.edgeConnector.update({
      where: { id },
      data: { 
        isActive: false,
        updatedAt: new Date()
      }
    });
    
    return NextResponse.json({ success: true, message: 'Connector deleted successfully' });
  } catch (error) {
    console.error('Error deleting connector:', error);
    return NextResponse.json({ error: 'Failed to delete connector' }, { status: 500 });
  }
}
