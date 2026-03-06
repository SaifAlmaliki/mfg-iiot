import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/orders - List all production orders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const workCenterId = searchParams.get('workCenterId');
    
    const orders = await db.productionOrder.findMany({
      where: {
        ...(status && { status }),
        ...(workCenterId && { workCenterId })
      },
      include: {
        workCenter: { 
          select: { id: true, name: true, code: true, type: true } 
        },
        recipe: { 
          select: { id: true, name: true, version: true, product: true } 
        },
        productionRuns: {
          select: { id: true, runNumber: true, status: true, progress: true }
        }
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' }
      ]
    });
    
    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

// POST /api/orders - Create a new production order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      orderNumber, 
      externalId,
      quantity, 
      plannedStart, 
      plannedEnd, 
      priority, 
      notes, 
      workCenterId, 
      recipeId 
    } = body;
    
    // Validate required fields
    if (!orderNumber || !quantity) {
      return NextResponse.json(
        { error: 'Order number and quantity are required' },
        { status: 400 }
      );
    }
    
    // Check if order number already exists
    const existingOrder = await db.productionOrder.findUnique({
      where: { orderNumber }
    });
    
    if (existingOrder) {
      return NextResponse.json(
        { error: 'Order number already exists' },
        { status: 400 }
      );
    }
    
    const order = await db.productionOrder.create({
      data: {
        orderNumber,
        externalId: externalId || null,
        quantity: parseFloat(quantity),
        producedQty: 0,
        scrapQty: 0,
        plannedStart: plannedStart ? new Date(plannedStart) : null,
        plannedEnd: plannedEnd ? new Date(plannedEnd) : null,
        priority: parseInt(priority) || 3,
        notes: notes || null,
        workCenterId: workCenterId || null,
        recipeId: recipeId || null,
        status: 'CREATED'
      },
      include: {
        workCenter: true,
        recipe: { include: { product: true } }
      }
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'ProductionOrder',
        entityId: order.id,
        newValue: order,
        details: { message: `Created order ${orderNumber}` }
      }
    });
    
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
