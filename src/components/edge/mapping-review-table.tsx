'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CheckCircle,
  XCircle,
  Edit2,
  Save,
  X,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProposedMapping {
  id: string;
  sourceAddress: string;
  sourceType: string;
  sourceDataType: string;
  tagName: string;
  mqttTopic: string;
  dataType: string;
  engUnit?: string;
  description?: string;
  scale?: number;
  offset?: number;
  simulatorId: string;
  simulatorName: string;
  simulatorType: string;
  simulatorPort: number;
  productionLine?: string;
  exists?: boolean;
  status: 'pending' | 'approved' | 'rejected';
}

interface MappingReviewTableProps {
  mappings: ProposedMapping[];
  onApprove: (ids: string[]) => void;
  onReject: (ids: string[]) => void;
  onSavePending: (mappings: ProposedMapping[]) => void;
  isLoading?: boolean;
}

export function MappingReviewTable({
  mappings,
  onApprove,
  onReject,
  onSavePending,
  isLoading,
}: MappingReviewTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTopic, setEditedTopic] = useState<string>('');
  const [editedName, setEditedName] = useState<string>('');

  const toggleAll = () => {
    if (selectedIds.size === mappings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(mappings.map((m) => m.id)));
    }
  };

  const toggleOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const startEdit = (mapping: ProposedMapping) => {
    setEditingId(mapping.id);
    setEditedTopic(mapping.mqttTopic);
    setEditedName(mapping.tagName);
  };

  const saveEdit = (mapping: ProposedMapping) => {
    const index = mappings.findIndex((m) => m.id === mapping.id);
    if (index !== -1) {
      mappings[index] = {
        ...mappings[index],
        mqttTopic: editedTopic,
        tagName: editedName,
      };
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const getSourceTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      TAG: 'bg-blue-100 text-blue-800',
      COIL: 'bg-amber-100 text-amber-800',
      DISCRETE_INPUT: 'bg-amber-100 text-amber-800',
      INPUT_REGISTER: 'bg-green-100 text-green-800',
      HOLDING_REGISTER: 'bg-purple-100 text-purple-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} of {mappings.length} selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSavePending(mappings)}
            disabled={isLoading}
          >
            Save for Review
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onReject(Array.from(selectedIds))}
            disabled={selectedIds.size === 0 || isLoading}
          >
            <XCircle className="w-4 h-4 mr-1" />
            Reject
          </Button>
          <Button
            size="sm"
            onClick={() => onApprove(Array.from(selectedIds))}
            disabled={selectedIds.size === 0 || isLoading}
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Approve
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === mappings.length && mappings.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Tag Name</TableHead>
              <TableHead>MQTT Topic</TableHead>
              <TableHead>Source Address</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Data Type</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Simulator</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No mappings to review
                </TableCell>
              </TableRow>
            ) : (
              mappings.map((mapping) => (
                <TableRow
                  key={mapping.id}
                  className={cn(
                    mapping.exists && 'bg-yellow-50',
                    mapping.status === 'approved' && 'bg-green-50',
                    mapping.status === 'rejected' && 'bg-red-50 opacity-50'
                  )}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(mapping.id)}
                      onCheckedChange={() => toggleOne(mapping.id)}
                    />
                  </TableCell>
                  <TableCell>
                    {editingId === mapping.id ? (
                      <Input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="h-8"
                      />
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-sm">{mapping.tagName}</span>
                        {mapping.exists && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                              </TooltipTrigger>
                              <TooltipContent>
                                Topic already exists in database
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === mapping.id ? (
                      <Input
                        value={editedTopic}
                        onChange={(e) => setEditedTopic(e.target.value)}
                        className="h-8 font-mono text-xs"
                      />
                    ) : (
                      <span className="font-mono text-xs">{mapping.mqttTopic}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{mapping.sourceAddress}</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={getSourceTypeBadge(mapping.sourceType)}>
                      {mapping.sourceType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{mapping.dataType}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{mapping.engUnit || '-'}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">{mapping.simulatorName}</span>
                      <span className="text-xs text-muted-foreground">
                        :{mapping.simulatorPort}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {editingId === mapping.id ? (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => saveEdit(mapping)}
                        >
                          <Save className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={cancelEdit}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEdit(mapping)}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
