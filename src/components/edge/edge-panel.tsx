'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  HardDrive,
  Plus,
  RefreshCw,
  Settings,
  Wifi,
  WifiOff,
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Edit,
  Trash2,
  Loader2,
  Zap,
  Plug,
  ArrowRightLeft,
  BarChart3,
  Timer,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SimulatorDiscoveryDialog } from './simulator-discovery-dialog';
import { MappingReviewTable } from './mapping-review-table';
import { OpcuaBrowseDialog } from './opcua-browse-dialog';
import type { BrowseNodeResult } from './opcua-browse-dialog';

// Types
interface Site {
  id: string;
  name: string;
  code: string;
  enterprise?: { code: string };
}

interface Tag {
  id: string;
  name: string;
  mqttTopic: string;
  dataType: string;
  engUnit: string | null;
}

interface EdgeConnector {
  id: string;
  name: string;
  code: string;
  type: string;
  protocol: string | null;
  endpoint: string;
  config: any;
  status: string;
  lastSeen: Date | null;
  version: string | null;
  heartbeatRate: number;
  isActive: boolean;
  siteId: string;
  site: Site;
  _count?: { tagMappings: number };
  connectorMetrics?: ConnectorMetric[];
}

interface TagMapping {
  id: string;
  sourceAddress: string;
  sourceType: string;
  sourceDataType: string | null;
  scale: number | null;
  offset: number | null;
  swapBytes: boolean;
  isActive: boolean;
  connectorId: string;
  tagId: string;
  connector: {
    id: string;
    name: string;
    code: string;
    type: string;
    status: string;
  };
  tag: {
    id: string;
    name: string;
    mqttTopic: string;
    dataType: string;
    engUnit: string | null;
  };
}

interface ConnectorMetric {
  id: string;
  messagesRead: number;
  messagesError: number;
  latencyMs: number;
  timestamp: Date;
}

interface TestResult {
  success: boolean;
  message: string;
  latencyMs: number;
  details?: any;
}

// Connector type options
const CONNECTOR_TYPES = [
  { value: 'OPC_UA', label: 'OPC UA', color: 'bg-blue-500' },
  { value: 'MODBUS_TCP', label: 'Modbus TCP', color: 'bg-orange-500' },
  { value: 'MODBUS_RTU', label: 'Modbus RTU', color: 'bg-amber-500' },
  { value: 'S7', label: 'Siemens S7', color: 'bg-purple-500' },
  { value: 'ETHERNET_IP', label: 'Ethernet/IP', color: 'bg-cyan-500' },
  { value: 'BACNET', label: 'BACnet', color: 'bg-teal-500' },
  { value: 'DNP3', label: 'DNP3', color: 'bg-indigo-500' },
  { value: 'MQTT', label: 'MQTT', color: 'bg-emerald-500' },
];

// Source type options
const SOURCE_TYPES = [
  { value: 'COIL', label: 'Coil' },
  { value: 'DISCRETE_INPUT', label: 'Discrete Input' },
  { value: 'INPUT_REGISTER', label: 'Input Register' },
  { value: 'HOLDING_REGISTER', label: 'Holding Register' },
  { value: 'TAG', label: 'Tag' },
  { value: 'NODE', label: 'Node' },
];

