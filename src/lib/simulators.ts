/**
 * Shared simulator config types and normalization (DRY).
 * Used by API route only (server-side); types can be imported by frontend for type safety.
 */

import path from 'path';

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
    /** Endpoint URL: opc.tcp://host:port for Modbus/OPC UA, tcp://host:port for others */
    endpointLocal?: string;
    endpointDocker?: string;
  };
}

interface RawSimulator {
  id: string;
  name: string;
  type: string;
  port: number;
  enabled?: boolean;
  description?: string;
  status?: string;
  config?: unknown;
}

/**
 * Returns the filesystem path to simulators.json.
 * Override with SIMULATORS_CONFIG_PATH (absolute or relative to cwd).
 */
export function getSimulatorsConfigPath(): string {
  const envPath = process.env.SIMULATORS_CONFIG_PATH;
  if (envPath) return envPath;
  return path.join(process.cwd(), 'simulators', 'simulators.json');
}

/**
 * Local host for connection display (e.g. localhost or NEXT_PUBLIC_SIMULATORS_HOST).
 * Only used server-side when building response; frontend may also read NEXT_PUBLIC_ for display.
 */
export function getLocalHost(): string {
  return process.env.NEXT_PUBLIC_SIMULATORS_HOST || 'localhost';
}

/**
 * Docker Compose service name per simulator type (one container per type, multiple ports).
 * Used for connection.docker: e.g. modbus-simulator:5020, opcua-simulator:4840.
 */
const DOCKER_SERVICE_BY_TYPE: Record<string, string> = {
  modbus: 'modbus-simulator',
  opcua: 'opcua-simulator',
  energymeter: 'energymeter-simulator',
};

function getDockerServiceName(type: string): string {
  return DOCKER_SERVICE_BY_TYPE[type?.toLowerCase()] ?? (type || 'simulator');
}

/**
 * Normalize a raw simulator from JSON into the API shape with connection strings.
 * Local: localHost:port. Docker: Compose service name for that type + port.
 * Endpoint URL: opc.tcp:// for Modbus and OPC UA (e.g. opc.tcp://localhost:5040), tcp:// for energymeter.
 */
export function normalizeSimulatorEntry(
  raw: RawSimulator,
  localHost: string
): SimulatorEntry {
  const port = Number(raw.port) || 0;
  const dockerService = getDockerServiceName(raw.type);
  const type = String(raw.type ?? '').toLowerCase();
  const useOpcTcp = type === 'modbus' || type === 'opcua';
  const scheme = useOpcTcp ? 'opc.tcp' : 'tcp';
  return {
    id: String(raw.id ?? '').trim() || raw.name?.replace(/\s+/g, '-').toLowerCase() || 'simulator',
    name: String(raw.name ?? ''),
    type: String(raw.type ?? ''),
    port,
    enabled: raw.enabled !== false,
    description: String(raw.description ?? ''),
    status: String(raw.status ?? 'unknown'),
    connection: {
      local: `${localHost}:${port}`,
      docker: `${dockerService}:${port}`,
      endpointLocal: `${scheme}://${localHost}:${port}`,
      endpointDocker: `${scheme}://${dockerService}:${port}`,
    },
  };
}
