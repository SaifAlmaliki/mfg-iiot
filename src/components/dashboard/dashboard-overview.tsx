'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle,
  Clock,
  Factory,
  Gauge,
  GitBranch,
  Layers,
  Package,
  RefreshCw,
  Users,
  Wrench,
  ArrowUpRight,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigationStore } from '@/lib/store';
import { cn } from '@/lib/utils';

// Types
interface Enterprise {
  id: string;
  name: string;
  code: string;
  isSetup: boolean;
  _count?: { sites: number };
}

interface SiteStats {
  total: number;
  active: number;
}

interface OrderStats {
  total: number;
  inProgress: number;
  completed: number;
  created: number;
}

interface RecipeStats {
  total: number;
  active: number;
  draft: number;
}

interface EquipmentStats {
  total: number;
  normal: number;
  warning: number;
  critical: number;
}

interface UserStats {
  total: number;
  active: number;
}

interface DashboardData {
  enterprise: Enterprise | null;
  sites: SiteStats;
  orders: OrderStats;
  recipes: RecipeStats;
  equipment: EquipmentStats;
  users: UserStats;
  lastUpdated: Date | null;
}

interface ClickableCardProps {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}

function ClickableCard({ children, onClick, className }: ClickableCardProps) {
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-lg active:scale-[0.98] md:hover:scale-[1.02] hover:border-emerald-500/50 group relative",
        className
      )}
      onClick={onClick}
    >
      {children}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ExternalLink className="w-4 h-4 text-muted-foreground" />
      </div>
    </Card>
  );
}

