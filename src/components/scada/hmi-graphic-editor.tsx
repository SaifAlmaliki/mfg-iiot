'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Save, GripVertical, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePermission } from '@/lib/hooks/use-auth';

// Types matching API / Prisma
export interface HmiSymbolSummary {
  id: string;
  name: string;
  category: string;
  svg: string;
  isPredefined: boolean;
}

export interface TagSummary {
  id: string;
  name: string;
  isWritable?: boolean;
}

export interface EditorElement {
  id: string;
  symbolId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  props: {
    bindings?: Array<{ tagId?: string; property?: string }>;
    control?: { type?: string; tagId?: string; writeValue?: number };
  };
  symbol?: { id: string; name: string; category: string; svg: string };
}

interface HmiGraphicEditorProps {
  graphicId: string | null;
  onBack: () => void;
  onSaved: (id: string) => void;
}

const DEFAULT_ELEMENT_SIZE = 100;
const DEFAULT_ROTATION = 0;
const DEFAULT_Z = 0;

function generateTempId(): string {
  return 'temp-' + crypto.randomUUID?.() ?? `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function HmiGraphicEditor({ graphicId, onBack, onSaved }: HmiGraphicEditorProps) {
  const canEdit = usePermission('scada.edit');
  const [loading, setLoading] = useState(!!graphicId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [elements, setElements] = useState<EditorElement[]>([]);
  const [symbols, setSymbols] = useState<HmiSymbolSummary[]>([]);
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragElementId, setDragElementId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const clientToSvg = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    return { x: svgP.x, y: svgP.y };
  }, []);

  // Permission gate: show forbidden and back if no scada.edit
  useEffect(() => {
    if (canEdit === false) return;
  }, [canEdit]);

  // Load graphic when editing existing
  useEffect(() => {
    if (!graphicId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchGraphic() {
      setError(null);
      try {
        const res = await fetch(`/api/hmi/graphics/${graphicId}`);
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to load');
        const data = await res.json();
        if (!cancelled) {
          setName(data.name ?? '');
          setDescription(data.description ?? '');
          setWidth(data.width ?? 800);
          setHeight(data.height ?? 600);
          const els = (data.elements ?? []).map((el: EditorElement) => ({
            ...el,
            props: el.props && typeof el.props === 'object' ? el.props : { bindings: [], control: {} },
          }));
          setElements(els);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchGraphic();
    return () => { cancelled = true; };
  }, [graphicId]);

  // Load symbols and tags
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/hmi/symbols').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/tags').then((r) => (r.ok ? r.json() : [])),
    ]).then(([symList, tagList]) => {
      if (!cancelled) {
        setSymbols(Array.isArray(symList) ? symList : []);
        setTags(Array.isArray(tagList) ? tagList : []);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const selectedElement = elements.find((e) => e.id === selectedId);

  const updateElement = useCallback((id: string, updates: Partial<EditorElement>) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...updates } : el))
    );
  }, []);

  const updateSelectedProps = useCallback(
    (propsUpdate: Partial<EditorElement['props']>) => {
      if (!selectedId) return;
      setElements((prev) =>
        prev.map((el) =>
          el.id === selectedId
            ? { ...el, props: { ...el.props, ...propsUpdate } }
            : el
        )
      );
    },
    [selectedId]
  );

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!canEdit) {
      setError('You do not have permission to save.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = graphicId ? `/api/hmi/graphics/${graphicId}` : '/api/hmi/graphics';
      const method = graphicId ? 'PUT' : 'POST';
      const payload = elements.map((el) => ({
        symbolId: el.symbolId,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        rotation: el.rotation,
        zIndex: el.zIndex,
        props: el.props,
      }));
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        width,
        height,
        elements: payload,
      };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.details || `HTTP ${res.status}`);
      }
      const data = await res.json();
      onSaved(data.id);
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePaletteDragStart = (e: React.DragEvent, symbolId: string) => {
    e.dataTransfer.setData('application/x-hmi-symbol-id', symbolId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const symbolId = e.dataTransfer.getData('application/x-hmi-symbol-id');
    if (!symbolId || !canvasRect) return;
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const x = e.clientX - rect.left - DEFAULT_ELEMENT_SIZE / 2;
    const y = e.clientY - rect.top - DEFAULT_ELEMENT_SIZE / 2;
    const symbol = symbols.find((s) => s.id === symbolId);
    const newEl: EditorElement = {
      id: generateTempId(),
      symbolId,
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: DEFAULT_ELEMENT_SIZE,
      height: DEFAULT_ELEMENT_SIZE,
      rotation: DEFAULT_ROTATION,
      zIndex: elements.length ? Math.max(...elements.map((e) => e.zIndex), 0) + 1 : DEFAULT_Z,
      props: {},
      symbol: symbol ? { id: symbol.id, name: symbol.name, category: symbol.category, svg: symbol.svg } : undefined,
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedId(newEl.id);
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleElementMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    const el = elements.find((x) => x.id === id);
    if (!el) return;
    const pt = clientToSvg(e.clientX, e.clientY);
    setDragElementId(id);
    setDragOffset({ x: pt.x - el.x, y: pt.y - el.y });
  };

  const handleCanvasMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragElementId == null) return;
      const pt = clientToSvg(e.clientX, e.clientY);
      setElements((prev) =>
        prev.map((el) =>
          el.id === dragElementId
            ? {
                ...el,
                x: Math.max(0, pt.x - dragOffset.x),
                y: Math.max(0, pt.y - dragOffset.y),
              }
            : el
        )
      );
    },
    [dragElementId, dragOffset, clientToSvg]
  );

  const handleCanvasMouseUp = useCallback(() => {
    setDragElementId(null);
  }, []);

  useEffect(() => {
    if (dragElementId == null) return;
    window.addEventListener('mousemove', handleCanvasMouseMove);
    window.addEventListener('mouseup', handleCanvasMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleCanvasMouseMove);
      window.removeEventListener('mouseup', handleCanvasMouseUp);
    };
  }, [dragElementId, handleCanvasMouseMove, handleCanvasMouseUp]);

  const handleCanvasRef = useCallback((node: SVGSVGElement | null) => {
    svgRef.current = node;
    if (node) setCanvasRect(node.getBoundingClientRect());
  }, []);

  const handleCanvasClick = () => {
    setSelectedId(null);
  };

  if (canEdit === false) {
    return (
      <div className="space-y-4 p-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to list
        </Button>
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="h-10 w-10 text-amber-500 shrink-0" />
            <div>
              <p className="font-medium">You don&apos;t have permission to edit graphics.</p>
              <p className="text-sm text-muted-foreground">Only users with &quot;scada.edit&quot; can create or edit HMI graphics.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-2 overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to list
        </Button>
        <div className="flex items-center gap-2">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-3">
        {/* Symbol palette */}
        <Card className="w-52 shrink-0 flex flex-col overflow-hidden">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm">Symbols</CardTitle>
            <CardDescription className="text-xs">Drag onto canvas</CardDescription>
          </CardHeader>
          <ScrollArea className="flex-1 px-2 pb-2">
            <div className="space-y-1">
              {symbols.map((sym) => (
                <div
                  key={sym.id}
                  draggable
                  onDragStart={(e) => handlePaletteDragStart(e, sym.id)}
                  className="flex items-center gap-2 rounded border bg-muted/50 px-2 py-2 cursor-grab active:cursor-grabbing text-sm"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{sym.name}</span>
                </div>
              ))}
              {symbols.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">No symbols loaded</p>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Canvas */}
        <Card className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <CardHeader className="py-2 px-3 flex flex-row items-center gap-4 shrink-0">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Graphic name"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Size (px)</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    min={100}
                    max={4000}
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value) || 800)}
                    className="h-8 w-20 text-sm"
                  />
                  <span className="self-center text-muted-foreground">×</span>
                  <Input
                    type="number"
                    min={100}
                    max={4000}
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value) || 600)}
                    className="h-8 w-20 text-sm"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-2 overflow-auto">
            <svg
              ref={handleCanvasRef}
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              className="border border-dashed rounded bg-slate-100 dark:bg-slate-800 block"
              onDrop={handleCanvasDrop}
              onDragOver={handleCanvasDragOver}
              onClick={handleCanvasClick}
            >
              {elements
                .sort((a, b) => a.zIndex - b.zIndex)
                .map((el) => {
                  const isSelected = el.id === selectedId;
                  const symbolName = el.symbol?.name ?? symbols.find((s) => s.id === el.symbolId)?.name ?? '?';
                  return (
                    <g
                      key={el.id}
                      transform={`translate(${el.x},${el.y}) rotate(${el.rotation} ${el.width / 2} ${el.height / 2})`}
                      onMouseDown={(e) => handleElementMouseDown(e, el.id)}
                      style={{ cursor: 'move' }}
                    >
                      <rect
                        width={el.width}
                        height={el.height}
                        rx={4}
                        fill={isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(148, 163, 184, 0.2)'}
                        stroke={isSelected ? 'rgb(59, 130, 246)' : 'rgb(148, 163, 184)'}
                        strokeWidth={isSelected ? 2 : 1}
                      />
                      <text
                        x={el.width / 2}
                        y={el.height / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="11"
                        fill="currentColor"
                      >
                        {symbolName}
                      </text>
                    </g>
                  );
                })}
            </svg>
          </CardContent>
        </Card>

        {/* Property panel */}
        <Card className="w-72 shrink-0 flex flex-col overflow-hidden">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm">
              {selectedElement ? 'Element' : 'Graphic'}
            </CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1 px-3 pb-3">
            {selectedElement ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">X</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedElement.x)}
                      onChange={(e) => updateElement(selectedElement.id, { x: Number(e.target.value) || 0 })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Y</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedElement.y)}
                      onChange={(e) => updateElement(selectedElement.id, { y: Number(e.target.value) || 0 })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Width</Label>
                    <Input
                      type="number"
                      min={20}
                      value={Math.round(selectedElement.width)}
                      onChange={(e) => updateElement(selectedElement.id, { width: Number(e.target.value) || 100 })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height</Label>
                    <Input
                      type="number"
                      min={20}
                      value={Math.round(selectedElement.height)}
                      onChange={(e) => updateElement(selectedElement.id, { height: Number(e.target.value) || 100 })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Rotation (°)</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedElement.rotation)}
                      onChange={(e) => updateElement(selectedElement.id, { rotation: Number(e.target.value) || 0 })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Z-Index</Label>
                    <Input
                      type="number"
                      value={selectedElement.zIndex}
                      onChange={(e) => updateElement(selectedElement.id, { zIndex: Number(e.target.value) || 0 })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Tag binding (value)</Label>
                  <Select
                    value={
                      (selectedElement.props?.bindings?.find((b) => b.property === 'value')?.tagId as string) ?? ''
                    }
                    onValueChange={(tagId) => {
                      const bindings = selectedElement.props?.bindings?.filter((b) => b.property !== 'value') ?? [];
                      if (tagId) bindings.push({ tagId, property: 'value' });
                      updateSelectedProps({ bindings });
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm mt-1">
                      <SelectValue placeholder="Select tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {tags.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Tag binding (fill / state)</Label>
                  <Select
                    value={
                      (selectedElement.props?.bindings?.find((b) => b.property === 'fill')?.tagId as string) ?? ''
                    }
                    onValueChange={(tagId) => {
                      const bindings = selectedElement.props?.bindings?.filter((b) => b.property !== 'fill') ?? [];
                      if (tagId) bindings.push({ tagId, property: 'fill' });
                      updateSelectedProps({ bindings });
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm mt-1">
                      <SelectValue placeholder="Select tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {tags.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Control type</Label>
                  <Select
                    value={selectedElement.props?.control?.type ?? 'none'}
                    onValueChange={(type) => {
                      const control = { ...selectedElement.props?.control, type };
                      if (type === 'none') updateSelectedProps({ control: undefined });
                      else updateSelectedProps({ control: control as { type: string; tagId?: string; writeValue?: number } });
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (display only)</SelectItem>
                      <SelectItem value="setpoint">Setpoint</SelectItem>
                      <SelectItem value="button">Button</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(selectedElement.props?.control?.type === 'setpoint' ||
                  selectedElement.props?.control?.type === 'button') && (
                  <>
                    <div>
                      <Label className="text-xs">Control tag</Label>
                      <Select
                        value={selectedElement.props?.control?.tagId ?? ''}
                        onValueChange={(tagId) =>
                          updateSelectedProps({
                            control: { ...selectedElement.props?.control, tagId: tagId || undefined },
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-sm mt-1">
                          <SelectValue placeholder="Tag to write" />
                        </SelectTrigger>
                        <SelectContent>
                          {tags.filter((t) => t.isWritable !== false).map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                          {tags.filter((t) => t.isWritable !== false).length === 0 && (
                            <SelectItem value="" disabled>No writable tags</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedElement.props?.control?.type === 'button' && (
                      <div>
                        <Label className="text-xs">Button write value</Label>
                        <Input
                          type="number"
                          value={selectedElement.props?.control?.writeValue ?? ''}
                          onChange={(e) =>
                            updateSelectedProps({
                              control: {
                                ...selectedElement.props?.control,
                                writeValue: e.target.value === '' ? undefined : Number(e.target.value),
                              },
                            })
                          }
                          placeholder="Optional"
                          className="h-8 text-sm"
                        />
                      </div>
                    )}
                  </>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setElements((prev) => prev.filter((el) => el.id !== selectedId));
                    setSelectedId(null);
                  }}
                >
                  Remove element
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional"
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Click an element on the canvas to edit its position and bindings.
                </p>
              </div>
            )}
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
