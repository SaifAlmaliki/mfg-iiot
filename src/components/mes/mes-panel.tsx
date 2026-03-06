'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Switch } from '@/components/ui/switch';
import {
  ClipboardList,
  Plus,
  Play,
  Pause,
  Square,
  CheckCircle,
  Clock,
  Package,
  Settings,
  FileText,
  ArrowRight,
  Calendar,
  User,
  Trash2,
  Edit,
  Eye,
  Loader2,
  AlertCircle,
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

interface Recipe {
  id: string;
  name: string;
  version: string;
  status: string;
  productId: string | null;
  product?: Product;
  description?: string | null;
  parameters: any;
  steps: any;
}

interface WorkCenter {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface ProductionOrder {
  id: string;
  orderNumber: string;
  externalId?: string | null;
  status: string;
  quantity: number;
  producedQty: number;
  scrapQty: number;
  plannedStart?: Date | null;
  plannedEnd?: Date | null;
  actualStart?: Date | null;
  actualEnd?: Date | null;
  priority: number;
  notes?: string | null;
  workCenterId?: string | null;
  workCenter?: WorkCenter | null;
  recipeId?: string | null;
  recipe?: Recipe | null;
}

interface MaterialLot {
  id: string;
  lotNumber: string;
  externalLot?: string | null;
  quantity: number;
  remainingQty: number;
  status: string;
  expiryDate?: Date | null;
  receivedDate: Date;
  supplierName?: string | null;
  location?: string | null;
  productId: string;
  product: Product;
}

// Form validation helper
function validateRequired(value: any, fieldName: string): string | null {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return `${fieldName} is required`;
  }
  return null;
}

export function MesPanel() {
  // State
  const [activeTab, setActiveTab] = useState('orders');
  
  // Orders state
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [orderFormMode, setOrderFormMode] = useState<'create' | 'edit'>('create');
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);
  const [orderFormErrors, setOrderFormErrors] = useState<Record<string, string>>({});
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [deleteOrderDialog, setDeleteOrderDialog] = useState(false);
  
  // Recipes state
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false);
  const [recipeFormMode, setRecipeFormMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipeFormErrors, setRecipeFormErrors] = useState<Record<string, string>>({});
  const [recipeSubmitting, setRecipeSubmitting] = useState(false);
  const [deleteRecipeDialog, setDeleteRecipeDialog] = useState(false);
  const [approvalDialog, setApprovalDialog] = useState(false);
  
  // Materials & Lots state
  const [products, setProducts] = useState<Product[]>([]);
  const [lots, setLots] = useState<MaterialLot[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [lotDialogOpen, setLotDialogOpen] = useState(false);
  const [lotFormErrors, setLotFormErrors] = useState<Record<string, string>>({});
  const [lotSubmitting, setLotSubmitting] = useState(false);
  
  // Work centers for order assignment
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  
  // Order form state
  const [orderForm, setOrderForm] = useState({
    orderNumber: '',
    externalId: '',
    quantity: '',
    priority: '3',
    plannedStart: '',
    plannedEnd: '',
    notes: '',
    workCenterId: '',
    recipeId: '',
  });
  
  // Recipe form state
  const [recipeForm, setRecipeForm] = useState({
    name: '',
    version: '',
    description: '',
    productId: '',
    status: 'DRAFT',
    temperature: '',
    pressure: '',
    reactionTime: '',
    coolingTime: '',
    stepsJson: '',
  });
  
  // Lot form state
  const [lotForm, setLotForm] = useState({
    lotNumber: '',
    externalLot: '',
    productId: '',
    quantity: '',
    supplierName: '',
    location: '',
    expiryDate: '',
  });

  // Fetch functions
  const fetchOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      const response = await fetch('/api/orders');
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const fetchRecipes = useCallback(async () => {
    try {
      setRecipesLoading(true);
      const response = await fetch('/api/recipes');
      if (!response.ok) throw new Error('Failed to fetch recipes');
      const data = await response.json();
      setRecipes(data);
    } catch (error) {
      console.error('Error fetching recipes:', error);
      toast.error('Failed to load recipes');
    } finally {
      setRecipesLoading(false);
    }
  }, []);

  const fetchMaterials = useCallback(async () => {
    try {
      setMaterialsLoading(true);
      const [productsRes, lotsRes, workCentersRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/lots'),
        fetch('/api/workcenters'),
      ]);
      
      if (productsRes.ok) setProducts(await productsRes.json());
      if (lotsRes.ok) setLots(await lotsRes.json());
      if (workCentersRes.ok) setWorkCenters(await workCentersRes.json());
    } catch (error) {
      console.error('Error fetching materials:', error);
      toast.error('Failed to load materials');
    } finally {
      setMaterialsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchOrders();
    fetchRecipes();
    fetchMaterials();
  }, [fetchOrders, fetchRecipes, fetchMaterials]);

  // Status color helper
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
      case 'RUNNING':
      case 'ACTIVE':
        return 'bg-green-500';
      case 'RELEASED':
      case 'APPROVED':
        return 'bg-blue-500';
      case 'COMPLETED':
        return 'bg-slate-500';
      case 'CREATED':
      case 'DRAFT':
        return 'bg-yellow-500';
      case 'HELD':
        return 'bg-orange-500';
      case 'ABORTED':
      case 'CANCELLED':
        return 'bg-red-500';
      default:
        return 'bg-slate-500';
    }
  };

  // ============================================
  // Order CRUD Operations
  // ============================================

  const resetOrderForm = () => {
    setOrderForm({
      orderNumber: `PO-${new Date().getFullYear()}-${String(orders.length + 1).padStart(3, '0')}`,
      externalId: '',
      quantity: '',
      priority: '3',
      plannedStart: '',
      plannedEnd: '',
      notes: '',
      workCenterId: '',
      recipeId: '',
    });
    setOrderFormErrors({});
  };

  const openCreateOrderDialog = () => {
    resetOrderForm();
    setOrderFormMode('create');
    setSelectedOrder(null);
    setOrderDialogOpen(true);
  };

  const openEditOrderDialog = (order: ProductionOrder) => {
    setOrderForm({
      orderNumber: order.orderNumber,
      externalId: order.externalId || '',
      quantity: String(order.quantity),
      priority: String(order.priority),
      plannedStart: order.plannedStart ? new Date(order.plannedStart).toISOString().slice(0, 16) : '',
      plannedEnd: order.plannedEnd ? new Date(order.plannedEnd).toISOString().slice(0, 16) : '',
      notes: order.notes || '',
      workCenterId: order.workCenterId || '',
      recipeId: order.recipeId || '',
    });
    setOrderFormMode('edit');
    setSelectedOrder(order);
    setOrderFormErrors({});
    setOrderDialogOpen(true);
  };

  const validateOrderForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!orderForm.orderNumber.trim()) {
      errors.orderNumber = 'Order number is required';
    }
    if (!orderForm.quantity || parseFloat(orderForm.quantity) <= 0) {
      errors.quantity = 'Valid quantity is required';
    }
    if (!orderForm.workCenterId) {
      errors.workCenterId = 'Work center is required';
    }
    
    setOrderFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOrderSubmit = async () => {
    if (!validateOrderForm()) return;
    
    setOrderSubmitting(true);
    try {
      const url = orderFormMode === 'create' ? '/api/orders' : `/api/orders/${selectedOrder?.id}`;
      const method = orderFormMode === 'create' ? 'POST' : 'PUT';
      
      const body = {
        orderNumber: orderForm.orderNumber,
        externalId: orderForm.externalId || null,
        quantity: parseFloat(orderForm.quantity),
        priority: parseInt(orderForm.priority),
        plannedStart: orderForm.plannedStart ? new Date(orderForm.plannedStart) : null,
        plannedEnd: orderForm.plannedEnd ? new Date(orderForm.plannedEnd) : null,
        notes: orderForm.notes || null,
        workCenterId: orderForm.workCenterId || null,
        recipeId: orderForm.recipeId || null,
        status: orderFormMode === 'create' ? 'CREATED' : selectedOrder?.status,
      };
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save order');
      }
      
      toast.success(orderFormMode === 'create' ? 'Order created successfully' : 'Order updated successfully');
      setOrderDialogOpen(false);
      fetchOrders();
    } catch (error: any) {
      console.error('Error saving order:', error);
      toast.error(error.message || 'Failed to save order');
    } finally {
      setOrderSubmitting(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;
    
    try {
      const response = await fetch(`/api/orders/${selectedOrder.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete order');
      
      toast.success('Order deleted successfully');
      setDeleteOrderDialog(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Failed to delete order');
    }
  };

  const handleOrderStatusChange = async (order: ProductionOrder, newStatus: string) => {
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: newStatus,
          actualStart: newStatus === 'IN_PROGRESS' ? new Date() : order.actualStart,
          actualEnd: newStatus === 'COMPLETED' ? new Date() : order.actualEnd,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to update order status');
      
      toast.success(`Order ${newStatus.toLowerCase().replace('_', ' ')}`);
      fetchOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    }
  };

  // ============================================
  // Recipe CRUD Operations
  // ============================================

  const resetRecipeForm = () => {
    setRecipeForm({
      name: '',
      version: 'v1.0',
      description: '',
      productId: '',
      status: 'DRAFT',
      temperature: '',
      pressure: '',
      reactionTime: '',
      coolingTime: '',
      stepsJson: JSON.stringify([
        { step: 1, name: 'Charge Raw Materials', duration: 15 },
        { step: 2, name: 'Heat to Reaction Temperature', duration: 20 },
        { step: 3, name: 'Reaction Phase', duration: 60 },
        { step: 4, name: 'Cooling', duration: 30 },
        { step: 5, name: 'Discharge', duration: 15 },
      ], null, 2),
    });
    setRecipeFormErrors({});
  };

  const openCreateRecipeDialog = () => {
    resetRecipeForm();
    setRecipeFormMode('create');
    setSelectedRecipe(null);
    setRecipeDialogOpen(true);
  };

  const openEditRecipeDialog = (recipe: Recipe, mode: 'edit' | 'view' = 'edit') => {
    const params = recipe.parameters || {};
    setRecipeForm({
      name: recipe.name,
      version: recipe.version,
      description: recipe.description || '',
      productId: recipe.productId || '',
      status: recipe.status,
      temperature: String(params.temperature || ''),
      pressure: String(params.pressure || ''),
      reactionTime: String(params.reactionTime || ''),
      coolingTime: String(params.coolingTime || ''),
      stepsJson: JSON.stringify(recipe.steps || [], null, 2),
    });
    setRecipeFormMode(mode);
    setSelectedRecipe(recipe);
    setRecipeFormErrors({});
    setRecipeDialogOpen(true);
  };

  const validateRecipeForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!recipeForm.name.trim()) {
      errors.name = 'Recipe name is required';
    }
    if (!recipeForm.version.trim()) {
      errors.version = 'Version is required';
    }
    
    // Validate JSON steps
    try {
      if (recipeForm.stepsJson.trim()) {
        JSON.parse(recipeForm.stepsJson);
      }
    } catch {
      errors.stepsJson = 'Invalid JSON format for steps';
    }
    
    setRecipeFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRecipeSubmit = async () => {
    if (!validateRecipeForm()) return;
    
    setRecipeSubmitting(true);
    try {
      const url = recipeFormMode === 'create' ? '/api/recipes' : `/api/recipes/${selectedRecipe?.id}`;
      const method = recipeFormMode === 'create' ? 'POST' : 'PUT';
      
      const steps = recipeForm.stepsJson.trim() ? JSON.parse(recipeForm.stepsJson) : [];
      
      const body = {
        name: recipeForm.name,
        version: recipeForm.version,
        description: recipeForm.description || null,
        productId: recipeForm.productId || null,
        status: recipeForm.status,
        parameters: {
          temperature: recipeForm.temperature ? parseFloat(recipeForm.temperature) : null,
          pressure: recipeForm.pressure ? parseFloat(recipeForm.pressure) : null,
          reactionTime: recipeForm.reactionTime ? parseInt(recipeForm.reactionTime) : null,
          coolingTime: recipeForm.coolingTime ? parseInt(recipeForm.coolingTime) : null,
        },
        steps,
      };
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save recipe');
      }
      
      toast.success(recipeFormMode === 'create' ? 'Recipe created successfully' : 'Recipe updated successfully');
      setRecipeDialogOpen(false);
      fetchRecipes();
    } catch (error: any) {
      console.error('Error saving recipe:', error);
      toast.error(error.message || 'Failed to save recipe');
    } finally {
      setRecipeSubmitting(false);
    }
  };

  const handleRecipeApproval = async (action: 'approve' | 'activate') => {
    if (!selectedRecipe) return;
    
    try {
      const newStatus = action === 'approve' ? 'APPROVED' : 'ACTIVE';
      const response = await fetch(`/api/recipes/${selectedRecipe.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: newStatus,
          approvedAt: action === 'approve' ? new Date() : undefined,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to update recipe status');
      
      toast.success(`Recipe ${action === 'approve' ? 'approved' : 'activated'} successfully`);
      setApprovalDialog(false);
      fetchRecipes();
    } catch (error) {
      console.error('Error updating recipe:', error);
      toast.error('Failed to update recipe status');
    }
  };

  const handleDeleteRecipe = async () => {
    if (!selectedRecipe) return;
    
    try {
      const response = await fetch(`/api/recipes/${selectedRecipe.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete recipe');
      
      toast.success('Recipe deleted successfully');
      setDeleteRecipeDialog(false);
      setSelectedRecipe(null);
      fetchRecipes();
    } catch (error) {
      console.error('Error deleting recipe:', error);
      toast.error('Failed to delete recipe');
    }
  };

  // ============================================
  // Material Lot Operations
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
    });
    setLotFormErrors({});
  };

  const openCreateLotDialog = () => {
    resetLotForm();
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
      const quantity = parseFloat(lotForm.quantity);
      
      const response = await fetch('/api/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotNumber: lotForm.lotNumber,
          externalLot: lotForm.externalLot || null,
          productId: lotForm.productId,
          quantity,
          remainingQty: quantity,
          supplierName: lotForm.supplierName || null,
          location: lotForm.location || null,
          expiryDate: lotForm.expiryDate ? new Date(lotForm.expiryDate) : null,
          status: 'AVAILABLE',
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create lot');
      }
      
      toast.success('Material lot created successfully');
      setLotDialogOpen(false);
      fetchMaterials();
    } catch (error: any) {
      console.error('Error creating lot:', error);
      toast.error(error.message || 'Failed to create lot');
    } finally {
      setLotSubmitting(false);
    }
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-emerald-500" />
            <span className="hidden sm:inline">Manufacturing Execution System</span>
            <span className="sm:hidden">MES</span>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Orders, recipes, batches, and materials management</p>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3 md:space-y-4">
        <ScrollArea className="w-full">
          <TabsList className="w-full sm:w-auto flex gap-1">
            <TabsTrigger value="orders" className="text-xs md:text-sm px-3 md:px-4">Orders</TabsTrigger>
            <TabsTrigger value="recipes" className="text-xs md:text-sm px-3 md:px-4">Recipes</TabsTrigger>
            <TabsTrigger value="materials" className="text-xs md:text-sm px-3 md:px-4">Materials</TabsTrigger>
          </TabsList>
        </ScrollArea>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-3 md:space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-xs md:text-sm text-muted-foreground">
              {orders.length} orders
            </div>
            <Button onClick={openCreateOrderDialog} size="sm" className="h-8 md:h-9">
              <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-2" />
              <span className="hidden md:inline">New Order</span>
              <span className="md:hidden">New</span>
            </Button>
          </div>

          <Card>
            <CardContent className="p-0 md:p-6">
              {ordersLoading ? (
                <div className="flex items-center justify-center py-6 md:py-8">
                  <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" />
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-6 md:py-8 text-muted-foreground text-sm">
                  No orders found. Create your first order.
                </div>
              ) : (
                <ScrollArea className="w-full">
                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Recipe</TableHead>
                      <TableHead>Work Center</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium text-xs md:text-sm">{order.orderNumber}</TableCell>
                        <TableCell className="text-xs md:text-sm hidden md:table-cell">{order.recipe?.name || '-'} {order.recipe?.version}</TableCell>
                        <TableCell className="text-xs md:text-sm hidden sm:table-cell">{order.workCenter?.name || '-'}</TableCell>
                        <TableCell className="text-xs md:text-sm">
                          <span className="sm:hidden">{order.producedQty}/{order.quantity}</span>
                          <span className="hidden sm:inline">{order.producedQty} / {order.quantity}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 md:gap-2">
                            <Progress 
                              value={order.quantity > 0 ? (order.producedQty / order.quantity) * 100 : 0} 
                              className="w-12 md:w-20 h-1.5 md:h-2" 
                            />
                            <span className="text-[10px] md:text-xs text-muted-foreground">
                              {order.quantity > 0 ? Math.round((order.producedQty / order.quantity) * 100) : 0}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getStatusColor(order.status)} text-[10px] md:text-xs`}>
                            {order.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{order.priority}</TableCell>
                        <TableCell>
                          <div className="flex gap-0.5 md:gap-1">
                            {order.status === 'CREATED' && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="h-7 text-[10px] md:text-xs px-2 md:px-3"
                                onClick={() => handleOrderStatusChange(order, 'RELEASED')}
                              >
                                Release
                              </Button>
                            )}
                            {order.status === 'RELEASED' && (
                              <Button 
                                size="sm" 
                                variant="default"
                                className="h-7 text-[10px] md:text-xs px-2 md:px-3"
                                onClick={() => handleOrderStatusChange(order, 'IN_PROGRESS')}
                              >
                                <Play className="w-3 h-3 md:mr-1" />
                                <span className="hidden md:inline">Start</span>
                              </Button>
                            )}
                            {order.status === 'IN_PROGRESS' && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="h-7 text-[10px] md:text-xs px-2 md:px-3"
                                  onClick={() => handleOrderStatusChange(order, 'HELD')}
                                >
                                  <Pause className="w-3 h-3" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="default"
                                  className="h-7 text-[10px] md:text-xs px-2 md:px-3"
                                  onClick={() => handleOrderStatusChange(order, 'COMPLETED')}
                                >
                                  <CheckCircle className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                            {order.status === 'HELD' && (
                              <Button 
                                size="sm" 
                                variant="default"
                                className="h-7 text-[10px] md:text-xs px-2 md:px-3"
                                onClick={() => handleOrderStatusChange(order, 'IN_PROGRESS')}
                              >
                                <Play className="w-3 h-3" />
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => openEditOrderDialog(order)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive"
                              onClick={() => {
                                setSelectedOrder(order);
                                setDeleteOrderDialog(true);
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
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recipes Tab */}
        <TabsContent value="recipes" className="space-y-3 md:space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="text-xs md:text-sm text-muted-foreground">
              {recipes.length} recipes
            </div>
            <Button onClick={openCreateRecipeDialog} size="sm" className="h-8 md:h-9">
              <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-2" />
              <span className="hidden md:inline">New Recipe</span>
              <span className="md:hidden">New</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {recipesLoading ? (
              <div className="col-span-full flex items-center justify-center py-6 md:py-8">
                <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" />
              </div>
            ) : recipes.length === 0 ? (
              <div className="col-span-full text-center py-6 md:py-8 text-muted-foreground text-sm">
                No recipes found. Create your first recipe.
              </div>
            ) : (
              recipes.map((recipe) => (
                <Card key={recipe.id} className="cursor-pointer hover:shadow-md active:scale-[0.98] transition-all">
                  <CardHeader className="p-3 md:p-6">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm md:text-lg">{recipe.name}</CardTitle>
                      <Badge className={`${getStatusColor(recipe.status)} text-[10px] md:text-xs`}>{recipe.status}</Badge>
                    </div>
                    <CardDescription className="text-xs md:text-sm">{recipe.version} • {recipe.product?.code || 'No product'}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-3 md:p-6 pt-0">
                    <p className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-4 line-clamp-2">
                      {recipe.description || 'No description'}
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => openEditRecipeDialog(recipe, 'view')}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                      {recipe.status !== 'ACTIVE' && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => openEditRecipeDialog(recipe, 'edit')}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                      )}
                      {recipe.status === 'DRAFT' && (
                        <Button 
                          size="sm" 
                          variant="default" 
                          className="flex-1"
                          onClick={() => {
                            setSelectedRecipe(recipe);
                            setApprovalDialog(true);
                          }}
                        >
                          Approve
                        </Button>
                      )}
                      {recipe.status === 'APPROVED' && (
                        <Button 
                          size="sm" 
                          variant="default" 
                          className="flex-1"
                          onClick={() => {
                            setSelectedRecipe(recipe);
                            setApprovalDialog(true);
                          }}
                        >
                          Activate
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Materials Tab */}
        <TabsContent value="materials" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Products */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Products</CardTitle>
                    <CardDescription>Product definitions and types</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => {/* TODO: Add product dialog */}}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Product
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {materialsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Unit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.slice(0, 10).map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.code}</TableCell>
                          <TableCell>{product.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{product.productType}</Badge>
                          </TableCell>
                          <TableCell>{product.unit || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Material Lots */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Material Lots</CardTitle>
                    <CardDescription>Inventory lots and traceability</CardDescription>
                  </div>
                  <Button size="sm" onClick={openCreateLotDialog}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Lot
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {materialsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lot #</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Qty / Remaining</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lots.slice(0, 10).map((lot) => (
                        <TableRow key={lot.id}>
                          <TableCell className="font-medium">{lot.lotNumber}</TableCell>
                          <TableCell>{lot.product.name}</TableCell>
                          <TableCell>{lot.quantity} / {lot.remainingQty}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={lot.status === 'AVAILABLE' ? 'default' : 'outline'}
                              className={lot.status === 'AVAILABLE' ? 'bg-green-500' : ''}
                            >
                              {lot.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Order Dialog */}
      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {orderFormMode === 'create' ? 'Create Production Order' : 'Edit Production Order'}
            </DialogTitle>
            <DialogDescription>
              {orderFormMode === 'create' 
                ? 'Enter details for the new production order' 
                : 'Update production order details'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="orderNumber">Order Number *</Label>
                <Input
                  id="orderNumber"
                  value={orderForm.orderNumber}
                  onChange={(e) => setOrderForm({ ...orderForm, orderNumber: e.target.value })}
                  className={orderFormErrors.orderNumber ? 'border-destructive' : ''}
                />
                {orderFormErrors.orderNumber && (
                  <p className="text-sm text-destructive">{orderFormErrors.orderNumber}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="externalId">External ID (ERP)</Label>
                <Input
                  id="externalId"
                  value={orderForm.externalId}
                  onChange={(e) => setOrderForm({ ...orderForm, externalId: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="recipeId">Recipe</Label>
                <Select
                  value={orderForm.recipeId}
                  onValueChange={(value) => setOrderForm({ ...orderForm, recipeId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select recipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {recipes.filter(r => r.status === 'ACTIVE').map((recipe) => (
                      <SelectItem key={recipe.id} value={recipe.id}>
                        {recipe.name} {recipe.version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="workCenterId">Work Center *</Label>
                <Select
                  value={orderForm.workCenterId}
                  onValueChange={(value) => setOrderForm({ ...orderForm, workCenterId: value })}
                >
                  <SelectTrigger className={orderFormErrors.workCenterId ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select work center" />
                  </SelectTrigger>
                  <SelectContent>
                    {workCenters.map((wc) => (
                      <SelectItem key={wc.id} value={wc.id}>
                        {wc.name} ({wc.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {orderFormErrors.workCenterId && (
                  <p className="text-sm text-destructive">{orderFormErrors.workCenterId}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={orderForm.quantity}
                  onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
                  className={orderFormErrors.quantity ? 'border-destructive' : ''}
                />
                {orderFormErrors.quantity && (
                  <p className="text-sm text-destructive">{orderFormErrors.quantity}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={orderForm.priority}
                  onValueChange={(value) => setOrderForm({ ...orderForm, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Highest</SelectItem>
                    <SelectItem value="2">2 - High</SelectItem>
                    <SelectItem value="3">3 - Normal</SelectItem>
                    <SelectItem value="4">4 - Low</SelectItem>
                    <SelectItem value="5">5 - Lowest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plannedStart">Planned Start</Label>
                <Input
                  id="plannedStart"
                  type="datetime-local"
                  value={orderForm.plannedStart}
                  onChange={(e) => setOrderForm({ ...orderForm, plannedStart: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="plannedEnd">Planned End</Label>
                <Input
                  id="plannedEnd"
                  type="datetime-local"
                  value={orderForm.plannedEnd}
                  onChange={(e) => setOrderForm({ ...orderForm, plannedEnd: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={orderForm.notes}
                onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleOrderSubmit} disabled={orderSubmitting}>
              {orderSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {orderFormMode === 'create' ? 'Create Order' : 'Update Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recipe Dialog */}
      <Dialog open={recipeDialogOpen} onOpenChange={setRecipeDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {recipeFormMode === 'create' ? 'Create Recipe' : 
               recipeFormMode === 'view' ? 'View Recipe' : 'Edit Recipe'}
            </DialogTitle>
            <DialogDescription>
              {recipeFormMode === 'create' 
                ? 'Define a new production recipe' 
                : recipeFormMode === 'view'
                ? 'View recipe details'
                : 'Update recipe configuration'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="recipeName">Recipe Name *</Label>
                <Input
                  id="recipeName"
                  value={recipeForm.name}
                  onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })}
                  disabled={recipeFormMode === 'view'}
                  className={recipeFormErrors.name ? 'border-destructive' : ''}
                />
                {recipeFormErrors.name && (
                  <p className="text-sm text-destructive">{recipeFormErrors.name}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="version">Version *</Label>
                <Input
                  id="version"
                  value={recipeForm.version}
                  onChange={(e) => setRecipeForm({ ...recipeForm, version: e.target.value })}
                  disabled={recipeFormMode === 'view'}
                  className={recipeFormErrors.version ? 'border-destructive' : ''}
                />
                {recipeFormErrors.version && (
                  <p className="text-sm text-destructive">{recipeFormErrors.version}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={recipeForm.status}
                  onValueChange={(value) => setRecipeForm({ ...recipeForm, status: value })}
                  disabled={recipeFormMode === 'view'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="productId">Product</Label>
                <Select
                  value={recipeForm.productId}
                  onValueChange={(value) => setRecipeForm({ ...recipeForm, productId: value })}
                  disabled={recipeFormMode === 'view'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.filter(p => p.productType === 'FINISHED_GOOD' || p.productType === 'INTERMEDIATE').map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={recipeForm.description}
                  onChange={(e) => setRecipeForm({ ...recipeForm, description: e.target.value })}
                  disabled={recipeFormMode === 'view'}
                />
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-3">Process Parameters</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature (°C)</Label>
                  <Input
                    id="temperature"
                    type="number"
                    value={recipeForm.temperature}
                    onChange={(e) => setRecipeForm({ ...recipeForm, temperature: e.target.value })}
                    disabled={recipeFormMode === 'view'}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="pressure">Pressure (bar)</Label>
                  <Input
                    id="pressure"
                    type="number"
                    step="0.1"
                    value={recipeForm.pressure}
                    onChange={(e) => setRecipeForm({ ...recipeForm, pressure: e.target.value })}
                    disabled={recipeFormMode === 'view'}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="reactionTime">Reaction Time (min)</Label>
                  <Input
                    id="reactionTime"
                    type="number"
                    value={recipeForm.reactionTime}
                    onChange={(e) => setRecipeForm({ ...recipeForm, reactionTime: e.target.value })}
                    disabled={recipeFormMode === 'view'}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="coolingTime">Cooling Time (min)</Label>
                  <Input
                    id="coolingTime"
                    type="number"
                    value={recipeForm.coolingTime}
                    onChange={(e) => setRecipeForm({ ...recipeForm, coolingTime: e.target.value })}
                    disabled={recipeFormMode === 'view'}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="steps">Recipe Steps (JSON)</Label>
              <Textarea
                id="steps"
                value={recipeForm.stepsJson}
                onChange={(e) => setRecipeForm({ ...recipeForm, stepsJson: e.target.value })}
                disabled={recipeFormMode === 'view'}
                rows={8}
                className={`font-mono text-sm ${recipeFormErrors.stepsJson ? 'border-destructive' : ''}`}
              />
              {recipeFormErrors.stepsJson && (
                <p className="text-sm text-destructive">{recipeFormErrors.stepsJson}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Array of steps with: step (number), name (string), duration (minutes)
              </p>
            </div>
          </div>

          <DialogFooter>
            {recipeFormMode !== 'view' && (
              <>
                <Button variant="outline" onClick={() => setRecipeDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleRecipeSubmit} disabled={recipeSubmitting}>
                  {recipeSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {recipeFormMode === 'create' ? 'Create Recipe' : 'Update Recipe'}
                </Button>
              </>
            )}
            {recipeFormMode === 'view' && (
              <Button onClick={() => setRecipeDialogOpen(false)}>Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Material Lot Dialog */}
      <Dialog open={lotDialogOpen} onOpenChange={setLotDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Material Lot</DialogTitle>
            <DialogDescription>
              Receive new material into inventory
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
                  {products.filter(p => p.productType === 'RAW_MATERIAL').map((product) => (
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
              Add Lot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Order Confirmation */}
      <ConfirmDialog
        open={deleteOrderDialog}
        onOpenChange={setDeleteOrderDialog}
        title="Delete Order"
        description={`Are you sure you want to delete order "${selectedOrder?.orderNumber}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteOrder}
      />

      {/* Delete Recipe Confirmation */}
      <ConfirmDialog
        open={deleteRecipeDialog}
        onOpenChange={setDeleteRecipeDialog}
        title="Delete Recipe"
        description={`Are you sure you want to delete recipe "${selectedRecipe?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteRecipe}
      />

      {/* Recipe Approval Dialog */}
      <Dialog open={approvalDialog} onOpenChange={setApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedRecipe?.status === 'DRAFT' ? 'Approve Recipe' : 'Activate Recipe'}
            </DialogTitle>
            <DialogDescription>
              {selectedRecipe?.status === 'DRAFT' 
                ? 'Approve this recipe to make it available for production planning.'
                : 'Activate this recipe to make it available for production orders.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Recipe: <strong>{selectedRecipe?.name} {selectedRecipe?.version}</strong>
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Current status: <Badge className={getStatusColor(selectedRecipe?.status || '')}>{selectedRecipe?.status}</Badge>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleRecipeApproval(selectedRecipe?.status === 'DRAFT' ? 'approve' : 'activate')}
            >
              {selectedRecipe?.status === 'DRAFT' ? 'Approve' : 'Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
