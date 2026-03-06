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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  GitBranch,
  Search,
  Package,
  Truck,
  MapPin,
  Calendar,
  User,
  Building,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  FileSearch,
  Download,
  Plus,
  Edit,
  Trash2,
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// Types
interface Product {
  id: string;
  name: string;
  code: string;
  productType: string;
  unit: string | null;
}

interface MaterialLot {
  id: string;
  lotNumber: string;
  externalLot?: string | null;
  quantity: number;
  remainingQty: number;
  status: string;
  expiryDate?: string | null;
  receivedDate: string;
  supplierName?: string | null;
  location?: string | null;
  productId: string;
  product: Product;
}

interface Genealogy {
  id: string;
  relationship: string;
  quantity: number | null;
  notes?: string | null;
  timestamp: string;
  runId?: string | null;
  fromLotId?: string | null;
  toLotId?: string | null;
  fromLot?: MaterialLot | null;
  toLot?: MaterialLot | null;
}

export function TraceabilityPanel() {
  // State
  const [activeTab, setActiveTab] = useState('lots');
  
  // Lots state
  const [lots, setLots] = useState<MaterialLot[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lotsLoading, setLotsLoading] = useState(true);
  const [lotDialogOpen, setLotDialogOpen] = useState(false);
  const [lotFormMode, setLotFormMode] = useState<'create' | 'edit'>('create');
  const [selectedLot, setSelectedLot] = useState<MaterialLot | null>(null);
  const [lotFormErrors, setLotFormErrors] = useState<Record<string, string>>({});
  const [lotSubmitting, setLotSubmitting] = useState(false);
  const [deleteLotDialog, setDeleteLotDialog] = useState(false);
  
  // Genealogy state
  const [genealogyEvents, setGenealogyEvents] = useState<Genealogy[]>([]);
  const [genealogyLoading, setGenealogyLoading] = useState(false);
  const [traceLotId, setTraceLotId] = useState('');
  const [traceResults, setTraceResults] = useState<{ forward: Genealogy[]; backward: Genealogy[] }>({ forward: [], backward: [] });
  const [showingTrace, setShowingTrace] = useState(false);
  
  // Lot form state
  const [lotForm, setLotForm] = useState({
    lotNumber: '',
    externalLot: '',
    productId: '',
    quantity: '',
    supplierName: '',
    location: '',
    expiryDate: '',
    notes: '',
  });

  // Fetch functions
  const fetchLots = useCallback(async () => {
    try {
      setLotsLoading(true);
      const [lotsRes, productsRes] = await Promise.all([
        fetch('/api/lots'),
        fetch('/api/products'),
      ]);
      
      if (lotsRes.ok) setLots(await lotsRes.json());
      if (productsRes.ok) setProducts(await productsRes.json());
    } catch (error) {
      console.error('Error fetching lots:', error);
      toast.error('Failed to load lots');
    } finally {
      setLotsLoading(false);
    }
  }, []);

  const fetchGenealogy = useCallback(async () => {
    try {
      setGenealogyLoading(true);
      const response = await fetch('/api/genealogy');
      if (response.ok) {
        setGenealogyEvents(await response.json());
      }
    } catch (error) {
      console.error('Error fetching genealogy:', error);
    } finally {
      setGenealogyLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLots();
    fetchGenealogy();
  }, [fetchLots, fetchGenealogy]);

  // Status helpers
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-green-500';
      case 'IN_USE': return 'bg-blue-500';
      case 'RESERVED': return 'bg-yellow-500';
      case 'CONSUMED': return 'bg-slate-500';
      case 'QUARANTINE': return 'bg-orange-500';
      case 'REJECTED': return 'bg-red-500';
      default: return 'bg-slate-400';
    }
  };

  // ============================================
  // Lot CRUD Operations
  // ============================================

  const resetLotForm = () => {
    setLotForm({
      lotNumber: `LOT-${new Date().getFullYear()}-${String(lots.length + 1).padStart(3, '0')}`,
      externalLot: '',
      productId: '',
      quantity: '',
      supplierName: '',
      location: '',
      expiryDate: '',
      notes: '',
    });
    setLotFormErrors({});
  };

  const openCreateLotDialog = () => {
    resetLotForm();
    setLotFormMode('create');
    setSelectedLot(null);
    setLotDialogOpen(true);
  };

  const openEditLotDialog = (lot: MaterialLot) => {
    setLotForm({
      lotNumber: lot.lotNumber,
      externalLot: lot.externalLot || '',
      productId: lot.productId,
      quantity: String(lot.quantity),
      supplierName: lot.supplierName || '',
      location: lot.location || '',
      expiryDate: lot.expiryDate ? lot.expiryDate.split('T')[0] : '',
      notes: '',
    });
    setLotFormMode('edit');
    setSelectedLot(lot);
    setLotFormErrors({});
    setLotDialogOpen(true);
  };

  const validateLotForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!lotForm.lotNumber.trim()) errors.lotNumber = 'Lot number is required';
    if (!lotForm.productId) errors.productId = 'Product is required';
    if (!lotForm.quantity || parseFloat(lotForm.quantity) <= 0) {
      errors.quantity = 'Valid quantity is required';
    }
    
    setLotFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLotSubmit = async () => {
    if (!validateLotForm()) return;
    
    setLotSubmitting(true);
    try {
      const url = lotFormMode === 'create' ? '/api/lots' : `/api/lots/${selectedLot?.id}`;
      const method = lotFormMode === 'create' ? 'POST' : 'PUT';
      
      const body = {
        lotNumber: lotForm.lotNumber,
        externalLot: lotForm.externalLot || null,
        productId: lotForm.productId,
        quantity: parseFloat(lotForm.quantity),
        supplierName: lotForm.supplierName || null,
        location: lotForm.location || null,
        expiryDate: lotForm.expiryDate ? new Date(lotForm.expiryDate) : null,
      };
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save lot');
      }
      
      toast.success(lotFormMode === 'create' ? 'Lot created successfully' : 'Lot updated successfully');
      setLotDialogOpen(false);
      fetchLots();
    } catch (error: any) {
      console.error('Error saving lot:', error);
      toast.error(error.message || 'Failed to save lot');
    } finally {
      setLotSubmitting(false);
    }
  };

  const handleDeleteLot = async () => {
    if (!selectedLot) return;
    
    try {
      const response = await fetch(`/api/lots/${selectedLot.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete lot');
      
      toast.success('Lot deleted successfully');
      setDeleteLotDialog(false);
      setSelectedLot(null);
      fetchLots();
    } catch (error) {
      console.error('Error deleting lot:', error);
      toast.error('Failed to delete lot');
    }
  };

  // ============================================
  // Trace Operations
  // ============================================

  const handleTrace = async () => {
    if (!traceLotId) {
      toast.error('Please select a lot to trace');
      return;
    }
    
    try {
      const response = await fetch(`/api/lots/${traceLotId}/trace`);
      if (!response.ok) throw new Error('Failed to trace lot');
      
      const data = await response.json();
      setTraceResults(data);
      setShowingTrace(true);
    } catch (error) {
      console.error('Error tracing lot:', error);
      toast.error('Failed to trace lot');
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
            <GitBranch className="w-8 h-8 text-emerald-500" />
            Traceability
          </h1>
          <p className="text-muted-foreground">Material genealogy, lot tracking, and forward/backward trace</p>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="lots">Material Lots</TabsTrigger>
          <TabsTrigger value="genealogy">Genealogy</TabsTrigger>
          <TabsTrigger value="trace">Trace</TabsTrigger>
        </TabsList>

        {/* Lots Tab */}
        <TabsContent value="lots" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {lots.length} lots in inventory
            </div>
            <Button onClick={openCreateLotDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Lot
            </Button>
          </div>

          <Card>
            <CardContent>
              {lotsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : lots.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No material lots found. Add your first lot to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lot Number</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lots.map((lot) => (
                      <TableRow key={lot.id}>
                        <TableCell className="font-medium">{lot.lotNumber}</TableCell>
                        <TableCell>
                          <div>
                            <div>{lot.product.name}</div>
                            <div className="text-xs text-muted-foreground">{lot.product.code}</div>
                          </div>
                        </TableCell>
                        <TableCell>{lot.quantity} {lot.product.unit}</TableCell>
                        <TableCell>{lot.remainingQty} {lot.product.unit}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(lot.status)}>
                            {lot.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{lot.supplierName || '-'}</TableCell>
                        <TableCell>{lot.location || '-'}</TableCell>
                        <TableCell>
                          {lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                setTraceLotId(lot.id);
                                setActiveTab('trace');
                              }}
                            >
                              <FileSearch className="w-3 h-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => openEditLotDialog(lot)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => {
                                setSelectedLot(lot);
                                setDeleteLotDialog(true);
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

        {/* Genealogy Tab */}
        <TabsContent value="genealogy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Genealogy Events</CardTitle>
              <CardDescription>Material transformations and lot relationships</CardDescription>
            </CardHeader>
            <CardContent>
              {genealogyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : genealogyEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No genealogy events recorded yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Relationship</TableHead>
                      <TableHead>From Lot</TableHead>
                      <TableHead>To Lot</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {genealogyEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <Badge variant="outline">{event.relationship}</Badge>
                        </TableCell>
                        <TableCell>{event.fromLot?.lotNumber || '-'}</TableCell>
                        <TableCell>{event.toLot?.lotNumber || '-'}</TableCell>
                        <TableCell>{event.quantity || '-'}</TableCell>
                        <TableCell>{new Date(event.timestamp).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trace Tab */}
        <TabsContent value="trace" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lot Trace</CardTitle>
              <CardDescription>Trace material flow forward and backward</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6">
                <Select value={traceLotId} onValueChange={setTraceLotId}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select lot to trace" />
                  </SelectTrigger>
                  <SelectContent>
                    {lots.map((lot) => (
                      <SelectItem key={lot.id} value={lot.id}>
                        {lot.lotNumber} - {lot.product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleTrace}>
                  <FileSearch className="w-4 h-4 mr-2" />
                  Trace
                </Button>
              </div>

              {showingTrace && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Backward Trace */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ArrowUpCircle className="w-5 h-5 text-blue-500" />
                        Backward Trace (Sources)
                      </CardTitle>
                      <CardDescription>Where did this material come from?</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {traceResults.backward.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          No source lots found
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {traceResults.backward.map((event) => (
                            <div key={event.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                              <ArrowLeft className="w-4 h-4 text-blue-500" />
                              <div className="flex-1">
                                <div className="font-medium">{event.fromLot?.lotNumber}</div>
                                <div className="text-xs text-muted-foreground">
                                  {event.fromLot?.product?.name} • Qty: {event.quantity}
                                </div>
                              </div>
                              <Badge variant="outline">{event.relationship}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Forward Trace */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ArrowDownCircle className="w-5 h-5 text-emerald-500" />
                        Forward Trace (Destinations)
                      </CardTitle>
                      <CardDescription>Where did this material go?</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {traceResults.forward.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          No destination lots found
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {traceResults.forward.map((event) => (
                            <div key={event.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                              <ArrowRight className="w-4 h-4 text-emerald-500" />
                              <div className="flex-1">
                                <div className="font-medium">{event.toLot?.lotNumber}</div>
                                <div className="text-xs text-muted-foreground">
                                  {event.toLot?.product?.name} • Qty: {event.quantity}
                                </div>
                              </div>
                              <Badge variant="outline">{event.relationship}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Lot Dialog */}
      <Dialog open={lotDialogOpen} onOpenChange={setLotDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {lotFormMode === 'create' ? 'Add Material Lot' : 'Edit Material Lot'}
            </DialogTitle>
            <DialogDescription>
              {lotFormMode === 'create' 
                ? 'Receive new material into inventory' 
                : 'Update lot information'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lotNumber">Lot Number *</Label>
                <Input
                  id="lotNumber"
                  value={lotForm.lotNumber}
                  onChange={(e) => setLotForm({ ...lotForm, lotNumber: e.target.value })}
                  className={lotFormErrors.lotNumber ? 'border-destructive' : ''}
                />
                {lotFormErrors.lotNumber && (
                  <p className="text-sm text-destructive">{lotFormErrors.lotNumber}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="externalLot">External Lot (Supplier)</Label>
                <Input
                  id="externalLot"
                  value={lotForm.externalLot}
                  onChange={(e) => setLotForm({ ...lotForm, externalLot: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="productId">Product *</Label>
              <Select
                value={lotForm.productId}
                onValueChange={(value) => setLotForm({ ...lotForm, productId: value })}
              >
                <SelectTrigger className={lotFormErrors.productId ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lotFormErrors.productId && (
                <p className="text-sm text-destructive">{lotFormErrors.productId}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={lotForm.quantity}
                  onChange={(e) => setLotForm({ ...lotForm, quantity: e.target.value })}
                  className={lotFormErrors.quantity ? 'border-destructive' : ''}
                />
                {lotFormErrors.quantity && (
                  <p className="text-sm text-destructive">{lotFormErrors.quantity}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={lotForm.expiryDate}
                  onChange={(e) => setLotForm({ ...lotForm, expiryDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplierName">Supplier Name</Label>
                <Input
                  id="supplierName"
                  value={lotForm.supplierName}
                  onChange={(e) => setLotForm({ ...lotForm, supplierName: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="location">Storage Location</Label>
                <Input
                  id="location"
                  value={lotForm.location}
                  onChange={(e) => setLotForm({ ...lotForm, location: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLotDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLotSubmit} disabled={lotSubmitting}>
              {lotSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {lotFormMode === 'create' ? 'Add Lot' : 'Update Lot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteLotDialog}
        onOpenChange={setDeleteLotDialog}
        title="Delete Material Lot"
        description={`Are you sure you want to delete lot "${selectedLot?.lotNumber}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteLot}
      />
    </div>
  );
}
