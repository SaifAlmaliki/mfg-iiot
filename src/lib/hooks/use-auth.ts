import { useAuthStore, User } from '@/lib/auth-store';

// Re-export types
export type { User };

// Main hook for auth functionality
export function useAuth() {
  const {
    user,
    isLoading,
    isInitialized,
    logout,
    refreshSession,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessSite,
  } = useAuthStore();

  return {
    user,
    isLoading,
    isInitialized,
    isAuthenticated: !!user,
    logout,
    refreshSession,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessSite,
  };
}

// Hook for checking specific permission
export function usePermission(permission: string): boolean {
  const { hasPermission } = useAuthStore();
  return hasPermission(permission);
}

// Hook for checking multiple permissions
export function usePermissions(permissions: string[], requireAll = false): boolean {
  const { hasAnyPermission, hasAllPermissions } = useAuthStore();
  return requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
}

// Hook for checking site access
export function useSiteAccess(siteId: string): boolean {
  const { canAccessSite } = useAuthStore();
  return canAccessSite(siteId);
}

// Hook that redirects if user doesn't have permission
export function useRequirePermission(permission: string): { hasPermission: boolean; isLoading: boolean } {
  const { hasPermission, isLoading, isInitialized } = useAuthStore();
  
  return {
    hasPermission: hasPermission(permission),
    isLoading: isLoading || !isInitialized,
  };
}
