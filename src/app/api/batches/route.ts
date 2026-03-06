import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/batches - List all batches
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const lineId = searchParams.get('lineId');
    const orderId = searchParams.get('orderId');
    
    const batches = await db.batch.findMany({
      where: {
        ...(status && { status }),
        ...(lineId && { lineId }),
        ...(orderId && { orderId })
      },
      include: {
        line: { select: { name: true, code: true } },
        order: { select: { orderNumber: true } },
        recipe: { select: { name: true, version: true } },
        units: {
          include: {
            unit: { select: { name: true, code: true, type: true } }
          }
        },
        consumptions: {
          include: {
            lot: {
              include: {
                material: { select: { name: true, code: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json(batches);
  } catch (error) {
    console.error('Error fetching batches:', error);
    return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 });
  }
}

// POST /api/batches - Create a new batch
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batchNumber, quantity, lineId, orderId, recipeId, parameters } = body;
    
    const batch = await db.batch.create({
      data: {
        batchNumber,
        quantity,
        lineId,
        orderId,
        recipeId,
        parameters: parameters ? JSON.stringify(parameters) : null,
        status: 'IDLE',
        progress: 0
      }
    });
    
    return NextResponse.json(batch, { status: 201 });
  } catch (error) {
    console.error('Error creating batch:', error);
    return NextResponse.json({ error: 'Failed to create batch' }, { status: 500 });
  }
}
