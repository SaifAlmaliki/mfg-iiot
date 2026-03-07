/**
 * Modbus TCP Simulator Service
 * 
 * This service provides a Modbus TCP slave/server that can simulate:
 * - Multiple slave devices (unit IDs 1-247)
 * - Coils, Discrete Inputs, Holding Registers, Input Registers
 * - Dynamic value generation with noise and trends
 * - Real-time data via IPC to main orchestrator
 */

import { createServer, type Server as TCPServer, type Socket } from 'net';
import * as modbus from 'jsmodbus';
import { loadSimulatorsConfig } from '../config-loader';

// Types
interface Register {
  address: number;
  value: number;
  name: string;
  dataType: string;
  generator?: GeneratorConfig;
  readCount: number;
  writeCount: number;
  lastRead: Date | null;
  lastWrite: Date | null;
}

interface Slave {
  slaveId: number;
  name: string;
  enabled: boolean;
  coils: Map<number, Register>;
  discreteInputs: Map<number, Register>;
  holdingRegisters: Map<number, Register>;
  inputRegisters: Map<number, Register>;
}

interface GeneratorConfig {
  mode: 'static' | 'dynamic' | 'scenario';
  baseValue: number;
  noise?: {
    type: 'gaussian' | 'uniform';
    amplitude: number;
  };
  trend?: {
    direction: 'up' | 'down' | 'sine';
    rate: number;
  };
}

interface ServiceConfig {
  port: number;
  host: string;
  maxConnections: number;
  connectionTimeout: number;
  slaves: SlaveConfig[];
}

interface SlaveConfig {
  slaveId: number;
  name: string;
  enabled: boolean;
  coils?: RegisterConfig[];
  discreteInputs?: RegisterConfig[];
  holdingRegisters?: RegisterConfig[];
  inputRegisters?: RegisterConfig[];
}

interface RegisterConfig {
  address: number;
  value: number;
  name: string;
  dataType: string;
  generator?: GeneratorConfig;
}

// JSON config entry from simulator config (modular or single file)
interface SimulatorConfigEntry {
  id?: string;
  name?: string;
  type?: string;
  port?: number;
  enabled?: boolean;
  config?: {
    maxConnections?: number;
    connectionTimeout?: number;
    slaves?: Array<{
      slaveId: number;
      name: string;
      enabled?: boolean;
      registers?: {
        coils?: Array<{ address: number; name: string; value: boolean; description?: string }>;
        discreteInputs?: Array<{ address: number; name: string; value: boolean; description?: string }>;
        holdingRegisters?: Array<{ address: number; name: string; value: number; dataType?: string; description?: string; generator?: GeneratorConfig }>;
        inputRegisters?: Array<{ address: number; name: string; value: number; dataType?: string; description?: string; generator?: GeneratorConfig }>;
      };
    }>;
  };
}

// Metrics
interface ServiceMetrics {
  connections: number;
  disconnections: number;
  readOperations: number;
  writeOperations: number;
  errors: number;
  avgLatency: number;
  maxLatency: number;
  startTime: Date;
}

// Default configuration
const DEFAULT_CONFIG: ServiceConfig = {
  port: 5020,
  host: '0.0.0.0',
  maxConnections: 50,
  connectionTimeout: 30000,
  slaves: [
    {
      slaveId: 1,
      name: 'Default Slave',
      enabled: true,
      holdingRegisters: Array.from({ length: 100 }, (_, i) => ({
        address: i,
        value: 0,
        name: `HR${i}`,
        dataType: 'int16',
      })),
      inputRegisters: Array.from({ length: 100 }, (_, i) => ({
        address: i,
        value: 0,
        name: `IR${i}`,
        dataType: 'int16',
      })),
      coils: Array.from({ length: 100 }, (_, i) => ({
        address: i,
        value: 0,
        name: `C${i}`,
        dataType: 'bool',
      })),
      discreteInputs: Array.from({ length: 100 }, (_, i) => ({
        address: i,
        value: 0,
        name: `DI${i}`,
        dataType: 'bool',
      })),
    },
  ],
};

class ModbusSimulatorService {
  private config: ServiceConfig;
  private server: TCPServer | null = null;
  private modbusServer: any;
  private slaves: Map<number, Slave> = new Map();
  private metrics: ServiceMetrics;
  private connections: Set<Socket> = new Set();
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(config: Partial<ServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = {
      connections: 0,
      disconnections: 0,
      readOperations: 0,
      writeOperations: 0,
      errors: 0,
      avgLatency: 0,
      maxLatency: 0,
      startTime: new Date(),
    };
    this.initializeSlaves();
  }

