/**
 * Energy Meter Simulator Service
 *
 * Simple Modbus‑style energy meter simulator that:
 * - Listens on ENERGY_METER_PORT (default 5010)
 * - Exposes a few registers per "meter" (voltage, current, power, energy, power factor, frequency)
 * - Periodically perturbs values with noise so they look alive
 *
 * This is intentionally much simpler than the full modbus/opcua services –
 * just enough to back the energymeter config.
 */

import { createServer, type Server as TCPServer, type Socket } from 'net';
import { loadSimulatorsConfig } from '../config-loader';

interface MeasurementGenerator {
  baseValue: number;
  noiseAmplitude: number;
}

interface MeterMeasurement {
  name: string;
  unit: string;
  value: number;
  generator?: MeasurementGenerator;
}

interface Meter {
  slaveId: number;
  name: string;
  measurements: MeterMeasurement[];
}

interface ServiceConfig {
  port: number;
  host: string;
  updateIntervalMs: number;
  meters: Meter[];
}

// JSON config entry from simulator config (modular or single file)
interface SimulatorConfigEntry {
  id?: string;
  name?: string;
  type?: string;
  port?: number;
  enabled?: boolean;
  config?: {
    updateInterval?: number;
    meters?: Array<{
      slaveId: number;
      name: string;
      measurements?: Array<{
        name: string;
        unit: string;
        value: number;
        generator?: { mode?: string; baseValue?: number; noise?: { type?: string; amplitude?: number } };
      }>;
    }>;
  };
}

const DEFAULT_CONFIG: ServiceConfig = {
  port: parseInt(process.env.ENERGY_METER_PORT || '5010', 10),
  host: '0.0.0.0',
  updateIntervalMs: 5000,
  meters: [
    {
      slaveId: 1,
      name: 'Main Panel Meter',
      measurements: [
        { name: 'Voltage L1', unit: 'V', value: 230, generator: { baseValue: 230, noiseAmplitude: 2 } },
        { name: 'Voltage L2', unit: 'V', value: 230, generator: { baseValue: 230, noiseAmplitude: 2 } },
        { name: 'Voltage L3', unit: 'V', value: 230, generator: { baseValue: 230, noiseAmplitude: 2 } },
        { name: 'Current L1', unit: 'A', value: 15, generator: { baseValue: 15, noiseAmplitude: 3 } },
        { name: 'Current L2', unit: 'A', value: 15, generator: { baseValue: 15, noiseAmplitude: 3 } },
        { name: 'Current L3', unit: 'A', value: 15, generator: { baseValue: 15, noiseAmplitude: 3 } },
        { name: 'Active Power', unit: 'kW', value: 10.5, generator: { baseValue: 10.5, noiseAmplitude: 1 } },
        { name: 'Reactive Power', unit: 'kvar', value: 3.2, generator: { baseValue: 3.2, noiseAmplitude: 0.5 } },
        { name: 'Power Factor', unit: '', value: 0.95, generator: { baseValue: 0.95, noiseAmplitude: 0.02 } },
        { name: 'Frequency', unit: 'Hz', value: 50, generator: { baseValue: 50, noiseAmplitude: 0.1 } },
      ],
    },
    {
      slaveId: 2,
      name: 'HVAC Panel Meter',
      measurements: [
        { name: 'Voltage', unit: 'V', value: 230, generator: { baseValue: 230, noiseAmplitude: 3 } },
        { name: 'Current', unit: 'A', value: 25, generator: { baseValue: 25, noiseAmplitude: 5 } },
        { name: 'Active Power', unit: 'kW', value: 5.8, generator: { baseValue: 5.8, noiseAmplitude: 0.5 } },
        { name: 'Power Factor', unit: '', value: 0.92, generator: { baseValue: 0.92, noiseAmplitude: 0.02 } },
        { name: 'Frequency', unit: 'Hz', value: 50, generator: { baseValue: 50, noiseAmplitude: 0.1 } },
      ],
    },
  ],
};

