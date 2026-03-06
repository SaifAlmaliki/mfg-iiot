/**
 * OPC UA Simulator Service
 * 
 * This service provides an OPC UA server with:
 * - Standard address space structure
 * - Robotics companion specification
 * - Machine Tools companion specification
 * - Dynamic value generation
 * - Anonymous and username/password authentication
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  OPCUAServer,
  Variant,
  DataType,
  DataValue,
  StatusCodes,
  VariantArrayType,
  NodeClass,
  makeRoles,
  WellKnownRoles,
  ISessionBase,
} from 'node-opcua';

// Types
interface NodeConfig {
  nodeId: string;
  browseName: string;
  displayName: string;
  description?: string;
  dataType: DataType;
  value: unknown;
  accessLevel: number;
  generator?: GeneratorConfig;
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
  serverName: string;
  serverUri: string;
  productUri: string;
  allowAnonymous: boolean;
  users: UserConfig[];
  namespaces: NamespaceConfig[];
  /** Interval in ms for updating dynamic node values (default 5000). Can be overridden from config file. */
  dynamicUpdateIntervalMs?: number;
  /** Robot asset ID for this server (e.g. Robot1, Robot2). Used to expose different assets per production line. */
  robotId?: string;
  /** Machine tool asset ID for this server (e.g. Machine1, Machine2). */
  machineId?: string;
}

interface UserConfig {
  username: string;
  password: string;
  role: 'admin' | 'operator' | 'observer';
}

interface NamespaceConfig {
  uri: string;
  name: string;
  nodes: NodeConfig[];
}

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

