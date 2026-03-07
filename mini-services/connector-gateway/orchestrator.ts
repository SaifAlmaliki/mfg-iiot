/**
 * Orchestrator: polls DB for active connectors, maintains one runner per connector.
 * Efficient: only start/stop/restart when config or list changes.
 */

import type { ConnectorConfig, IConnectorRunner } from './types';
import { fetchActiveConnectors, updateConnectorStatus } from './lib/db';
import { OpcuaRunner } from './runners/opcua-runner';
import { ModbusTcpRunner } from './runners/modbus-tcp-runner';

const POLL_INTERVAL_MS = 30_000; // 30 seconds – balance between responsiveness and DB load

const RUNNER_TYPES: Record<string, new (id: string, code: string) => IConnectorRunner> = {
  OPC_UA: OpcuaRunner,
  MODBUS_TCP: ModbusTcpRunner,
};

export class Orchestrator {
  private runners = new Map<string, IConnectorRunner>();
  private timer: ReturnType<typeof setInterval> | null = null;

  private createRunner(config: ConnectorConfig): IConnectorRunner | null {
    const Ctor = RUNNER_TYPES[config.type];
    if (!Ctor) {
      console.log(`[Orchestrator] Unsupported connector type: ${config.type} (${config.code})`);
      return null;
    }
    return new Ctor(config.id, config.code);
  }

  async runOnce(): Promise<void> {
    const connectors = await fetchActiveConnectors();
    const idSet = new Set(connectors.map((c) => c.id));

    // Stop runners for connectors no longer in DB or inactive
    for (const [id, runner] of this.runners) {
      if (!idSet.has(id)) {
        console.log(`[Orchestrator] Stopping connector ${runner.code} (removed or inactive).`);
        await runner.stop();
        this.runners.delete(id);
      }
    }

    // Start or update each connector from DB
    for (const config of connectors) {
      const c = config as unknown as ConnectorConfig;
      const existing = this.runners.get(c.id);

      if (existing) {
        if (existing.isConfigChanged(c)) {
          console.log(`[Orchestrator] Config changed for ${c.code}; restarting.`);
          await existing.stop();
          this.runners.delete(c.id);
          const runner = this.createRunner(c);
          if (runner) {
            this.runners.set(c.id, runner);
            await runner.start(c);
          }
        }
        continue;
      }

      const runner = this.createRunner(c);
      if (runner) {
        this.runners.set(c.id, runner);
        await runner.start(c);
      }
    }
  }

  start(): void {
    if (this.timer) return;
    console.log(`[Orchestrator] Starting; poll interval ${POLL_INTERVAL_MS / 1000}s`);
    this.runOnce();
    this.timer = setInterval(() => this.runOnce(), POLL_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    for (const [id, runner] of this.runners) {
      await runner.stop();
      await updateConnectorStatus(id, 'OFFLINE');
    }
    this.runners.clear();
    console.log('[Orchestrator] Stopped.');
  }

  getRunnerCount(): number {
    return this.runners.size;
  }
}
