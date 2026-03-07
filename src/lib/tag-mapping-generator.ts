/**
 * Tag Mapping Generator
 * 
 * Parses simulator configurations and generates ISA-95 compliant tag mappings
 * for review before activation.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface SimulatorTag {
  address: string;
  name: string;
  description?: string;
  dataType: string;
  value?: unknown;
  unit?: string;
  generator?: {
    mode: string;
    baseValue?: number;
    noise?: { type: string; amplitude: number };
  };
}

export interface SimulatorConfig {
  id: string;
  name: string;
  type: 'opcua' | 'modbus' | 'energymeter';
  enabled: boolean;
  port: number;
  description?: string;
  productionLine?: string;
  config: Record<string, unknown>;
  status?: string;
}

export interface SimulatorsFile {
  simulators: SimulatorConfig[];
}

export interface ProposedTagMapping {
  id: string;
  sourceAddress: string;
  sourceType: string;
  sourceDataType: string;
  tagName: string;
  mqttTopic: string;
  dataType: string;
  engUnit?: string;
  description?: string;
  scale?: number;
  offset?: number;
  simulatorId: string;
  simulatorName: string;
  simulatorType: string;
  simulatorPort: number;
  productionLine?: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface TagMappingGeneratorOptions {
  enterpriseCode: string;
  siteCode: string;
  areaCode?: string;
  workCenterCode?: string;
  defaultScanRate?: number;
}

const DATA_TYPE_MAP: Record<string, string> = {
  'bool': 'BOOL',
  'boolean': 'BOOL',
  'int8': 'INT8',
  'int16': 'INT16',
  'int32': 'INT32',
  'int64': 'INT64',
  'uint8': 'UINT8',
  'uint16': 'UINT16',
  'uint32': 'UINT32',
  'uint64': 'UINT64',
  'float': 'FLOAT32',
  'float32': 'FLOAT32',
  'double': 'FLOAT64',
  'float64': 'FLOAT64',
  'string': 'STRING',
};

function normalizeDataType(dataType: string): string {
  const normalized = dataType?.toLowerCase() || 'string';
  return DATA_TYPE_MAP[normalized] || 'STRING';
}

export class TagMappingGenerator {
  private configPath: string;
  private options: TagMappingGeneratorOptions;

  constructor(options: TagMappingGeneratorOptions, configPath?: string) {
    this.options = {
      defaultScanRate: 1000,
      ...options,
    };
    
    if (configPath) {
      this.configPath = configPath;
    } else {
      this.configPath = this.findSimulatorsConfig();
    }
  }

  private findSimulatorsConfig(): string {
    const possiblePaths = [
      join(process.cwd(), 'simulators', 'simulators.json'),
      join(process.cwd(), '..', 'simulators', 'simulators.json'),
      join(__dirname, '..', '..', '..', 'simulators', 'simulators.json'),
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    throw new Error('Simulators configuration file not found');
  }

  loadSimulators(): SimulatorConfig[] {
    if (!existsSync(this.configPath)) {
      console.warn(`[TagMappingGenerator] Config not found at ${this.configPath}`);
      return [];
    }

    try {
      const content = readFileSync(this.configPath, 'utf-8');
      const data = JSON.parse(content) as SimulatorsFile;
      return data.simulators.filter(s => s.enabled !== false);
    } catch (error) {
      console.error('[TagMappingGenerator] Failed to load simulators config:', error);
      return [];
    }
  }

  generateMappings(): ProposedTagMapping[] {
    const simulators = this.loadSimulators();
    const allMappings: ProposedTagMapping[] = [];

    for (const simulator of simulators) {
      const mappings = this.extractMappingsFromSimulator(simulator);
      allMappings.push(...mappings);
    }

    return allMappings;
  }

  private extractMappingsFromSimulator(simulator: SimulatorConfig): ProposedTagMapping[] {
    const mappings: ProposedTagMapping[] = [];

    switch (simulator.type) {
      case 'opcua':
        mappings.push(...this.extractOpcuaMappings(simulator));
        break;
      case 'modbus':
        mappings.push(...this.extractModbusMappings(simulator));
        break;
      case 'energymeter':
        mappings.push(...this.extractEnergyMeterMappings(simulator));
        break;
    }

    return mappings;
  }

  private extractOpcuaMappings(simulator: SimulatorConfig): ProposedTagMapping[] {
    const mappings: ProposedTagMapping[] = [];
    const config = simulator.config as any;
    const namespaces = config?.namespaces || [];

    for (const ns of namespaces) {
      const nodes = ns.nodes || [];
      for (const node of nodes) {
        if (node.nodeClass === 'Variable' && node.dataType) {
          const address = node.nodeId;
          const name = node.browseName || node.displayName;
          const workUnit = this.extractWorkUnitFromNodeId(node.nodeId);
          
          const mqttTopic = this.generateMqttTopic(
            workUnit,
            this.sanitizeName(name)
          );

          mappings.push({
            id: `${simulator.id}-${address}`,
            sourceAddress: `ns=1;s=${address}`,
            sourceType: 'TAG',
            sourceDataType: node.dataType,
            tagName: name,
            mqttTopic,
            dataType: normalizeDataType(node.dataType),
            engUnit: node.unit,
            description: node.description,
            simulatorId: simulator.id,
            simulatorName: simulator.name,
            simulatorType: 'OPC_UA',
            simulatorPort: simulator.port,
            productionLine: simulator.productionLine,
            status: 'pending',
          });
        }
      }
    }

    return mappings;
  }

  private extractModbusMappings(simulator: SimulatorConfig): ProposedTagMapping[] {
    const mappings: ProposedTagMapping[] = [];
    const config = simulator.config as any;
    const slaves = config?.slaves || [];

    for (const slave of slaves) {
      const slaveId = slave.slaveId;
      const slaveName = slave.name || `Unit${slaveId}`;

      const registerTypes = [
        { key: 'coils', sourceType: 'COIL', prefix: 'coil' },
        { key: 'discreteInputs', sourceType: 'DISCRETE_INPUT', prefix: 'di' },
        { key: 'holdingRegisters', sourceType: 'HOLDING_REGISTER', prefix: 'hr' },
        { key: 'inputRegisters', sourceType: 'INPUT_REGISTER', prefix: 'ir' },
      ];

      for (const { key, sourceType, prefix } of registerTypes) {
        const registers = slave.registers?.[key] || [];
        for (const reg of registers) {
          const address = `${slaveId}:${reg.address}`;
          const name = reg.name || `${prefix}_${reg.address}`;
          
          const mqttTopic = this.generateMqttTopic(
            slaveName,
            this.sanitizeName(name)
          );

          mappings.push({
            id: `${simulator.id}-${address}`,
            sourceAddress: address,
            sourceType,
            sourceDataType: reg.dataType || 'INT16',
            tagName: name,
            mqttTopic,
            dataType: normalizeDataType(reg.dataType || 'INT16'),
            engUnit: reg.unit,
            description: reg.description,
            scale: reg.scale,
            simulatorId: simulator.id,
            simulatorName: simulator.name,
            simulatorType: 'MODBUS_TCP',
            simulatorPort: simulator.port,
            productionLine: simulator.productionLine,
            status: 'pending',
          });
        }
      }
    }

    return mappings;
  }

  private extractEnergyMeterMappings(simulator: SimulatorConfig): ProposedTagMapping[] {
    const mappings: ProposedTagMapping[] = [];
    const config = simulator.config as any;
    const meters = config?.meters || [];

    for (const meter of meters) {
      const slaveId = meter.slaveId;
      const meterName = meter.name || `Meter${slaveId}`;
      const measurements = meter.measurements || [];

      for (const meas of measurements) {
        const address = `${slaveId}:${meas.name.replace(/\s+/g, '_')}`;
        const name = meas.name;
        
        const mqttTopic = this.generateMqttTopic(
          meterName,
          this.sanitizeName(name)
        );

        let dataType = 'FLOAT64';
        if (meas.type === 'powerFactor') {
          dataType = 'FLOAT64';
        } else if (meas.type === 'frequency') {
          dataType = 'FLOAT64';
        }

        mappings.push({
          id: `${simulator.id}-${address}`,
          sourceAddress: address,
          sourceType: 'INPUT_REGISTER',
          sourceDataType: 'FLOAT32',
          tagName: name,
          mqttTopic,
          dataType,
          engUnit: meas.unit,
          description: `${meas.type} - ${meas.phase || 'Total'}`,
          simulatorId: simulator.id,
          simulatorName: simulator.name,
          simulatorType: 'MODBUS_TCP',
          simulatorPort: simulator.port,
          productionLine: simulator.productionLine,
          status: 'pending',
        });
      }
    }

    return mappings;
  }

  private extractWorkUnitFromNodeId(nodeId: string): string {
    const parts = nodeId.split('.');
    if (parts.length > 1) {
      return parts[0];
    }
    return 'Equipment';
  }

  private generateMqttTopic(workUnit: string, attribute: string): string {
    const { enterpriseCode, siteCode, areaCode, workCenterCode } = this.options;
    
    const parts = [
      enterpriseCode,
      siteCode,
      areaCode || 'PRODUCTION',
      workCenterCode || this.inferWorkCenter(workUnit),
      this.sanitizeName(workUnit),
      this.sanitizeName(attribute),
    ];

    return parts.join('/');
  }

  private inferWorkCenter(workUnit: string): string {
    const workUnitLower = workUnit.toLowerCase();
    
    if (workUnitLower.includes('robot')) return 'ROBOTICS';
    if (workUnitLower.includes('machine') || workUnitLower.includes('cnc')) return 'MACHINING';
    if (workUnitLower.includes('boiler') || workUnitLower.includes('reactor')) return 'PROCESS';
    if (workUnitLower.includes('packaging') || workUnitLower.includes('conveyor')) return 'PACKAGING';
    if (workUnitLower.includes('meter') || workUnitLower.includes('panel')) return 'UTILITIES';
    
    return 'LINE-01';
  }

  private sanitizeName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toUpperCase();
  }
}

export function createTagMappingGenerator(
  options: TagMappingGeneratorOptions,
  configPath?: string
): TagMappingGenerator {
  return new TagMappingGenerator(options, configPath);
}

export function getSimulatorsConfigPath(): string {
  const envPath = process.env.SIMULATORS_CONFIG_PATH;
  if (envPath) return envPath;

  const possiblePaths = [
    join(process.cwd(), 'simulators', 'simulators.json'),
    join(process.cwd(), '..', 'simulators', 'simulators.json'),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) return path;
  }

  return join(process.cwd(), 'simulators', 'simulators.json');
}
