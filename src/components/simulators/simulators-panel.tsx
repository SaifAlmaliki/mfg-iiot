'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Cpu, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SimulatorEntry } from '@/types/simulator';
import { groupSimulatorsByType } from '@/types/simulator';
import {
  SimulatorStatusBadge,
  simulatorTypeBadgeVariant,
  simulatorTypeBadgeClassName,
} from '@/components/simulators/simulator-shared';
import { ConnectionCell } from '@/components/simulators/connection-cell';

export function SimulatorsPanel() {
  const [simulators, setSimulators] = useState<SimulatorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSimulators = (withLive = true) => {
    const url = withLive ? '/api/simulators?live=true' : '/api/simulators';
    return fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText || 'Failed to load');
        return res.json();
      })
      .then((data) => setSimulators(Array.isArray(data) ? data : []));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSimulators(true)
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load simulators'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (simulators.length === 0) return;
    const interval = setInterval(() => {
      fetchSimulators(true).catch(() => {});
    }, 20000);
    return () => clearInterval(interval);
  }, [simulators.length]);

  return (
    <div className="p-4 md:p-6 min-h-full bg-slate-950">
      <Card className="border-slate-600 bg-slate-800/80 shadow-lg">
        <CardHeader className="border-b border-slate-600/80">
          <CardTitle className="flex items-center gap-2 text-slate-50">
            <Cpu className="h-5 w-5 text-emerald-400" />
            Simulators
          </CardTitle>
          <CardDescription className="text-slate-300 text-base leading-relaxed mt-1">
            Status and connection details for Modbus, OPC UA, and Energy Meter simulators. Use <span className="text-slate-200">Local</span> when running on this machine; use <span className="text-slate-200">Docker</span> when services run in containers.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {loading && (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 py-6 text-rose-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {!loading && !error && simulators.length === 0 && (
            <p className="py-6 text-slate-400 text-sm">No simulators configured.</p>
          )}
          {!loading && !error && simulators.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-600 hover:bg-transparent">
                  <TableHead className="text-slate-200 font-semibold">Name</TableHead>
                  <TableHead className="text-slate-200 font-semibold">Type</TableHead>
                  <TableHead className="text-slate-200 font-semibold">Port</TableHead>
                  <TableHead className="text-slate-200 font-semibold">Status</TableHead>
                  <TableHead className="text-slate-200 font-semibold">Connection</TableHead>
                </TableRow>
              </TableHeader>
              {groupSimulatorsByType(simulators).map(({ type, label, items }) => (
                <TableBody key={type} className="border-b border-slate-600/80">
                  <TableRow className="bg-slate-700/60 border-slate-600 hover:bg-slate-700/60">
                    <TableCell colSpan={5} className="py-3 px-4">
                      <span className="font-semibold text-slate-100">{label}</span>
                      <span className="ml-2 text-slate-400 font-normal text-sm">
                        ({items.length} {items.length === 1 ? 'simulator' : 'simulators'})
                      </span>
                    </TableCell>
                  </TableRow>
                  {items.map((sim) => (
                    <TableRow key={sim.id} className="border-slate-600/80 hover:bg-slate-700/50">
                      <TableCell className="align-top">
                        <div>
                          <p className="font-medium text-slate-50">{sim.name}</p>
                          {sim.description && (
                            <p className="text-sm text-slate-400 mt-0.5 leading-snug">{sim.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant={simulatorTypeBadgeVariant(sim.type)} className={cn('border', simulatorTypeBadgeClassName(sim.type))}>
                          {sim.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-200 align-top tabular-nums">{sim.port}</TableCell>
                      <TableCell className="align-top">
                        <SimulatorStatusBadge status={sim.status} variant="slate" />
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-2">
                          <ConnectionCell
                            variant="slate"
                            label="Local"
                            value={sim.connection.endpointLocal ?? sim.connection.local}
                          />
                          <ConnectionCell
                            variant="slate"
                            label="Docker"
                            value={sim.connection.endpointDocker ?? sim.connection.docker}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              ))}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
