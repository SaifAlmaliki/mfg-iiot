/**
 * Shared frontend types and constants for simulator UI.
 * Matches GET /api/simulators response shape.
 */

export interface SimulatorEntry {
  id: string;
  name: string;
  type: string;
  port: number;
  enabled: boolean;
  description: string;
  status: string;
  connection: {
    local: string;
    docker: string;
    endpointLocal?: string;
    endpointDocker?: string;
  };
}

/** Display order for grouping simulators by type. */
export const SIMULATOR_TYPE_ORDER = ['modbus', 'opcua', 'energymeter'] as const;

/** Human-readable labels for simulator types. */
export const SIMULATOR_TYPE_LABELS: Record<string, string> = {
  modbus: 'Modbus TCP',
  opcua: 'OPC UA',
  energymeter: 'Energy Meter',
};

/** Format simulator type for display (short form for cards/lists). */
export function formatSimulatorType(type: string): string {
  const t = (type || '').toLowerCase();
  if (t === 'energymeter') return 'Energy meter';
  if (t === 'opcua') return 'OPC UA';
  if (t === 'modbus') return 'Modbus';
  return (type || '').toUpperCase();
}

/** Format status for display (capitalized). */
export function formatSimulatorStatus(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'running') return 'Running';
  if (s === 'stopped') return 'Stopped';
  return status || 'Unknown';
}

/** Group simulators by type using shared order and labels. */
export function groupSimulatorsByType<T extends { type: string }>(
  simulators: T[],
  order: readonly string[] = SIMULATOR_TYPE_ORDER,
  labels: Record<string, string> = SIMULATOR_TYPE_LABELS
): { type: string; label: string; items: T[] }[] {
  const byType = new Map<string, T[]>();
  for (const sim of simulators) {
    const t = (sim.type || '').toLowerCase();
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t)!.push(sim);
  }
  const ordered: { type: string; label: string; items: T[] }[] = (
    order as readonly string[]
  ).filter((t) => byType.has(t)).map((type) => ({
    type,
    label: labels[type] ?? type,
    items: byType.get(type)!,
  }));
  for (const [type] of byType) {
    if ((order as readonly string[]).includes(type)) continue;
    ordered.push({ type, label: labels[type] ?? type, items: byType.get(type)! });
  }
  return ordered;
}
