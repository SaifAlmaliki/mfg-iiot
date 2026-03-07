'use client';

import { Cpu, Zap, Gauge } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Reusable icon for simulator type (Modbus, OPC UA, Energy meter). */
export function SimulatorTypeIcon({
  type,
  className,
  ...props
}: { type: string; className?: string } & React.SVGProps<SVGSVGElement>) {
  const t = (type || '').toLowerCase();
  switch (t) {
    case 'opcua':
      return <Cpu className={cn('size-5 text-blue-500', className)} aria-hidden {...props} />;
    case 'modbus':
      return <Zap className={cn('size-5 text-amber-500', className)} aria-hidden {...props} />;
    case 'energymeter':
      return <Gauge className={cn('size-5 text-green-500', className)} aria-hidden {...props} />;
    default:
      return <Cpu className={cn('size-5 text-muted-foreground', className)} aria-hidden {...props} />;
  }
}

type StatusBadgeVariant = 'default' | 'slate';

/** Reusable status badge. Use variant="default" for light/dialog UI, "slate" for dark panel. */
export function SimulatorStatusBadge({
  status,
  variant = 'default',
  className,
}: {
  status: string;
  variant?: StatusBadgeVariant;
  className?: string;
}) {
  const s = (status || '').toLowerCase();
  const label = s === 'running' ? 'Running' : s === 'stopped' ? 'Stopped' : status || 'Unknown';

  if (variant === 'slate') {
    const slateClass =
      s === 'running'
        ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
        : s === 'stopped'
          ? 'bg-slate-600/50 text-slate-300 border-slate-500/50'
          : 'bg-slate-600/30 text-slate-400 border-slate-600';
    return (
      <Badge variant="outline" className={cn('border', slateClass, className)}>
        {label}
      </Badge>
    );
  }

  return (
    <Badge
      variant={s === 'running' ? 'default' : 'secondary'}
      className={cn('text-xs', className)}
    >
      {label}
    </Badge>
  );
}

/** Type badge variant for shadcn Badge (used by panel table). */
export function simulatorTypeBadgeVariant(type: string): 'default' | 'secondary' | 'outline' {
  const t = type?.toLowerCase();
  if (t === 'modbus') return 'default';
  if (t === 'opcua') return 'secondary';
  if (t === 'energymeter') return 'outline';
  return 'outline';
}

/** Type badge className for panel slate theme. */
export function simulatorTypeBadgeClassName(type: string): string {
  const t = type?.toLowerCase();
  if (t === 'modbus') return 'bg-slate-600 text-slate-100 border-slate-500';
  if (t === 'opcua') return 'bg-slate-600/80 text-slate-200 border-slate-500';
  if (t === 'energymeter') return 'bg-transparent text-slate-200 border-slate-500';
  return 'border-slate-500 text-slate-300';
}