  private initializeSlaves(): void {
    for (const slaveConfig of this.config.slaves) {
      const slave: Slave = {
        slaveId: slaveConfig.slaveId,
        name: slaveConfig.name,
        enabled: slaveConfig.enabled,
        coils: new Map(),
        discreteInputs: new Map(),
        holdingRegisters: new Map(),
        inputRegisters: new Map(),
      };

      // Initialize registers
      slaveConfig.coils?.forEach((r) => {
        slave.coils.set(r.address, { ...r, readCount: 0, writeCount: 0, lastRead: null, lastWrite: null });
      });
      slaveConfig.discreteInputs?.forEach((r) => {
        slave.discreteInputs.set(r.address, { ...r, readCount: 0, writeCount: 0, lastRead: null, lastWrite: null });
      });
      slaveConfig.holdingRegisters?.forEach((r) => {
        slave.holdingRegisters.set(r.address, { ...r, readCount: 0, writeCount: 0, lastRead: null, lastWrite: null });
      });
      slaveConfig.inputRegisters?.forEach((r) => {
        slave.inputRegisters.set(r.address, { ...r, readCount: 0, writeCount: 0, lastRead: null, lastWrite: null });
      });

      this.slaves.set(slave.slaveId, slave);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[Modbus] Service already running');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const server = createServer();
        this.server = server;

        // Create Modbus server using jsmodbus
        this.modbusServer = new modbus.server.TCP(server, {
          holding: this.createHoldingBuffer(),
          input: this.createInputBuffer(),
          coils: this.createCoilBuffer(),
          discrete: this.createDiscreteBuffer(),
        });

        // Handle connections
        server.on('connection', (socket: Socket) => {
          this.handleConnection(socket);
        });

        server.on('error', (error: Error) => {
          console.error('[Modbus] Server error:', error);
          this.metrics.errors++;
        });

        server.listen(this.config.port, this.config.host, () => {
          this.isRunning = true;
          this.metrics.startTime = new Date();
          console.log(`[Modbus] Service started on ${this.config.host}:${this.config.port}`);
          console.log(`[Modbus] Simulating ${this.slaves.size} slave(s)`);
          
          // Start dynamic value updates
          this.startValueUpdates();
          
          resolve();
        });

        // Setup Modbus callbacks
        this.setupModbusCallbacks();
      } catch (error) {
        console.error('[Modbus] Failed to start:', error);
        reject(error);
      }
    });
  }

  private createHoldingBuffer(): Buffer {
    const maxAddress = 65536;
    return Buffer.alloc(maxAddress * 2); // 2 bytes per register
  }

  private createInputBuffer(): Buffer {
    const maxAddress = 65536;
    return Buffer.alloc(maxAddress * 2);
  }

  private createCoilBuffer(): Buffer {
    const maxAddress = 65536;
    return Buffer.alloc(Math.ceil(maxAddress / 8)); // 1 bit per coil
  }

  private createDiscreteBuffer(): Buffer {
    const maxAddress = 65536;
    return Buffer.alloc(Math.ceil(maxAddress / 8));
  }

  private setupModbusCallbacks(): void {
    if (!this.modbusServer) return;

    // Handle read operations
    this.modbusServer.on('readCoils', (_request: any, _response: any) => {
      const startTime = Date.now();
      this.metrics.readOperations++;
      this.updateLatency(Date.now() - startTime);
    });

    this.modbusServer.on('readHoldingRegisters', (_request: any, _response: any) => {
      const startTime = Date.now();
      this.metrics.readOperations++;
      this.updateLatency(Date.now() - startTime);
    });

    this.modbusServer.on('readInputRegisters', (_request: any, _response: any) => {
      const startTime = Date.now();
      this.metrics.readOperations++;
      this.updateLatency(Date.now() - startTime);
    });

    this.modbusServer.on('readDiscreteInputs', (_request: any, _response: any) => {
      const startTime = Date.now();
      this.metrics.readOperations++;
      this.updateLatency(Date.now() - startTime);
    });

    // Handle write operations
    this.modbusServer.on('writeSingleCoil', (_request: any, _response: any) => {
      const startTime = Date.now();
      this.metrics.writeOperations++;
      this.updateLatency(Date.now() - startTime);
    });

    this.modbusServer.on('writeSingleRegister', (_request: any, _response: any) => {
      const startTime = Date.now();
      this.metrics.writeOperations++;
      this.updateLatency(Date.now() - startTime);
    });

    this.modbusServer.on('writeMultipleCoils', (_request: any, _response: any) => {
      const startTime = Date.now();
      this.metrics.writeOperations++;
      this.updateLatency(Date.now() - startTime);
    });

    this.modbusServer.on('writeMultipleRegisters', (_request: any, _response: any) => {
      const startTime = Date.now();
      this.metrics.writeOperations++;
      this.updateLatency(Date.now() - startTime);
    });
  }

  private handleConnection(socket: Socket): void {
    this.connections.add(socket);
    this.metrics.connections++;
    console.log(`[Modbus] Client connected from ${socket.remoteAddress}`);

    socket.setTimeout(this.config.connectionTimeout);

    socket.on('close', () => {
      this.connections.delete(socket);
      this.metrics.disconnections++;
      console.log(`[Modbus] Client disconnected`);
    });

    socket.on('error', (error: Error) => {
      console.error('[Modbus] Socket error:', error);
      this.connections.delete(socket);
      this.metrics.errors++;
    });

    socket.on('timeout', () => {
      console.log('[Modbus] Connection timeout');
      socket.destroy();
      this.connections.delete(socket);
    });
  }

  private startValueUpdates(): void {
    // Update dynamic values every 5 seconds
    this.updateInterval = setInterval(() => {
      this.updateDynamicValues();
    }, 5000);
  }

  private updateDynamicValues(): void {
    for (const [_slaveId, slave] of this.slaves) {
      // Update input registers with dynamic values
      for (const [_address, register] of slave.inputRegisters) {
        if (register.generator?.mode === 'dynamic') {
          const newValue = this.generateDynamicValue(register.generator, register.value);
          register.value = newValue;
        }
      }

      // Update holding registers with dynamic values
      for (const [_address, register] of slave.holdingRegisters) {
        if (register.generator?.mode === 'dynamic') {
          const newValue = this.generateDynamicValue(register.generator, register.value);
          register.value = newValue;
        }
      }
    }
  }

  private generateDynamicValue(config: GeneratorConfig, _currentValue: number): number {
    let value = config.baseValue;

    // Apply noise
    if (config.noise) {
      const noise = config.noise.type === 'gaussian'
        ? this.gaussianRandom() * config.noise.amplitude
        : (Math.random() * 2 - 1) * config.noise.amplitude;
      value += noise;
    }

    // Apply trend
    if (config.trend) {
      const hours = new Date().getHours();
      const trendFactor = config.trend.direction === 'sine'
        ? Math.sin(hours / 24 * Math.PI * 2)
        : config.trend.direction === 'up'
          ? config.trend.rate * (hours / 24)
          : -config.trend.rate * (hours / 24);
      value += trendFactor;
    }

    return Math.round(value * 100) / 100;
  }

  private gaussianRandom(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  private updateLatency(latency: number): void {
    // Simple moving average
    this.metrics.avgLatency = this.metrics.avgLatency === 0
      ? latency
      : (this.metrics.avgLatency * 0.9 + latency * 0.1);
    this.metrics.maxLatency = Math.max(this.metrics.maxLatency, latency);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('[Modbus] Service not running');
      return;
    }

    // Stop value updates
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Close all connections
    for (const socket of this.connections) {
      socket.destroy();
    }
    this.connections.clear();

    // Close server
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.isRunning = false;
          console.log('[Modbus] Service stopped');
          resolve();
        });
      } else {
        this.isRunning = false;
        resolve();
      }
    });
  }

  // Public API methods
  getStatus(): { isRunning: boolean; metrics: ServiceMetrics; slaveCount: number; connectionCount: number } {
    return {
      isRunning: this.isRunning,
      metrics: this.metrics,
      slaveCount: this.slaves.size,
      connectionCount: this.connections.size,
    };
  }

  getMetrics(): ServiceMetrics {
    return this.metrics;
  }

  getSlaves(): Slave[] {
    return Array.from(this.slaves.values());
  }

  getSlave(slaveId: number): Slave | undefined {
    return this.slaves.get(slaveId);
  }

  setRegisterValue(slaveId: number, type: 'coil' | 'discrete' | 'holding' | 'input', address: number, value: number): boolean {
    const slave = this.slaves.get(slaveId);
    if (!slave) return false;

    const registers = type === 'coil' ? slave.coils
      : type === 'discrete' ? slave.discreteInputs
      : type === 'holding' ? slave.holdingRegisters
      : slave.inputRegisters;

    const register = registers.get(address);
    if (!register) return false;

    register.value = value;
    register.writeCount++;
    register.lastWrite = new Date();
    return true;
  }

  getRegisterValue(slaveId: number, type: 'coil' | 'discrete' | 'holding' | 'input', address: number): number | null {
    const slave = this.slaves.get(slaveId);
    if (!slave) return null;

    const registers = type === 'coil' ? slave.coils
      : type === 'discrete' ? slave.discreteInputs
      : type === 'holding' ? slave.holdingRegisters
      : slave.inputRegisters;

    const register = registers.get(address);
    if (!register) return null;

    register.readCount++;
    register.lastRead = new Date();
    return register.value;
  }
}

