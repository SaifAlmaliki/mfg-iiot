import { NextResponse } from 'next/server';
import fs from 'fs';
import {
  getSimulatorsConfigPath,
  getLocalHost,
  normalizeSimulatorEntry,
} from '@/lib/simulators';

/**
 * GET /api/simulators
 * Returns list of simulators from simulators.json with normalized connection info (local + docker).
 * Config path: SIMULATORS_CONFIG_PATH or simulators/simulators.json
 */
export async function GET() {
  try {
    const configPath = getSimulatorsConfigPath();
    const raw = fs.readFileSync(configPath, 'utf-8');
    const data = JSON.parse(raw) as { simulators?: unknown[] };
    const list = Array.isArray(data.simulators) ? data.simulators : [];
    const localHost = getLocalHost();

    const simulators = list.map((item) =>
      normalizeSimulatorEntry(item as { id: string; name: string; type: string; port: number; enabled?: boolean; description?: string; status?: string }, localHost)
    );

    return NextResponse.json(simulators);
  } catch (error) {
    console.error('Error reading simulators config:', error);
    return NextResponse.json(
      { error: 'Failed to load simulators configuration' },
      { status: 500 }
    );
  }
}
