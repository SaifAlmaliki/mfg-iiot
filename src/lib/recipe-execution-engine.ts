/**
 * Recipe execution engine: S88-style state machine for ProductionRun.
 * Validates and applies commands (Start, Hold, Resume, Abort, Complete, StepComplete, Reset),
 * persists state and transitions, and optionally broadcasts run:update via Socket.IO.
 */

import { db } from '@/lib/db';
import { getSocketIO } from '@/lib/socketio-server';

export type RunCommand =
  | 'START'
  | 'HOLD'
  | 'RESUME'
  | 'ABORT'
  | 'COMPLETE'
  | 'STEP_COMPLETE'
  | 'RESET';

/** Allowed next states for each current state (by command). */
const TRANSITIONS: Record<string, Partial<Record<RunCommand, string>>> = {
  IDLE: { START: 'RUNNING' },
  RUNNING: {
    HOLD: 'HELD',
    RESUME: 'RUNNING',
    ABORT: 'ABORTED',
    COMPLETE: 'COMPLETE',
    STEP_COMPLETE: 'RUNNING',
  },
  HELD: { RESUME: 'RUNNING' },
  COMPLETE: { RESET: 'IDLE' },
  ABORTED: { RESET: 'IDLE' },
  STOPPED: { RESET: 'IDLE' },
};

/** Status field (high-level) to set for each S88 state. */
function statusForState(state: string): string {
  switch (state) {
    case 'IDLE':
    case 'RESETTING':
      return 'IDLE';
    case 'RUNNING':
    case 'HOLDING':
    case 'RESTARTING':
    case 'COMPLETING':
      return 'RUNNING';
    case 'HELD':
      return 'HELD';
    case 'COMPLETE':
    case 'STOPPED':
      return 'COMPLETE';
    case 'ABORTING':
    case 'ABORTED':
      return 'ABORTED';
    default:
      return state;
  }
}

export function getAllowedTransitions(state: string): RunCommand[] {
  const normalized = (state || 'IDLE').toUpperCase();
  const map = TRANSITIONS[normalized];
  if (!map) return [];
  return Object.keys(map) as RunCommand[];
}

export function canApplyCommand(state: string, command: RunCommand): boolean {
  const allowed = getAllowedTransitions(state || 'IDLE');
  if (command === 'STEP_COMPLETE') return allowed.includes('STEP_COMPLETE');
  return allowed.includes(command);
}

interface RecipeStep {
  step?: number;
  name?: string;
  duration?: number;
  description?: string;
  [key: string]: unknown;
}

function getRecipeSteps(recipe: { steps: unknown } | null): RecipeStep[] {
  if (!recipe?.steps) return [];
  const s = recipe.steps;
  if (!Array.isArray(s)) return [];
  return s as RecipeStep[];
}

/** Broadcast run update to Socket.IO room "runs" and "run:{id}". */
function broadcastRunUpdate(payload: {
  id: string;
  status: string;
  state: string | null;
  phase: string | null;
  step: string | null;
  stepIndex: number;
  progress: number;
  updatedAt: Date;
}) {
  const io = getSocketIO();
  if (!io) return;
  io.to('runs').emit('run:update', payload);
  io.to(`run:${payload.id}`).emit('run:update', payload);
}