function loadModbusEntries(): SimulatorConfigEntry[] {
  try {
    const { simulators } = loadSimulatorsConfig();
    return (Array.isArray(simulators) ? simulators : []).filter(
      (s) => (s as SimulatorConfigEntry).type === 'modbus' && (s as SimulatorConfigEntry).enabled !== false
    ) as SimulatorConfigEntry[];
  } catch {
    return [];
  }
}

function mapEntryToServiceConfig(entry: SimulatorConfigEntry): ServiceConfig {
  const port = Number(entry.port) || 5020;
  const cfg = entry.config || {};
  const slaves: SlaveConfig[] = (cfg.slaves || []).map((s) => {
    const regs = s.registers || {};
    return {
      slaveId: s.slaveId,
      name: s.name,
      enabled: s.enabled !== false,
      coils: (regs.coils || []).map((r) => ({
        address: r.address,
        value: r.value ? 1 : 0,
        name: r.name,
        dataType: 'bool',
      })),
      discreteInputs: (regs.discreteInputs || []).map((r) => ({
        address: r.address,
        value: r.value ? 1 : 0,
        name: r.name,
        dataType: 'bool',
      })),
      holdingRegisters: (regs.holdingRegisters || []).map((r) => ({
        address: r.address,
        value: r.value,
        name: r.name,
        dataType: r.dataType || 'int16',
        generator: r.generator,
      })),
      inputRegisters: (regs.inputRegisters || []).map((r) => ({
        address: r.address,
        value: r.value,
        name: r.name,
        dataType: r.dataType || 'int16',
        generator: r.generator,
      })),
    };
  });
  return {
    port,
    host: '0.0.0.0',
    maxConnections: cfg.maxConnections ?? 50,
    connectionTimeout: cfg.connectionTimeout ?? 30000,
    slaves: slaves.length > 0 ? slaves : DEFAULT_CONFIG.slaves,
  };
}