export function DashboardOverview() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const setCurrentModule = useNavigationStore((state) => state.setCurrentModule);

  const navigateTo = (module: string) => {
    setCurrentModule(module);
    window.location.href = `/#${module}`;
  };

  const fetchDashboardData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    
    try {
      // Fetch all data in parallel
      const [enterpriseRes, sitesRes, ordersRes, recipesRes, equipmentRes, usersRes] = await Promise.all([
        fetch('/api/enterprise'),
        fetch('/api/sites'),
        fetch('/api/orders'),
        fetch('/api/recipes'),
        fetch('/api/equipment'),
        fetch('/api/users'),
      ]);

      const enterprise = enterpriseRes.ok ? await enterpriseRes.json() : null;
      const sites = sitesRes.ok ? await sitesRes.json() : [];
      const orders = ordersRes.ok ? await ordersRes.json() : [];
      const recipes = recipesRes.ok ? await recipesRes.json() : [];
      const equipment = equipmentRes.ok ? await equipmentRes.json() : [];
      const users = usersRes.ok ? await usersRes.json() : [];

      setData({
        enterprise,
        sites: {
          total: sites.length,
          active: sites.filter((s: any) => s.isActive).length,
        },
        orders: {
          total: orders.length,
          inProgress: orders.filter((o: any) => o.status === 'IN_PROGRESS').length,
          completed: orders.filter((o: any) => o.status === 'COMPLETED').length,
          created: orders.filter((o: any) => o.status === 'CREATED').length,
        },
        recipes: {
          total: recipes.length,
          active: recipes.filter((r: any) => r.status === 'ACTIVE').length,
          draft: recipes.filter((r: any) => r.status === 'DRAFT').length,
        },
        equipment: {
          total: equipment.length,
          normal: equipment.filter((e: any) => e.latestHealth?.status === 'NORMAL').length,
          warning: equipment.filter((e: any) => e.latestHealth?.status === 'WARNING').length,
          critical: equipment.filter((e: any) => e.latestHealth?.status === 'CRITICAL').length,
        },
        users: {
          total: users.length,
          active: users.filter((u: any) => u.isActive).length,
        },
        lastUpdated: new Date(),
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  if (loading) {
    return (
      <div className="p-3 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-7 md:h-9 w-48 md:w-64" />
            <Skeleton className="h-4 md:h-5 w-36 md:w-48 mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
                <Skeleton className="h-3 md:h-4 w-16 md:w-24" />
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0">
                <Skeleton className="h-6 md:h-8 w-14 md:w-20" />
                <Skeleton className="h-2 md:h-3 w-24 md:w-32 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const oeeValue = 78.5; // This would come from actual OEE calculations
  const productionToday = data?.orders.completed || 0;

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Factory className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-emerald-500" />
            <span className="truncate">{data?.enterprise?.name || 'UNS Platform'} Dashboard</span>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
            Real-time overview of manufacturing operations. Click cards to navigate to details.
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          {data?.lastUpdated && (
            <Badge variant="outline" className="gap-1 text-[10px] md:text-xs">
              <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" />
              <span className="hidden sm:inline">Updated: </span>
              {data.lastUpdated.toLocaleTimeString()}
            </Badge>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-8 md:h-9"
          >
            {refreshing ? (
              <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-2" />
            )}
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Setup Warning */}
      {data?.enterprise && !data.enterprise.isSetup && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="py-3 md:py-4 px-3 md:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-yellow-600 shrink-0" />
                <div>
                  <p className="font-medium text-sm md:text-base">Setup Incomplete</p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Complete the hierarchy setup to enable full functionality.
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={() => navigateTo('hierarchy')} className="sm:ml-auto w-full sm:w-auto">
                Go to Setup
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        {/* OEE */}
        <ClickableCard onClick={() => navigateTo('monitoring/health')}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">OEE</CardTitle>
            <Gauge className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="text-lg md:text-2xl font-bold">{oeeValue}%</div>
              <Badge variant="default" className="bg-green-500/10 text-green-600 gap-0.5 md:gap-1 text-[10px] md:text-xs px-1.5 md:px-2">
                <ArrowUpRight className="w-2.5 h-2.5 md:w-3 md:h-3" />
                +2.3%
              </Badge>
            </div>
            <Progress value={oeeValue} className="mt-1.5 md:mt-2 h-1.5 md:h-2" />
            <div className="flex items-center justify-between mt-1.5 md:mt-2">
              <p className="text-[10px] md:text-xs text-muted-foreground">Target: 85%</p>
              <Badge variant="outline" className="text-[10px] md:text-xs gap-0.5 md:gap-1 text-muted-foreground px-1.5 md:px-2">
                <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" />
                {data?.lastUpdated?.toLocaleTimeString() || '--:--'}
              </Badge>
            </div>
          </CardContent>
        </ClickableCard>

        {/* Production */}
        <ClickableCard onClick={() => navigateTo('mes/orders')}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Production Today</CardTitle>
            <Package className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="text-lg md:text-2xl font-bold">{productionToday}</div>
              <Badge variant="default" className="bg-green-500/10 text-green-600 gap-0.5 md:gap-1 text-[10px] md:text-xs px-1.5 md:px-2">
                <ArrowUpRight className="w-2.5 h-2.5 md:w-3 md:h-3" />
                +5.2%
              </Badge>
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">Units completed</p>
            <div className="flex items-center justify-end mt-0.5 md:mt-1">
              <Badge variant="outline" className="text-[10px] md:text-xs gap-0.5 md:gap-1 text-muted-foreground px-1.5 md:px-2">
                <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" />
                {data?.lastUpdated?.toLocaleTimeString() || '--:--'}
              </Badge>
            </div>
          </CardContent>
        </ClickableCard>

        {/* Active Orders */}
        <ClickableCard onClick={() => navigateTo('mes/orders')}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Active Orders</CardTitle>
            <Activity className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="text-lg md:text-2xl font-bold">{data?.orders.inProgress || 0}</div>
              {data?.orders.created ? (
                <Badge variant="default" className="bg-blue-500/10 text-blue-600 gap-0.5 md:gap-1 text-[10px] md:text-xs px-1.5 md:px-2">
                  {data.orders.created} pending
                </Badge>
              ) : null}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">
              {data?.orders.total || 0} total orders
            </p>
            <div className="flex items-center justify-end mt-0.5 md:mt-1">
              <Badge variant="outline" className="text-[10px] md:text-xs gap-0.5 md:gap-1 text-muted-foreground px-1.5 md:px-2">
                <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" />
                {data?.lastUpdated?.toLocaleTimeString() || '--:--'}
              </Badge>
            </div>
          </CardContent>
        </ClickableCard>

        {/* Equipment Health */}
        <ClickableCard onClick={() => navigateTo('monitoring/health')}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Equipment Health</CardTitle>
            <Wrench className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="text-lg md:text-2xl font-bold">
                {data?.equipment.total ? 
                  Math.round((data.equipment.normal / data.equipment.total) * 100) : 0}%
              </div>
              {(data?.equipment.warning || data?.equipment.critical) ? (
                <Badge variant="destructive" className="gap-0.5 md:gap-1 text-[10px] md:text-xs px-1.5 md:px-2">
                  <AlertTriangle className="w-2.5 h-2.5 md:w-3 md:h-3" />
                  {(data?.equipment.warning || 0) + (data?.equipment.critical || 0)}
                </Badge>
              ) : null}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">
              {data?.equipment.normal || 0} of {data?.equipment.total || 0} normal
            </p>
            <div className="flex items-center justify-end mt-0.5 md:mt-1">
              <Badge variant="outline" className="text-[10px] md:text-xs gap-0.5 md:gap-1 text-muted-foreground px-1.5 md:px-2">
                <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" />
                {data?.lastUpdated?.toLocaleTimeString() || '--:--'}
              </Badge>
            </div>
          </CardContent>
        </ClickableCard>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        {/* Sites */}
        <ClickableCard onClick={() => navigateTo('hierarchy')}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Sites</CardTitle>
            <Building2 className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="text-lg md:text-2xl font-bold">{data?.sites.total || 0}</div>
              <Badge variant={data?.sites.active ? 'default' : 'secondary'} className="gap-0.5 md:gap-1 text-[10px] md:text-xs px-1.5 md:px-2">
                <CheckCircle className="w-2.5 h-2.5 md:w-3 md:h-3" />
                {data?.sites.active || 0}
              </Badge>
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">Manufacturing sites</p>
            <div className="flex items-center justify-end mt-0.5 md:mt-1">
              <Badge variant="outline" className="text-[10px] md:text-xs gap-0.5 md:gap-1 text-muted-foreground px-1.5 md:px-2">
                <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" />
                {data?.lastUpdated?.toLocaleTimeString() || '--:--'}
              </Badge>
            </div>
          </CardContent>
        </ClickableCard>

        {/* Recipes */}
        <ClickableCard onClick={() => navigateTo('mes/recipes')}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Recipes</CardTitle>
            <GitBranch className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="text-lg md:text-2xl font-bold">{data?.recipes.total || 0}</div>
              {data?.recipes.draft ? (
                <Badge variant="outline" className="gap-0.5 md:gap-1 text-[10px] md:text-xs px-1.5 md:px-2">
                  {data.recipes.draft} drafts
                </Badge>
              ) : null}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">
              {data?.recipes.active || 0} active recipes
            </p>
            <div className="flex items-center justify-end mt-0.5 md:mt-1">
              <Badge variant="outline" className="text-[10px] md:text-xs gap-0.5 md:gap-1 text-muted-foreground px-1.5 md:px-2">
                <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" />
                {data?.lastUpdated?.toLocaleTimeString() || '--:--'}
              </Badge>
            </div>
          </CardContent>
        </ClickableCard>

        {/* Users */}
        <ClickableCard onClick={() => navigateTo('admin/users')}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Users</CardTitle>
            <Users className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="text-lg md:text-2xl font-bold">{data?.users.total || 0}</div>
              <Badge variant="default" className="bg-green-500/10 text-green-600 gap-0.5 md:gap-1 text-[10px] md:text-xs px-1.5 md:px-2">
                <CheckCircle className="w-2.5 h-2.5 md:w-3 md:h-3" />
                {data?.users.active || 0}
              </Badge>
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">Platform users</p>
            <div className="flex items-center justify-end mt-0.5 md:mt-1">
              <Badge variant="outline" className="text-[10px] md:text-xs gap-0.5 md:gap-1 text-muted-foreground px-1.5 md:px-2">
                <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" />
                {data?.lastUpdated?.toLocaleTimeString() || '--:--'}
              </Badge>
            </div>
          </CardContent>
        </ClickableCard>

        {/* Hierarchy Status */}
        <ClickableCard onClick={() => navigateTo('hierarchy')}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Hierarchy</CardTitle>
            <Layers className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="text-base md:text-2xl font-bold">
                {data?.enterprise?.isSetup ? 'Ready' : 'Pending'}
              </div>
              {data?.enterprise?.isSetup ? (
                <Badge variant="default" className="bg-green-500 text-[10px] md:text-xs px-1.5 md:px-2">
                  Complete
                </Badge>
              ) : (
                <Badge variant="outline" className="text-yellow-600 border-yellow-600 text-[10px] md:text-xs px-1.5 md:px-2">
                  Incomplete
                </Badge>
              )}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">ISA-95 setup status</p>
            <div className="flex items-center justify-end mt-0.5 md:mt-1">
              <Badge variant="outline" className="text-[10px] md:text-xs gap-0.5 md:gap-1 text-muted-foreground px-1.5 md:px-2">
                <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" />
                {data?.lastUpdated?.toLocaleTimeString() || '--:--'}
              </Badge>
            </div>
          </CardContent>
        </ClickableCard>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="text-base md:text-lg">Quick Actions</CardTitle>
          <CardDescription className="text-xs md:text-sm">Common operations and navigation</CardDescription>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            <Button variant="outline" className="h-auto py-3 md:py-4 flex-col gap-1 md:gap-2 text-xs md:text-sm" onClick={() => navigateTo('hierarchy')}>
              <Layers className="w-4 h-4 md:w-5 md:h-5" />
              <span>Setup Hierarchy</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 md:py-4 flex-col gap-1 md:gap-2 text-xs md:text-sm" onClick={() => navigateTo('mes/orders')}>
              <Package className="w-4 h-4 md:w-5 md:h-5" />
              <span>Orders</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 md:py-4 flex-col gap-1 md:gap-2 text-xs md:text-sm" onClick={() => navigateTo('monitoring')}>
              <Wrench className="w-4 h-4 md:w-5 md:h-5" />
              <span>Monitoring</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 md:py-4 flex-col gap-1 md:gap-2 text-xs md:text-sm" onClick={() => navigateTo('admin')}>
              <Users className="w-4 h-4 md:w-5 md:h-5" />
              <span>Admin</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Footer with last updated */}
      <div className="text-center text-[10px] md:text-xs text-muted-foreground pb-4 md:pb-0">
        Dashboard last updated: {data?.lastUpdated?.toLocaleString() || 'Never'}
      </div>
    </div>
  );
}
