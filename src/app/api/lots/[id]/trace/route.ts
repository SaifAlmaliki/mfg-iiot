import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/lots/[id]/trace - Trace lot forward and backward
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if lot exists
    const lot = await db.materialLot.findUnique({
      where: { id },
      include: { product: true }
    });
    
    if (!lot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }
    
    // Get backward trace (where this lot came from)
    const backwardGenealogy = await db.genealogy.findMany({
      where: { toLotId: id },
      include: {
        fromLot: { include: { product: { select: { name: true, code: true } } } },
        run: { select: { runNumber: true, status: true } }
      },
      orderBy: { timestamp: 'desc' }
    });
    
    // Recursively get all source lots
    const backward = await getBackwardTrace(id, new Set([id]));
    
    // Get forward trace (where this lot went)
    const forwardGenealogy = await db.genealogy.findMany({
      where: { fromLotId: id },
      include: {
        toLot: { include: { product: { select: { name: true, code: true } } } },
        run: { select: { runNumber: true, status: true } }
      },
      orderBy: { timestamp: 'asc' }
    });
    
    // Recursively get all destination lots
    const forward = await getForwardTrace(id, new Set([id]));
    
    // Serialize dates
    const serializeGenealogy = (g: any) => ({
      ...g,
      timestamp: g.timestamp.toISOString()
    });
    
    return NextResponse.json({
      lot: {
        ...lot,
        expiryDate: lot.expiryDate?.toISOString() || null,
        receivedDate: lot.receivedDate.toISOString(),
        createdAt: lot.createdAt.toISOString(),
        updatedAt: lot.updatedAt.toISOString()
      },
      forward: forward.map(serializeGenealogy),
      backward: backward.map(serializeGenealogy)
    });
  } catch (error) {
    console.error('Error tracing lot:', error);
    return NextResponse.json({ error: 'Failed to trace lot' }, { status: 500 });
  }
}

// Recursively get backward trace
async function getBackwardTrace(lotId: string, visited: Set<string>): Promise<any[]> {
  const results: any[] = [];
  
  const genealogy = await db.genealogy.findMany({
    where: { toLotId: lotId },
    include: {
      fromLot: { include: { product: { select: { name: true, code: true } } } },
      toLot: { include: { product: { select: { name: true, code: true } } } },
      run: { select: { runNumber: true, status: true } }
    }
  });
  
  for (const g of genealogy) {
    results.push(g);
    
    // Recursively trace source lots (if not already visited)
    if (g.fromLotId && !visited.has(g.fromLotId)) {
      visited.add(g.fromLotId);
      const childResults = await getBackwardTrace(g.fromLotId, visited);
      results.push(...childResults);
    }
  }
  
  return results;
}

// Recursively get forward trace
async function getForwardTrace(lotId: string, visited: Set<string>): Promise<any[]> {
  const results: any[] = [];
  
  const genealogy = await db.genealogy.findMany({
    where: { fromLotId: lotId },
    include: {
      fromLot: { include: { product: { select: { name: true, code: true } } } },
      toLot: { include: { product: { select: { name: true, code: true } } } },
      run: { select: { runNumber: true, status: true } }
    }
  });
  
  for (const g of genealogy) {
    results.push(g);
    
    // Recursively trace destination lots (if not already visited)
    if (g.toLotId && !visited.has(g.toLotId)) {
      visited.add(g.toLotId);
      const childResults = await getForwardTrace(g.toLotId, visited);
      results.push(...childResults);
    }
  }
  
  return results;
}
