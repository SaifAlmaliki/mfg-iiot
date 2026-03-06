import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/connectors - List edge connectors
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const siteId = searchParams.get('siteId');
    
    const connectors = await db.edgeConnector.findMany({
      where: {
        ...(status && { status }),
        ...(type && { type }),
        ...(siteId && { siteId }),
        isActive: true
      },
      include: {
        site: { 
          select: { 
            id: true,
            name: true, 
            code: true 
          } 
        },
        _count: {
          select: { tagMappings: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    return NextResponse.json(connectors);
  } catch (error) {
    console.error('Error fetching connectors:', error);
    return NextResponse.json({ error: 'Failed to fetch connectors' }, { status: 500 });
  }
}

// POST /api/connectors - Create a new edge connector
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      code, 
      type, 
      protocol, 
      endpoint, 
      config, 
      siteId,
      heartbeatRate,
      version
    } = body;
    
    // Validate required fields
    if (!name || !code || !type || !endpoint || !siteId) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, code, type, endpoint, siteId' 
      }, { status: 400 });
    }
    
    // Check if code already exists
    const existingConnector = await db.edgeConnector.findUnique({
      where: { code }
    });
    
    if (existingConnector) {
      return NextResponse.json({ 
        error: 'Connector with this code already exists' 
      }, { status: 400 });
    }
    
    const connector = await db.edgeConnector.create({
      data: {
        name,
        code,
        type,
        protocol: protocol || null,
        endpoint,
        config: config || null,
        siteId,
        status: 'OFFLINE',
        heartbeatRate: heartbeatRate || 30,
        version: version || null,
        isActive: true
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
    
    return NextResponse.json(connector, { status: 201 });
  } catch (error) {
    console.error('Error creating connector:', error);
    return NextResponse.json({ error: 'Failed to create connector' }, { status: 500 });
  }
}