class EnergyMeterService {
  private config: ServiceConfig;
  private server: TCPServer | null = null;
  private sockets: Set<Socket> = new Set();
  private updateTimer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(config: Partial<ServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[EnergyMeter] Service already running');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const server = createServer((socket: Socket) => {
          this.handleConnection(socket);
        });

        this.server = server;

        server.on('error', (err) => {
          console.error('[EnergyMeter] Server error:', err);
        });

        server.listen(this.config.port, this.config.host, () => {
          this.isRunning = true;
          console.log(`[EnergyMeter] Service started on ${this.config.host}:${this.config.port}`);
          console.log(`[EnergyMeter] Simulating ${this.config.meters.length} meter(s)`);

          this.startUpdates();
          resolve();
        });
      } catch (err) {
        console.error('[EnergyMeter] Failed to start:', err);
        reject(err);
      }
    });
  }

  private handleConnection(socket: Socket): void {
    this.sockets.add(socket);
    console.log('[EnergyMeter] Client connected from', socket.remoteAddress);

    socket.on('close', () => {
      this.sockets.delete(socket);
      console.log('[EnergyMeter] Client disconnected');
    });

    socket.on('error', (err) => {
      console.error('[EnergyMeter] Socket error:', err);
      this.sockets.delete(socket);
    });
  }

  private startUpdates(): void {
    if (this.updateTimer) return;

    this.updateTimer = setInterval(() => {
      this.updateMeasurements();
    }, this.config.updateIntervalMs);
  }

  private updateMeasurements(): void {
    const now = new Date().toISOString();

    for (const meter of this.config.meters) {
      for (const m of meter.measurements) {
        if (!m.generator) continue;

        const noise =
          (Math.random() * 2 - 1) * m.generator.noiseAmplitude;

        let value = m.generator.baseValue + noise;

        // Keep some physical bounds reasonable
        if (m.name.startsWith('Voltage')) {
          value = Math.max(180, Math.min(260, value));
        }
        if (m.name.startsWith('Current')) {
          value = Math.max(0, value);
        }
        if (m.name.includes('Power Factor')) {
          value = Math.max(0.7, Math.min(1.0, value));
        }

        m.value = Math.round(value * 100) / 100;
      }
    }

    console.log(
      `[EnergyMeter] ${now} updated meters: ` +
        this.config.meters
          .map(
            (meter) =>
              `${meter.name} (S${meter.slaveId}) P=${meter.measurements.find((m) =>
                m.name.includes('Active Power'),
              )?.value ?? '-'}kW`,
          )
          .join(' | '),
    );
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('[EnergyMeter] Service not running');
      return;
    }

    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    for (const socket of this.sockets) {
      socket.destroy();
    }
    this.sockets.clear();

    await new Promise<void>((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.isRunning = false;
          console.log('[EnergyMeter] Service stopped');
          resolve();
        });
      } else {
        this.isRunning = false;
        resolve();
      }
    });
  }
}

function loadEnergyMeterEntries(): SimulatorConfigEntry[] {
  try {
    const { simulators } = loadSimulatorsConfig();
    return (Array.isArray(simulators) ? simulators : []).filter(
      (s) => (s as SimulatorConfigEntry).type === 'energymeter' && (s as SimulatorConfigEntry).enabled !== false
    ) as SimulatorConfigEntry[];
  } catch {
    return [];
  }
}

function mapEntryToServiceConfig(entry: SimulatorConfigEntry): ServiceConfig {
  const port = Number(entry.port) || 5010;
  const cfg = entry.config || {};
  const updateIntervalMs = cfg.updateInterval ?? 5000;
  const meters: Meter[] = (cfg.meters || []).map((m) => ({
    slaveId: m.slaveId,
    name: m.name,
    measurements: (m.measurements || []).map((mm) => ({
      name: mm.name,
      unit: mm.unit,
      value: mm.value,
      generator:
        mm.generator != null
          ? {
              baseValue: mm.generator.baseValue ?? mm.value,
              noiseAmplitude: mm.generator.noise?.amplitude ?? 0,
            }
          : undefined,
    })),
  }));
  return {
    port,
    host: '0.0.0.0',
    updateIntervalMs,
    meters: meters.length > 0 ? meters : DEFAULT_CONFIG.meters,
  };
}

async function main(): Promise<void> {
  const entries = loadEnergyMeterEntries();
  const services: EnergyMeterService[] = [];

  if (entries.length === 0) {
    const service = new EnergyMeterService();
    await service.start();
    services.push(service);
    console.log('[EnergyMeter] Service is ready (single server)');
  } else {
    for (const entry of entries) {
      const config = mapEntryToServiceConfig(entry);
      const service = new EnergyMeterService(config);
      await service.start();
      services.push(service);
      console.log(`[EnergyMeter] Started ${entry.name || entry.id || config.port} on port ${config.port}`);
    }
    console.log(`[EnergyMeter] All ${services.length} Energy Meter server(s) are ready`);
  }

  const shutdown = async () => {
    console.log('[EnergyMeter] Shutting down...');
    for (const s of services) await s.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => { void shutdown(); });
  process.on('SIGTERM', () => { void shutdown(); });
}

main().catch((err) => {
  console.error('[EnergyMeter] Failed to start:', err);
  process.exit(1);
});

export { EnergyMeterService, type ServiceConfig, type Meter };