export function EdgePanel() {
  // State
  const [activeTab, setActiveTab] = useState('connectors');
  
  // Connectors state
  const [connectors, setConnectors] = useState<EdgeConnector[]>([]);
  const [connectorsLoading, setConnectorsLoading] = useState(true);
  const [connectorDialogOpen, setConnectorDialogOpen] = useState(false);
  const [connectorFormMode, setConnectorFormMode] = useState<'create' | 'edit'>('create');
  const [selectedConnector, setSelectedConnector] = useState<EdgeConnector | null>(null);
  const [connectorFormErrors, setConnectorFormErrors] = useState<Record<string, string>>({});
  const [connectorSubmitting, setConnectorSubmitting] = useState(false);
  const [deleteConnectorDialog, setDeleteConnectorDialog] = useState(false);
  const [testResultDialog, setTestResultDialog] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testingConnector, setTestingConnector] = useState<string | null>(null);
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  
  // Tag Mappings state
  const [mappings, setMappings] = useState<TagMapping[]>([]);
  const [mappingsLoading, setMappingsLoading] = useState(true);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [mappingFormMode, setMappingFormMode] = useState<'create' | 'edit'>('create');
  const [selectedMapping, setSelectedMapping] = useState<TagMapping | null>(null);
  const [mappingFormErrors, setMappingFormErrors] = useState<Record<string, string>>({});
  const [mappingSubmitting, setMappingSubmitting] = useState(false);
  const [deleteMappingDialog, setDeleteMappingDialog] = useState(false);
  
  // Metrics state
  const [metricsData, setMetricsData] = useState<EdgeConnector | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  
  // Simulator Discovery state
  const [simulatorDialogOpen, setSimulatorDialogOpen] = useState(false);
  const [discoveredMappings, setDiscoveredMappings] = useState<any[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [opcuaBrowseOpen, setOpcuaBrowseOpen] = useState(false);
  const [opcuaBrowseConnector, setOpcuaBrowseConnector] = useState<EdgeConnector | null>(null);
  
  // Dropdown data
  const [sites, setSites] = useState<Site[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  
  // Connector form state
  const [connectorForm, setConnectorForm] = useState({
    name: '',
    code: '',
    type: 'OPC_UA',
    endpoint: '',
    siteId: '',
    heartbeatRate: '30',
    version: '',
  });
  
  // Mapping form state
  const [mappingForm, setMappingForm] = useState({
    sourceAddress: '',
    sourceType: 'TAG',
    sourceDataType: '',
    scale: '',
    offset: '',
    swapBytes: false,
    isActive: true,
    connectorId: '',
    tagId: '',
  });

  // Fetch functions
  const fetchConnectors = useCallback(async () => {
    try {
      setConnectorsLoading(true);
      const response = await fetch('/api/connectors');
      if (!response.ok) throw new Error('Failed to fetch connectors');
      const data = await response.json();
      setConnectors(data);
    } catch (error) {
      console.error('Error fetching connectors:', error);
      toast.error('Failed to load connectors');
    } finally {
      setConnectorsLoading(false);
    }
  }, []);

  const fetchMappings = useCallback(async () => {
    try {
      setMappingsLoading(true);
      const response = await fetch('/api/tag-mappings');
      if (!response.ok) throw new Error('Failed to fetch tag mappings');
      const data = await response.json();
      setMappings(data);
    } catch (error) {
      console.error('Error fetching tag mappings:', error);
      toast.error('Failed to load tag mappings');
    } finally {
      setMappingsLoading(false);
    }
  }, []);

  const fetchDropdownData = useCallback(async () => {
    try {
      const [sitesRes, tagsRes] = await Promise.all([
        fetch('/api/sites'),
        fetch('/api/tags'),
      ]);
      
      if (sitesRes.ok) setSites(await sitesRes.json());
      if (tagsRes.ok) setTags(await tagsRes.json());
    } catch (error) {
      console.error('Error fetching dropdown data:', error);
    }
  }, []);

  const fetchConnectorMetrics = useCallback(async (connectorId: string) => {
    try {
      setMetricsLoading(true);
      const response = await fetch(`/api/connectors/${connectorId}`);
      if (!response.ok) throw new Error('Failed to fetch connector metrics');
      const data = await response.json();
      setMetricsData(data);
    } catch (error) {
      console.error('Error fetching connector metrics:', error);
      toast.error('Failed to load connector metrics');
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchConnectors();
    fetchMappings();
    fetchDropdownData();
  }, [fetchConnectors, fetchMappings, fetchDropdownData]);

  // Status helpers
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ONLINE': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'OFFLINE': return <XCircle className="w-4 h-4 text-slate-500" />;
      case 'ERROR': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'MAINTENANCE': return <Settings className="w-4 h-4 text-yellow-500" />;
      default: return <WifiOff className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE': return 'bg-green-500';
      case 'OFFLINE': return 'bg-slate-500';
      case 'ERROR': return 'bg-red-500';
      case 'MAINTENANCE': return 'bg-yellow-500';
      default: return 'bg-slate-500';
    }
  };

  const getTypeColor = (type: string) => {
    const typeInfo = CONNECTOR_TYPES.find(t => t.value === type);
    return typeInfo?.color || 'bg-slate-500';
  };

  const formatLastSeen = (lastSeen: Date | null) => {
    if (!lastSeen) return 'Never';
    const date = new Date(lastSeen);
    return date.toLocaleString();
  };

  // ============================================
  // Connector CRUD Operations
  // ============================================

  const resetConnectorForm = () => {
    setConnectorForm({
      name: '',
      code: '',
      type: 'OPC_UA',
      endpoint: '',
      siteId: sites[0]?.id || '',
      heartbeatRate: '30',
      version: '',
    });
    setConnectorFormErrors({});
  };

  const openCreateConnectorDialog = () => {
    resetConnectorForm();
    setConnectorFormMode('create');
    setSelectedConnector(null);
    setConnectorDialogOpen(true);
  };

  const openEditConnectorDialog = (connector: EdgeConnector) => {
    setConnectorForm({
      name: connector.name,
      code: connector.code,
      type: connector.type,
      endpoint: connector.endpoint,
      siteId: connector.siteId,
      heartbeatRate: String(connector.heartbeatRate),
      version: connector.version || '',
    });
    setConnectorFormMode('edit');
    setSelectedConnector(connector);
    setConnectorFormErrors({});
    setConnectorDialogOpen(true);
  };

  const validateConnectorForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!connectorForm.name.trim()) errors.name = 'Name is required';
    if (!connectorForm.code.trim()) errors.code = 'Code is required';
    if (!connectorForm.type) errors.type = 'Type is required';
    if (!connectorForm.endpoint.trim()) errors.endpoint = 'Endpoint is required';
    if (!connectorForm.siteId) errors.siteId = 'Site is required';
    
    setConnectorFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConnectorSubmit = async () => {
    if (!validateConnectorForm()) return;
    
    setConnectorSubmitting(true);
    try {
      const url = connectorFormMode === 'create' 
        ? '/api/connectors' 
        : `/api/connectors/${selectedConnector?.id}`;
      const method = connectorFormMode === 'create' ? 'POST' : 'PUT';
      
      const body: any = {
        name: connectorForm.name,
        code: connectorForm.code,
        type: connectorForm.type,
        protocol: null,
        endpoint: connectorForm.endpoint,
        siteId: connectorForm.siteId,
        heartbeatRate: parseInt(connectorForm.heartbeatRate) || 30,
        version: connectorForm.version || null,
      };
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save connector');
      }
      
      toast.success(connectorFormMode === 'create' 
        ? 'Connector created successfully' 
        : 'Connector updated successfully');
      setConnectorDialogOpen(false);
      fetchConnectors();
    } catch (error: any) {
      console.error('Error saving connector:', error);
      toast.error(error.message || 'Failed to save connector');
    } finally {
      setConnectorSubmitting(false);
    }
  };

  const handleTestConnection = async (connector: EdgeConnector) => {
    setTestingConnector(connector.id);
    try {
      const response = await fetch(`/api/connectors/${connector.id}/test`, {
        method: 'POST',
      });
      
      const result = await response.json();
      setTestResult(result);
      setTestResultDialog(true);
      
      // Refresh connector to get updated status
      fetchConnectors();
    } catch (error) {
      console.error('Error testing connection:', error);
      toast.error('Failed to test connection');
    } finally {
      setTestingConnector(null);
    }
  };

  const handleTestEndpoint = async () => {
    const endpoint = connectorForm.endpoint.trim();
    if (!endpoint) {
      toast.error('Enter an endpoint first');
      return;
    }
    if (!/^opc\.tcp:\/\//i.test(endpoint)) {
      toast.error('Endpoint must start with opc.tcp://');
      return;
    }
    setTestingEndpoint(true);
    try {
      const response = await fetch('/api/opcua/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
      const result = await response.json();
      setTestResult(result);
      setTestResultDialog(true);
    } catch (error) {
      console.error('Error testing endpoint:', error);
      toast.error('Failed to test endpoint');
    } finally {
      setTestingEndpoint(false);
    }
  };

  const handleDeleteConnector = async () => {
    if (!selectedConnector) return;
    
    try {
      const response = await fetch(`/api/connectors/${selectedConnector.id}`, { 
        method: 'DELETE' 
      });
      if (!response.ok) throw new Error('Failed to delete connector');
      
      toast.success('Connector deleted successfully');
      setDeleteConnectorDialog(false);
      setSelectedConnector(null);
      fetchConnectors();
    } catch (error) {
      console.error('Error deleting connector:', error);
      toast.error('Failed to delete connector');
    }
  };

  // ============================================
  // Tag Mapping CRUD Operations
  // ============================================

  const resetMappingForm = () => {
    setMappingForm({
      sourceAddress: '',
      sourceType: 'TAG',
      sourceDataType: '',
      scale: '',
      offset: '',
      swapBytes: false,
      isActive: true,
      connectorId: connectors[0]?.id || '',
      tagId: tags[0]?.id || '',
    });
    setMappingFormErrors({});
  };

  const openCreateMappingDialog = () => {
    resetMappingForm();
    setMappingFormMode('create');
    setSelectedMapping(null);
    setMappingDialogOpen(true);
  };

  const openEditMappingDialog = (mapping: TagMapping) => {
    setMappingForm({
      sourceAddress: mapping.sourceAddress,
      sourceType: mapping.sourceType,
      sourceDataType: mapping.sourceDataType || '',
      scale: mapping.scale !== null ? String(mapping.scale) : '',
      offset: mapping.offset !== null ? String(mapping.offset) : '',
      swapBytes: mapping.swapBytes,
      isActive: mapping.isActive,
      connectorId: mapping.connectorId,
      tagId: mapping.tagId,
    });
    setMappingFormMode('edit');
    setSelectedMapping(mapping);
    setMappingFormErrors({});
    setMappingDialogOpen(true);
  };

  const validateMappingForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!mappingForm.sourceAddress.trim()) errors.sourceAddress = 'Source address is required';
    if (!mappingForm.sourceType) errors.sourceType = 'Source type is required';
    if (!mappingForm.connectorId) errors.connectorId = 'Connector is required';
    if (!mappingForm.tagId) errors.tagId = 'Tag is required';
    
    setMappingFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleMappingSubmit = async () => {
    if (!validateMappingForm()) return;
    
    setMappingSubmitting(true);
    try {
      const url = mappingFormMode === 'create' 
        ? '/api/tag-mappings' 
        : `/api/tag-mappings/${selectedMapping?.id}`;
      const method = mappingFormMode === 'create' ? 'POST' : 'PUT';
      
      const body = {
        sourceAddress: mappingForm.sourceAddress,
        sourceType: mappingForm.sourceType,
        sourceDataType: mappingForm.sourceDataType || null,
        scale: mappingForm.scale ? parseFloat(mappingForm.scale) : null,
        offset: mappingForm.offset ? parseFloat(mappingForm.offset) : null,
        swapBytes: mappingForm.swapBytes,
        isActive: mappingForm.isActive,
        connectorId: mappingForm.connectorId,
        tagId: mappingForm.tagId,
      };
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save tag mapping');
      }
      
      toast.success(mappingFormMode === 'create' 
        ? 'Tag mapping created successfully' 
        : 'Tag mapping updated successfully');
      setMappingDialogOpen(false);
      fetchMappings();
    } catch (error: any) {
      console.error('Error saving tag mapping:', error);
      toast.error(error.message || 'Failed to save tag mapping');
    } finally {
      setMappingSubmitting(false);
    }
  };

  const handleDeleteMapping = async () => {
    if (!selectedMapping) return;
    
    try {
      const response = await fetch(`/api/tag-mappings/${selectedMapping.id}`, { 
        method: 'DELETE' 
      });
      if (!response.ok) throw new Error('Failed to delete tag mapping');
      
      toast.success('Tag mapping deleted successfully');
      setDeleteMappingDialog(false);
      setSelectedMapping(null);
      fetchMappings();
    } catch (error) {
      console.error('Error deleting tag mapping:', error);
      toast.error('Failed to delete tag mapping');
    }
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <HardDrive className="w-8 h-8 text-emerald-500" />
            Edge Connectors
          </h1>
          <p className="text-muted-foreground">Manage on-premises connectivity to PLCs and control systems</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchConnectors(); fetchMappings(); }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh All
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Connectors</p>
                <p className="text-2xl font-bold">{connectors.length}</p>
              </div>
              <HardDrive className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Online</p>
                <p className="text-2xl font-bold text-green-500">
                  {connectors.filter(c => c.status === 'ONLINE').length}
                </p>
              </div>
              <Wifi className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tag Mappings</p>
                <p className="text-2xl font-bold">
                  {connectors.reduce((sum, c) => sum + (c._count?.tagMappings || 0), 0)}
                </p>
              </div>
              <ArrowRightLeft className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-2xl font-bold text-red-500">
                  {connectors.filter(c => c.status === 'ERROR').length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="connectors">Connectors</TabsTrigger>
          <TabsTrigger value="mappings">Tag Mappings</TabsTrigger>
          <TabsTrigger value="discovery">Simulator Discovery</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        {/* Connectors Tab */}
        <TabsContent value="connectors" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {connectors.length} connectors total
            </div>
            <Button onClick={openCreateConnectorDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Connector
            </Button>
          </div>

          <Card>
            <CardContent>
              {connectorsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : connectors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No connectors found. Create your first connector to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Mappings</TableHead>
                      <TableHead>Last Seen</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connectors.map((connector) => (
                      <TableRow key={connector.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(connector.status)}
                            <Badge className={getStatusColor(connector.status)}>
                              {connector.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{connector.name}</TableCell>
                        <TableCell>
                          <Badge className={getTypeColor(connector.type)}>
                            {connector.type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{connector.endpoint}</TableCell>
                        <TableCell>{connector.site?.name || '-'}</TableCell>
                        <TableCell>{connector._count?.tagMappings || 0}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatLastSeen(connector.lastSeen)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleTestConnection(connector)}
                              disabled={testingConnector === connector.id}
                            >
                              {testingConnector === connector.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Zap className="w-3 h-3" />
                              )}
                            </Button>
                            {connector.type === 'OPC_UA' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setOpcuaBrowseConnector(connector);
                                  setOpcuaBrowseOpen(true);
                                }}
                                title="Browse OPC UA server and add tag mappings"
                              >
                                <Search className="w-3 h-3" />
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => openEditConnectorDialog(connector)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => {
                                setSelectedConnector(connector);
                                setDeleteConnectorDialog(true);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
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

        {/* Tag Mappings Tab */}
        <TabsContent value="mappings" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {mappings.length} mappings total
            </div>
            <Button onClick={openCreateMappingDialog} disabled={connectors.length === 0 || tags.length === 0}>
              <Plus className="w-4 h-4 mr-2" />
              Add Mapping
            </Button>
          </div>

          <Card>
            <CardContent>
              {mappingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : mappings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tag mappings found. Create your first mapping to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Connector</TableHead>
                      <TableHead>Source Address</TableHead>
                      <TableHead>Source Type</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead>Scale</TableHead>
                      <TableHead>Offset</TableHead>
                      <TableHead>Swap Bytes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className={getTypeColor(mapping.connector.type)}>
                              {mapping.connector.name}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{mapping.sourceAddress}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{mapping.sourceType.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{mapping.tag.name}</TableCell>
                        <TableCell>{mapping.scale ?? '-'}</TableCell>
                        <TableCell>{mapping.offset ?? '-'}</TableCell>
                        <TableCell>
                          {mapping.swapBytes ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-slate-300" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={mapping.isActive ? 'default' : 'secondary'}>
                            {mapping.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => openEditMappingDialog(mapping)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => {
                                setSelectedMapping(mapping);
                                setDeleteMappingDialog(true);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
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

        {/* Simulator Discovery Tab */}
        <TabsContent value="discovery" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Auto-discover tags from simulators and generate ISA-95 compliant mappings
            </div>
            <Button onClick={() => setSimulatorDialogOpen(true)} disabled={sites.length === 0}>
              <Search className="w-4 h-4 mr-2" />
              Discover Tags
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tag Discovery</CardTitle>
              <CardDescription>
                Scan simulators for available tags and create mappings with ISA-95 compliant MQTT topics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {discoveredMappings.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Click "Discover Tags" to scan simulators and generate tag mappings
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supported: OPC-UA, Modbus TCP, Energy Meters
                  </p>
                </div>
              ) : (
                <MappingReviewTable
                  mappings={discoveredMappings}
                  onApprove={async (ids) => {
                    setReviewLoading(true);
                    try {
                      const toApprove = discoveredMappings.filter(m => ids.includes(m.id));
                      const res = await fetch('/api/mapping-review', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'approve',
                          siteId: sites[0]?.id,
                          mappings: toApprove,
                        }),
                      });
                      if (res.ok) {
                        toast.success(`Approved ${ids.length} mappings`);
                        setDiscoveredMappings(discoveredMappings.filter(m => !ids.includes(m.id)));
                        fetchConnectors();
                        fetchMappings();
                      }
                    } catch (_error) {
                      toast.error('Failed to approve mappings');
                    } finally {
                      setReviewLoading(false);
                    }
                  }}
                  onReject={async (ids) => {
                    setDiscoveredMappings(discoveredMappings.filter(m => !ids.includes(m.id)));
                    toast.success(`Rejected ${ids.length} mappings`);
                  }}
                  onSavePending={async (mappings) => {
                    setReviewLoading(true);
                    try {
                      const res = await fetch('/api/mapping-review', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'save_pending',
                          siteId: sites[0]?.id,
                          mappings,
                        }),
                      });
                      if (res.ok) {
                        toast.success('Mappings saved for later review');
                      }
                    } catch (_error) {
                      toast.error('Failed to save mappings');
                    } finally {
                      setReviewLoading(false);
                    }
                  }}
                  isLoading={reviewLoading}
                />
              )}
            </CardContent>
          </Card>

          <SimulatorDiscoveryDialog
            open={simulatorDialogOpen}
            onClose={() => setSimulatorDialogOpen(false)}
            siteId={sites[0]?.id || ''}
            onDiscovered={(mappings) => {
              setDiscoveredMappings(mappings);
              setSimulatorDialogOpen(false);
              toast.success(`Discovered ${mappings.length} tags`);
            }}
          />
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Connector Metrics</CardTitle>
              <CardDescription>Select a connector to view performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Select 
                  onValueChange={(value) => fetchConnectorMetrics(value)}
                  disabled={connectors.length === 0}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select connector" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectors.map((connector) => (
                      <SelectItem key={connector.id} value={connector.id}>
                        {connector.name} ({connector.type.replace('_', ' ')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {metricsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : metricsData ? (
                <div className="space-y-4">
                  {/* Status Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Status</p>
                            <div className="flex items-center gap-2 mt-1">
                              {getStatusIcon(metricsData.status)}
                              <Badge className={getStatusColor(metricsData.status)}>
                                {metricsData.status}
                              </Badge>
                            </div>
                          </div>
                          <Activity className="w-8 h-8 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Tag Mappings</p>
                            <p className="text-2xl font-bold">
                              {metricsData._count?.tagMappings || 0}
                            </p>
                          </div>
                          <ArrowRightLeft className="w-8 h-8 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Heartbeat Rate</p>
                            <p className="text-2xl font-bold">{metricsData.heartbeatRate}s</p>
                          </div>
                          <Timer className="w-8 h-8 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Version</p>
                            <p className="text-2xl font-bold">{metricsData.version || 'N/A'}</p>
                          </div>
                          <BarChart3 className="w-8 h-8 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Metrics Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Metrics</CardTitle>
                      <CardDescription>Connection performance over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {metricsData.connectorMetrics && metricsData.connectorMetrics.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Timestamp</TableHead>
                              <TableHead>Messages Read</TableHead>
                              <TableHead>Messages Error</TableHead>
                              <TableHead>Latency (ms)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {metricsData.connectorMetrics.map((metric: ConnectorMetric) => (
                              <TableRow key={metric.id}>
                                <TableCell>
                                  {new Date(metric.timestamp).toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50">
                                    {metric.messagesRead}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant="outline" 
                                    className={metric.messagesError > 0 ? 'bg-red-50' : 'bg-slate-50'}
                                  >
                                    {metric.messagesError}
                                  </Badge>
                                </TableCell>
                                <TableCell>{metric.latencyMs}ms</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No metrics data available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Select a connector to view metrics
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Connector Dialog */}
      <Dialog open={connectorDialogOpen} onOpenChange={setConnectorDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {connectorFormMode === 'create' ? 'Add Edge Connector' : 'Edit Edge Connector'}
            </DialogTitle>
            <DialogDescription>
              {connectorFormMode === 'create' 
                ? 'Configure a new edge connector for data acquisition' 
                : 'Update edge connector configuration'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="connectorName">Name *</Label>
                <Input
                  id="connectorName"
                  value={connectorForm.name}
                  onChange={(e) => setConnectorForm({ ...connectorForm, name: e.target.value })}
                  className={connectorFormErrors.name ? 'border-destructive' : ''}
                  placeholder="OPC-UA-Gateway-01"
                />
                {connectorFormErrors.name && (
                  <p className="text-sm text-destructive">{connectorFormErrors.name}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="connectorCode">Code *</Label>
                <Input
                  id="connectorCode"
                  value={connectorForm.code}
                  onChange={(e) => setConnectorForm({ ...connectorForm, code: e.target.value })}
                  className={connectorFormErrors.code ? 'border-destructive' : ''}
                  placeholder="OPC-UA-01"
                />
                {connectorFormErrors.code && (
                  <p className="text-sm text-destructive">{connectorFormErrors.code}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="connectorType">Type *</Label>
              <Select
                value={connectorForm.type}
                onValueChange={(value) => setConnectorForm({ ...connectorForm, type: value })}
              >
                <SelectTrigger className={connectorFormErrors.type ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {CONNECTOR_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {connectorFormErrors.type && (
                <p className="text-sm text-destructive">{connectorFormErrors.type}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="connectorEndpoint">Endpoint *</Label>
              <div className="flex gap-2">
                <Input
                  id="connectorEndpoint"
                  value={connectorForm.endpoint}
                  onChange={(e) => setConnectorForm({ ...connectorForm, endpoint: e.target.value })}
                  className={`flex-1 min-w-0 ${connectorFormErrors.endpoint ? 'border-destructive' : ''}`}
                  placeholder="opc.tcp://localhost:4840 or opc.tcp://host:port/path"
                />
                {connectorForm.type === 'OPC_UA' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleTestEndpoint}
                    disabled={testingEndpoint || !connectorForm.endpoint.trim()}
                    title="Test connection before saving"
                  >
                    {testingEndpoint ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                  </Button>
                )}
                {connectorForm.type === 'MODBUS_TCP' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setConnectorForm((f) => ({ ...f, endpoint: 'localhost:5020' }))}
                    title="Use local Modbus TCP (e.g. simulator)"
                  >
                    <Wifi className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {connectorFormErrors.endpoint && (
                <p className="text-sm text-destructive">{connectorFormErrors.endpoint}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="connectorSite">Site *</Label>
                <Select
                  value={connectorForm.siteId}
                  onValueChange={(value) => setConnectorForm({ ...connectorForm, siteId: value })}
                >
                  <SelectTrigger className={connectorFormErrors.siteId ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {connectorFormErrors.siteId && (
                  <p className="text-sm text-destructive">{connectorFormErrors.siteId}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="connectorHeartbeat">Heartbeat Rate (seconds)</Label>
                <Input
                  id="connectorHeartbeat"
                  type="number"
                  value={connectorForm.heartbeatRate}
                  onChange={(e) => setConnectorForm({ ...connectorForm, heartbeatRate: e.target.value })}
                  placeholder="30"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="connectorVersion">Version</Label>
                <Input
                  id="connectorVersion"
                  value={connectorForm.version}
                  onChange={(e) => setConnectorForm({ ...connectorForm, version: e.target.value })}
                  placeholder="1.0.0"
                />
              </div>
            </div>

            {connectorForm.type === 'OPC_UA' && (
              <div className="space-y-2 rounded-lg border p-4 bg-muted/30">
                <p className="text-sm font-medium">Tag mappings</p>
                {selectedConnector ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setConnectorDialogOpen(false);
                        setOpcuaBrowseConnector(selectedConnector);
                        setOpcuaBrowseOpen(true);
                      }}
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Browse server
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setConnectorDialogOpen(false);
                        setMappingForm({
                          sourceAddress: '',
                          sourceType: 'TAG',
                          sourceDataType: '',
                          scale: '',
                          offset: '',
                          swapBytes: false,
                          isActive: true,
                          connectorId: selectedConnector.id,
                          tagId: '',
                        });
                        setMappingFormMode('create');
                        setSelectedMapping(null);
                        setMappingFormErrors({});
                        setMappingDialogOpen(true);
                      }}
                    >
                      Add mapping manually
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Save the connector first, then use <strong>Browse server</strong> or <strong>Add mapping manually</strong> on the connector row to add tag mappings.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setConnectorDialogOpen(false)}
              disabled={connectorSubmitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConnectorSubmit}
              disabled={connectorSubmitting}
            >
              {connectorSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                connectorFormMode === 'create' ? 'Add Connector' : 'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Mapping Dialog */}
      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mappingFormMode === 'create' ? 'Add Tag Mapping' : 'Edit Tag Mapping'}
            </DialogTitle>
            <DialogDescription>
              {mappingFormMode === 'create' 
                ? 'Map a source address to a local tag' 
                : 'Update tag mapping configuration'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mappingConnector">Connector *</Label>
                <Select
                  value={mappingForm.connectorId}
                  onValueChange={(value) => setMappingForm({ ...mappingForm, connectorId: value })}
                >
                  <SelectTrigger className={mappingFormErrors.connectorId ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select connector" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectors.map((connector) => (
                      <SelectItem key={connector.id} value={connector.id}>
                        {connector.name} ({connector.type.replace('_', ' ')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mappingFormErrors.connectorId && (
                  <p className="text-sm text-destructive">{mappingFormErrors.connectorId}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="mappingTag">Tag *</Label>
                <Select
                  value={mappingForm.tagId}
                  onValueChange={(value) => setMappingForm({ ...mappingForm, tagId: value })}
                >
                  <SelectTrigger className={mappingFormErrors.tagId ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        {tag.name} ({tag.dataType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mappingFormErrors.tagId && (
                  <p className="text-sm text-destructive">{mappingFormErrors.tagId}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mappingSourceAddress">Source Address *</Label>
                <Input
                  id="mappingSourceAddress"
                  value={mappingForm.sourceAddress}
                  onChange={(e) => setMappingForm({ ...mappingForm, sourceAddress: e.target.value })}
                  className={mappingFormErrors.sourceAddress ? 'border-destructive' : ''}
                  placeholder="ns=2;s=Temperature"
                />
                {mappingFormErrors.sourceAddress && (
                  <p className="text-sm text-destructive">{mappingFormErrors.sourceAddress}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="mappingSourceType">Source Type *</Label>
                <Select
                  value={mappingForm.sourceType}
                  onValueChange={(value) => setMappingForm({ ...mappingForm, sourceType: value })}
                >
                  <SelectTrigger className={mappingFormErrors.sourceType ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select source type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mappingFormErrors.sourceType && (
                  <p className="text-sm text-destructive">{mappingFormErrors.sourceType}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mappingSourceDataType">Source Data Type</Label>
                <Input
                  id="mappingSourceDataType"
                  value={mappingForm.sourceDataType}
                  onChange={(e) => setMappingForm({ ...mappingForm, sourceDataType: e.target.value })}
                  placeholder="INT16, FLOAT32, etc."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="mappingScale">Scale</Label>
                <Input
                  id="mappingScale"
                  type="number"
                  step="0.01"
                  value={mappingForm.scale}
                  onChange={(e) => setMappingForm({ ...mappingForm, scale: e.target.value })}
                  placeholder="1.0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mappingOffset">Offset</Label>
                <Input
                  id="mappingOffset"
                  type="number"
                  step="0.01"
                  value={mappingForm.offset}
                  onChange={(e) => setMappingForm({ ...mappingForm, offset: e.target.value })}
                  placeholder="0"
                />
              </div>
              
              <div className="flex items-center space-x-4 pt-6">
                <Switch
                  id="mappingSwapBytes"
                  checked={mappingForm.swapBytes}
                  onCheckedChange={(checked) => setMappingForm({ ...mappingForm, swapBytes: checked })}
                />
                <Label htmlFor="mappingSwapBytes">Swap Bytes</Label>
              </div>
            </div>

            <div className="flex items-center space-x-4 pt-2">
              <Switch
                id="mappingIsActive"
                checked={mappingForm.isActive}
                onCheckedChange={(checked) => setMappingForm({ ...mappingForm, isActive: checked })}
              />
              <Label htmlFor="mappingIsActive">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setMappingDialogOpen(false)}
              disabled={mappingSubmitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleMappingSubmit}
              disabled={mappingSubmitting}
            >
              {mappingSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                mappingFormMode === 'create' ? 'Add Mapping' : 'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Result Dialog */}
      <Dialog open={testResultDialog} onOpenChange={setTestResultDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {testResult?.success ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Connection Successful
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Connection Failed
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {testResult?.message}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Latency</p>
                <p className="text-lg font-semibold">{testResult?.latencyMs}ms</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-lg font-semibold">
                  {testResult?.success ? 'Connected' : 'Failed'}
                </p>
              </div>
            </div>

            {testResult?.details?.readValue != null && (
              <div className="rounded-md border bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground mb-1">Read value</p>
                <p className="text-base font-medium">
                  Value: <span className="font-mono">{String(testResult.details.readValue.value)}</span>
                  {testResult.details.readValue.dataType && (
                    <span className="ml-2 text-muted-foreground">({testResult.details.readValue.dataType})</span>
                  )}
                </p>
                {testResult.details.readValue.statusCode && (
                  <p className="text-xs text-muted-foreground mt-1">Status: {testResult.details.readValue.statusCode}</p>
                )}
              </div>
            )}
            
            {testResult?.details && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Details</p>
                <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-3 rounded-md overflow-x-auto">
                  {JSON.stringify(testResult.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button onClick={() => setTestResultDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Connector Confirmation */}
      <ConfirmDialog
        open={deleteConnectorDialog}
        onOpenChange={setDeleteConnectorDialog}
        title="Delete Connector"
        description={`Are you sure you want to delete "${selectedConnector?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteConnector}
      />

      {/* Delete Mapping Confirmation */}
      <ConfirmDialog
        open={deleteMappingDialog}
        onOpenChange={setDeleteMappingDialog}
        title="Delete Tag Mapping"
        description={`Are you sure you want to delete this mapping for "${selectedMapping?.sourceAddress}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteMapping}
      />

      {/* OPC-UA Browse dialog: live browse server and create mappings */}
      {opcuaBrowseConnector && (
        <OpcuaBrowseDialog
          open={opcuaBrowseOpen}
          onClose={() => {
            setOpcuaBrowseOpen(false);
            setOpcuaBrowseConnector(null);
          }}
          endpoint={opcuaBrowseConnector.endpoint}
          connectorId={opcuaBrowseConnector.id}
          connectorName={opcuaBrowseConnector.name}
          siteId={opcuaBrowseConnector.siteId}
          enterpriseCode={opcuaBrowseConnector.site?.enterprise?.code ?? 'ACME'}
          siteCode={opcuaBrowseConnector.site?.code ?? 'SITE'}
          onSelectNodes={async (nodes: BrowseNodeResult[]) => {
            if (!opcuaBrowseConnector?.id) return;
            setReviewLoading(true);
            try {
              const res = await fetch(`/api/connectors/${opcuaBrowseConnector.id}/mappings-from-browse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  nodes: nodes.map((n) => ({
                    nodeId: n.nodeId,
                    displayName: n.displayName || n.browseName,
                    dataType: n.dataType,
                    description: n.description,
                  })),
                }),
              });
              const data = await res.json();
              if (res.ok && data.created > 0) {
                toast.success(`Created ${data.created} tag mapping(s)`);
                fetchConnectors();
                fetchMappings();
              } else if (data.skipped > 0 && data.created === 0) {
                toast.info('Mappings already exist for selected nodes');
              } else if (!res.ok) {
                toast.error(data.error || 'Failed to create mappings');
              }
            } catch (_e) {
              toast.error('Failed to create mappings');
            } finally {
              setReviewLoading(false);
            }
          }}
        />
      )}
    </div>
  );
}
