import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession, hasPermission } from '@/lib/auth-config';
import { PERMISSIONS } from '@/lib/permissions';
import { applyCommand, type RunCommand } from '@/lib/recipe-execution-engine';

const RUN_DETAIL_INCLUDE = {
  recipe: { select: { id: true, name: true, version: true, status: true, steps: true, parameters: true } },
  order: { select: { id: true, orderNumber: true, status: true, quantity: true } },
  workCenter: { select: { id: true, name: true, code: true } },
  stateTransitions: { orderBy: { timestamp: 'desc' }, take: 50 },
  batchUnits: { include: { workUnit: { select: { id: true, name: true, code: true } } } },
  consumptions: { include: { lot: { include: { product: { select: { id: true, name: true, code: true } } } } } },
} as const;

const VALID_COMMANDS: RunCommand[] = ['START', 'HOLD', 'RESUME', 'ABORT', 'COMPLETE', 'STEP_COMPLETE', 'RESET'];

/**
 * GET /api/runs/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasPermission(session, PERMISSIONS.MES_VIEW) && !hasPermission(session, PERMISSIONS.BATCHES_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const run = await db.productionRun.findUnique({
      where: { id },
      include: RUN_DETAIL_INCLUDE,
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json(run);
  } catch (error) {
    console.error('[API] GET /api/runs/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch run' }, { status: 500 });
  }
}

/**
 * PATCH /api/runs/[id]
 * Body: { command: RunCommand, params?: object, userId?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasPermission(session, PERMISSIONS.MES_EDIT) && !hasPermission(session, PERMISSIONS.BATCHES_CONTROL)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const command = body?.command as string | undefined;
    const userId = body?.userId ?? session.id;

    if (!command || typeof command !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid command' },
        { status: 400 }
      );
    }

    const cmd = command.toUpperCase() as RunCommand;
    if (!VALID_COMMANDS.includes(cmd)) {
      return NextResponse.json(
        { error: `Invalid command. Allowed: ${VALID_COMMANDS.join(', ')}` },
        { status: 400 }
      );
    }

    const updated = await applyCommand(id, cmd, userId);

    const run = await db.productionRun.findUnique({
      where: { id },
      include: RUN_DETAIL_INCLUDE,
    });

    return NextResponse.json(run ?? updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to apply command';
    if (message === 'RUN_NOT_FOUND') {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }
    if (message === 'INVALID_TRANSITION') {
      return NextResponse.json(
        { error: 'Invalid state transition for this command' },
        { status: 400 }
      );
    }
    console.error('[API] PATCH /api/runs/[id] error:', error);
    return NextResponse.json({ error: 'Failed to apply command' }, { status: 500 });
  }
}
