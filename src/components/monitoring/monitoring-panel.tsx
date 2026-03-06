'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity,
  Wrench,
  AlertTriangle,
  CheckCircle,
  Clock,
  Gauge,
  Thermometer,
  TrendingUp,
  Zap,
  Plus,
  Settings,
  Trash2,
  Edit,
  Eye,
  Loader2,
  History,
  DollarSign,
  Users,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// Types
interface Equipment {
  id: string;
  name: string;
  code: string;
  type: string;
  manufacturer?: string | null;
  model?: string | null;
  latestHealth?: {
    id: string;
    healthScore: number;
    status: string;
    metrics: any;
    timestamp: string;
  } | null;
}

interface MonitoringRule {
  id: string;
  name: string;
  code: string;
  type: string;
  metric: string;
  condition: any;
  severity: string;
  isActive: boolean;
  equipmentId?: string | null;
  equipment?: Equipment | null;
  createdAt: string;
  updatedAt: string;
}

interface MaintenanceLog {
  id: string;
  type: string;
  workOrder?: string | null;
  description: string;
  performedBy?: string | null;
  performedAt: string;
  nextDueDate?: string | null;
  cost?: number | null;
  laborHours?: number | null;
  downtimeHours?: number | null;
  parts?: any;
  notes?: string | null;
  equipmentId: string;
  equipment?: Equipment;
}

interface HealthRecord {
  id: string;
  healthScore: number;
  status: string;
  metrics: any;
  anomalies?: any;
  predictions?: any;
  recommendations?: any;
  timestamp: string;
  equipmentId: string;
  equipment: Equipment;
}

// Rule form state
const initialRuleForm = {
  name: '',
  code: '',
  type: 'THRESHOLD',
  metric: '',
  conditionJson: '{"operator": ">", "value": 0}',
  severity: 'WARNING',
  equipmentId: '',
  isActive: true,
};

// Maintenance form state
const initialMaintenanceForm = {
  type: 'PREVENTIVE',
  workOrder: '',
  description: '',
  performedBy: '',
  performedAt: '',
  nextDueDate: '',
  cost: '',
  laborHours: '',
  downtimeHours: '',
  partsJson: '[]',
  notes: '',
  equipmentId: '',
};

