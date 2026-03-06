'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Building2,
  Factory,
  MapPin,
  Settings,
  ChevronRight,
  ChevronDown,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Download,
  Upload,
  RefreshCw,
  Building,
  Warehouse,
  Layers,
  Activity,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SetupWizard } from './setup-wizard';

// Types
interface HierarchyNode {
  id: string;
  name: string;
  code: string;
  type?: string;
  status?: string;
  isActive?: boolean;
  children?: HierarchyNode[];
  _count?: Record<string, number>;
}

interface Enterprise {
  id: string;
  name: string;
  code: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  industry?: string;
  isActive: boolean;
  isSetup: boolean;
  sites?: Site[];
  _count?: { sites: number };
}

interface Site {
  id: string;
  name: string;
  code: string;
  description?: string;
  siteType: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  siteManager?: string;
  timezone: string;
  isActive: boolean;
  areas?: Area[];
  _count?: { areas: number; users: number };
}

interface Area {
  id: string;
  name: string;
  code: string;
  description?: string;
  areaType: string;
  building?: string;
  floor?: string;
  zone?: string;
  supervisor?: string;
  isActive: boolean;
  workCenters?: WorkCenter[];
  _count?: { workCenters: number };
  site?: { id: string; name: string };
}

interface WorkCenter {
  id: string;
  name: string;
  code: string;
  description?: string;
  type: string;
  status: string;
  capacity?: number;
  capacityUnit?: string;
  isActive: boolean;
  workUnits?: WorkUnit[];
  _count?: { workUnits: number; equipment: number };
  area?: { id: string; name: string };
}

interface WorkUnit {
  id: string;
  name: string;
  code: string;
  description?: string;
  type: string;
  status: string;
  sequenceNumber?: number;
  isActive: boolean;
  workCenter?: { id: string; name: string };
}