export async function applyCommand(
  runId: string,
  command: RunCommand,
  userId?: string
): Promise<{
  id: string;
  runNumber: string;
  status: string;
  state: string | null;
  phase: string | null;
  step: string | null;
  stepIndex: number;
  progress: number;
  startedAt: Date | null;
  endedAt: Date | null;
  recipeId: string | null;
  orderId: string | null;
  workCenterId: string;
  createdAt: Date;
  updatedAt: Date;
}> {
  const run = await db.productionRun.findUnique({
    where: { id: runId },
    include: { recipe: true },
  });

  if (!run) {
    throw new Error('RUN_NOT_FOUND');
  }

  const currentState = (run.state || run.status || 'IDLE').toUpperCase();

  if (command === 'STEP_COMPLETE') {
    if (currentState !== 'RUNNING') {
      throw new Error('INVALID_TRANSITION');
    }
    const steps = getRecipeSteps(run.recipe);
    const stepIndex = run.stepIndex ?? 0;
    const nextIndex = stepIndex + 1;
    if (steps.length === 0) {
      await db.productionRunStateTransition.create({
        data: {
          runId,
          fromState: currentState,
          toState: currentState,
          trigger: command,
          userId: userId ?? null,
        },
      });
      const updated = await db.productionRun.findUnique({
        where: { id: runId },
        select: {
          id: true,
          runNumber: true,
          status: true,
          state: true,
          phase: true,
          step: true,
          stepIndex: true,
          progress: true,
          startedAt: true,
          endedAt: true,
          recipeId: true,
          orderId: true,
          workCenterId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!updated) throw new Error('RUN_NOT_FOUND');
      broadcastRunUpdate(updated);
      return updated;
    }
    if (nextIndex >= steps.length) {
      await db.productionRunStateTransition.create({
        data: {
          runId,
          fromState: currentState,
          toState: 'COMPLETE',
          trigger: command,
          userId: userId ?? null,
        },
      });
      const updated = await db.productionRun.update({
        where: { id: runId },
        data: {
          status: 'COMPLETE',
          state: 'COMPLETE',
          stepIndex: steps.length,
          phase: null,
          step: null,
          progress: 100,
          endedAt: new Date(),
        },
        select: {
          id: true,
          runNumber: true,
          status: true,
          state: true,
          phase: true,
          step: true,
          stepIndex: true,
          progress: true,
          startedAt: true,
          endedAt: true,
          recipeId: true,
          orderId: true,
          workCenterId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      broadcastRunUpdate(updated);
      return updated;
    }
    const nextStep = steps[nextIndex];
    const phase = nextStep?.name ?? `Step ${nextIndex + 1}`;
    const progress = Math.round((nextIndex / steps.length) * 100);
    await db.productionRunStateTransition.create({
      data: {
        runId,
        fromState: currentState,
        toState: currentState,
        trigger: command,
        userId: userId ?? null,
      },
    });
    const updated = await db.productionRun.update({
      where: { id: runId },
      data: {
        stepIndex: nextIndex,
        phase,
        step: nextStep?.name ?? null,
        progress,
      },
      select: {
        id: true,
        runNumber: true,
        status: true,
        state: true,
        phase: true,
        step: true,
        stepIndex: true,
        progress: true,
        startedAt: true,
        endedAt: true,
        recipeId: true,
        orderId: true,
        workCenterId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    broadcastRunUpdate(updated);
    return updated;
  }

  if (!canApplyCommand(currentState, command)) {
    throw new Error('INVALID_TRANSITION');
  }

  const nextStateMap = TRANSITIONS[currentState];
  const nextState = nextStateMap?.[command];
  if (!nextState && command !== 'RESET') {
    throw new Error('INVALID_TRANSITION');
  }

  const toState = nextState ?? 'IDLE';
  const status = statusForState(toState);

  const updateData: {
    status: string;
    state: string;
    phase?: string | null;
    step?: string | null;
    stepIndex?: number;
    progress?: number;
    startedAt?: Date | null;
    endedAt?: Date | null;
  } = {
    status,
    state: toState,
  };

  if (command === 'START') {
    updateData.startedAt = new Date();
    updateData.stepIndex = 0;
    const steps = getRecipeSteps(run.recipe);
    if (steps.length > 0) {
      const first = steps[0];
      updateData.phase = first?.name ?? 'Step 1';
      updateData.step = first?.name ?? null;
      updateData.progress = 0;
    }
  } else if (toState === 'COMPLETE' || toState === 'ABORTED') {
    updateData.endedAt = new Date();
    if (toState === 'COMPLETE') updateData.progress = 100;
  } else if (command === 'RESET') {
    updateData.phase = null;
    updateData.step = null;
    updateData.stepIndex = 0;
    updateData.progress = 0;
    updateData.startedAt = null;
    updateData.endedAt = null;
  }

  await db.productionRunStateTransition.create({
    data: {
      runId,
      fromState: currentState,
      toState,
      trigger: command,
      userId: userId ?? null,
    },
  });

  const updated = await db.productionRun.update({
    where: { id: runId },
    data: updateData,
    select: {
      id: true,
      runNumber: true,
      status: true,
      state: true,
      phase: true,
      step: true,
      stepIndex: true,
      progress: true,
      startedAt: true,
      endedAt: true,
      recipeId: true,
      orderId: true,
      workCenterId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  broadcastRunUpdate(updated);
  return updated;
}