export function MonitoringPanel() {
  // Tab state
  const [activeTab, setActiveTab] = useState('rules');

  // Equipment state
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentLoading, setEquipmentLoading] = useState(true);

  // Monitoring Rules state
  const [rules, setRules] = useState<MonitoringRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [ruleFormMode, setRuleFormMode] = useState<'create' | 'edit'>('create');
  const [selectedRule, setSelectedRule] = useState<MonitoringRule | null>(null);
  const [ruleForm, setRuleForm] = useState(initialRuleForm);
  const [ruleFormErrors, setRuleFormErrors] = useState<Record<string, string>>({});
  const [ruleSubmitting, setRuleSubmitting] = useState(false);
  const [deleteRuleDialog, setDeleteRuleDialog] = useState(false);

  // Asset Health state
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthDetailDialog, setHealthDetailDialog] = useState(false);
  const [selectedEquipmentHealth, setSelectedEquipmentHealth] = useState<Equipment | null>(null);

  // Maintenance Logs state
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [maintenanceFormMode, setMaintenanceFormMode] = useState<'create' | 'edit'>('create');
  const [selectedMaintenance, setSelectedMaintenance] = useState<MaintenanceLog | null>(null);
  const [maintenanceForm, setMaintenanceForm] = useState(initialMaintenanceForm);
  const [maintenanceFormErrors, setMaintenanceFormErrors] = useState<Record<string, string>>({});
  const [maintenanceSubmitting, setMaintenanceSubmitting] = useState(false);

  // Fetch equipment
  const fetchEquipment = useCallback(async () => {
    try {
      setEquipmentLoading(true);
      const response = await fetch('/api/equipment');
      if (!response.ok) throw new Error('Failed to fetch equipment');
      const data = await response.json();
      setEquipment(data);
    } catch (error) {
      console.error('Error fetching equipment:', error);
      toast.error('Failed to load equipment');
    } finally {
      setEquipmentLoading(false);
    }
  }, []);

  // Fetch monitoring rules
  const fetchRules = useCallback(async () => {
    try {
      setRulesLoading(true);
      const response = await fetch('/api/monitoring-rules');
      if (!response.ok) throw new Error('Failed to fetch monitoring rules');
      const data = await response.json();
      setRules(data);
    } catch (error) {
      console.error('Error fetching monitoring rules:', error);
      toast.error('Failed to load monitoring rules');
    } finally {
      setRulesLoading(false);
    }
  }, []);

  // Fetch health records
  const fetchHealth = useCallback(async () => {
    try {
      setHealthLoading(true);
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error('Failed to fetch health records');
      const data = await response.json();
      setHealthRecords(data);
    } catch (error) {
      console.error('Error fetching health records:', error);
      toast.error('Failed to load health records');
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // Fetch maintenance logs
  const fetchMaintenance = useCallback(async () => {
    try {
      setMaintenanceLoading(true);
      const response = await fetch('/api/maintenance');
      if (!response.ok) throw new Error('Failed to fetch maintenance logs');
      const data = await response.json();
      setMaintenanceLogs(data);
    } catch (error) {
      console.error('Error fetching maintenance logs:', error);
      toast.error('Failed to load maintenance logs');
    } finally {
      setMaintenanceLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchEquipment();
    fetchRules();
    fetchHealth();
    fetchMaintenance();
  }, [fetchEquipment, fetchRules, fetchHealth, fetchMaintenance]);

  // Helper functions
  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getHealthBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NORMAL':
        return 'bg-green-500';
      case 'WARNING':
        return 'bg-yellow-500';
      case 'CRITICAL':
        return 'bg-red-500';
      case 'UNKNOWN':
      case 'OFFLINE':
        return 'bg-slate-500';
      default:
        return 'bg-slate-500';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'destructive';
      case 'WARNING':
        return 'outline';
      case 'INFO':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PREVENTIVE':
        return 'bg-blue-500';
      case 'CORRECTIVE':
        return 'bg-orange-500';
      case 'PREDICTIVE':
        return 'bg-purple-500';
      case 'EMERGENCY':
        return 'bg-red-500';
      default:
        return 'bg-slate-500';
    }
  };

  // ============================================
  // Monitoring Rules CRUD Operations
  // ============================================

  const resetRuleForm = () => {
    setRuleForm({
      ...initialRuleForm,
      code: `RULE-${Date.now().toString(36).toUpperCase()}`,
    });
    setRuleFormErrors({});
  };

  const openCreateRuleDialog = () => {
    resetRuleForm();
    setRuleFormMode('create');
    setSelectedRule(null);
    setRuleDialogOpen(true);
  };

  const openEditRuleDialog = (rule: MonitoringRule) => {
    setRuleForm({
      name: rule.name,
      code: rule.code,
      type: rule.type,
      metric: rule.metric,
      conditionJson: JSON.stringify(rule.condition, null, 2),
      severity: rule.severity,
      equipmentId: rule.equipmentId || '',
      isActive: rule.isActive,
    });
    setRuleFormMode('edit');
    setSelectedRule(rule);
    setRuleFormErrors({});
    setRuleDialogOpen(true);
  };

  const validateRuleForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!ruleForm.name.trim()) {
      errors.name = 'Rule name is required';
    }
    if (!ruleForm.code.trim()) {
      errors.code = 'Rule code is required';
    }
    if (!ruleForm.metric.trim()) {
      errors.metric = 'Metric is required';
    }

    // Validate JSON condition
    try {
      JSON.parse(ruleForm.conditionJson);
    } catch {
      errors.conditionJson = 'Invalid JSON format for condition';
    }

    setRuleFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRuleSubmit = async () => {
    if (!validateRuleForm()) return;

    setRuleSubmitting(true);
    try {
      const url = ruleFormMode === 'create'
        ? '/api/monitoring-rules'
        : `/api/monitoring-rules/${selectedRule?.id}`;
      const method = ruleFormMode === 'create' ? 'POST' : 'PUT';

      const condition = JSON.parse(ruleForm.conditionJson);

      const body = {
        name: ruleForm.name,
        code: ruleForm.code,
        type: ruleForm.type,
        metric: ruleForm.metric,
        condition,
        severity: ruleForm.severity,
        equipmentId: ruleForm.equipmentId || null,
        isActive: ruleForm.isActive,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save rule');
      }

      toast.success(ruleFormMode === 'create' ? 'Rule created successfully' : 'Rule updated successfully');
      setRuleDialogOpen(false);
      fetchRules();
    } catch (error: any) {
      console.error('Error saving rule:', error);
      toast.error(error.message || 'Failed to save rule');
    } finally {
      setRuleSubmitting(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!selectedRule) return;

    try {
      const response = await fetch(`/api/monitoring-rules/${selectedRule.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete rule');

      toast.success('Rule deleted successfully');
      setDeleteRuleDialog(false);
      setSelectedRule(null);
      fetchRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Failed to delete rule');
    }
  };

  const handleToggleRuleActive = async (rule: MonitoringRule) => {
    try {
      const response = await fetch(`/api/monitoring-rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });

      if (!response.ok) throw new Error('Failed to update rule');

      toast.success(`Rule ${!rule.isActive ? 'activated' : 'deactivated'}`);
      fetchRules();
    } catch (error) {
      console.error('Error updating rule:', error);
      toast.error('Failed to update rule status');
    }
  };

  // ============================================
  // Maintenance Log CRUD Operations
  // ============================================

  const resetMaintenanceForm = () => {
    setMaintenanceForm({
      ...initialMaintenanceForm,
      performedAt: new Date().toISOString().slice(0, 16),
    });
    setMaintenanceFormErrors({});
  };

  const openCreateMaintenanceDialog = () => {
    resetMaintenanceForm();
    setMaintenanceFormMode('create');
    setSelectedMaintenance(null);
    setMaintenanceDialogOpen(true);
  };

  const openEditMaintenanceDialog = (log: MaintenanceLog) => {
    setMaintenanceForm({
      type: log.type,
      workOrder: log.workOrder || '',
      description: log.description,
      performedBy: log.performedBy || '',
      performedAt: new Date(log.performedAt).toISOString().slice(0, 16),
      nextDueDate: log.nextDueDate ? new Date(log.nextDueDate).toISOString().slice(0, 10) : '',
      cost: log.cost?.toString() || '',
      laborHours: log.laborHours?.toString() || '',
      downtimeHours: log.downtimeHours?.toString() || '',
      partsJson: log.parts ? JSON.stringify(log.parts, null, 2) : '[]',
      notes: log.notes || '',
      equipmentId: log.equipmentId,
    });
    setMaintenanceFormMode('edit');
    setSelectedMaintenance(log);
    setMaintenanceFormErrors({});
    setMaintenanceDialogOpen(true);
  };

  const validateMaintenanceForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!maintenanceForm.description.trim()) {
      errors.description = 'Description is required';
    }
    if (!maintenanceForm.equipmentId) {
      errors.equipmentId = 'Equipment is required';
    }

    // Validate JSON parts if provided
    if (maintenanceForm.partsJson.trim()) {
      try {
        JSON.parse(maintenanceForm.partsJson);
      } catch {
        errors.partsJson = 'Invalid JSON format for parts';
      }
    }

    setMaintenanceFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleMaintenanceSubmit = async () => {
    if (!validateMaintenanceForm()) return;

    setMaintenanceSubmitting(true);
    try {
      const parts = maintenanceForm.partsJson.trim()
        ? JSON.parse(maintenanceForm.partsJson)
        : null;

      const body = {
        type: maintenanceForm.type,
        workOrder: maintenanceForm.workOrder || null,
        description: maintenanceForm.description,
        performedBy: maintenanceForm.performedBy || null,
        performedAt: maintenanceForm.performedAt ? new Date(maintenanceForm.performedAt) : new Date(),
        nextDueDate: maintenanceForm.nextDueDate ? new Date(maintenanceForm.nextDueDate) : null,
        cost: maintenanceForm.cost ? parseFloat(maintenanceForm.cost) : null,
        laborHours: maintenanceForm.laborHours ? parseFloat(maintenanceForm.laborHours) : null,
        downtimeHours: maintenanceForm.downtimeHours ? parseFloat(maintenanceForm.downtimeHours) : null,
        parts,
        notes: maintenanceForm.notes || null,
        equipmentId: maintenanceForm.equipmentId,
      };

      const url = maintenanceFormMode === 'create'
        ? '/api/maintenance'
        : `/api/maintenance/${selectedMaintenance?.id}`;
      const method = maintenanceFormMode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save maintenance log');
      }

      toast.success(maintenanceFormMode === 'create' ? 'Maintenance log created successfully' : 'Maintenance log updated successfully');
      setMaintenanceDialogOpen(false);
      fetchMaintenance();
    } catch (error: any) {
      console.error('Error saving maintenance log:', error);
      toast.error(error.message || 'Failed to save maintenance log');
    } finally {
      setMaintenanceSubmitting(false);
    }
  };

  // ============================================
  // Asset Health Operations
  // ============================================

  const openHealthDetailDialog = (eq: Equipment) => {
    setSelectedEquipmentHealth(eq);
    setHealthDetailDialog(true);
  };

  // Calculate summary stats
  const stats = {
    totalAssets: equipment.length,
    normal: equipment.filter(e => e.latestHealth?.status === 'NORMAL').length,
    warning: equipment.filter(e => e.latestHealth?.status === 'WARNING').length,
    critical: equipment.filter(e => e.latestHealth?.status === 'CRITICAL').length,
    totalRules: rules.length,
    activeRules: rules.filter(r => r.isActive).length,
    totalMaintenance: maintenanceLogs.length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wrench className="w-8 h-8 text-emerald-500" />
            Condition Monitoring
          </h1>
          <p className="text-muted-foreground">Asset health and predictive maintenance</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Assets</p>
                <p className="text-2xl font-bold">{stats.totalAssets}</p>
              </div>
              <Gauge className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Normal</p>
                <p className="text-2xl font-bold text-green-500">{stats.normal}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Warning</p>
                <p className="text-2xl font-bold text-yellow-500">{stats.warning}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-red-500">{stats.critical}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">Monitoring Rules</TabsTrigger>
          <TabsTrigger value="health">Asset Health</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance Log</TabsTrigger>
        </TabsList>

        {/* Monitoring Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {stats.totalRules} rules • {stats.activeRules} active
            </div>
            <Button onClick={openCreateRuleDialog}>
              <Plus className="w-4 h-4 mr-2" />
              New Rule
            </Button>
          </div>

          <Card>
            <CardContent>
              {rulesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : rules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No monitoring rules found. Create your first rule to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Metric</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell className="font-mono text-xs">{rule.code}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{rule.type}</Badge>
                        </TableCell>
                        <TableCell>{rule.metric}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {typeof rule.condition === 'object'
                            ? JSON.stringify(rule.condition)
                            : String(rule.condition)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getSeverityColor(rule.severity) as any}>
                            {rule.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rule.equipment ? (
                            <span className="text-sm">{rule.equipment.name}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">All Equipment</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={rule.isActive}
                            onCheckedChange={() => handleToggleRuleActive(rule)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditRuleDialog(rule)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => {
                                setSelectedRule(rule);
                                setDeleteRuleDialog(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Asset Health Tab */}
        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Equipment Health Overview</CardTitle>
              <CardDescription>Real-time health scores and status for all assets</CardDescription>
            </CardHeader>
            <CardContent>
              {equipmentLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : equipment.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No equipment found.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Health Score</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Key Metrics</TableHead>
                      <TableHead>Last Update</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipment.map((eq) => (
                      <TableRow key={eq.id}>
                        <TableCell className="font-medium">{eq.name}</TableCell>
                        <TableCell className="font-mono text-xs">{eq.code}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{eq.type}</Badge>
                        </TableCell>
                        <TableCell>
                          {eq.latestHealth ? (
                            <div className="flex items-center gap-2">
                              <Progress
                                value={eq.latestHealth.healthScore}
                                className="w-16"
                              />
                              <span className={`font-bold ${getHealthColor(eq.latestHealth.healthScore)}`}>
                                {Math.round(eq.latestHealth.healthScore)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">No data</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {eq.latestHealth ? (
                            <Badge className={getStatusColor(eq.latestHealth.status)}>
                              {eq.latestHealth.status}
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-500">UNKNOWN</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {eq.latestHealth?.metrics ? (
                            <div className="flex gap-2 text-xs">
                              {Object.entries(eq.latestHealth.metrics).slice(0, 3).map(([key, value]) => (
                                <span key={key} className="flex items-center gap-1">
                                  <Activity className="w-3 h-3" />
                                  {key}: {String(value)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {eq.latestHealth ? (
                            <span className="text-xs text-muted-foreground">
                              {new Date(eq.latestHealth.timestamp).toLocaleString()}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openHealthDetailDialog(eq)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance Log Tab */}
        <TabsContent value="maintenance" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {maintenanceLogs.length} maintenance records
            </div>
            <Button onClick={openCreateMaintenanceDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Log Maintenance
            </Button>
          </div>

          <Card>
            <CardContent>
              {maintenanceLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : maintenanceLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No maintenance logs found. Log your first maintenance activity.
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Work Order</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Performed By</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Next Due</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {maintenanceLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">
                            {log.equipment?.name || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <Badge className={getTypeColor(log.type)}>{log.type}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.workOrder || '-'}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {log.description}
                          </TableCell>
                          <TableCell>{log.performedBy || '-'}</TableCell>
                          <TableCell>
                            {new Date(log.performedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {log.cost ? `$${log.cost.toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell>
                            {log.nextDueDate
                              ? new Date(log.nextDueDate).toLocaleDateString()
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditMaintenanceDialog(log)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rule Dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {ruleFormMode === 'create' ? 'Create Monitoring Rule' : 'Edit Monitoring Rule'}
            </DialogTitle>
            <DialogDescription>
              {ruleFormMode === 'create'
                ? 'Configure a new monitoring rule for asset health'
                : 'Update monitoring rule configuration'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ruleName">Rule Name *</Label>
                <Input
                  id="ruleName"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  className={ruleFormErrors.name ? 'border-destructive' : ''}
                  placeholder="e.g., High Vibration Alert"
                />
                {ruleFormErrors.name && (
                  <p className="text-sm text-destructive">{ruleFormErrors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ruleCode">Rule Code *</Label>
                <Input
                  id="ruleCode"
                  value={ruleForm.code}
                  onChange={(e) => setRuleForm({ ...ruleForm, code: e.target.value })}
                  className={ruleFormErrors.code ? 'border-destructive' : ''}
                  placeholder="e.g., RULE-001"
                />
                {ruleFormErrors.code && (
                  <p className="text-sm text-destructive">{ruleFormErrors.code}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ruleType">Rule Type</Label>
                <Select
                  value={ruleForm.type}
                  onValueChange={(value) => setRuleForm({ ...ruleForm, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="THRESHOLD">Threshold</SelectItem>
                    <SelectItem value="ANOMALY">Anomaly Detection</SelectItem>
                    <SelectItem value="TREND">Trend Analysis</SelectItem>
                    <SelectItem value="COMPOSITE">Composite Rule</SelectItem>
                    <SelectItem value="ML_BASED">ML-Based</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ruleSeverity">Severity</Label>
                <Select
                  value={ruleForm.severity}
                  onValueChange={(value) => setRuleForm({ ...ruleForm, severity: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INFO">Info</SelectItem>
                    <SelectItem value="WARNING">Warning</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ruleMetric">Metric *</Label>
                <Input
                  id="ruleMetric"
                  value={ruleForm.metric}
                  onChange={(e) => setRuleForm({ ...ruleForm, metric: e.target.value })}
                  className={ruleFormErrors.metric ? 'border-destructive' : ''}
                  placeholder="e.g., vibration, temperature, pressure"
                />
                {ruleFormErrors.metric && (
                  <p className="text-sm text-destructive">{ruleFormErrors.metric}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ruleEquipment">Equipment</Label>
                <Select
                  value={ruleForm.equipmentId}
                  onValueChange={(value) => setRuleForm({ ...ruleForm, equipmentId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipment.map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.name} ({eq.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ruleCondition">Condition (JSON) *</Label>
              <Textarea
                id="ruleCondition"
                value={ruleForm.conditionJson}
                onChange={(e) => setRuleForm({ ...ruleForm, conditionJson: e.target.value })}
                className={`font-mono text-xs min-h-[100px] ${ruleFormErrors.conditionJson ? 'border-destructive' : ''}`}
                placeholder='{"operator": ">", "value": 5.0}'
              />
              {ruleFormErrors.conditionJson && (
                <p className="text-sm text-destructive">{ruleFormErrors.conditionJson}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Example: {`{"operator": ">", "value": 5.0}`} or {`{"type": "range", "min": 0, "max": 100}`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="ruleActive"
                checked={ruleForm.isActive}
                onCheckedChange={(checked) => setRuleForm({ ...ruleForm, isActive: checked })}
              />
              <Label htmlFor="ruleActive">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRuleSubmit} disabled={ruleSubmitting}>
              {ruleSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {ruleFormMode === 'create' ? 'Create Rule' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance Dialog */}
      <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {maintenanceFormMode === 'create' ? 'Log Maintenance Activity' : 'Edit Maintenance Log'}
            </DialogTitle>
            <DialogDescription>
              Record maintenance performed on equipment
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maintenanceEquipment">Equipment *</Label>
                <Select
                  value={maintenanceForm.equipmentId}
                  onValueChange={(value) => setMaintenanceForm({ ...maintenanceForm, equipmentId: value })}
                >
                  <SelectTrigger className={maintenanceFormErrors.equipmentId ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipment.map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.name} ({eq.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {maintenanceFormErrors.equipmentId && (
                  <p className="text-sm text-destructive">{maintenanceFormErrors.equipmentId}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="maintenanceType">Maintenance Type</Label>
                <Select
                  value={maintenanceForm.type}
                  onValueChange={(value) => setMaintenanceForm({ ...maintenanceForm, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PREVENTIVE">Preventive</SelectItem>
                    <SelectItem value="CORRECTIVE">Corrective</SelectItem>
                    <SelectItem value="PREDICTIVE">Predictive</SelectItem>
                    <SelectItem value="EMERGENCY">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="workOrder">Work Order</Label>
                <Input
                  id="workOrder"
                  value={maintenanceForm.workOrder}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, workOrder: e.target.value })}
                  placeholder="e.g., WO-2024-001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="performedBy">Performed By</Label>
                <Input
                  id="performedBy"
                  value={maintenanceForm.performedBy}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, performedBy: e.target.value })}
                  placeholder="Technician name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={maintenanceForm.description}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                className={maintenanceFormErrors.description ? 'border-destructive' : ''}
                placeholder="Describe the maintenance performed"
              />
              {maintenanceFormErrors.description && (
                <p className="text-sm text-destructive">{maintenanceFormErrors.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="performedAt">Performed At</Label>
                <Input
                  id="performedAt"
                  type="datetime-local"
                  value={maintenanceForm.performedAt}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, performedAt: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nextDueDate">Next Due Date</Label>
                <Input
                  id="nextDueDate"
                  type="date"
                  value={maintenanceForm.nextDueDate}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, nextDueDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost">Cost ($)</Label>
                <Input
                  id="cost"
                  type="number"
                  value={maintenanceForm.cost}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="laborHours">Labor Hours</Label>
                <Input
                  id="laborHours"
                  type="number"
                  step="0.5"
                  value={maintenanceForm.laborHours}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, laborHours: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="downtimeHours">Downtime Hours</Label>
                <Input
                  id="downtimeHours"
                  type="number"
                  step="0.5"
                  value={maintenanceForm.downtimeHours}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, downtimeHours: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parts">Parts Used (JSON)</Label>
              <Textarea
                id="parts"
                value={maintenanceForm.partsJson}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, partsJson: e.target.value })}
                className={`font-mono text-xs min-h-[80px] ${maintenanceFormErrors.partsJson ? 'border-destructive' : ''}`}
                placeholder='[{"name": "Bearing", "partNumber": "SKF-6205", "quantity": 2}]'
              />
              {maintenanceFormErrors.partsJson && (
                <p className="text-sm text-destructive">{maintenanceFormErrors.partsJson}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={maintenanceForm.notes}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintenanceDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMaintenanceSubmit} disabled={maintenanceSubmitting}>
              {maintenanceSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {maintenanceFormMode === 'create' ? 'Log Maintenance' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Health Detail Dialog */}
      <Dialog open={healthDetailDialog} onOpenChange={setHealthDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Equipment Health Details</DialogTitle>
            <DialogDescription>
              {selectedEquipmentHealth?.name} - {selectedEquipmentHealth?.code}
            </DialogDescription>
          </DialogHeader>

          {selectedEquipmentHealth && (
            <div className="space-y-4">
              {/* Health Score */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-sm text-muted-foreground">Health Score</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress
                      value={selectedEquipmentHealth.latestHealth?.healthScore || 0}
                      className="flex-1"
                    />
                    <span className={`text-2xl font-bold ${getHealthColor(selectedEquipmentHealth.latestHealth?.healthScore || 0)}`}>
                      {Math.round(selectedEquipmentHealth.latestHealth?.healthScore || 0)}%
                    </span>
                  </div>
                </div>
                <Badge className={`${getStatusColor(selectedEquipmentHealth.latestHealth?.status || 'UNKNOWN')} text-lg px-4 py-2`}>
                  {selectedEquipmentHealth.latestHealth?.status || 'UNKNOWN'}
                </Badge>
              </div>

              {/* Equipment Info */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Equipment Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type:</span>{' '}
                    <span className="font-medium">{selectedEquipmentHealth.type}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Manufacturer:</span>{' '}
                    <span className="font-medium">{selectedEquipmentHealth.manufacturer || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Model:</span>{' '}
                    <span className="font-medium">{selectedEquipmentHealth.model || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Code:</span>{' '}
                    <span className="font-mono">{selectedEquipmentHealth.code}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Metrics */}
              {selectedEquipmentHealth.latestHealth?.metrics && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Health Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(selectedEquipmentHealth.latestHealth.metrics).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center p-2 bg-muted rounded">
                          <span className="text-sm capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="font-mono font-medium">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Anomalies */}
              {selectedEquipmentHealth.latestHealth?.anomalies && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      Detected Anomalies
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs font-mono bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(selectedEquipmentHealth.latestHealth.anomalies, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Recommendations */}
              {selectedEquipmentHealth.latestHealth?.recommendations && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Settings className="w-4 h-4 text-blue-500" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs font-mono bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(selectedEquipmentHealth.latestHealth.recommendations, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Last Update */}
              <div className="text-xs text-muted-foreground text-right">
                Last updated:{' '}
                {selectedEquipmentHealth.latestHealth
                  ? new Date(selectedEquipmentHealth.latestHealth.timestamp).toLocaleString()
                  : 'No data'}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setHealthDetailDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Rule Dialog */}
      <ConfirmDialog
        open={deleteRuleDialog}
        onOpenChange={setDeleteRuleDialog}
        title="Delete Monitoring Rule"
        description={`Are you sure you want to delete the rule "${selectedRule?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteRule}
      />
    </div>
  );
}
