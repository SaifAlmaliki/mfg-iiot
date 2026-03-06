'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, Plus, Loader2, LayoutGrid } from 'lucide-react';

export interface HmiGraphicSummary {
  id: string;
  name: string;
  description: string | null;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string };
}

interface HmiGraphicsListProps {
  canEdit: boolean;
  onView: (graphicId: string) => void;
  onEdit: (graphicId: string | null) => void;
}

export function HmiGraphicsList({ canEdit, onView, onEdit }: HmiGraphicsListProps) {
  const [graphics, setGraphics] = useState<HmiGraphicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchList() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/hmi/graphics?limit=50');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const json = await res.json();
        if (!cancelled) setGraphics(json.data ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load graphics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchList();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-destructive text-center">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            Saved graphics
          </h3>
          <p className="text-sm text-muted-foreground">View or edit process graphics</p>
        </div>
        {canEdit && (
          <Button onClick={() => onEdit(null)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New graphic
          </Button>
        )}
      </div>

      {graphics.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No graphics yet</CardTitle>
            <CardDescription>
              {canEdit
                ? 'Create a new graphic to design your process overview with symbols and live tag bindings.'
                : 'No saved graphics are available to view.'}
            </CardDescription>
          </CardHeader>
          {canEdit && (
            <CardContent>
              <Button onClick={() => onEdit(null)}>
                <Plus className="h-4 w-4 mr-2" />
                New graphic
              </Button>
            </CardContent>
          )}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {graphics.map((g) => (
            <Card key={g.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base truncate">{g.name}</CardTitle>
                <CardDescription className="line-clamp-2 text-xs">
                  {g.description || `${g.width}×${g.height}`}
                </CardDescription>
                <p className="text-[10px] text-muted-foreground">
                  Updated {new Date(g.updatedAt).toLocaleDateString()}
                </p>
              </CardHeader>
              <CardContent className="mt-auto flex gap-2 pt-0">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => onView(g.id)}>
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  View
                </Button>
                {canEdit && (
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(g.id)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