// Default configuration with companion specs
const DEFAULT_CONFIG: ServiceConfig = {
  port: 4840,
  serverName: 'Industrial Simulator OPC UA Server',
  serverUri: 'urn:industrial-simulator:opcua:server',
  productUri: 'urn:industrial-simulator:opcua:product',
  allowAnonymous: true,
  users: [
    { username: 'admin', password: 'admin123', role: 'admin' },
    { username: 'operator', password: 'operator123', role: 'operator' },
  ],
  namespaces: [
    // Robotics Companion Spec namespace
    {
      uri: 'http://opcfoundation.org/UA/Robotics/',
      name: 'Robotics',
      nodes: [
        {
          nodeId: 'Robot1',
          browseName: 'Robot1',
          displayName: 'Robot 1',
          description: 'Industrial Robot',
          dataType: DataType.ObjectType,
          value: null,
          accessLevel: 1,
        },
        {
          nodeId: 'Robot1.Status',
          browseName: 'Status',
          displayName: 'Robot Status',
          dataType: DataType.Int32,
          value: 1, // 0=Offline, 1=Online, 2=Error
          accessLevel: 1,
          generator: { mode: 'dynamic', baseValue: 1, noise: { type: 'uniform', amplitude: 0 } },
        },
        {
          nodeId: 'Robot1.Position.X',
          browseName: 'PositionX',
          displayName: 'Position X',
          dataType: DataType.Double,
          value: 0,
          accessLevel: 3,
          generator: { mode: 'dynamic', baseValue: 500, noise: { type: 'gaussian', amplitude: 10 } },
        },
        {
          nodeId: 'Robot1.Position.Y',
          browseName: 'PositionY',
          displayName: 'Position Y',
          dataType: DataType.Double,
          value: 0,
          accessLevel: 3,
          generator: { mode: 'dynamic', baseValue: 300, noise: { type: 'gaussian', amplitude: 5 } },
        },
        {
          nodeId: 'Robot1.Position.Z',
          browseName: 'PositionZ',
          displayName: 'Position Z',
          dataType: DataType.Double,
          value: 0,
          accessLevel: 3,
          generator: { mode: 'dynamic', baseValue: 200, noise: { type: 'gaussian', amplitude: 3 } },
        },
        {
          nodeId: 'Robot1.Speed',
          browseName: 'Speed',
          displayName: 'Speed',
          dataType: DataType.Double,
          value: 0,
          accessLevel: 3,
          generator: { mode: 'dynamic', baseValue: 100, noise: { type: 'uniform', amplitude: 20 } },
        },
        {
          nodeId: 'Robot1.Load',
          browseName: 'Load',
          displayName: 'Load',
          dataType: DataType.Double,
          value: 0,
          accessLevel: 1,
          generator: { mode: 'dynamic', baseValue: 50, noise: { type: 'gaussian', amplitude: 5 } },
        },
      ],
    },
    // Machine Tools Companion Spec namespace
    {
      uri: 'http://opcfoundation.org/UA/MachineTool/',
      name: 'MachineTool',
      nodes: [
        {
          nodeId: 'Machine1',
          browseName: 'Machine1',
          displayName: 'Machine 1',
          description: 'CNC Machine Tool',
          dataType: DataType.ObjectType,
          value: null,
          accessLevel: 1,
        },
        {
          nodeId: 'Machine1.State',
          browseName: 'State',
          displayName: 'Machine State',
          dataType: DataType.Int32,
          value: 1, // 0=Stopped, 1=Running, 2=Paused, 3=Error
          accessLevel: 1,
          generator: { mode: 'dynamic', baseValue: 1, noise: { type: 'uniform', amplitude: 0 } },
        },
        {
          nodeId: 'Machine1.SpindleSpeed',
          browseName: 'SpindleSpeed',
          displayName: 'Spindle Speed',
          dataType: DataType.Double,
          value: 0,
          accessLevel: 3,
          generator: { mode: 'dynamic', baseValue: 3000, noise: { type: 'gaussian', amplitude: 50 } },
        },
        {
          nodeId: 'Machine1.FeedRate',
          browseName: 'FeedRate',
          displayName: 'Feed Rate',
          dataType: DataType.Double,
          value: 0,
          accessLevel: 3,
          generator: { mode: 'dynamic', baseValue: 500, noise: { type: 'gaussian', amplitude: 20 } },
        },
        {
          nodeId: 'Machine1.ToolNumber',
          browseName: 'ToolNumber',
          displayName: 'Tool Number',
          dataType: DataType.Int32,
          value: 1,
          accessLevel: 1,
        },
        {
          nodeId: 'Machine1.Temperature',
          browseName: 'Temperature',
          displayName: 'Temperature',
          dataType: DataType.Double,
          value: 0,
          accessLevel: 1,
          generator: { mode: 'dynamic', baseValue: 45, noise: { type: 'gaussian', amplitude: 3 } },
        },
        {
          nodeId: 'Machine1.Power',
          browseName: 'Power',
          displayName: 'Power Consumption',
          dataType: DataType.Double,
          value: 0,
          accessLevel: 1,
          generator: { mode: 'dynamic', baseValue: 15, noise: { type: 'gaussian', amplitude: 2 } },
        },
        {
          nodeId: 'Machine1.PartCount',
          browseName: 'PartCount',
          displayName: 'Parts Produced',
          dataType: DataType.Int32,
          value: 0,
          accessLevel: 1,
        },
      ],
    },
  ],
};

class OpcuaSimulatorService {
  private config: ServiceConfig;
  private server: OPCUAServer | null = null;
  private metrics: ServiceMetrics;
  private isRunning = false;
  private dynamicNodes: Map<string, { node: any; config: GeneratorConfig; nodeConfig: NodeConfig }> = new Map();
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private namespaceMap: Map<string, number> = new Map();
  /** Resolved update interval in ms (from config file or default). */
  private dynamicUpdateIntervalMs = 5000;
  private robotId: string;
  private machineId: string;

  constructor(config: Partial<ServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.robotId = this.config.robotId ?? 'Robot1';
    this.machineId = this.config.machineId ?? 'Machine1';
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
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[OPC UA] Service already running');
      return;
    }

