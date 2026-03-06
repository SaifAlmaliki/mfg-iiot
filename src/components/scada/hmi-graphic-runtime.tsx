'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useRealtimeStore, useRealtimeConnection } from '@/hooks/use-realtime';

interface GraphicElement {
  id: string;
  symbolId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  props: { bindings?: Array<{ tagId?: string; property?: string }>; control?: { type?: string; tagId?: string; writeValue?: number } };
  symbol: { id: string; name: string; category: string; svg: string };
}

interface HmiGraphicData {
  id: string;
  name: string;
  description: string | null;
  width: number;
  height: number;
  elements: GraphicElement[];
}

interface HmiGraphicRuntimeProps {
  graphicId: string;
  onBack: () => void;
}

export function HmiGraphicRuntime({ graphicId, onBack }: HmiGraphicRuntimeProps) {
  const [graphic, setGraphic] = useState<HmiGraphicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setpointInputs, setSetpointInputs] = useState<Record<string, string>>({});
  const tags = useRealtimeStore((s) => s.tags);
  const { writeTag } = useRealtimeConnection();

  useEffect(() => {
    let cancelled = false;
    async function fetchGraphic() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/hmi/graphics/${graphicId}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error('Graphic not found');
          throw new Error((await res.json()).error || 'Failed to load');
        }
        const data = await res.json();
        if (!cancelled) setGraphic(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load graphic');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchGraphic();
    return () => { cancelled = true; };
  }, [graphicId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading graphic…</p>
      </div>
    );
  }

  if (error || !graphic) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to list
        </Button>
        <p className="text-destructive">{error || 'Graphic not found'}</p>
      </div>
    );
  }

  // Resolve tag value for binding (store may be keyed by tag id or name)
  const getTagValue = (tagId: string): string => {
    const t = tags.get(tagId);
    if (!t) return '--';
    return typeof t.value === 'number' ? t.value.toFixed(2) : String(t.value);
  };

  const getTagQuality = (tagId: string): string => {
    return tags.get(tagId)?.quality ?? 'INIT';
  };

  const handleSetpoint = (elementId: string, tagId: string) => {
    const v = setpointInputs[elementId];
    if (v === undefined || v === '') return;
    const num = Number(v);
    if (!Number.isFinite(num)) return;
    writeTag(tagId, num);
  };

  const handleButton = (tagId: string, writeValue?: number) => {
    writeTag(tagId, writeValue ?? 1);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to list
        </Button>
        <span className="text-sm font-medium text-muted-foreground">{graphic.name}</span>
      </div>

      <div
        className="relative rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800"
        style={{ width: graphic.width, height: graphic.height, maxWidth: '100%' }}
      >
        <svg
          width={graphic.width}
          height={graphic.height}
          viewBox={`0 0 ${graphic.width} ${graphic.height}`}
          className="block"
        >
          {graphic.elements
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((el) => {
              const bindings = (el.props as { bindings?: Array<{ tagId?: string; property?: string }> })?.bindings ?? [];
              const valueBinding = bindings.find((b) => b.property === 'value');
              const fillBinding = bindings.find((b) => b.property === 'fill');
              const tagId = valueBinding?.tagId ?? fillBinding?.tagId;
              const value = tagId ? getTagValue(tagId) : '';
              const quality = tagId ? getTagQuality(tagId) : 'GOOD';
              const isBad = quality === 'BAD';
              const fillColor = isBad ? '#ef4444' : 'currentColor';

              return (
                <g
                  key={el.id}
                  transform={`translate(${el.x},${el.y}) rotate(${el.rotation} ${el.width / 2} ${el.height / 2})`}
                >
                  <rect
                    width={el.width}
                    height={el.height}
                    rx={4}
                    fill={isBad ? 'rgba(239,68,68,0.2)' : 'rgba(148,163,184,0.2)'}
                    stroke={fillColor}
                    strokeWidth={2}
                  />
                  <text
                    x={el.width / 2}
                    y={el.height / 2 - 6}
                    textAnchor="middle"
                    fontSize="10"
                    fill="currentColor"
                  >
                    {el.symbol.name}
                  </text>
                  {valueBinding?.tagId && (
                    <text
                      x={el.width / 2}
                      y={el.height / 2 + 8}
                      textAnchor="middle"
                      fontSize="14"
                      fontWeight="bold"
                      fill="currentColor"
                    >
                      {value}
                    </text>
                  )}
                </g>
              );
            })}
        </svg>
      </div>

      {/* Setpoint / button controls for elements that have control config */}
      {graphic.elements.some((el) => (el.props as { control?: { type?: string } })?.control?.tagId) && (
        <div className="flex flex-wrap gap-3 pt-2 border-t">
          {graphic.elements.map((el) => {
            const control = (el.props as { control?: { type?: string; tagId?: string; writeValue?: number } })?.control;
            if (!control?.tagId) return null;
            if (control.type === 'setpoint') {
              return (
                <div key={el.id} className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{el.symbol.name}:</span>
                  <Input
                    type="number"
                    className="w-24 h-8 text-sm"
                    value={setpointInputs[el.id] ?? ''}
                    onChange={(e) => setSetpointInputs((s) => ({ ...s, [el.id]: e.target.value }))}
                    placeholder="Value"
                  />
                  <Button size="sm" onClick={() => handleSetpoint(el.id, control.tagId!)}>
                    Write
                  </Button>
                </div>
              );
            }
            if (control.type === 'button') {
              return (
                <Button
                  key={el.id}
                  size="sm"
                  variant="outline"
                  onClick={() => handleButton(control.tagId!, control.writeValue)}
                >
                  {el.symbol.name}
                </Button>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}
