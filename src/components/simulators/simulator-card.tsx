'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatSimulatorType } from '@/types/simulator';
import { SimulatorTypeIcon, SimulatorStatusBadge } from './simulator-shared';

export interface SimulatorCardEntry {
  id: string;
  name: string;
  type: string;
  port: number;
  status?: string;
  productionLine?: string;
}

export interface SimulatorCardProps {
  simulator: SimulatorCardEntry;
  /** When true, card is selectable and shows selected state. */
  selected?: boolean;
  onSelect?: (id: string) => void;
  /** Show production line row when present. Default true. */
  showProductionLine?: boolean;
  className?: string;
}

export function SimulatorCard({
  simulator,
  selected = false,
  onSelect,
  showProductionLine = true,
  className,
}: SimulatorCardProps) {
  const isInteractive = typeof onSelect === 'function';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isInteractive) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(simulator.id);
    }
  };

  return (
    <Card
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-pressed={isInteractive ? selected : undefined}
      aria-label={
        isInteractive
          ? `${simulator.name}, ${formatSimulatorType(simulator.type)}, port ${simulator.port}, ${simulator.status || 'stopped'}`
          : undefined
      }
      className={cn(
        'min-w-0 border-2 py-4 transition-[box-shadow,border-color] duration-200',
        isInteractive && [
          'cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          selected ? 'border-primary shadow-md' : 'border-border',
        ],
        className
      )}
      onClick={isInteractive ? () => onSelect(simulator.id) : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
    >
      <CardHeader className="space-y-2 px-4 pb-2 pt-0">
        <CardTitle className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
          {simulator.name}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <SimulatorTypeIcon type={simulator.type} />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{formatSimulatorType(simulator.type)}</span>
            <span className="tabular-nums font-mono"> · {simulator.port}</span>
          </span>
          <SimulatorStatusBadge status={simulator.status ?? 'stopped'} className="ml-auto shrink-0" />
        </div>
      </CardHeader>
      {showProductionLine && simulator.productionLine && (
        <CardContent className="px-4 pt-0 text-xs text-muted-foreground">
          <span className="shrink-0">Line </span>
          <span>{simulator.productionLine}</span>
        </CardContent>
      )}
    </Card>
  );
}
