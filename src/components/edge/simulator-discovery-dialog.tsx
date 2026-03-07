'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SimulatorEntry } from '@/types/simulator';
import { SimulatorCard } from '@/components/simulators/simulator-card';

interface SimulatorDiscoveryDialogProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  onDiscovered: (mappings: unknown[]) => void;
}

export function SimulatorDiscoveryDialog({
  open,
  onClose,
  siteId,
  onDiscovered,
}: SimulatorDiscoveryDialogProps) {
  const [simulators, setSimulators] = useState<SimulatorEntry[]>([]);
  const [selectedSimulator, setSelectedSimulator] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);

  useEffect(() => {
    if (open) loadSimulators();
  }, [open]);

  const loadSimulators = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/simulators?live=true');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.simulators ?? []);
        setSimulators(list);
      }
    } catch (error) {
      console.error('Failed to load simulators:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscover = async () => {
    if (!selectedSimulator) return;
    setIsDiscovering(true);
    try {
      const res = await fetch(
        `/api/simulator-tags?siteId=${siteId}&simulatorId=${selectedSimulator}`
      );
      if (res.ok) {
        const data = await res.json();
        onDiscovered(data.mappings ?? []);
        onClose();
      }
    } catch (error) {
      console.error('Failed to discover tags:', error);
    } finally {
      setIsDiscovering(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          'flex max-h-[85dvh] w-[calc(100vw-2rem)] max-w-[min(56rem,calc(100vw-2rem))] flex-col overflow-hidden p-4 sm:p-6',
        )}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-balance">Discover Simulator Tags</DialogTitle>
          <DialogDescription className="text-pretty">
            Select a simulator to discover available tags and generate ISA-95 compliant mappings.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex shrink-0 items-center justify-center py-8" role="status" aria-live="polite">
            <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
            <span className="sr-only">Loading simulators…</span>
          </div>
        ) : simulators.length === 0 ? (
          <div className="shrink-0 py-8 text-center text-pretty text-muted-foreground">
            No simulators found. Check simulator config (simulators/modbus.json, opcua.json, energy.json).
          </div>
        ) : (
          <>
            <div className="min-h-0 min-w-0 flex-1 overflow-auto -mx-1 px-1" role="list" aria-label="Simulators">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                {simulators.map((simulator) => (
                  <SimulatorCard
                    key={simulator.id}
                    simulator={{
                      id: simulator.id,
                      name: simulator.name,
                      type: simulator.type,
                      port: simulator.port,
                      status: simulator.status,
                    }}
                    selected={selectedSimulator === simulator.id}
                    onSelect={setSelectedSimulator}
                    showProductionLine={false}
                  />
                ))}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleDiscover}
                disabled={!selectedSimulator || isDiscovering}
              >
                {isDiscovering ? (
                  <>
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                    <span>Discovering…</span>
                  </>
                ) : (
                  <>
                    <Search className="size-4 shrink-0" aria-hidden />
                    <span>Discover Tags</span>
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
