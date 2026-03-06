import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/lots/[id] - Get a single lot
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const lot = await db.materialLot.findUnique({
      where: { id },
      include: {
        product: true,
        genealogyFrom: {
          include: { toLot: { include: { product: true } } },
          take: 10,
          orderBy: { timestamp: 'desc' }
        },
        genealogyTo: {
          include: { fromLot: { include: { product: true } } },
          take: 10,
          orderBy: { timestamp: 'desc' }
        },
        shipmentLots: {
          include: {
            shipment: { include: { customer: true } }
          }
        },
        consumptions: {
          include: {
            run: { select: { runNumber: true, status: true } }
          },
          take: 20,
          orderBy: { timestamp: 'desc' }
        }
      }
    });
    
    if (!lot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }
    
    // Serialize dates
    return NextResponse.json({
      ...lot,
      expiryDate: lot.expiryDate?.toISOString() || null,
      receivedDate: lot.receivedDate.toISOString(),
      createdAt: lot.createdAt.toISOString(),
      updatedAt: lot.updatedAt.toISOString()
    });
  } catch (error) {
    console.error('Error fetching lot:', error);
    return NextResponse.json({ error: 'Failed to fetch lot' }, { status: 500 });
  }
}

// PUT /api/lots/[id] - Update a lot
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Check if lot exists
    const existingLot = await db.materialLot.findUnique({
      where: { id }
    });
    
    if (!existingLot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }
    
    // Extract updatable fields
    const {
      lotNumber,
      externalLot,
      quantity,
      remainingQty,
      status,
      expiryDate,
      supplierName,
      supplierCode,
      location,
      notes,
      customFields
    } = body;
    
    // If changing lot number, check for duplicates
    if (lotNumber && lotNumber !== existingLot.lotNumber) {
      const duplicate = await db.materialLot.findUnique({
        where: { lotNumber }
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Lot number already exists' },
          { status: 400 }
        );
      }
    }
    
    // Build update data
    const updateData: any = {};
    if (lotNumber !== undefined) updateData.lotNumber = lotNumber;
    if (externalLot !== undefined) updateData.externalLot = externalLot;
    if (quantity !== undefined) updateData.quantity = parseFloat(quantity);
    if (remainingQty !== undefined) updateData.remainingQty = parseFloat(remainingQty);
    if (status !== undefined) updateData.status = status;
    if (expiryDate !== undefined) updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (supplierName !== undefined) updateData.supplierName = supplierName;
    if (supplierCode !== undefined) updateData.supplierCode = supplierCode;
    if (location !== undefined) updateData.location = location;
    if (notes !== undefined) updateData.notes = notes;
    if (customFields !== undefined) updateData.customFields = customFields;
    
    const lot = await db.materialLot.update({
      where: { id },
      data: updateData,
      include: { product: true }
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'UPDATE',
        entityType: 'MaterialLot',
        entityId: lot.id,
        oldValue: existingLot,
        newValue: lot,
        details: { message: `Updated lot ${lot.lotNumber}` }
      }
    });
    
    return NextResponse.json({
      ...lot,
      expiryDate: lot.expiryDate?.toISOString() || null,
      receivedDate: lot.receivedDate.toISOString(),
      createdAt: lot.createdAt.toISOString(),
      updatedAt: lot.updatedAt.toISOString()
    });
  } catch (error) {
    console.error('Error updating lot:', error);
    return NextResponse.json({ error: 'Failed to update lot' }, { status: 500 });
  }
}

// DELETE /api/lots/[id] - Delete a lot
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if lot exists
    const existingLot = await db.materialLot.findUnique({
      where: { id },
      include: {
        genealogyFrom: true,
        genealogyTo: true,
        consumptions: true,
        shipmentLots: true
      }
    });
    
    if (!existingLot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }
    
    // Check if lot has genealogy records
    if (existingLot.genealogyFrom.length > 0 || existingLot.genealogyTo.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete lot with genealogy records' },
        { status: 400 }
      );
    }
    
    // Check if lot is in shipments
    if (existingLot.shipmentLots.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete lot that is in shipments' },
        { status: 400 }
      );
    }
    
    // Delete consumptions first
    await db.materialConsumption.deleteMany({
      where: { lotId: id }
    });
    
    // Delete the lot
    await db.materialLot.delete({
      where: { id }
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'DELETE',
        entityType: 'MaterialLot',
        entityId: id,
        oldValue: existingLot,
        details: { message: `Deleted lot ${existingLot.lotNumber}` }
      }
    });
    
    return NextResponse.json({ success: true, message: 'Lot deleted successfully' });
  } catch (error) {
    console.error('Error deleting lot:', error);
    return NextResponse.json({ error: 'Failed to delete lot' }, { status: 500 });
  }
}
