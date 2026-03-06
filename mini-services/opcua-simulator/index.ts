/**
 * OPC UA Server Simulator for Manufacturing System
 * Simulates a real PLC with process variables, alarms, and control capabilities
 */

import {
  OPCUAServer,
  Variant,
  DataType,
  VariantArrayType,
  StatusCodes,
  makeAccessLevelFlag,
  ServerState,
} from 'node-opcua';

const PORT = 4840;

// Process simulation state
const processState = {
  // Reactor 1
  TIC_101: { value: 65.0, min: 0, max: 200, unit: '°C', noise: 0.5 },
  PIC_101: { value: 3.5, min: 0, max: 20, unit: 'bar', noise: 0.1 },
  FIC_101: { value: 250.0, min: 0, max: 500, unit: 'L/min', noise: 5.0 },
  LIC_101: { value: 75.0, min: 0, max: 100, unit: '%', noise: 0.5 },
  
  // Reactor 2
  TIC_102: { value: 72.0, min: 0, max: 200, unit: '°C', noise: 0.5 },
  PIC_102: { value: 4.2, min: 0, max: 20, unit: 'bar', noise: 0.1 },
  FIC_102: { value: 180.0, min: 0, max: 500, unit: 'L/min', noise: 5.0 },
  LIC_102: { value: 45.0, min: 0, max: 100, unit: '%', noise: 0.5 },
  
  // Motors
  MOT_101: { value: 1450, min: 0, max: 3000, unit: 'RPM', noise: 10 },
  MOT_102: { value: 1600, min: 0, max: 3000, unit: 'RPM', noise: 10 },
  
  // Vibration
  VIB_101: { value: 2.5, min: 0, max: 20, unit: 'mm/s', noise: 0.2 },
  VIB_102: { value: 3.1, min: 0, max: 20, unit: 'mm/s', noise: 0.2 },
  
  // Power
  PWR_101: { value: 125.0, min: 0, max: 500, unit: 'kW', noise: 5.0 },
  
  // Valves
  VLV_101: { value: 50, min: 0, max: 100, unit: '%', noise: 0 },
  VLV_102: { value: 75, min: 0, max: 100, unit: '%', noise: 0 },
  
  // Pumps
  PMP_101_RUN: { value: true, noise: 0 },
  PMP_102_RUN: { value: true, noise: 0 },
  
  // Setpoints
  TIC_101_SP: { value: 70.0, min: 0, max: 200, unit: '°C', noise: 0, writable: true },
  PIC_101_SP: { value: 3.5, min: 0, max: 20, unit: 'bar', noise: 0, writable: true },
  TIC_102_SP: { value: 75.0, min: 0, max: 200, unit: '°C', noise: 0, writable: true },
  
  // Batch control
  BATCH_RUNNING: { value: false, noise: 0 },
  BATCH_ID: { value: 'BATCH-001', noise: 0 },
  BATCH_PROGRESS: { value: 0, min: 0, max: 100, unit: '%', noise: 0 },
};

// Alarm states
const alarmStates = {
  TEMP_HIGH_1: { active: false, value: 80, priority: 2 },
  TEMP_HIGH_2: { active: false, value: 90, priority: 1 },
  PRESS_HIGH_1: { active: false, value: 5.0, priority: 2 },
  LEVEL_LOW_1: { active: false, value: 20, priority: 3 },
  VIBRATION_HIGH: { active: false, value: 5.0, priority: 2 },
};

// Simulation parameters
let simulationRunning = true;
let batchPhase = 0;

