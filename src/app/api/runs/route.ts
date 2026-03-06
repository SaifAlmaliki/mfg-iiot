import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession, hasPermission } from '@/lib/auth-config';
import { PERMISSIONS } from '@/lib/permissions';

const RUN_LIST_INCLUDE = {
  recipe: { select: { id: true, name: true, version: true, status: true } },
  order: { select: { id: true, orderNumber: true, status: true } },
  workCenter: { select: { id: true, name: true, code: true } },
  _count: { select: { stateTransitions: true } },
} as const;

/**
 * GET /api/runs
 * Query params: status, workCenterId, orderId, recipeId, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasPermission(session, PERMISSIONS.MES_VIEW) && !hasPermission(session, PERMISSIONS.BATCHES_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const workCenterId = searchParams.get('workCenterId');
    const orderId = searchParams.get('orderId');
    const recipeId = searchParams.get('recipeId');
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (workCenterId) where.workCenterId = workCenterId;
    if (orderId) where.orderId = orderId;
    if (recipeId) where.recipeId = recipeId;

    const [runs, total] = await Promise.all([
      db.productionRun.findMany({
        where,
        include: RUN_LIST_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      db.productionRun.count({ where }),
    ]);

    return NextResponse.json({ data: runs, total, limit, offset });
  } catch (error) {
    console.error('[API] GET /api/runs error:', error);
    return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 });
  }
}

/**
 * POST /api/runs
 * Body: runNumber, workCenterId, recipeId, orderId?, quantity?, parameters?
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasPermission(session, PERMISSIONS.MES_EDIT) && !hasPermission(session, PERMISSIONS.BATCHES_CONTROL)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { runNumber, workCenterId, recipeId, orderId, quantity, parameters } = body;

    if (!runNumber || !workCenterId || !recipeId) {
      return NextResponse.json(
        { error: 'runNumber, workCenterId, and recipeId are required' },
        { status: 400 }
      );
    }

    const existing = await db.productionRun.findUnique({
      where: { runNumber: String(runNumber).trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'A run with this run number already exists' },
        { status: 400 }
      );
    }

    const recipe = await db.recipe.findUnique({
      where: { id: recipeId },
      select: { id: true, status: true },
    });
    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }
    if (recipe.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Recipe must be ACTIVE to start a run' },
        { status: 400 }
      );
    }

    const workCenter = await db.workCenter.findUnique({
      where: { id: workCenterId },
      select: { id: true },
    });
    if (!workCenter) {
      return NextResponse.json({ error: 'Work center not found' }, { status: 404 });
    }

    const run = await db.productionRun.create({
      data: {
        runNumber: String(runNumber).trim(),
        workCenterId,
        recipeId,
        orderId: orderId || null,
        quantity: quantity != null ? Number(quantity) : null,
        parameters: parameters ?? undefined,
        status: 'IDLE',
        state: 'IDLE',
        stepIndex: 0,
        progress: 0,
      },
      include: RUN_LIST_INCLUDE,
    });

    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/runs error:', error);
    return NextResponse.json({ error: 'Failed to create run' }, { status: 500 });
  }
}