    try {
      console.log('[OPC UA] Initializing server...');

      // Create OPC UA server (do not pass nodeset_filename: [] or address space stays null)
      this.server = new OPCUAServer({
        port: this.config.port,
        hostname: '0.0.0.0',
        serverName: this.config.serverName,
        serverUri: this.config.serverUri,
        productUri: this.config.productUri,
        allowAnonymous: this.config.allowAnonymous,
        buildInfo: {
          productName: this.config.serverName,
          productUri: this.config.productUri,
          manufacturerName: 'Industrial Simulator',
          softwareVersion: '1.0.0',
        },
        userManager: {
          isValidUser: (username: string, password: string) => {
            const user = this.config.users.find((u) => u.username === username);
            return user?.password === password;
          },
        },
      });

      // Initialize server (loads default OPC UA nodeset so rootFolder exists)
      await this.server.initialize();
      console.log('[OPC UA] Server initialized');

      // Build address space
      this.buildAddressSpace();

      // Start server
      await this.server.start();
      this.isRunning = true;
      this.metrics.startTime = new Date();
      console.log(`[OPC UA] Server started on port ${this.config.port}`);
      console.log(`[OPC UA] Endpoint URL: opc.tcp://localhost:${this.config.port}`);
      console.log(`[OPC UA] Server URI: ${this.config.serverUri}`);
      console.log(`[OPC UA] Anonymous access: ${this.config.allowAnonymous ? 'enabled' : 'disabled'}`);

      // Resolve dynamic update interval from config file if present
      this.resolveDynamicUpdateInterval();
      console.log(`[OPC UA] Dynamic value update interval: ${this.dynamicUpdateIntervalMs} ms`);

      // Start dynamic value updates
      this.startValueUpdates();

      // Setup event handlers
      this.setupEventHandlers();
    } catch (error) {
      console.error('[OPC UA] Failed to start:', error);
      throw error;
    }
  }

  /** Load dynamicUpdateIntervalMs from CONFIG_PATH (simulators.json) if set and matching port. */
  private resolveDynamicUpdateInterval(): void {
    const configPath = process.env.CONFIG_PATH;
    if (this.config.dynamicUpdateIntervalMs != null && this.config.dynamicUpdateIntervalMs > 0) {
      this.dynamicUpdateIntervalMs = this.config.dynamicUpdateIntervalMs;
      return;
    }
    if (!configPath || !existsSync(configPath)) return;
    try {
      const content = readFileSync(configPath, 'utf-8');
      const data = JSON.parse(content) as { simulators?: Array<{ type?: string; port?: number; config?: { dynamicUpdateIntervalMs?: number } }> };
      const sim = data.simulators?.find((s) => s.type === 'opcua' && s.port === this.config.port);
      const ms = sim?.config?.dynamicUpdateIntervalMs;
      if (typeof ms === 'number' && ms > 0) {
        this.dynamicUpdateIntervalMs = ms;
      }
    } catch (err) {
      console.warn('[OPC UA] Could not load config for update interval:', (err as Error).message);
    }
  }

  /** Substitute asset IDs so each server can expose Robot2/Machine2 etc. for different production lines. */
  private substituteAssetIds(s: string): string {
    return s
      .replace(/\bRobot1\b/g, this.robotId)
      .replace(/\bMachine1\b/g, this.machineId);
  }

  private buildAddressSpace(): void {
    if (!this.server) return;

    const addressSpace = this.server.engine.addressSpace;
    if (!addressSpace) return;

    const namespace = addressSpace.getOwnNamespace();

    // Create namespaces and nodes for each companion spec
    for (const nsConfig of this.config.namespaces) {
      // Register namespace
      const nsIndex = addressSpace.registerNamespace(nsConfig.uri);
      this.namespaceMap.set(nsConfig.uri, nsIndex);
      console.log(`[OPC UA] Registered namespace: ${nsConfig.name} (${nsConfig.uri})`);

      // Create root object for this namespace
      const rootFolder = namespace.addObject({
        organizedBy: addressSpace.rootFolder.objects,
        browseName: nsConfig.name,
      });

      // Create nodes (substitute robotId/machineId so each server can expose different assets)
      let currentParent: any = rootFolder;
      for (const nodeConfig of nsConfig.nodes) {
        try {
          const nodeId = this.substituteAssetIds(nodeConfig.nodeId);
          const browseName = this.substituteAssetIds(nodeConfig.browseName);
          const displayName = this.substituteAssetIds(nodeConfig.displayName);
          const description = nodeConfig.description ? this.substituteAssetIds(nodeConfig.description) : undefined;

          if (nodeConfig.dataType === DataType.ObjectType) {
            // Create an object folder
            const obj = namespace.addObject({
              organizedBy: currentParent,
              browseName,
              displayName,
              description,
            });
            currentParent = obj;
          } else {
            // Seed initial value for dynamic nodes so first read is correct
            if (nodeConfig.generator?.mode === 'dynamic') {
              nodeConfig.value = nodeConfig.generator.baseValue;
            }
            // Create a variable (minimumSamplingInterval required when using getter/setter)
            const variable = namespace.addVariable({
              componentOf: currentParent,
              nodeId: `s=${nodeId}`,
              browseName,
              displayName,
              description,
              dataType: nodeConfig.dataType,
              value: {
                get: () => {
                  this.metrics.readOperations++;
                  return new Variant({
                    dataType: nodeConfig.dataType,
                    value: nodeConfig.value,
                  });
                },
                set: (variant: Variant) => {
                  this.metrics.writeOperations++;
                  nodeConfig.value = variant.value;
                  return StatusCodes.Good;
                },
              },
              accessLevel: nodeConfig.accessLevel,
              minimumSamplingInterval: 1000,
            });

            // Register for dynamic updates (key by substituted nodeId)
            if (nodeConfig.generator?.mode === 'dynamic') {
              this.dynamicNodes.set(nodeId, {
                node: variable,
                config: nodeConfig.generator,
                nodeConfig,
              });
            }
          }
        } catch (error) {
          console.error(`[OPC UA] Failed to create node ${nodeConfig.nodeId}:`, error);
        }
      }
    }

    console.log(`[OPC UA] Address space built with ${this.dynamicNodes.size} dynamic nodes (${this.robotId}, ${this.machineId})`);
  }

  private setupEventHandlers(): void {
    if (!this.server) return;

    // Track sessions
    this.server.on('session_activated', (session: ISessionBase) => {
      this.metrics.connections++;
      console.log(`[OPC UA] Session activated: ${session.sessionName || 'anonymous'}`);
    });

    this.server.on('session_closed', (session: ISessionBase) => {
      this.metrics.disconnections++;
      console.log(`[OPC UA] Session closed: ${session.sessionName || 'anonymous'}`);
    });
  }

  private startValueUpdates(): void {
    // Run once immediately so clients see correct values (e.g. 3000, 500, 45) before first interval
    this.updateDynamicValues();
    this.updateInterval = setInterval(() => {
      this.updateDynamicValues();
    }, this.dynamicUpdateIntervalMs);
  }

  private updateDynamicValues(): void {
    const now = new Date();
    const hours = now.getHours();

    for (const [nodeId, { node, config, nodeConfig }] of this.dynamicNodes) {
      try {
        let value = config.baseValue;

        // Apply noise
        if (config.noise) {
          const noise = config.noise.type === 'gaussian'
            ? this.gaussianRandom() * config.noise.amplitude
            : (Math.random() * 2 - 1) * config.noise.amplitude;
          value += noise;
        }

        // Apply trend (daily pattern)
        if (config.trend) {
          const trendFactor = config.trend.direction === 'sine'
            ? Math.sin(hours / 24 * Math.PI * 2) * config.trend.rate
            : config.trend.direction === 'up'
              ? config.trend.rate * (hours / 24)
              : -config.trend.rate * (hours / 24);
          value += trendFactor;
        }

        const roundedValue = Math.round(value * 100) / 100;
        // Update backing config so getter returns correct value on read
        nodeConfig.value = nodeConfig.dataType === DataType.Int32 ? Math.round(roundedValue) : roundedValue;
        node.setValueFromSource(new Variant({
          dataType: nodeConfig.dataType,
          value: nodeConfig.value,
        }));
      } catch (error) {
        console.error(`[OPC UA] Failed to update node ${nodeId}:`, error);
      }
    }
  }

  private gaussianRandom(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  private updateLatency(latency: number): void {
    this.metrics.avgLatency = this.metrics.avgLatency === 0
      ? latency
      : (this.metrics.avgLatency * 0.9 + latency * 0.1);
    this.metrics.maxLatency = Math.max(this.metrics.maxLatency, latency);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('[OPC UA] Service not running');
      return;
    }

    // Stop value updates
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.server) {
      await this.server.shutdown();
      this.server = null;
    }

    this.isRunning = false;
    console.log('[OPC UA] Server stopped');
  }

  // Public API
  getStatus(): { isRunning: boolean; metrics: ServiceMetrics; namespaceCount: number; nodeCount: number } {
    return {
      isRunning: this.isRunning,
      metrics: this.metrics,
      namespaceCount: this.config.namespaces.length,
      nodeCount: this.dynamicNodes.size,
    };
  }

  getMetrics(): ServiceMetrics {
    return this.metrics;
  }

  getNamespaces(): Array<{ uri: string; name: string }> {
    return this.config.namespaces.map((ns) => ({ uri: ns.uri, name: ns.name }));
  }
}