async function main() {
  // Create OPC UA server
  const server = new OPCUAServer({
    port: PORT,
    hostname: '0.0.0.0',
    serverName: 'Manufacturing PLC Simulator',
    serverInfo: {
      applicationName: { text: 'Manufacturing PLC Simulator', locale: 'en' },
      applicationUri: 'urn:manufacturing:plc:simulator',
      productUri: 'urn:manufacturing:plc:simulator',
      manufacturerName: 'Demo Manufacturing Co.',
    },
    buildInfo: {
      buildNumber: '1.0.0',
      buildDate: new Date(),
    },
    allowAnonymous: true,
  });

  await server.initialize();

  const addressSpace = server.engine.addressSpace;
  const namespace = addressSpace?.getOwnNamespace();

  if (!namespace) {
    throw new Error('Failed to get namespace');
  }

  // Create Objects folder structure
  const objectsFolder = addressSpace?.rootFolder?.objects;

  // Create Device folder
  const deviceFolder = namespace.addFolder(objectsFolder, {
    browseName: 'Devices',
  });

  // Create Reactor 1 folder
  const reactor1 = namespace.addFolder(deviceFolder, {
    browseName: 'Reactor1',
  });

  // Create Reactor 2 folder
  const reactor2 = namespace.addFolder(deviceFolder, {
    browseName: 'Reactor2',
  });

  // Create Motors folder
  const motors = namespace.addFolder(deviceFolder, {
    browseName: 'Motors',
  });

  // Create Utilities folder
  const utilities = namespace.addFolder(deviceFolder, {
    browseName: 'Utilities',
  });

  // Create Batch Control folder
  const batchControl = namespace.addFolder(deviceFolder, {
    browseName: 'BatchControl',
  });

  // Create Alarms folder
  const alarmsFolder = namespace.addFolder(deviceFolder, {
    browseName: 'Alarms',
  });

  // Store variable nodes for updates
  const variableNodes: Map<string, any> = new Map();

  // Helper to add analog variable
  function addAnalogVariable(parent: any, name: string, initialState: any) {
    const node = namespace.addVariable({
      componentOf: parent,
      browseName: name,
      nodeId: `s="${name}"`,
      dataType: initialState.value === true || initialState.value === false 
        ? DataType.Boolean 
        : initialState.value.toString().includes('.') 
          ? DataType.Double 
          : DataType.Int32,
      accessLevel: initialState.writable 
        ? makeAccessLevelFlag('CurrentRead | CurrentWrite')
        : makeAccessLevelFlag('CurrentRead'),
      value: {
        get: () => {
          const state = processState[name as keyof typeof processState];
          if (state.value === true || state.value === false) {
            return new Variant({ dataType: DataType.Boolean, value: state.value });
          }
          return new Variant({ 
            dataType: DataType.Double, 
            value: state.value 
          });
        },
        set: (variant: Variant) => {
          if (initialState.writable) {
            const state = processState[name as keyof typeof processState];
            state.value = variant.value;
            console.log(`[OPCUA] Setpoint ${name} changed to ${variant.value}`);
          }
          return StatusCodes.Good;
        }
      },
    });
    variableNodes.set(name, node);
    return node;
  }

  // Add engineering units property
  function addEngineeringUnits(parent: any, name: string, unit: string) {
    namespace.addVariable({
      componentOf: parent,
      browseName: `${name}_Unit`,
      dataType: DataType.String,
      value: { get: () => new Variant({ dataType: DataType.String, value: unit }) }
    });
  }

  // Create Reactor 1 variables
  addAnalogVariable(reactor1, 'TIC_101', processState.TIC_101);
  addEngineeringUnits(reactor1, 'TIC_101', '°C');
  addAnalogVariable(reactor1, 'PIC_101', processState.PIC_101);
  addEngineeringUnits(reactor1, 'PIC_101', 'bar');
  addAnalogVariable(reactor1, 'FIC_101', processState.FIC_101);
  addEngineeringUnits(reactor1, 'FIC_101', 'L/min');
  addAnalogVariable(reactor1, 'LIC_101', processState.LIC_101);
  addEngineeringUnits(reactor1, 'LIC_101', '%');
  addAnalogVariable(reactor1, 'TIC_101_SP', processState.TIC_101_SP);
  addAnalogVariable(reactor1, 'PIC_101_SP', processState.PIC_101_SP);

  // Create Reactor 2 variables
  addAnalogVariable(reactor2, 'TIC_102', processState.TIC_102);
  addEngineeringUnits(reactor2, 'TIC_102', '°C');
  addAnalogVariable(reactor2, 'PIC_102', processState.PIC_102);
  addEngineeringUnits(reactor2, 'PIC_102', 'bar');
  addAnalogVariable(reactor2, 'FIC_102', processState.FIC_102);
  addEngineeringUnits(reactor2, 'FIC_102', 'L/min');
  addAnalogVariable(reactor2, 'LIC_102', processState.LIC_102);
  addEngineeringUnits(reactor2, 'LIC_102', '%');
  addAnalogVariable(reactor2, 'TIC_102_SP', processState.TIC_102_SP);

  // Create Motor variables
  addAnalogVariable(motors, 'MOT_101', processState.MOT_101);
  addEngineeringUnits(motors, 'MOT_101', 'RPM');
  addAnalogVariable(motors, 'MOT_102', processState.MOT_102);
  addEngineeringUnits(motors, 'MOT_102', 'RPM');
  addAnalogVariable(motors, 'VIB_101', processState.VIB_101);
  addEngineeringUnits(motors, 'VIB_101', 'mm/s');
  addAnalogVariable(motors, 'VIB_102', processState.VIB_102);
  addEngineeringUnits(motors, 'VIB_102', 'mm/s');

  // Create Utility variables
  addAnalogVariable(utilities, 'PWR_101', processState.PWR_101);
  addEngineeringUnits(utilities, 'PWR_101', 'kW');
  addAnalogVariable(utilities, 'VLV_101', processState.VLV_101);
  addEngineeringUnits(utilities, 'VLV_101', '%');
  addAnalogVariable(utilities, 'VLV_102', processState.VLV_102);
  addEngineeringUnits(utilities, 'VLV_102', '%');
  addAnalogVariable(utilities, 'PMP_101_RUN', processState.PMP_101_RUN);
  addAnalogVariable(utilities, 'PMP_102_RUN', processState.PMP_102_RUN);

  // Create Batch Control variables
  addAnalogVariable(batchControl, 'BATCH_RUNNING', processState.BATCH_RUNNING);
  addAnalogVariable(batchControl, 'BATCH_ID', processState.BATCH_ID);
  addAnalogVariable(batchControl, 'BATCH_PROGRESS', processState.BATCH_PROGRESS);

  // Create Alarm variables
  namespace.addVariable({
    componentOf: alarmsFolder,
    browseName: 'TEMP_HIGH_1',
    dataType: DataType.Boolean,
    value: { get: () => new Variant({ dataType: DataType.Boolean, value: alarmStates.TEMP_HIGH_1.active }) }
  });

  namespace.addVariable({
    componentOf: alarmsFolder,
    browseName: 'TEMP_HIGH_2',
    dataType: DataType.Boolean,
    value: { get: () => new Variant({ dataType: DataType.Boolean, value: alarmStates.TEMP_HIGH_2.active }) }
  });

  namespace.addVariable({
    componentOf: alarmsFolder,
    browseName: 'PRESS_HIGH_1',
    dataType: DataType.Boolean,
    value: { get: () => new Variant({ dataType: DataType.Boolean, value: alarmStates.PRESS_HIGH_1.active }) }
  });

  namespace.addVariable({
    componentOf: alarmsFolder,
    browseName: 'LEVEL_LOW_1',
    dataType: DataType.Boolean,
    value: { get: () => new Variant({ dataType: DataType.Boolean, value: alarmStates.LEVEL_LOW_1.active }) }
  });

  namespace.addVariable({
    componentOf: alarmsFolder,
    browseName: 'VIBRATION_HIGH',
    dataType: DataType.Boolean,
    value: { get: () => new Variant({ dataType: DataType.Boolean, value: alarmStates.VIBRATION_HIGH.active }) }
  });

  // Start server
  await server.start();
  console.log(`[OPCUA] Server started on port ${PORT}`);
  console.log(`[OPCUA] Endpoint: opc.tcp://localhost:${PORT}`);
  console.log(`[OPCUA] Browse at: http://localhost:${PORT}/discovery`);

  // Start simulation
  startSimulation();

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('[OPCUA] Shutting down...');
    simulationRunning = false;
    await server.shutdown();
    process.exit(0);
  });
}

