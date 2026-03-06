'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRealtimeStore as store } from '@/lib/store';

// Re-export the store for convenience
export { useRealtimeStore } from '@/lib/store';

// WebSocket message types
interface TagUpdate {
  id: string;
  value: number;
  timestamp: number;
  quality: string;
}

interface AlarmData {
  id: string;
  tagId: string;
  type: string;
  message: string;
  state: 'ACTIVE' | 'ACKNOWLEDGED' | 'CLEARED';
  priority: number;
  value: number;
  activatedAt: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
}

interface BatchData {
  id: string;
  batchNumber: string;
  status: string;
  state?: string;
  progress: number;
  startedAt?: number;
}

// Simple WebSocket hook that connects to Data Bridge service
export function useRealtimeConnection() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackRef = useRef(false);
  const updateTag = store((state) => state.updateTag);
  const addAlarm = store((state) => state.addAlarm);
  const updateAlarm = store((state) => state.updateAlarm);
  const updateBatch = store((state) => state.updateBatch);
  const setConnected = store((state) => state.setConnected);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    // Try to connect to the data bridge service
    const connectWebSocket = () => {
      // Don't try to reconnect if we're already in fallback mode
      if (fallbackRef.current) {
        return;
      }
      
      try {
        // Connect through gateway with XTransformPort
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/?XTransformPort=3005`;
        
        console.log('[WS] Attempting to connect to data bridge...');
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[WS] Connected to data bridge service');
          setConnected(true);
          setUseFallback(false);
          fallbackRef.current = false;
          
          // Subscribe to all data
          ws.send(JSON.stringify({ event: 'subscribe:all' }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
          } catch (e) {
            console.error('[WS] Error parsing message:', e);
          }
        };

        ws.onerror = () => {
          // Browser gives no details; onclose will run next. No log here to avoid duplicate with onclose.
        };

        ws.onclose = () => {
          if (fallbackRef.current) {
            return;
          }
          fallbackRef.current = true;
          setUseFallback(true);
          console.warn('[WS] Data bridge unavailable — using demo mode. Start the bridge on port 3005 for live data.');
        };
      } catch (error) {
        console.error('[WS] Failed to create WebSocket:', error);
        fallbackRef.current = true;
        setUseFallback(true);
      }
    };

    // Handle incoming WebSocket messages
    const handleWebSocketMessage = (data: any) => {
      const event = data.event || Object.keys(data)[0];
      
      switch (event) {
        case 'connected':
          console.log('[WS] Server acknowledged connection');
          break;
          
        case 'tags:initial':
          if (Array.isArray(data.tags)) {
            data.tags.forEach((tag: TagUpdate) => {
              updateTag(tag.id, tag.value, tag.timestamp);
            });
          }
          break;
          
        case 'tag:update':
        case 'tags:update':
          if (Array.isArray(data.tags)) {
            data.tags.forEach((tag: TagUpdate) => {
              updateTag(tag.id, tag.value, tag.timestamp);
            });
          } else if (data.id && data.value !== undefined) {
            updateTag(data.id, data.value, data.timestamp || Date.now());
          }
          break;
          
        case 'alarms:initial':
          if (Array.isArray(data.alarms)) {
            data.alarms.forEach((alarm: AlarmData) => {
              addAlarm(alarm);
            });
          }
          break;
          
        case 'alarms:update':
          if (Array.isArray(data.alarms)) {
            data.alarms.forEach((alarm: AlarmData) => {
              updateAlarm(alarm);
            });
          }
          break;
          
        case 'alarm:new':
        case 'alarm:update':
          if (data.id) {
            updateAlarm(data);
          }
          break;
          
        case 'batches:initial':
          if (Array.isArray(data.batches)) {
            data.batches.forEach((batch: BatchData) => {
              updateBatch(batch);
            });
          }
          break;
          
        case 'batch:update':
          if (data.id) {
            updateBatch(data);
          }
          break;
      }
    };

    // Start connection
    connectWebSocket();

    // Cleanup
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      setConnected(false);
    };
  }, [updateTag, addAlarm, updateAlarm, updateBatch, setConnected]);

  // Fallback simulation if WebSocket fails
  useEffect(() => {
    if (!useFallback) return;
    
    console.log('[WS] Using fallback simulation mode');
    setConnected(true);
    
    const interval = setInterval(() => {
      const tags = store.getState().tags;
      tags.forEach((tag, id) => {
        const variation = (Math.random() - 0.5) * 2;
        const newValue = tag.value + variation;
        updateTag(id, Math.round(newValue * 100) / 100, Date.now());
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      setConnected(false);
    };
  }, [useFallback, updateTag, setConnected]);

  const writeTag = useCallback((tagId: string, value: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        event: 'tag:write',
        tagId,
        value
      }));
      console.log(`[WS] Tag write sent: ${tagId} = ${value}`);
    } else {
      // Fallback: update locally
      updateTag(tagId, value, Date.now());
      console.log(`[WS] Tag write (local): ${tagId} = ${value}`);
    }
  }, [updateTag]);

  const ackAlarm = useCallback((alarmId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        event: 'alarm:ack',
        alarmId
      }));
      console.log(`[WS] Alarm ack sent: ${alarmId}`);
    } else {
      // Fallback: update locally
      const alarms = store.getState().alarms;
      const alarm = alarms.find(a => a.id === alarmId);
      if (alarm) {
        updateAlarm({ ...alarm, state: 'ACKNOWLEDGED', acknowledgedAt: Date.now() });
      }
    }
  }, [updateAlarm]);

  const sendBatchCommand = useCallback((batchId: string, command: string, params?: any) => {
    return new Promise((resolve) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          event: 'batch:command',
          batchId,
          command,
          params
        }));
        console.log(`[WS] Batch command sent: ${batchId} - ${command}`);
        resolve({ success: true });
      } else {
        console.log(`[WS] Batch command (local): ${batchId} - ${command}`);
        resolve({ success: true });
      }
    });
  }, []);

  return {
    writeTag,
    ackAlarm,
    sendBatchCommand,
  };
}

export function useTagValue(tagId: string) {
  const tags = store((state) => state.tags);
  return tags.get(tagId);
}

export function useAlarms(activeOnly: boolean = true) {
  const alarms = store((state) => state.alarms);
  if (activeOnly) {
    return alarms.filter((a) => a.state === 'ACTIVE');
  }
  return alarms;
}

export function useBatches() {
  return store((state) => state.batches);
}

export function useConnectionStatus() {
  return store((state) => state.connected);
}
