import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/tag-mappings/[id] - Get a single tag mapping
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const mapping = await db.tagMapping.findUnique({
      where: { id },
      include: {
        connector: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            status: true
          }
        },
        tag: {
          select: {
            id: true,
            name: true,
            mqttTopic: true,
            dataType: true,
            engUnit: true
          }
        }
      }
    });
    
    if (!mapping) {
      return NextResponse.json({ error: 'Tag mapping not found' }, { status: 404 });
    }
    
    return NextResponse.json(mapping);
  } catch (error) {
    console.error('Error fetching tag mapping:', error);
    return NextResponse.json({ error: 'Failed to fetch tag mapping' }, { status: 500 });
  }
}

// PUT /api/tag-mappings/[id] - Update a tag mapping
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { 
      sourceAddress, 
      sourceType, 
      sourceDataType, 
      scale, 
      offset, 
      swapBytes, 
      isActive,
      connectorId, 
      tagId 
    } = body;
    
    // Check if mapping exists
    const existingMapping = await db.tagMapping.findUnique({
      where: { id }
    });
    
    if (!existingMapping) {
      return NextResponse.json({ error: 'Tag mapping not found' }, { status: 404 });
    }
    
    // If sourceAddress or connectorId is being changed, check for duplicates
    const newSourceAddress = sourceAddress ?? existingMapping.sourceAddress;
    const newConnectorId = connectorId ?? existingMapping.connectorId;
    
    if (sourceAddress !== undefined || connectorId !== undefined) {
      const duplicate = await db.tagMapping.findUnique({
        where: {
          connectorId_sourceAddress: {
            connectorId: newConnectorId,
            sourceAddress: newSourceAddress
          }
        }
      });
      
      if (duplicate && duplicate.id !== id) {
        return NextResponse.json({ 
          error: 'A mapping with this source address already exists for this connector' 
        }, { status: 400 });
      }
    }
    
    // Verify connector if being changed
    if (connectorId !== undefined && connectorId !== existingMapping.connectorId) {
      const connector = await db.edgeConnector.findUnique({
        where: { id: connectorId }
      });
      
      if (!connector) {
        return NextResponse.json({ 
          error: 'Connector not found' 
        }, { status: 400 });
      }
    }
    
    // Verify tag if being changed
    if (tagId !== undefined && tagId !== existingMapping.tagId) {
      const tag = await db.tag.findUnique({
        where: { id: tagId }
      });
      
      if (!tag) {
        return NextResponse.json({ 
          error: 'Tag not found' 
        }, { status: 400 });
      }
    }
    
    const mapping = await db.tagMapping.update({
      where: { id },
      data: {
        ...(sourceAddress !== undefined && { sourceAddress }),
        ...(sourceType !== undefined && { sourceType }),
        ...(sourceDataType !== undefined && { sourceDataType }),
        ...(scale !== undefined && { scale }),
        ...(offset !== undefined && { offset }),
        ...(swapBytes !== undefined && { swapBytes }),
        ...(isActive !== undefined && { isActive }),
        ...(connectorId !== undefined && { connectorId }),
        ...(tagId !== undefined && { tagId })
      },
      include: {
        connector: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            status: true
          }
        },
        tag: {
          select: {
            id: true,
            name: true,
            mqttTopic: true,
            dataType: true,
            engUnit: true
          }
        }
      }
    });
    
    return NextResponse.json(mapping);
  } catch (error) {
    console.error('Error updating tag mapping:', error);
    return NextResponse.json({ error: 'Failed to update tag mapping' }, { status: 500 });
  }
}

// DELETE /api/tag-mappings/[id] - Delete a tag mapping
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if mapping exists
    const existingMapping = await db.tagMapping.findUnique({
      where: { id }
    });
    
    if (!existingMapping) {
      return NextResponse.json({ error: 'Tag mapping not found' }, { status: 404 });
    }
    
    // Delete the mapping
    await db.tagMapping.delete({
      where: { id }
    });
    
    return NextResponse.json({ success: true, message: 'Tag mapping deleted successfully' });
  } catch (error) {
    console.error('Error deleting tag mapping:', error);
    return NextResponse.json({ error: 'Failed to delete tag mapping' }, { status: 500 });
  }
}