export function HierarchyPanel() {
  // State
  const [enterprise, setEnterprise] = useState<Enterprise | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);
  
  // Expanded nodes
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editLevel, setEditLevel] = useState<'enterprise' | 'site' | 'area' | 'workcenter' | 'workunit'>('enterprise');
  const [editItem, setEditItem] = useState<any>(null);
  const [editParentId, setEditParentId] = useState<string>('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [deleteLevel, setDeleteLevel] = useState<string>('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Form state
  const [form, setForm] = useState<any>({});
  
  // Fetch hierarchy
  const fetchHierarchy = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/hierarchy');
      if (!response.ok) throw new Error('Failed to fetch hierarchy');
      const data = await response.json();
      setEnterprise(data);
      
      // Auto-expand first level if setup is complete
      if (data && data.sites && data.sites.length > 0) {
        setExpandedNodes(new Set([data.id, data.sites[0].id]));
      }
    } catch (error) {
      console.error('Error fetching hierarchy:', error);
      toast.error('Failed to load hierarchy');
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchHierarchy();
  }, [fetchHierarchy]);
  
  // Toggle node expansion
  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };
  
  // Open create dialog
  const openCreateDialog = (level: string, parentId?: string) => {
    setEditLevel(level as any);
    setEditItem(null);
    setEditParentId(parentId || '');
    setForm(getInitialForm(level));
    setFormErrors({});
    setEditDialogOpen(true);
  };
  
  // Open edit dialog
  const openEditDialog = (level: string, item: any) => {
    setEditLevel(level as any);
    setEditItem(item);
    setForm(item);
    setFormErrors({});
    setEditDialogOpen(true);
  };
  
  // Get initial form for create
  const getInitialForm = (level: string) => {
    switch (level) {
      case 'site':
        return { siteType: 'MANUFACTURING', timezone: 'UTC', isActive: true };
      case 'area':
        return { areaType: 'PRODUCTION', isActive: true };
      case 'workcenter':
        return { type: 'PRODUCTION_LINE', status: 'ACTIVE', isActive: true };
      case 'workunit':
        return { type: 'OTHER', status: 'ACTIVE', isActive: true };
      default:
        return { isActive: true };
    }
  };
  
  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.name?.trim()) {
      errors.name = 'Name is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Handle submit
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setEditSubmitting(true);
    try {
      const isCreate = !editItem;
      let url = '';
      let method = '';
      
      switch (editLevel) {
        case 'enterprise':
          url = '/api/enterprise';
          method = isCreate ? 'POST' : 'PUT';
          break;
        case 'site':
          url = isCreate ? '/api/sites' : '/api/sites';
          method = isCreate ? 'POST' : 'PUT';
          if (!isCreate) form.id = editItem.id;
          break;
        case 'area':
          url = '/api/areas';
          method = isCreate ? 'POST' : 'PUT';
          if (isCreate) form.siteId = editParentId;
          if (!isCreate) form.id = editItem.id;
          break;
        case 'workcenter':
          url = '/api/workcenters';
          method = isCreate ? 'POST' : 'PUT';
          if (isCreate) form.areaId = editParentId;
          if (!isCreate) form.id = editItem.id;
          break;
        case 'workunit':
          url = '/api/workunits';
          method = isCreate ? 'POST' : 'PUT';
          if (isCreate) form.workCenterId = editParentId;
          if (!isCreate) form.id = editItem.id;
          break;
      }
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save');
      }
      
      toast.success(isCreate ? `${editLevel} created successfully` : `${editLevel} updated successfully`);
      setEditDialogOpen(false);
      fetchHierarchy();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save');
    } finally {
      setEditSubmitting(false);
    }
  };
  
  // Handle delete
  const handleDelete = async () => {
    if (!deleteItem) return;
    
    setDeleteLoading(true);
    try {
      let url = '';
      switch (deleteLevel) {
        case 'site':
          url = `/api/sites?id=${deleteItem.id}`;
          break;
        case 'area':
          url = `/api/areas?id=${deleteItem.id}`;
          break;
        case 'workcenter':
          url = `/api/workcenters?id=${deleteItem.id}`;
          break;
        case 'workunit':
          url = `/api/workunits?id=${deleteItem.id}`;
          break;
      }
      
      const response = await fetch(url, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete');
      }
      
      toast.success(`${deleteLevel} deleted successfully`);
      setDeleteDialogOpen(false);
      fetchHierarchy();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    } finally {
      setDeleteLoading(false);
    }
  };
  
  // Export hierarchy
  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const response = await fetch(`/api/hierarchy/export?format=${format}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hierarchy_export.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Hierarchy exported successfully');
    } catch (error) {
      toast.error('Failed to export hierarchy');
    }
  };
  
  // Render tree node
  const renderTreeNode = (
    node: any,
    level: string,
    icon: React.ReactNode,
    parentId?: string
  ) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    
    const getStatusColor = (status?: string) => {
      if (!status) return '';
      switch (status.toUpperCase()) {
        case 'ACTIVE': return 'bg-green-500';
        case 'PLANNED': return 'bg-blue-500';
        case 'UNDER_MAINTENANCE': return 'bg-yellow-500';
        case 'INACTIVE': return 'bg-slate-500';
        default: return 'bg-slate-500';
      }
    };
    
    return (
      <div key={node.id} className="ml-1 md:ml-2">
        <Collapsible
          open={isExpanded}
          onOpenChange={() => toggleNode(node.id)}
        >
          {/* Main row - stack on mobile, row on desktop */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 py-2 px-2 hover:bg-muted rounded-lg group border-b sm:border-b-0 border-border/50">
            {/* First row on mobile: expand button, icon, name */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
              {hasChildren ? (
                <CollapsibleTrigger asChild>
                  <button className="p-1 hover:bg-muted-foreground/10 rounded flex-shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                </CollapsibleTrigger>
              ) : (
                <span className="w-5 flex-shrink-0" />
              )}
              
              <span className="flex-shrink-0">{icon}</span>
              
              <span className="font-medium flex-1 truncate text-sm md:text-base">{node.name}</span>
            </div>
            
            {/* Second row on mobile: badges and actions */}
            <div className="flex items-center gap-1 flex-wrap pl-6 sm:pl-0">
              <Badge variant="outline" className="text-[10px] md:text-xs font-mono">
                {node.code}
              </Badge>
              {node.type && (
                <Badge variant="secondary" className="text-[10px] md:text-xs hidden sm:flex">
                  {node.type.replace(/_/g, ' ')}
                </Badge>
              )}
              {node.status && (
                <Badge className={`text-[10px] md:text-xs ${getStatusColor(node.status)}`}>
                  {node.status}
                </Badge>
              )}
              {node.isActive === false && (
                <Badge variant="outline" className="text-[10px] md:text-xs text-muted-foreground">
                  Inactive
                </Badge>
              )}
              
              {/* Action buttons - always visible on mobile */}
              <div className="flex gap-0.5 sm:gap-1 ml-auto sm:ml-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                {level !== 'workunit' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 sm:h-6 sm:w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      const nextLevel = {
                        enterprise: 'site',
                        site: 'area',
                        area: 'workcenter',
                        workcenter: 'workunit',
                      }[level];
                      if (nextLevel) openCreateDialog(nextLevel, node.id);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 sm:h-6 sm:w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditDialog(level, node);
                  }}
                >
                  <Edit className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                </Button>
                {level !== 'enterprise' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 sm:h-6 sm:w-6 p-0 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteItem(node);
                      setDeleteLevel(level);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          
          {hasChildren && (
            <CollapsibleContent className="ml-2 sm:ml-4 border-l pl-1 sm:pl-2">
              {node.children.map((child: any) => {
                const nextIcon = {
                  site: <Factory className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-500" />,
                  area: <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-500" />,
                  workcenter: <Settings className="w-3.5 h-3.5 md:w-4 md:h-4 text-purple-500" />,
                  workunit: <Activity className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-500" />,
                }[child.level || ''];
                
                return renderTreeNode(
                  child,
                  child.level || level,
                  nextIcon || icon,
                  node.id
                );
              })}
            </CollapsibleContent>
          )}
        </Collapsible>
      </div>
    );
  };
  
  // Transform enterprise to tree structure
  const getTreeData = (): any => {
    if (!enterprise) return null;
    
    const transformSite = (site: Site) => ({
      ...site,
      level: 'site',
      children: (site.areas || []).map(transformArea),
    });
    
    const transformArea = (area: Area) => ({
      ...area,
      level: 'area',
      children: (area.workCenters || []).map(transformWorkCenter),
    });
    
    const transformWorkCenter = (wc: WorkCenter) => ({
      ...wc,
      level: 'workcenter',
      children: (wc.workUnits || []).map(transformWorkUnit),
    });
    
    const transformWorkUnit = (wu: WorkUnit) => ({
      ...wu,
      level: 'workunit',
      children: [],
    });
    
    return {
      ...enterprise,
      level: 'enterprise',
      children: (enterprise.sites || []).map(transformSite),
    };
  };
  
  const treeData = getTreeData();
  
  // Render form fields based on level
  const renderFormFields = () => {
    switch (editLevel) {
      case 'enterprise':
        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={form.name || ''}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={formErrors.name ? 'border-destructive' : ''}
                />
                {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={form.code || ''}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>Industry</Label>
                <Select
                  value={form.industry || ''}
                  onValueChange={(v) => setForm({ ...form, industry: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Chemical">Chemical</SelectItem>
                    <SelectItem value="Pharmaceutical">Pharmaceutical</SelectItem>
                    <SelectItem value="Food & Beverage">Food & Beverage</SelectItem>
                    <SelectItem value="Automotive">Automotive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  value={form.website || ''}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={form.address || ''}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={form.state || ''} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input value={form.country || ''} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </div>
            </div>
          </>
        );
        
      case 'site':
        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={form.name || ''}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={formErrors.name ? 'border-destructive' : ''}
                />
                {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={form.code || ''}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>Site Type</Label>
                <Select value={form.siteType || 'MANUFACTURING'} onValueChange={(v) => setForm({ ...form, siteType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANUFACTURING">Manufacturing</SelectItem>
                    <SelectItem value="DISTRIBUTION">Distribution</SelectItem>
                    <SelectItem value="R_D">R&D</SelectItem>
                    <SelectItem value="MIXED_USE">Mixed Use</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={form.timezone || 'UTC'} onValueChange={(v) => setForm({ ...form, timezone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    <SelectItem value="Europe/London">London</SelectItem>
                    <SelectItem value="Asia/Shanghai">Shanghai</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <div className="space-y-2"><Label>City</Label><Input value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div className="space-y-2"><Label>State</Label><Input value={form.state || ''} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
              <div className="space-y-2"><Label>Country</Label><Input value={form.country || ''} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2"><Label>Site Manager</Label><Input value={form.siteManager || ''} onChange={(e) => setForm({ ...form, siteManager: e.target.value })} /></div>
              <div className="space-y-2"><Label>Contact Email</Label><Input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
          </>
        );
        
      case 'area':
        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className={formErrors.name ? 'border-destructive' : ''} />
                {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>Area Type</Label>
                <Select value={form.areaType || 'PRODUCTION'} onValueChange={(v) => setForm({ ...form, areaType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRODUCTION">Production</SelectItem>
                    <SelectItem value="WAREHOUSE">Warehouse</SelectItem>
                    <SelectItem value="QUALITY_LAB">Quality Lab</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    <SelectItem value="SHIPPING">Shipping</SelectItem>
                    <SelectItem value="RECEIVING">Receiving</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Supervisor</Label>
                <Input value={form.supervisor || ''} onChange={(e) => setForm({ ...form, supervisor: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <div className="space-y-2"><Label>Building</Label><Input value={form.building || ''} onChange={(e) => setForm({ ...form, building: e.target.value })} /></div>
              <div className="space-y-2"><Label>Floor</Label><Input value={form.floor || ''} onChange={(e) => setForm({ ...form, floor: e.target.value })} /></div>
              <div className="space-y-2"><Label>Zone</Label><Input value={form.zone || ''} onChange={(e) => setForm({ ...form, zone: e.target.value })} /></div>
            </div>
          </>
        );
        
      case 'workcenter':
        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className={formErrors.name ? 'border-destructive' : ''} />
                {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type || 'PRODUCTION_LINE'} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRODUCTION_LINE">Production Line</SelectItem>
                    <SelectItem value="BATCH_PROCESS">Batch Process</SelectItem>
                    <SelectItem value="CONTINUOUS_PROCESS">Continuous Process</SelectItem>
                    <SelectItem value="ASSEMBLY_CELL">Assembly Cell</SelectItem>
                    <SelectItem value="PACKAGING_LINE">Packaging Line</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status || 'ACTIVE'} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="PLANNED">Planned</SelectItem>
                    <SelectItem value="UNDER_MAINTENANCE">Under Maintenance</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2"><Label>Capacity</Label><Input type="number" value={form.capacity || ''} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Capacity Unit</Label>
                <Select value={form.capacityUnit || 'units/h'} onValueChange={(v) => setForm({ ...form, capacityUnit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="units/h">units/hour</SelectItem>
                    <SelectItem value="kg/h">kg/hour</SelectItem>
                    <SelectItem value="L/h">L/hour</SelectItem>
                    <SelectItem value="batches/day">batches/day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        );
        
      case 'workunit':
        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className={formErrors.name ? 'border-destructive' : ''} />
                {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type || 'OTHER'} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REACTOR">Reactor</SelectItem>
                    <SelectItem value="MIXER">Mixer</SelectItem>
                    <SelectItem value="TANK">Tank</SelectItem>
                    <SelectItem value="PUMP">Pump</SelectItem>
                    <SelectItem value="HEAT_EXCHANGER">Heat Exchanger</SelectItem>
                    <SelectItem value="CONVEYOR">Conveyor</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status || 'ACTIVE'} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="UNDER_MAINTENANCE">Under Maintenance</SelectItem>
                    <SelectItem value="STANDBY">Standby</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2"><Label>Sequence Number</Label><Input type="number" value={form.sequenceNumber || ''} onChange={(e) => setForm({ ...form, sequenceNumber: e.target.value })} /></div>
            </div>
          </>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Layers className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-emerald-500" />
            <span className="hidden sm:inline">Hierarchy Management</span>
            <span className="sm:hidden">Hierarchy</span>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">ISA-95 enterprise hierarchy configuration</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 md:h-9" onClick={() => handleExport('json')}>
            <Download className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-1" />
            <span className="hidden md:inline">Export</span>
          </Button>
          <Button variant="outline" size="sm" className="h-8 md:h-9" onClick={fetchHierarchy}>
            <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-1" />
            <span className="hidden md:inline">Refresh</span>
          </Button>
        </div>
      </div>
      
      {/* ISA-95 Level Legend */}
      <Card>
        <CardContent className="py-3 md:py-4 px-3 md:px-6">
          <div className="flex flex-wrap gap-3 md:gap-6">
            <div className="flex items-center gap-1.5 md:gap-2">
              <Building2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
              <span className="text-[10px] md:text-sm">Enterprise</span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <Factory className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
              <span className="text-[10px] md:text-sm">Site</span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <MapPin className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
              <span className="text-[10px] md:text-sm">Area</span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <Settings className="w-4 h-4 md:w-5 md:h-5 text-purple-500" />
              <span className="text-[10px] md:text-sm">Work Center</span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <Activity className="w-4 h-4 md:w-5 md:h-5 text-orange-500" />
              <span className="text-[10px] md:text-sm">Work Unit</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Main Content */}
      <Card>
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="text-base md:text-lg">Organization Hierarchy</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Tap nodes to expand/collapse. Long press for options.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8 md:py-12">
              <Loader2 className="w-6 h-6 md:w-8 md:h-8 animate-spin" />
            </div>
          ) : !enterprise ? (
            <div className="text-center py-6 md:py-12 space-y-3 md:space-y-4">
              <Building2 className="w-12 h-12 md:w-16 md:h-16 mx-auto text-muted-foreground" />
              <h3 className="text-base md:text-lg font-semibold">No Enterprise Found</h3>
              <p className="text-xs md:text-sm text-muted-foreground">
                Get started by creating your enterprise hierarchy.
              </p>
              <Button onClick={() => setSetupWizardOpen(true)} size="sm">
                <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-2" />
                Start Setup
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[300px] md:h-[500px]">
              {treeData && renderTreeNode(
                treeData,
                'enterprise',
                <Building2 className="w-4 h-4 text-emerald-500" />
              )}
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      
      {/* Setup Wizard */}
      <SetupWizard
        open={setupWizardOpen}
        onOpenChange={setSetupWizardOpen}
        onComplete={fetchHierarchy}
      />
      
      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>
              {editItem ? `Edit ${editLevel}` : `Create ${editLevel}`}
            </DialogTitle>
            <DialogDescription>
              {editItem ? 'Update the details below' : 'Fill in the details to create a new item'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {renderFormFields()}
            
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive ?? true}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={editSubmitting}>
              {editSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editItem ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete ${deleteLevel}`}
        description={`Are you sure you want to delete "${deleteItem?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />
    </div>
  );
}
