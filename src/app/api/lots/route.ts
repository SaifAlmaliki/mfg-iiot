import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/lots - List all material lots
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const productId = searchParams.get('productId');
    const lotNumber = searchParams.get('lotNumber');
    
    const lots = await db.materialLot.findMany({
      where: {
        ...(status && { status }),
        ...(productId && { productId }),
        ...(lotNumber && { lotNumber: { contains: lotNumber } })
      },
      include: {
        product: { 
          select: { 
            id: true,
            name: true, 
            code: true, 
            unit: true, 
            productType: true 
          } 
        }
      },
      orderBy: { receivedDate: 'desc' }
    });
    
    // Serialize dates for JSON
    const serializedLots = lots.map(lot => ({
      ...lot,
      expiryDate: lot.expiryDate?.toISOString() || null,
      receivedDate: lot.receivedDate.toISOString(),
      createdAt: lot.createdAt.toISOString(),
      updatedAt: lot.updatedAt.toISOString()
    }));
    
    return NextResponse.json(serializedLots);
  } catch (error) {
    console.error('Error fetching lots:', error);
    return NextResponse.json({ error: 'Failed to fetch lots' }, { status: 500 });
  }
}

// POST /api/lots - Create a new material lot
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      lotNumber, 
      externalLot,
      quantity, 
      expiryDate, 
      supplierName, 
      supplierCode,
      location, 
      notes,
      customFields,
      productId 
    } = body;
    
    // Validate required fields
    if (!lotNumber || !quantity || !productId) {
      return NextResponse.json(
        { error: 'Lot number, quantity, and product are required' },
        { status: 400 }
      );
    }
    
    // Check for duplicate lot number
    const existingLot = await db.materialLot.findUnique({
      where: { lotNumber }
    });
    
    if (existingLot) {
      return NextResponse.json(
        { error: 'Lot number already exists' },
        { status: 400 }
      );
    }
    
    const lot = await db.materialLot.create({
      data: {
        lotNumber,
        externalLot: externalLot || null,
        quantity: parseFloat(quantity),
        remainingQty: parseFloat(quantity),
        status: 'AVAILABLE',
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        receivedDate: new Date(),
        supplierName: supplierName || null,
        supplierCode: supplierCode || null,
        location: location || null,
        notes: notes || null,
        customFields: customFields || null,
        productId
      },
      include: {
        product: true
      }
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'MaterialLot',
        entityId: lot.id,
        newValue: lot,
        details: { message: `Created lot ${lotNumber}` }
      }
    });
    
    return NextResponse.json({
      ...lot,
      expiryDate: lot.expiryDate?.toISOString() || null,
      receivedDate: lot.receivedDate.toISOString(),
      createdAt: lot.createdAt.toISOString(),
      updatedAt: lot.updatedAt.toISOString()
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating lot:', error);
    return NextResponse.json({ error: 'Failed to create lot' }, { status: 500 });
  }
}
