import { NextRequest, NextResponse } from 'next/server';
import {
  loadSimulatorsConfig,
  getLocalHost,
  normalizeSimulatorEntry,
  checkSimulatorsLiveness,
} from '@/lib/simulators';

/**
 * GET /api/simulators
 * Returns list of simulators from config (single file or modular files) with normalized connection info (local + docker).
 * Query: ?live=true to run TCP liveness check and return status 'running' | 'stopped' per simulator.
 */
export async function GET(request: NextRequest) {
  try {
    const { simulators: list } = loadSimulatorsConfig();
    const localHost = getLocalHost();

    let simulators = (Array.isArray(list) ? list : []).map((item) =>
      normalizeSimulatorEntry(item as { id: string; name: string; type: string; port: number; enabled?: boolean; description?: string; status?: string }, localHost)
    );

    const live = request.nextUrl.searchParams.get('live');
    if (live === 'true' || live === '1') {
      simulators = await checkSimulatorsLiveness(simulators);
    }

    return NextResponse.json(simulators);
  } catch (error) {
    console.error('Error reading simulators config:', error);
    return NextResponse.json(
      { error: 'Failed to load simulators configuration' },
      { status: 500 }
    );
  }
}
