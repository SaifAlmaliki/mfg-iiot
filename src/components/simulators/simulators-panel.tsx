'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Cpu, Loader2, Copy, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/** API response shape for one simulator (matches GET /api/simulators). */
interface SimulatorEntry {
  id: string;
  name: string;
  type: string;
  port: number;
  enabled: boolean;
  description: string;
  status: string;
  connection: {
    local: string;
    docker: string;
    endpointLocal?: string;
    endpointDocker?: string;
  };
}

function ConnectionCell({ label, value }: { label: string; value: string }) {
  const copy = () => {
    navigator.clipboard.writeText(value).then(
      () => toast.success('Copied to clipboard'),
      () => toast.error('Copy failed')
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-300 text-xs font-medium tabular-nums">{label}:</span>
      <code className="text-xs bg-slate-700 text-slate-100 px-2 py-1 rounded border border-slate-600 font-mono">
        {value}
      </code>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-100" onClick={copy} title="Copy">
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function typeBadgeVariant(type: string): 'default' | 'secondary' | 'outline' {
  const t = type?.toLowerCase();
  if (t === 'modbus') return 'default';
  if (t === 'opcua') return 'secondary';
  if (t === 'energymeter') return 'outline';
  return 'outline';
}

function typeBadgeClassName(type: string): string {
  const t = type?.toLowerCase();
  if (t === 'modbus') return 'bg-slate-600 text-slate-100 border-slate-500';
  if (t === 'opcua') return 'bg-slate-600/80 text-slate-200 border-slate-500';
  if (t === 'energymeter') return 'bg-transparent text-slate-200 border-slate-500';
  return 'border-slate-500 text-slate-300';
}

function statusBadgeClassName(status: string): string {
  const s = status?.toLowerCase();
  if (s === 'running') return 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40';
  if (s === 'stopped') return 'bg-slate-600/50 text-slate-300 border-slate-500/50';
  return 'bg-slate-600/30 text-slate-400 border-slate-600';
}

export function SimulatorsPanel() {
  const [simulators, setSimulators] = useState<SimulatorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch('/api/simulators')
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText || 'Failed to load');
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setSimulators(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Failed to load simulators');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

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
              <TableBody>
                {simulators.map((sim) => (
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
                      <Badge variant={typeBadgeVariant(sim.type)} className={cn('border', typeBadgeClassName(sim.type))}>
                        {sim.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-200 align-top tabular-nums">{sim.port}</TableCell>
                    <TableCell className="align-top">
                      <Badge variant="outline" className={cn('border', statusBadgeClassName(sim.status))}>
                        {sim.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-2">
                        <ConnectionCell
                          label="Local"
                          value={sim.connection.endpointLocal ?? sim.connection.local}
                        />
                        <ConnectionCell
                          label="Docker"
                          value={sim.connection.endpointDocker ?? sim.connection.docker}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
