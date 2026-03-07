import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/tag-mappings - List all tag mappings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const connectorId = searchParams.get('connectorId');
    const tagId = searchParams.get('tagId');
    const isActive = searchParams.get('isActive');
    
    const mappings = await db.tagMapping.findMany({
      where: {
        ...(connectorId && { connectorId }),
        ...(tagId && { tagId }),
        ...(isActive !== null && { isActive: isActive === 'true' })
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
            engUnit: true,
            tagValues: {
              orderBy: { timestamp: 'desc' },
              take: 1,
              select: { value: true, quality: true, timestamp: true }
            }
          }
        }
      },
      orderBy: [
        { connector: { name: 'asc' } },
        { sourceAddress: 'asc' }
      ]
    });
    
    return NextResponse.json(mappings);
  } catch (error) {
    console.error('Error fetching tag mappings:', error);
    return NextResponse.json({ error: 'Failed to fetch tag mappings' }, { status: 500 });
  }
}

// POST /api/tag-mappings - Create a new tag mapping
export async function POST(request: NextRequest) {
  try {
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
    
    // Validate required fields
    if (!sourceAddress || !sourceType || !connectorId || !tagId) {
      return NextResponse.json({ 
        error: 'Missing required fields: sourceAddress, sourceType, connectorId, tagId' 
      }, { status: 400 });
    }
    
    // Verify connector exists
    const connector = await db.edgeConnector.findUnique({
      where: { id: connectorId }
    });
    
    if (!connector) {
      return NextResponse.json({ 
        error: 'Connector not found' 
      }, { status: 400 });
    }
    
    // Verify tag exists
    const tag = await db.tag.findUnique({
      where: { id: tagId }
    });
    
    if (!tag) {
      return NextResponse.json({ 
        error: 'Tag not found' 
      }, { status: 400 });
    }
    
    // Check for duplicate source address in same connector
    const existingMapping = await db.tagMapping.findUnique({
      where: {
        connectorId_sourceAddress: {
          connectorId,
          sourceAddress
        }
      }
    });
    
    if (existingMapping) {
      return NextResponse.json({ 
        error: 'A mapping with this source address already exists for this connector' 
      }, { status: 400 });
    }
    
    const mapping = await db.tagMapping.create({
      data: {
        sourceAddress,
        sourceType,
        sourceDataType: sourceDataType || null,
        scale: scale !== undefined ? scale : null,
        offset: offset !== undefined ? offset : null,
        swapBytes: swapBytes || false,
        isActive: isActive !== undefined ? isActive : true,
        connectorId,
        tagId
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
            engUnit: true,
            tagValues: {
              orderBy: { timestamp: 'desc' },
              take: 1,
              select: { value: true, quality: true, timestamp: true }
            }
          }
        }
      }
    });
    
    return NextResponse.json(mapping, { status: 201 });
  } catch (error) {
    console.error('Error creating tag mapping:', error);
    return NextResponse.json({ error: 'Failed to create tag mapping' }, { status: 500 });
  }
}
