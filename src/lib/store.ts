import { create } from 'zustand';

// Types
interface RealtimeTag {
  id: string;
  value: number;
  timestamp: number;
  quality: string;
}

interface Alarm {
  id: string;
  tagId: string;
  type: string;
  message: string;
  state: 'ACTIVE' | 'ACKNOWLEDGED' | 'CLEARED';
  priority: number;
  value: number;
  activatedAt: number;
  acknowledgedAt?: number;
}

interface Batch {
  id: string;
  batchNumber: string;
  status: string;
  state?: string;
  progress: number;
  startedAt?: number;
}

interface User {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  roles: string[];
}

interface NavigationState {
  currentModule: string;
  setCurrentModule: (module: string) => void;
}

// Navigation Store
export const useNavigationStore = create<NavigationState>((set) => ({
  currentModule: 'dashboard',
  setCurrentModule: (module) => set({ currentModule: module }),
}));

// Realtime Data Store
interface RealtimeState {
  tags: Map<string, RealtimeTag>;
  alarms: Alarm[];
  batches: Batch[];
  connected: boolean;
  setTag: (id: string, tag: RealtimeTag) => void;
  updateTag: (id: string, value: number, timestamp: number) => void;
  addAlarm: (alarm: Alarm) => void;
  updateAlarm: (alarm: Alarm) => void;
  updateBatch: (batch: Batch) => void;
  setConnected: (connected: boolean) => void;
  clearAlarms: () => void;
}

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  tags: new Map(),
  alarms: [],
  batches: [],
  connected: false,

  setTag: (id, tag) => {
    const tags = new Map(get().tags);
    tags.set(id, tag);
    set({ tags });
  },

  updateTag: (id, value, timestamp) => {
    const tags = new Map(get().tags);
    const existing = tags.get(id);
    if (existing) {
      tags.set(id, { ...existing, value, timestamp, quality: 'GOOD' });
    } else {
      tags.set(id, { id, value, timestamp, quality: 'GOOD' });
    }
    set({ tags });
  },

  addAlarm: (alarm) => {
    set({ alarms: [alarm, ...get().alarms] });
  },

  updateAlarm: (alarm) => {
    const alarms = get().alarms.map((a) => 
      a.id === alarm.id ? alarm : a
    );
    set({ alarms });
  },

  updateBatch: (batch) => {
    const batches = get().batches.map((b) =>
      b.id === batch.id ? { ...b, ...batch } : b
    );
    if (!batches.find((b) => b.id === batch.id)) {
      batches.push(batch);
    }
    set({ batches });
  },

  setConnected: (connected) => set({ connected }),

  clearAlarms: () => set({ alarms: [] }),
}));

// Auth Store
interface AuthState {
  user: User | null;
  token: string | null;
  organizationId: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  organizationId: null,
  isAuthenticated: false,

  login: (user, token) => {
    localStorage.setItem('auth_token', token);
    set({
      user,
      token,
      organizationId: user.organizationId,
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    set({
      user: null,
      token: null,
      organizationId: null,
      isAuthenticated: false,
    });
  },
}));

// Selection Store
interface SelectionState {
  selectedPlantId: string | null;
  selectedLineId: string | null;
  selectedUnitId: string | null;
  setSelectedPlant: (id: string | null) => void;
  setSelectedLine: (id: string | null) => void;
  setSelectedUnit: (id: string | null) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedPlantId: null,
  selectedLineId: null,
  selectedUnitId: null,

  setSelectedPlant: (id) => set({ selectedPlantId: id, selectedLineId: null, selectedUnitId: null }),
  setSelectedLine: (id) => set({ selectedLineId: id, selectedUnitId: null }),
  setSelectedUnit: (id) => set({ selectedUnitId: id }),
}));

// Demo data for initial state
const demoTags: [string, RealtimeTag][] = [
  ['TIC-101', { id: 'TIC-101', value: 65.2, timestamp: Date.now(), quality: 'GOOD' }],
  ['PIC-101', { id: 'PIC-101', value: 3.5, timestamp: Date.now(), quality: 'GOOD' }],
  ['FIC-101', { id: 'FIC-101', value: 250.8, timestamp: Date.now(), quality: 'GOOD' }],
  ['LIC-101', { id: 'LIC-101', value: 75.3, timestamp: Date.now(), quality: 'GOOD' }],
  ['TIC-102', { id: 'TIC-102', value: 72.1, timestamp: Date.now(), quality: 'GOOD' }],
  ['PIC-102', { id: 'PIC-102', value: 4.2, timestamp: Date.now(), quality: 'GOOD' }],
  ['FIC-102', { id: 'FIC-102', value: 180.5, timestamp: Date.now(), quality: 'GOOD' }],
  ['LIC-102', { id: 'LIC-102', value: 45.7, timestamp: Date.now(), quality: 'GOOD' }],
  ['MOT-101', { id: 'MOT-101', value: 1450, timestamp: Date.now(), quality: 'GOOD' }],
  ['MOT-102', { id: 'MOT-102', value: 1600, timestamp: Date.now(), quality: 'GOOD' }],
  ['VIB-101', { id: 'VIB-101', value: 2.5, timestamp: Date.now(), quality: 'GOOD' }],
  ['PWR-101', { id: 'PWR-101', value: 125.3, timestamp: Date.now(), quality: 'GOOD' }],
];

// Initialize with demo data
useRealtimeStore.setState({ tags: new Map(demoTags) });
