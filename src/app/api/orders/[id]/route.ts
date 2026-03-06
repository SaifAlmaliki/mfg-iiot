import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/orders/[id] - Get a single production order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const order = await db.productionOrder.findUnique({
      where: { id },
      include: {
        workCenter: { 
          include: { area: { include: { site: true } } } 
        },
        recipe: { 
          include: { 
            product: true,
            recipeMaterials: { include: { material: true } }
          } 
        },
        productionRuns: {
          include: {
            batchUnits: { include: { workUnit: true } },
            consumptions: { include: { lot: { include: { product: true } } } }
          }
        }
      }
    });
    
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    return NextResponse.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

// PUT /api/orders/[id] - Update a production order
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Check if order exists
    const existingOrder = await db.productionOrder.findUnique({
      where: { id }
    });
    
    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    // Extract updatable fields
    const {
      orderNumber,
      externalId,
      status,
      quantity,
      producedQty,
      scrapQty,
      plannedStart,
      plannedEnd,
      actualStart,
      actualEnd,
      priority,
      notes,
      workCenterId,
      recipeId
    } = body;
    
    // If changing order number, check for duplicates
    if (orderNumber && orderNumber !== existingOrder.orderNumber) {
      const duplicate = await db.productionOrder.findUnique({
        where: { orderNumber }
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Order number already exists' },
          { status: 400 }
        );
      }
    }
    
    // Build update data
    const updateData: any = {};
    if (orderNumber !== undefined) updateData.orderNumber = orderNumber;
    if (externalId !== undefined) updateData.externalId = externalId;
    if (status !== undefined) updateData.status = status;
    if (quantity !== undefined) updateData.quantity = parseFloat(quantity);
    if (producedQty !== undefined) updateData.producedQty = parseFloat(producedQty);
    if (scrapQty !== undefined) updateData.scrapQty = parseFloat(scrapQty);
    if (plannedStart !== undefined) updateData.plannedStart = plannedStart ? new Date(plannedStart) : null;
    if (plannedEnd !== undefined) updateData.plannedEnd = plannedEnd ? new Date(plannedEnd) : null;
    if (actualStart !== undefined) updateData.actualStart = actualStart ? new Date(actualStart) : null;
    if (actualEnd !== undefined) updateData.actualEnd = actualEnd ? new Date(actualEnd) : null;
    if (priority !== undefined) updateData.priority = parseInt(priority);
    if (notes !== undefined) updateData.notes = notes;
    if (workCenterId !== undefined) updateData.workCenterId = workCenterId;
    if (recipeId !== undefined) updateData.recipeId = recipeId;
    
    const order = await db.productionOrder.update({
      where: { id },
      data: updateData,
      include: {
        workCenter: true,
        recipe: { include: { product: true } }
      }
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'UPDATE',
        entityType: 'ProductionOrder',
        entityId: order.id,
        oldValue: existingOrder,
        newValue: order,
        details: { message: `Updated order ${order.orderNumber}` }
      }
    });
    
    return NextResponse.json(order);
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

// DELETE /api/orders/[id] - Delete a production order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if order exists
    const existingOrder = await db.productionOrder.findUnique({
      where: { id },
      include: { productionRuns: true }
    });
    
    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    // Check if order has running productions
    const runningProductions = existingOrder.productionRuns.filter(
      run => run.status === 'RUNNING'
    );
    
    if (runningProductions.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete order with running production runs' },
        { status: 400 }
      );
    }
    
    // Delete associated production runs first
    await db.productionRun.deleteMany({
      where: { orderId: id }
    });
    
    // Delete the order
    await db.productionOrder.delete({
      where: { id }
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'DELETE',
        entityType: 'ProductionOrder',
        entityId: id,
        oldValue: existingOrder,
        details: { message: `Deleted order ${existingOrder.orderNumber}` }
      }
    });
    
    return NextResponse.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 });
  }
}
