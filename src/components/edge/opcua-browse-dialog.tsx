'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
import { Loader2, Network, CheckCircle, Search } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
  siteId: _siteId,
  enterpriseCode: _enterpriseCode,
  siteCode: _siteCode,
  onSelectNodes,
}: OpcuaBrowseDialogProps) {
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<BrowseNodeResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hideSystemNodes, setHideSystemNodes] = useState(true);

  useEffect(() => {
    if (!open || !endpoint.trim()) return;
    setLoading(true);
    setError(null);
    setNodes([]);
    setSelected(new Set());

    const trimmed = endpoint.trim();
    if (!/^opc\.tcp:\/\/[^/]+:\d+/.test(trimmed)) {
      setError('Endpoint must be opc.tcp://host:port (e.g. opc.tcp://localhost:4840)');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    fetch('/api/opcua/browse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: trimmed, variablesOnly: true }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || 'Browse failed')));
        return res.json();
      })
      .then((data) => {
        if (data.nodes && Array.isArray(data.nodes)) {
          const seen = new Set<string>();
          const deduped = data.nodes.filter((n: BrowseNodeResult) => {
            if (seen.has(n.nodeId)) return false;
            seen.add(n.nodeId);
            return true;
          });
          setNodes(deduped);
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          setError('Browse timed out (45s). Check that the OPC UA server is running at the endpoint (e.g. opc.tcp://localhost:4840). Try Test first.');
        } else {
          setError(err.message || 'Failed to browse');
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setLoading(false);
      });
  }, [open, endpoint]);

  const toggle = (nodeId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const applicationNodes = useMemo(() => {
    const byId = new Map<string, BrowseNodeResult>();
    for (const n of nodes) {
      if (hideSystemNodes && n.nodeId.startsWith('ns=0;')) continue;
      if (!byId.has(n.nodeId)) byId.set(n.nodeId, n);
    }
    return Array.from(byId.values());
  }, [nodes, hideSystemNodes]);

  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return applicationNodes;
    const q = searchQuery.trim().toLowerCase();
    return applicationNodes.filter(
      (n) =>
        n.nodeId.toLowerCase().includes(q) ||
        (n.displayName || '').toLowerCase().includes(q) ||
        (n.browseName || '').toLowerCase().includes(q)
    );
  }, [applicationNodes, searchQuery]);

  const selectAll = () => {
    if (selected.size === filteredNodes.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredNodes.map((n) => n.nodeId)));
    }
  };

  const handleAddMappings = () => {
    const selectedNodes = nodes.filter((n) => selected.has(n.nodeId));
    onSelectNodes(selectedNodes);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Network className="w-5 h-5 text-blue-500" />
            Browse OPC UA Server
          </DialogTitle>
          <DialogDescription>
            Select variables to create tag mappings. Endpoint: <code className="text-xs bg-muted px-1 rounded">{endpoint}</code>
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12 flex-shrink-0">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm flex-shrink-0">
            {error}
          </div>
        )}

        {!loading && !error && nodes.length > 0 && (
          <>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by Node ID or name (e.g. Robot, Machine, Load)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
                  <Checkbox
                    checked={hideSystemNodes}
                    onCheckedChange={(v) => setHideSystemNodes(v === true)}
                  />
                  Hide system nodes (ns=0)
                </label>
              </div>
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  {selected.size === filteredNodes.length && filteredNodes.length > 0 ? 'Deselect all' : 'Select all'}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {filteredNodes.length} of {applicationNodes.length} variable(s) · {selected.size} selected
                </span>
              </div>
            </div>
            <div
              className="rounded-md border mt-2 overflow-auto overscroll-contain"
              style={{ height: 'min(400px, 50vh)', minHeight: 200 }}
            >
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead className="min-w-[200px]">Node ID</TableHead>
                    <TableHead className="min-w-[140px]">Display Name</TableHead>
                    <TableHead className="min-w-[80px]">Data Type</TableHead>
                    <TableHead className="hidden sm:table-cell min-w-[120px]">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNodes.map((node) => (
                    <TableRow
                      key={node.nodeId}
                      className={selected.has(node.nodeId) ? 'bg-primary/5' : ''}
                    >
                      <TableCell className="w-10">
                        <Checkbox
                          checked={selected.has(node.nodeId)}
                          onCheckedChange={() => toggle(node.nodeId)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs min-w-[200px] max-w-[280px] truncate" title={node.nodeId}>
                        {node.nodeId}
                      </TableCell>
                      <TableCell className="font-medium min-w-[140px] max-w-[200px] truncate" title={node.displayName || node.browseName}>
                        {node.displayName || node.browseName}
                      </TableCell>
                      <TableCell className="min-w-[80px] text-muted-foreground">
                        {node.dataType ?? '—'}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-xs min-w-[120px] max-w-[200px] truncate" title={node.description}>
                        {node.description ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filteredNodes.length === 0 && (
              <p className="text-sm text-muted-foreground flex-shrink-0 mt-2">
                No variables match the search. Try a different term or turn off &quot;Hide system nodes&quot;.
              </p>
            )}
          </>
        )}

        {!loading && !error && nodes.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm flex-shrink-0">
            No variables found. Ensure the server is running and the endpoint is correct.
          </div>
        )}

        <DialogFooter className="flex-shrink-0">
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
