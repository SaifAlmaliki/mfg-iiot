#!/usr/bin/env node
/**
 * Run all simulators for local dev (Modbus, OPC UA, Energy Meter).
 * Spawns one process per type with correct cwd and env so UI experts can connect.
 * Run from repo root: node scripts/run-simulators.mjs
 */

import { spawn } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');

const runners = [
  {
    name: 'modbus',
    cwd: join(root, 'simulators', 'modbus-service'),
    command: 'bun',
    args: ['run', 'index.ts'],
    env: { ...process.env, MODBUS_PORT: '5020' },
  },
  {
    name: 'opcua',
    cwd: join(root, 'simulators', 'opcua-service'),
    command: 'bun',
    args: ['run', 'index.ts'],
    env: {
      ...process.env,
      OPCUA_PORT: '4840',
      CONFIG_PATH: join(root, 'simulators', 'simulators.json'),
    },
  },
  {
    name: 'energymeter',
    cwd: join(root, 'simulators', 'energy-meter-service'),
    command: 'bun',
    args: ['run', 'index.ts'],
    env: { ...process.env, ENERGY_METER_PORT: '5010' },
  },
];

const children = [];

function prefix(name) {
  return (data) => {
    const lines = String(data).split('\n').filter(Boolean);
    for (const line of lines) {
      console.log(`[${name}] ${line}`);
    }
  };
}

for (const { name, cwd, command, args, env } of runners) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  child.stdout?.on('data', prefix(name));
  child.stderr?.on('data', prefix(name));
  child.on('error', (err) => {
    console.error(`[${name}] Failed to start:`, err.message);
  });
  child.on('exit', (code, signal) => {
    if (code != null && code !== 0) {
      console.error(`[${name}] Exited with code ${code}`);
    }
    if (signal) {
      console.error(`[${name}] Killed by signal ${signal}`);
    }
  });
  children.push(child);
}

function killAll() {
  for (const child of children) {
    child.kill('SIGTERM');
  }
  process.exit(0);
}

process.on('SIGINT', killAll);
process.on('SIGTERM', killAll);

console.log('Simulators started: Modbus :5020, OPC UA :4840, Energy Meter :5010');
console.log('Connect: opc.tcp://localhost:4840 (OPC UA), localhost:5020 (Modbus), localhost:5010 (Energy)');