// Config entry from simulators.json
interface SimulatorConfigEntry {
  id?: string;
  name?: string;
  type?: string;
  port?: number;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

function getSimulatorsConfigPath(): string {
  const envPath = process.env.SIMULATORS_CONFIG_PATH;
  if (envPath) return envPath;
  const fromCwd = join(process.cwd(), 'simulators', 'simulators.json');
  if (existsSync(fromCwd)) return fromCwd;
  const fromParent = join(process.cwd(), '..', 'simulators.json');
  if (existsSync(fromParent)) return fromParent;
  return join(__dirname, '..', 'simulators.json');
}

function loadOpcuaEntries(): SimulatorConfigEntry[] {
  const configPath = getSimulatorsConfigPath();
  if (!existsSync(configPath)) {
    console.warn('[OPC UA] No simulators.json found at', configPath, '- using single server from OPCUA_PORT');
    return [];
  }
  try {
    const data = JSON.parse(readFileSync(configPath, 'utf-8')) as { simulators?: SimulatorConfigEntry[] };
    const list = data.simulators?.filter((s) => s.type === 'opcua' && s.enabled !== false) ?? [];
    return list;
  } catch (err) {
    console.warn('[OPC UA] Failed to load simulators.json:', (err as Error).message, '- using single server');
    return [];
  }
}

// Main entry point: start all OPC UA servers from config, or single server from env
async function main(): Promise<void> {
  const entries = loadOpcuaEntries();
  const services: OpcuaSimulatorService[] = [];

  if (entries.length === 0) {
    const port = parseInt(process.env.OPCUA_PORT || '4840', 10);
    const service = new OpcuaSimulatorService({ port });
    await service.start();
    services.push(service);
    console.log('[OPC UA] Service is ready (single server)');
    console.log(`[OPC UA] Endpoint URL: opc.tcp://localhost:${port}`);
  } else {
    for (const entry of entries) {
      const port = Number(entry.port) || 4840;
      const config = (entry.config || {}) as Partial<ServiceConfig>;
      const service = new OpcuaSimulatorService({
        port,
        serverName: (config.serverName as string) || entry.name || `OPC UA Server ${port}`,
        serverUri: (config.serverUri as string) || `urn:industrial-simulator:opcua:server:${port}`,
        productUri: (config.productUri as string) || 'urn:industrial-simulator:opcua:product',
        allowAnonymous: config.allowAnonymous !== false,
        dynamicUpdateIntervalMs: config.dynamicUpdateIntervalMs,
        robotId: (config.robotId as string) || 'Robot1',
        machineId: (config.machineId as string) || 'Machine1',
      });
      await service.start();
      services.push(service);
      console.log(`[OPC UA] Started ${entry.name || entry.id || port} on port ${port}`);
    }
    console.log(`[OPC UA] All ${services.length} OPC UA server(s) are ready`);
  }

  const shutdown = async () => {
    console.log('[OPC UA] Shutting down...');
    for (const s of services) await s.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => { void shutdown(); });
  process.on('SIGTERM', () => { void shutdown(); });

  // Periodic status logging
  setInterval(() => {
    for (let i = 0; i < services.length; i++) {
      const status = services[i].getStatus();
      console.log(`[OPC UA] Server ${i + 1}: ${status.isRunning ? 'Running' : 'Stopped'}, Reads: ${status.metrics.readOperations}, Writes: ${status.metrics.writeOperations}`);
    }
  }, 300000);
}

main().catch((error) => {
  console.error('[OPC UA] Failed to start:', error);
  process.exit(1);
});

export { OpcuaSimulatorService, type ServiceConfig, type NodeConfig, type ServiceMetrics };
