import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import {
  getSimulatorsConfigPath,
  getLocalHost,
  normalizeSimulatorEntry,
  checkSimulatorsLiveness,
} from '@/lib/simulators';

/**
 * GET /api/simulators
 * Returns list of simulators from simulators.json with normalized connection info (local + docker).
 * Query: ?live=true to run TCP liveness check and return status 'running' | 'stopped' per simulator.
 */
export async function GET(request: NextRequest) {
  try {
    const configPath = getSimulatorsConfigPath();
    const raw = fs.readFileSync(configPath, 'utf-8');
    const data = JSON.parse(raw) as { simulators?: unknown[] };
    const list = Array.isArray(data.simulators) ? data.simulators : [];
    const localHost = getLocalHost();

    let simulators = list.map((item) =>
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
