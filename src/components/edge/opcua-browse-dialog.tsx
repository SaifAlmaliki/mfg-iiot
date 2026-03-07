'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Network, CheckCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface BrowseNodeResult {
  nodeId: string;
  browseName: string;
  displayName: string;
  nodeClass: string;
  dataType?: string;
  description?: string;
  isVariable?: boolean;
}

export interface OpcuaBrowseDialogProps {
  open: boolean;
  onClose: () => void;
  endpoint: string;
  connectorId?: string;
  connectorName?: string;
  siteId: string;
  enterpriseCode: string;
  siteCode: string;
  onSelectNodes: (nodes: BrowseNodeResult[]) => void;
}

export function OpcuaBrowseDialog({
  open,
  onClose,
  endpoint,
  siteId,
  enterpriseCode,
  siteCode,
  onSelectNodes,
}: OpcuaBrowseDialogProps) {
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<BrowseNodeResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !endpoint.trim()) return;
    setLoading(true);
    setError(null);
    setNodes([]);
    setSelected(new Set());

    fetch('/api/opcua/browse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: endpoint.trim(), variablesOnly: true }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || 'Browse failed')));
        return res.json();
      })
      .then((data) => {
        if (data.nodes && Array.isArray(data.nodes)) {
          setNodes(data.nodes);
        }
      })
      .catch((err) => setError(err.message || 'Failed to browse'))
      .finally(() => setLoading(false));
  }, [open, endpoint]);

  const toggle = (nodeId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === nodes.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(nodes.map((n) => n.nodeId)));
    }
  };

  const handleAddMappings = () => {
    const selectedNodes = nodes.filter((n) => selected.has(n.nodeId));
    onSelectNodes(selectedNodes);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="w-5 h-5 text-blue-500" />
            Browse OPC UA Server
          </DialogTitle>
          <DialogDescription>
            Select variables to create tag mappings. Endpoint: <code className="text-xs bg-muted px-1 rounded">{endpoint}</code>
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && nodes.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={selectAll}>
                {selected.size === nodes.length ? 'Deselect all' : 'Select all'}
              </Button>
              <span className="text-sm text-muted-foreground">
                {nodes.length} variable(s) · {selected.size} selected
              </span>
            </div>
            <ScrollArea className="flex-1 min-h-[280px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Node ID</TableHead>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Data Type</TableHead>
                    <TableHead className="hidden sm:table-cell">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nodes.map((node) => (
                    <TableRow
                      key={node.nodeId}
                      className={selected.has(node.nodeId) ? 'bg-primary/5' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selected.has(node.nodeId)}
                          onCheckedChange={() => toggle(node.nodeId)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[220px] truncate" title={node.nodeId}>
                        {node.nodeId}
                      </TableCell>
                      <TableCell className="font-medium">{node.displayName || node.browseName}</TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">{node.dataType ?? '—'}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-xs max-w-[180px] truncate" title={node.description}>
                        {node.description ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        )}

        {!loading && !error && nodes.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">
            No variables found. Ensure the server is running and the endpoint is correct.
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAddMappings}
            disabled={loading || selected.size === 0}
          >
            {selected.size > 0 ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Add {selected.size} mapping(s)
              </>
            ) : (
              'Add mappings'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