// Simulation loop
function startSimulation() {
  console.log('[OPCUA] Starting process simulation...');

  setInterval(() => {
    // Update process values with noise and realistic behavior
    Object.keys(processState).forEach((key) => {
      const state = processState[key as keyof typeof processState];
      
      if (typeof state.value === 'boolean') {
        return; // Don't add noise to boolean values
      }

      // Add noise
      const noise = (Math.random() - 0.5) * 2 * state.noise;
      let newValue = state.value + noise;

      // Apply setpoint influence for temperature (slow response)
      if (key === 'TIC_101') {
        const setpoint = processState.TIC_101_SP.value;
        const error = setpoint - state.value;
        newValue += error * 0.02; // PID-like response
      }
      if (key === 'TIC_102') {
        const setpoint = processState.TIC_102_SP.value;
        const error = setpoint - state.value;
        newValue += error * 0.02;
      }
      if (key === 'PIC_101') {
        const setpoint = processState.PIC_101_SP.value;
        const error = setpoint - state.value;
        newValue += error * 0.03;
      }

      // Clamp to limits
      newValue = Math.max(state.min, Math.min(state.max, newValue));
      state.value = Math.round(newValue * 100) / 100;
    });

    // Update power based on motor speed
    processState.PWR_101.value = 
      (processState.MOT_101.value / 3000 * 75 + 
       processState.MOT_102.value / 3000 * 75 + 
       processState.FIC_101.value / 500 * 25 +
       Math.random() * 5);

    // Update vibration based on motor speed (higher speed = more vibration)
    processState.VIB_101.value = 1.5 + (processState.MOT_101.value / 3000) * 2 + Math.random() * 0.3;
    processState.VIB_102.value = 1.5 + (processState.MOT_102.value / 3000) * 2 + Math.random() * 0.3;

    // Update level based on flow balance (simplified)
    const inflow = processState.FIC_101.value / 500;
    const outflow = processState.FIC_102.value / 500;
    processState.LIC_101.value += (inflow - outflow) * 0.1;
    processState.LIC_101.value = Math.max(0, Math.min(100, processState.LIC_101.value));

    // Check alarms
    checkAlarms();

    // Update batch progress if running
    if (processState.BATCH_RUNNING.value) {
      processState.BATCH_PROGRESS.value += 0.1;
      if (processState.BATCH_PROGRESS.value >= 100) {
        processState.BATCH_PROGRESS.value = 100;
        processState.BATCH_RUNNING.value = false;
        console.log('[OPCUA] Batch completed');
      }
    }

  }, 1000); // Update every second

  // Batch simulation phases
  setInterval(() => {
    if (!processState.BATCH_RUNNING.value) return;
    
    batchPhase = (batchPhase + 1) % 4;
    
    // Change process conditions based on batch phase
    switch (batchPhase) {
      case 0: // Charging
        processState.FIC_101.value = 300 + Math.random() * 50;
        processState.FIC_102.value = 100;
        break;
      case 1: // Heating
        processState.TIC_101_SP.value = 85;
        processState.MOT_101.value = 1500;
        break;
      case 2: // Reaction
        processState.TIC_101_SP.value = 75;
        processState.MOT_101.value = 1200;
        break;
      case 3: // Discharge
        processState.FIC_102.value = 250 + Math.random() * 50;
        processState.FIC_101.value = 100;
        break;
    }
  }, 30000); // Phase change every 30 seconds

  // Random setpoint changes
  setInterval(() => {
    // Occasional temperature setpoint adjustment
    if (Math.random() > 0.9) {
      processState.TIC_101_SP.value = 65 + Math.random() * 20;
      console.log(`[OPCUA] Temperature setpoint changed to ${processState.TIC_101_SP.value.toFixed(1)}°C`);
    }
  }, 10000);
}

function checkAlarms() {
  // Temperature alarms
  alarmStates.TEMP_HIGH_1.active = processState.TIC_101.value > alarmStates.TEMP_HIGH_1.value;
  alarmStates.TEMP_HIGH_2.active = processState.TIC_101.value > alarmStates.TEMP_HIGH_2.value;
  
  // Pressure alarm
  alarmStates.PRESS_HIGH_1.active = processState.PIC_101.value > alarmStates.PRESS_HIGH_1.value;
  
  // Level alarm
  alarmStates.LEVEL_LOW_1.active = processState.LIC_101.value < alarmStates.LEVEL_LOW_1.value;
  
  // Vibration alarm
  alarmStates.VIBRATION_HIGH.active = processState.VIB_101.value > alarmStates.VIBRATION_HIGH.value;

  // Log alarm changes
  Object.keys(alarmStates).forEach((key) => {
    const alarm = alarmStates[key as keyof typeof alarmStates];
    // Could emit alarm events here
  });
}

// Export current state for bridge service
export function getCurrentState() {
  return {
    processState: { ...processState },
    alarms: { ...alarmStates },
    timestamp: Date.now()
  };
}

main().catch((err) => {
  console.error('[OPCUA] Error:', err);
  process.exit(1);
});
