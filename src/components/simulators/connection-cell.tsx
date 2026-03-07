'use client';

import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface ConnectionCellProps {
  label: string;
  value: string;
  className?: string;
  /** Use "slate" for dark panel theme, "default" for light. */
  variant?: 'default' | 'slate';
}

export function ConnectionCell({ label, value, className, variant = 'default' }: ConnectionCellProps) {
  const copy = () => {
    navigator.clipboard.writeText(value).then(
      () => toast.success('Copied to clipboard'),
      () => toast.error('Copy failed')
    );
  };

  const isSlate = variant === 'slate';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn(
          'text-xs font-medium tabular-nums',
          isSlate ? 'text-slate-300' : 'text-muted-foreground'
        )}
      >
        {label}:
      </span>
      <code
        className={cn(
          'rounded border px-2 py-1 font-mono text-xs',
          isSlate
            ? 'border-slate-600 bg-slate-700 text-slate-100'
            : 'border-border bg-muted text-foreground'
        )}
      >
        {value}
      </code>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'size-7',
          isSlate ? 'text-slate-400 hover:text-slate-100' : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={copy}
        title="Copy"
        aria-label={`Copy ${label} connection`}
      >
        <Copy className="size-3.5" aria-hidden />
      </Button>
    </div>
  );
}
