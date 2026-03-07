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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Cpu, Zap, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimulatorInfo {
  id: string;
  name: string;
  type: 'opcua' | 'modbus' | 'energymeter';
  port: number;
  description?: string;
  productionLine?: string;
  status?: string;
}

interface SimulatorDiscoveryDialogProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  onDiscovered: (mappings: any[]) => void;
}

function getSimulatorIcon(type: string) {
  switch (type) {
    case 'opcua':
      return <Cpu className="size-5 text-blue-500" aria-hidden />;
    case 'modbus':
      return <Zap className="size-5 text-amber-500" aria-hidden />;
    case 'energymeter':
      return <Gauge className="size-5 text-green-500" aria-hidden />;
    default:
      return <Cpu className="size-5 text-muted-foreground" aria-hidden />;
  }
}

function formatType(type: string): string {
  const t = (type || '').toLowerCase();
  if (t === 'energymeter') return 'Energy meter';
  if (t === 'opcua') return 'OPC UA';
  if (t === 'modbus') return 'Modbus';
  return (type || '').toUpperCase();
}

export function SimulatorDiscoveryDialog({
  open,
  onClose,
  siteId,
  onDiscovered,
}: SimulatorDiscoveryDialogProps) {
  const [simulators, setSimulators] = useState<SimulatorInfo[]>([]);
  const [selectedSimulator, setSelectedSimulator] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);

  useEffect(() => {
    if (open) {
      loadSimulators();
    }
  }, [open]);

  const loadSimulators = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/simulators');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.simulators || []);
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
        onDiscovered(data.mappings || []);
        onClose();
      }
    } catch (error) {
      console.error('Failed to discover tags:', error);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleCardKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedSimulator(id);
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
                {simulators.map((simulator) => {
                  const isSelected = selectedSimulator === simulator.id;
                  return (
                    <Card
                      key={simulator.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={`${simulator.name}, ${formatType(simulator.type)}, port ${simulator.port}, ${simulator.status || 'stopped'}`}
                      className={cn(
                        'min-w-0 cursor-pointer border-2 py-4 transition-[box-shadow,border-color] duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        isSelected ? 'border-primary shadow-md' : 'border-border',
                      )}
                      onClick={() => setSelectedSimulator(simulator.id)}
                      onKeyDown={(e) => handleCardKeyDown(e, simulator.id)}
                    >
                      <CardHeader className="space-y-2 px-4 pb-2 pt-0">
                        <CardTitle className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                          {simulator.name}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          {getSimulatorIcon(simulator.type)}
                          <span className="text-muted-foreground">
                            <span className="font-medium text-foreground">{formatType(simulator.type)}</span>
                            <span className="tabular-nums font-mono"> · {simulator.port}</span>
                          </span>
                          <Badge variant={simulator.status === 'running' ? 'default' : 'secondary'} className="ml-auto shrink-0 text-xs">
                            {simulator.status || 'stopped'}
                          </Badge>
                        </div>
                      </CardHeader>
                      {simulator.productionLine && (
                        <CardContent className="px-4 pt-0 text-xs text-muted-foreground">
                          <span className="shrink-0">Line </span>
                          <span>{simulator.productionLine}</span>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
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
