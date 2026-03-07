'use client';

import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Factory,
  Activity,
  ClipboardList,
  GitBranch,
  Wrench,
  HardDrive,
  Users,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Bell,
  User,
  LogOut,
  Building2,
  Layers,
  LayoutGrid,
  Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useNavigationStore } from '@/lib/store';
import { useAuthStore } from '@/lib/auth-store';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  children?: NavItem[];
}

const navigation: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/#dashboard',
  },
  {
    id: 'hierarchy',
    label: 'Hierarchy Setup',
    icon: Layers,
    href: '/#hierarchy',
  },
  {
    id: 'scada',
    label: 'SCADA / HMI',
    icon: Activity,
    href: '/#scada',
    children: [
      { id: 'scada-tags', label: 'Live Tags', icon: Activity, href: '/#scada/tags' },
      { id: 'scada-alarms', label: 'Alarms', icon: Bell, href: '/#scada/alarms' },
      { id: 'scada-trends', label: 'Trends', icon: Factory, href: '/#scada/trends' },
      { id: 'scada-hmi', label: 'HMI View', icon: LayoutGrid, href: '/#scada/hmi' },
    ],
  },
  {
    id: 'mes',
    label: 'MES',
    icon: ClipboardList,
    href: '/#mes',
    children: [
      { id: 'mes-orders', label: 'Production Orders', icon: ClipboardList, href: '/#mes/orders' },
      { id: 'mes-recipes', label: 'Recipes', icon: Settings, href: '/#mes/recipes' },
      { id: 'mes-batches', label: 'Batches', icon: Factory, href: '/#mes/batches' },
      { id: 'mes-materials', label: 'Materials', icon: HardDrive, href: '/#mes/materials' },
    ],
  },
  {
    id: 'traceability',
    label: 'Traceability',
    icon: GitBranch,
    href: '/#traceability',
    children: [
      { id: 'traceability-genealogy', label: 'Genealogy', icon: GitBranch, href: '/#traceability/genealogy' },
      { id: 'traceability-shipments', label: 'Shipments', icon: Building2, href: '/#traceability/shipments' },
    ],
  },
  {
    id: 'monitoring',
    label: 'Condition Monitoring',
    icon: Wrench,
    href: '/#monitoring',
    children: [
      { id: 'monitoring-health', label: 'Asset Health', icon: Activity, href: '/#monitoring/health' },
      { id: 'monitoring-maintenance', label: 'Maintenance', icon: Wrench, href: '/#monitoring/maintenance' },
    ],
  },
  {
    id: 'edge',
    label: 'Edge Connectors',
    icon: HardDrive,
    href: '/#edge',
  },
  {
    id: 'simulators',
    label: 'Simulators',
    icon: Cpu,
    href: '/#simulators',
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: Users,
    href: '/#admin',
    children: [
      { id: 'admin-users', label: 'Users', icon: User, href: '/#admin/users' },
      { id: 'admin-roles', label: 'Roles', icon: Users, href: '/#admin/roles' },
      { id: 'admin-audit', label: 'Audit Logs', icon: ClipboardList, href: '/#admin/audit' },
      { id: 'admin-integrations', label: 'Integrations', icon: Settings, href: '/#admin/integrations' },
    ],
  },
];

interface SidebarContentProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

function SidebarContent({ collapsed = false, onNavigate }: SidebarContentProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>(['scada', 'mes']);
  const { currentModule, setCurrentModule } = useNavigationStore();
  const { user, logout } = useAuthStore();

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleNavClick = (item: NavItem, e: React.MouseEvent) => {
    if (item.children) {
      e.preventDefault();
      toggleExpanded(item.id);
    } else {
      setCurrentModule(item.id);
      onNavigate?.();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between h-14 md:h-16 px-3 md:px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Factory className="size-6 md:size-8 text-sidebar-primary" />
            <span className="font-bold text-base md:text-lg text-balance">UNS Platform</span>
          </div>
        )}
        {collapsed && (
          <Factory className="size-6 text-sidebar-primary mx-auto" />
        )}
      </div>

      {/* Mode Indicator */}
      <div className="px-3 md:px-4 py-2 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-sidebar-primary/20 text-sidebar-primary border-sidebar-primary/30 text-xs">
            {collapsed ? 'Demo' : 'Demo Mode'}
          </Badge>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0 py-2 md:py-4 bg-sidebar">
        <nav className="px-2 space-y-1">
          {navigation.map((item) => (
            <div key={item.id}>
              <a
                href={item.href}
                onClick={(e) => handleNavClick(item, e)}
                className={cn(
                  'flex items-center gap-3 px-2 md:px-3 py-2 rounded-lg transition-colors cursor-pointer',
                  currentModule.startsWith(item.id)
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground'
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-sm md:text-base">{item.label}</span>
                    {item.children && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-4 h-4"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleExpanded(item.id);
                        }}
                      >
                        {expandedItems.includes(item.id) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </>
                )}
              </a>

              {/* Children */}
              {!collapsed && item.children && expandedItems.includes(item.id) && (
                <div className="ml-3 md:ml-4 mt-1 space-y-1">
                  {item.children.map((child) => (
                    <a
                      key={child.id}
                      href={child.href}
                      onClick={() => {
                        setCurrentModule(child.id);
                        onNavigate?.();
                      }}
                      className={cn(
                        'flex items-center gap-2 md:gap-3 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm transition-colors cursor-pointer',
                        currentModule === child.id
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground'
                      )}
                    >
                      <child.icon className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
                      <span>{child.label}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      {!collapsed && (
        <div className="p-3 md:p-4 border-t border-sidebar-border bg-sidebar shrink-0">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="size-7 md:size-8 rounded-full bg-sidebar-accent flex items-center justify-center">
              <User className="size-3.5 md:size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm font-medium truncate text-pretty">{user?.name ?? 'User'}</p>
              <p className="text-[10px] md:text-xs text-sidebar-foreground/70 truncate">{user?.email ?? ''}</p>
            </div>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground/80 size-7 md:size-8" onClick={() => logout()} aria-label="Sign out">
              <LogOut className="size-3.5 md:size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <>
      {/* Desktop Sidebar - fixed so it never scrolls and always shows dark background */}
      <div
        className={cn(
          'hidden md:flex flex-col fixed inset-y-0 left-0 z-30 h-dvh shrink-0 bg-sidebar text-sidebar-foreground transition-[width] duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="absolute top-4 right-0 translate-x-1/2 z-10 bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80 rounded-full size-6"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
        <SidebarContent collapsed={collapsed} />
      </div>

      {/* Spacer so main content does not sit under fixed sidebar */}
      <div className={cn('hidden md:block shrink-0 transition-[width] duration-300', collapsed ? 'w-16' : 'w-64')} />

      {/* Mobile Header Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar text-sidebar-foreground flex items-center justify-between px-4 z-40 border-b border-sidebar-border">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[280px] bg-sidebar border-sidebar-border">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <SheetDescription className="sr-only">Main navigation menu for the UNS Platform</SheetDescription>
            <SidebarContent onNavigate={() => {
              // Close the sheet by clicking outside or programmatically
              const event = new KeyboardEvent('keydown', { key: 'Escape' });
              document.dispatchEvent(event);
            }} />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <Factory className="size-5 text-sidebar-primary" />
          <span className="font-bold text-balance">UNS Platform</span>
        </div>
        <Badge variant="outline" className="bg-sidebar-primary/20 text-sidebar-primary border-sidebar-primary/30 text-[10px]">
          Demo
        </Badge>
      </div>
    </>
  );
}
