'use client';

import { useCallback, useEffect, useState } from 'react';

export type RunCommand =
  | 'START'
  | 'HOLD'
  | 'RESUME'
  | 'ABORT'
  | 'COMPLETE'
  | 'STEP_COMPLETE'
  | 'RESET';

export interface ProductionRunSummary {
  id: string;
  runNumber: string;
  status: string;
  state: string | null;
  phase: string | null;
  step: string | null;
  stepIndex: number;
  progress: number;
  startedAt: string | null;
  endedAt: string | null;
  recipeId: string | null;
  orderId: string | null;
  workCenterId: string;
  createdAt: string;
  updatedAt: string;
  recipe?: { id: string; name: string; version: string; status: string };
  order?: { id: string; orderNumber: string; status: string };
  workCenter?: { id: string; name: string; code: string };
}

interface UseRunsResult {
  runs: ProductionRunSummary[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  sendRunCommand: (runId: string, command: RunCommand) => Promise<{ success: boolean; error?: string }>;
}

export function useRuns(params?: {
  status?: string;
  workCenterId?: string;
  orderId?: string;
  recipeId?: string;
  limit?: number;
  offset?: number;
}): UseRunsResult {
  const [runs, setRuns] = useState<ProductionRunSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set('status', params.status);
      if (params?.workCenterId) searchParams.set('workCenterId', params.workCenterId);
      if (params?.orderId) searchParams.set('orderId', params.orderId);
      if (params?.recipeId) searchParams.set('recipeId', params.recipeId);
      if (params?.limit != null) searchParams.set('limit', String(params.limit));
      if (params?.offset != null) searchParams.set('offset', String(params.offset));
      const res = await fetch(`/api/runs?${searchParams.toString()}`);
      if (!res.ok) throw new Error(await res.json().then((b) => b.error || res.statusText));
      const data = await res.json();
      setRuns(data.data ?? []);
      setTotal(data.total ?? data.data?.length ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch runs');
      setRuns([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [params?.status, params?.workCenterId, params?.orderId, params?.recipeId, params?.limit, params?.offset]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const sendRunCommand = useCallback(async (runId: string, command: RunCommand) => {
    try {
      const res = await fetch(`/api/runs/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || res.statusText };
      }
      await refetch();
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Command failed' };
    }
  }, [refetch]);

  return { runs, total, loading, error, refetch, sendRunCommand };
}
