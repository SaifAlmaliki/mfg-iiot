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
      return <Cpu className="w-5 h-5 text-blue-500" />;
    case 'modbus':
      return <Zap className="w-5 h-5 text-amber-500" />;
    case 'energymeter':
      return <Gauge className="w-5 h-5 text-green-500" />;
    default:
      return <Cpu className="w-5 h-5 text-gray-500" />;
  }
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Discover Simulator Tags</DialogTitle>
          <DialogDescription>
            Select a simulator to discover available tags and generate ISA-95 compliant mappings.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : simulators.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No simulators found. Check simulator config (simulators/modbus.json, opcua.json, energy.json).
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {simulators.map((simulator) => (
                <Card
                  key={simulator.id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md',
                    selectedSimulator === simulator.id && 'ring-2 ring-emerald-500'
                  )}
                  onClick={() => setSelectedSimulator(simulator.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getSimulatorIcon(simulator.type)}
                        <CardTitle className="text-sm">{simulator.name}</CardTitle>
                      </div>
                      <Badge variant={simulator.status === 'running' ? 'default' : 'secondary'}>
                        {simulator.status || 'stopped'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <span className="font-medium">{simulator.type.toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Port</span>
                        <span className="font-mono">{simulator.port}</span>
                      </div>
                      {simulator.productionLine && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Line</span>
                          <span>{simulator.productionLine}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleDiscover}
                disabled={!selectedSimulator || isDiscovering}
              >
                {isDiscovering ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Discovering...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Discover Tags
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
