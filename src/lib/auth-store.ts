import { create } from 'zustand';

export interface UserRole {
  id: string;
  name: string;
  code: string;
  permissions: string[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  siteId?: string | null;
  roles: UserRole[];
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  
  // Permission helpers
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  canAccessSite: (siteId: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isInitialized: false,

  setUser: (user) => set({ user, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
  setInitialized: (initialized) => set({ isInitialized: initialized }),

  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    }
    set({ user: null, isLoading: false });
    // Redirect to login page
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },

  refreshSession: async () => {
    try {
      set({ isLoading: true });
      const response = await fetch('/api/auth/session');

      // Avoid parsing HTML error pages as JSON (e.g. 404/500 from Next.js)
      if (!response.ok) {
        set({ user: null, isLoading: false, isInitialized: true });
        return;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        set({ user: null, isLoading: false, isInitialized: true });
        return;
      }

      const data = await response.json();

      // If no user session, set user to null (require login)
      if (!data.user) {
        set({
          user: null,
          isLoading: false,
          isInitialized: true,
        });
        return;
      }

      set({
        user: data.user,
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      console.error('Session refresh error:', error);
      set({
        user: null,
        isLoading: false,
        isInitialized: true,
      });
    }
  },

  hasPermission: (permission: string) => {
    const { user } = get();
    if (!user) return false;
    
    // Check if any role has the permission
    return user.roles.some(role => {
      const permissions = role.permissions;
      // Check for wildcard permission
      if (permissions.includes('*')) return true;
      // Check for module wildcard (e.g., "hierarchy:*")
      if (permissions.some(p => p.endsWith(':*') && permission.startsWith(p.replace(':*', '')))) return true;
      return permissions.includes(permission);
    });
  },

  hasAnyPermission: (permissions: string[]) => {
    return permissions.some(p => get().hasPermission(p));
  },

  hasAllPermissions: (permissions: string[]) => {
    return permissions.every(p => get().hasPermission(p));
  },

  canAccessSite: (siteId: string) => {
    const { user } = get();
    if (!user) return false;
    
    // If user has no siteId, they can access all sites (admin)
    if (!user.siteId) return true;
    
    // Check if user is assigned to the site
    return user.siteId === siteId;
  },
}));