async function main(): Promise<void> {
  const entries = loadModbusEntries();
  const services: ModbusSimulatorService[] = [];

  if (entries.length === 0) {
    const service = new ModbusSimulatorService({
      port: parseInt(process.env.MODBUS_PORT || '5020', 10),
    });
    await service.start();
    services.push(service);
    console.log('[Modbus] Service is ready (single server)');
  } else {
    for (const entry of entries) {
      const config = mapEntryToServiceConfig(entry);
      const service = new ModbusSimulatorService(config);
      await service.start();
      services.push(service);
      console.log(`[Modbus] Started ${entry.name || entry.id || config.port} on port ${config.port}`);
    }
    console.log(`[Modbus] All ${services.length} Modbus server(s) are ready`);
  }

  const shutdown = async () => {
    console.log('[Modbus] Shutting down...');
    for (const s of services) await s.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => { void shutdown(); });
  process.on('SIGTERM', () => { void shutdown(); });

  setInterval(() => {
    for (let i = 0; i < services.length; i++) {
      const status = services[i].getStatus();
      console.log(`[Modbus] Server ${i + 1}: ${status.isRunning ? 'Running' : 'Stopped'}, Connections: ${status.connectionCount}, Reads: ${status.metrics.readOperations}, Writes: ${status.metrics.writeOperations}`);
    }
  }, 30000);
}

main().catch((error) => {
  console.error('[Modbus] Failed to start:', error);
  process.exit(1);
});

export { ModbusSimulatorService, type ServiceConfig, type Slave, type Register, type ServiceMetrics };
