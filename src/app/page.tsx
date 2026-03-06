'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { DashboardOverview } from '@/components/dashboard/dashboard-overview';
import { HierarchyPanel } from '@/components/hierarchy/hierarchy-panel';
import { ScadaPanel } from '@/components/scada/scada-panel';
import { MesPanel } from '@/components/mes/mes-panel';
import { TraceabilityPanel } from '@/components/traceability/traceability-panel';
import { MonitoringPanel } from '@/components/monitoring/monitoring-panel';
import { EdgePanel } from '@/components/edge/edge-panel';
import { AdminPanel } from '@/components/admin/admin-panel';
import { useNavigationStore } from '@/lib/store';
import { useAuthStore } from '@/lib/auth-store';
import { Toaster } from '@/components/ui/sonner';

export default function Home() {
  const pathname = usePathname();
  const { user, isInitialized, refreshSession } = useAuthStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const currentModule = useNavigationStore((state) => state.currentModule);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!isInitialized) return;
    if (!user && pathname === '/') {
      window.location.href = '/login';
      return;
    }
  }, [isInitialized, user, pathname]);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setSidebarCollapsed(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const renderContent = () => {
    if (currentModule === 'hierarchy') {
      return <HierarchyPanel />;
    }
    if (currentModule.startsWith('scada')) {
      return <ScadaPanel />;
    }
    if (currentModule.startsWith('mes')) {
      return <MesPanel />;
    }
    if (currentModule.startsWith('traceability')) {
      return <TraceabilityPanel />;
    }
    if (currentModule.startsWith('monitoring')) {
      return <MonitoringPanel />;
    }
    if (currentModule === 'edge') {
      return <EdgePanel />;
    }
    if (currentModule.startsWith('admin')) {
      return <AdminPanel />;
    }
    // Default to dashboard
    return <DashboardOverview />;
  };

  return (
    <div className="flex h-screen bg-background">
      {(!isInitialized || !user) ? (
        <div className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      ) : (
        <>
          {/* Desktop Sidebar */}
          <AppSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />

          {/* Main Content */}
          <main className={cn(
            "flex-1 overflow-auto",
            isMobile && "pt-14" // Add top padding for mobile header
          )}>
            {renderContent()}
          </main>
        </>
      )}
      <Toaster />
    </div>
  );
}
