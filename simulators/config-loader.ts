/**
 * Shared simulator config loader. Supports:
 * - Single file: when SIMULATORS_CONFIG_PATH points to an existing file
 * - Modular (default): simulators/modbus.json, opcua.json, energy.json (merge order: modbus → opcua → energy)
 * Usable from Next.js app and from simulator services (opcua-service, modbus-service, energy-meter-service).
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

const MODULAR_FILES = ['modbus.json', 'opcua.json', 'energy.json'] as const;

export interface SimulatorsFile {
  simulators: unknown[];
}

/**
 * Resolves the config path. If SIMULATORS_CONFIG_PATH is set, use it (file or directory).
 * Otherwise try default file then simulators directory with fallbacks for different CWDs.
 */
export function getSimulatorsConfigPath(): string {
  const envPath = process.env.SIMULATORS_CONFIG_PATH;
  if (envPath) return envPath;

  const candidates: string[] = [
    join(process.cwd(), 'simulators', 'simulators.json'),
    join(process.cwd(), 'simulators'),
  ];

  // When run from simulators/opcua-service (or modbus-service, energy-meter-service), __dirname is that service's dir
  try {
    const dirname = typeof __dirname !== 'undefined' ? __dirname : getDirname();
    candidates.push(
      join(dirname, 'simulators.json'),
      join(dirname, '..', 'simulators.json'),
      dirname, // simulators/ dir (contains opcua.json, modbus.json, energy.json) — check before repo root
      join(dirname, '..')
    );
  } catch {
    // ESM may not have __dirname; ignore
  }

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  return join(process.cwd(), 'simulators', 'simulators.json');
}

function getDirname(): string {
  const u = (import.meta as { url?: string })?.url;
  if (u) {
    const p = pathToFileURL(u).pathname;
    const dir = join(p, '..');
    return dir.replace(/^\/([A-Z]:)/, '$1').replace(/\//g, '\\');
  }
  return process.cwd();
}

/**
 * Loads simulator config: either from a single file or by merging modular files.
 * Returns { simulators: array }. Missing modular file = []. Invalid JSON throws with clear message.
 */
export function loadSimulatorsConfig(): SimulatorsFile {
  const configPath = getSimulatorsConfigPath();

  if (existsSync(configPath)) {
    const stat = statSync(configPath);
    if (stat.isFile()) {
      return readSingleFile(configPath);
    }
    if (stat.isDirectory()) {
      return loadFromDirectory(configPath);
    }
  }

  // Path does not exist (e.g. Docker mount not yet present): if env was set, use it as directory; else default simulators dir
  const dir = process.env.SIMULATORS_CONFIG_PATH
    ? configPath
    : join(process.cwd(), 'simulators');
  return loadFromDirectory(dir);
}

function readSingleFile(filePath: string): SimulatorsFile {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as { simulators?: unknown[] };
    return { simulators: Array.isArray(data.simulators) ? data.simulators : [] };
  } catch (err) {
    const message = err instanceof SyntaxError
      ? `Invalid JSON in simulator config at ${filePath}: ${(err as Error).message}`
      : `Failed to read simulator config at ${filePath}: ${(err as Error).message}`;
    throw new Error(message);
  }
}

function loadFromDirectory(dirPath: string): SimulatorsFile {
  const all: unknown[] = [];
  for (const file of MODULAR_FILES) {
    const filePath = join(dirPath, file);
    if (!existsSync(filePath)) {
      continue;
    }
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw) as { simulators?: unknown[] };
      const list = Array.isArray(data.simulators) ? data.simulators : [];
      all.push(...list);
    } catch (err) {
      const message = err instanceof SyntaxError
        ? `Invalid JSON in ${filePath}: ${(err as Error).message}`
        : `Failed to read ${filePath}: ${(err as Error).message}`;
      throw new Error(message);
    }
  }
  return { simulators: all };
}
