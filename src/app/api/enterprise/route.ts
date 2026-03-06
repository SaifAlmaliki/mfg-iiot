import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/enterprise - Get enterprise (single tenant)
export async function GET() {
  try {
    // Single tenant - get the first/only enterprise
    let enterprise = await db.enterprise.findFirst({
      include: {
        _count: {
          select: { sites: true }
        }
      }
    });
    
    return NextResponse.json(enterprise);
  } catch (error) {
    console.error('Error fetching enterprise:', error);
    return NextResponse.json({ error: 'Failed to fetch enterprise' }, { status: 500 });
  }
}

// POST /api/enterprise - Create enterprise
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Check if enterprise already exists (single tenant)
    const existing = await db.enterprise.findFirst();
    if (existing) {
      return NextResponse.json({ error: 'Enterprise already exists. Use PUT to update.' }, { status: 400 });
    }
    
    const enterprise = await db.enterprise.create({
      data: {
        name: data.name,
        code: data.code || data.name?.toUpperCase().replace(/\s+/g, '_'),
        description: data.description,
        address: data.address,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        phone: data.phone,
        email: data.email,
        website: data.website,
        industry: data.industry,
        registrationNumber: data.registrationNumber,
        isActive: data.isActive ?? true,
        isSetup: data.isSetup ?? false,
      }
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'Enterprise',
        entityId: enterprise.id,
        newValue: enterprise,
        details: { message: `Enterprise "${enterprise.name}" created` }
      }
    });
    
    return NextResponse.json(enterprise);
  } catch (error) {
    console.error('Error creating enterprise:', error);
    return NextResponse.json({ error: 'Failed to create enterprise' }, { status: 500 });
  }
}

// PUT /api/enterprise - Update enterprise
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    
    const existing = await db.enterprise.findFirst();
    if (!existing) {
      return NextResponse.json({ error: 'Enterprise not found. Use POST to create.' }, { status: 404 });
    }
    
    const enterprise = await db.enterprise.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
        address: data.address,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        phone: data.phone,
        email: data.email,
        website: data.website,
        industry: data.industry,
        registrationNumber: data.registrationNumber,
        isActive: data.isActive,
        isSetup: data.isSetup,
      }
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'UPDATE',
        entityType: 'Enterprise',
        entityId: enterprise.id,
        oldValue: existing,
        newValue: enterprise,
        details: { message: `Enterprise "${enterprise.name}" updated` }
      }
    });
    
    return NextResponse.json(enterprise);
  } catch (error) {
    console.error('Error updating enterprise:', error);
    return NextResponse.json({ error: 'Failed to update enterprise' }, { status: 500 });
  }
}
