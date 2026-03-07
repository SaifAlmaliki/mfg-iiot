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
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Users,
  User,
  FileText,
  Plus,
  Edit,
  Trash2,
  Clock,
  ChevronDown,
  ChevronRight,
  Loader2,
  Filter,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useNavigationStore } from '@/lib/store';
import { IntegrationsSettings } from '@/components/admin/integrations-settings';

// Types
interface Site {
  id: string;
  name: string;
  code: string;
}

interface Role {
  id: string;
  name: string;
  code: string;
  permissions: string[];
  description?: string | null;
  isSystem: boolean;
  siteId?: string | null;
  site?: Site | null;
  _count?: { userRoles: number };
}

interface User {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  lastLogin?: Date | null;
  createdAt: Date;
  siteId?: string | null;
  site?: Site | null;
  roles: Role[];
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: any;
  newValue?: any;
  details?: any;
  createdAt: Date;
  userId?: string | null;
  user?: { name: string; email: string } | null;
}

// Permission categories with all available permissions
const permissionCategories = [
  {
    category: 'Dashboard',
    permissions: ['dashboard.view']
  },
  {
    category: 'SCADA',
    permissions: ['scada.view', 'scada.control']
  },
  {
    category: 'MES',
    permissions: ['mes.view', 'mes.edit']
  },
  {
    category: 'Recipes',
    permissions: ['recipes.view', 'recipes.edit', 'recipes.approve']
  },
  {
    category: 'Tags',
    permissions: ['tags.view', 'tags.edit']
  },
  {
    category: 'Batches',
    permissions: ['batches.view', 'batches.control']
  },
  {
    category: 'Monitoring',
    permissions: ['monitoring.view', 'monitoring.edit']
  },
  {
    category: 'Admin',
    permissions: ['admin.view', 'admin.users', 'admin.roles', 'admin.settings']
  },
];

// All permissions flattened (for future use in role editor)
const _allPermissions = permissionCategories.flatMap(c => c.permissions);

export function AdminPanel() {
  const currentModule = useNavigationStore((s) => s.currentModule);
  const setCurrentModule = useNavigationStore((s) => s.setCurrentModule);

  // Tab state; sync with hash (admin/users -> users, admin/integrations -> integrations)
  const [activeTab, setActiveTab] = useState('users');

  useEffect(() => {
    if (currentModule === 'admin' || currentModule === 'admin/users') setActiveTab('users');
    else if (currentModule === 'admin/roles') setActiveTab('roles');
    else if (currentModule === 'admin/audit') setActiveTab('audit');
    else if (currentModule === 'admin/integrations') setActiveTab('integrations');
  }, [currentModule]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const hash = value === 'users' ? 'admin' : `admin/${value}`;
    window.location.hash = hash;
    setCurrentModule(value === 'users' ? 'admin' : `admin/${value}`);
  };
  
  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userFormMode, setUserFormMode] = useState<'create' | 'edit'>('create');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userFormErrors, setUserFormErrors] = useState<Record<string, string>>({});
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [deleteUserDialog, setDeleteUserDialog] = useState(false);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);
  
  // Roles state
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleFormMode, setRoleFormMode] = useState<'create' | 'edit'>('create');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleFormErrors, setRoleFormErrors] = useState<Record<string, string>>({});
  const [roleSubmitting, setRoleSubmitting] = useState(false);
  const [deleteRoleDialog, setDeleteRoleDialog] = useState(false);
  const [deleteRoleLoading, setDeleteRoleLoading] = useState(false);
  
  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditTotal, setAuditTotal] = useState(0);
  
  // Audit filters
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    entityType: '',
    userId: '',
  });
  
  // Sites for dropdowns
  const [sites, setSites] = useState<Site[]>([]);
  
  // User form state
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    siteId: '',
    roleIds: [] as string[],
    isActive: true,
  });
  
  // Role form state
  const [roleForm, setRoleForm] = useState({
    name: '',
    code: '',
    description: '',
    siteId: '',
    permissions: [] as string[],
  });
  
  // Expanded rows for audit log details
  const [expandedAuditRows, setExpandedAuditRows] = useState<Set<string>>(new Set());

  // Fetch functions
  const fetchUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      setRolesLoading(true);
      const response = await fetch('/api/roles');
      if (!response.ok) throw new Error('Failed to fetch roles');
      const data = await response.json();
      setRoles(data);
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Failed to load roles');
    } finally {
      setRolesLoading(false);
    }
  }, []);

  const fetchSites = useCallback(async () => {
    try {
      const response = await fetch('/api/sites');
      if (!response.ok) throw new Error('Failed to fetch sites');
      const data = await response.json();
      setSites(data);
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setAuditLoading(true);
      const params = new URLSearchParams();
      if (auditFilters.action) params.set('action', auditFilters.action);
      if (auditFilters.entityType) params.set('entityType', auditFilters.entityType);
      if (auditFilters.userId) params.set('userId', auditFilters.userId);
      params.set('limit', '100');
      
      const response = await fetch(`/api/audit?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      const data = await response.json();
      setAuditLogs(data.logs || data);
      setAuditTotal(data.total || data.length);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setAuditLoading(false);
    }
  }, [auditFilters]);

  // Initial fetch
  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchSites();
    fetchAuditLogs();
  }, [fetchUsers, fetchRoles, fetchSites, fetchAuditLogs]);

  // ============================================
  // User CRUD Operations
  // ============================================

  const resetUserForm = () => {
    setUserForm({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      siteId: '',
      roleIds: [],
      isActive: true,
    });
    setUserFormErrors({});
  };

  const openCreateUserDialog = () => {
    resetUserForm();
    setUserFormMode('create');
    setSelectedUser(null);
    setUserDialogOpen(true);
  };

  const openEditUserDialog = (user: User) => {
    setUserForm({
      name: user.name,
      email: user.email,
      password: '',
      confirmPassword: '',
      siteId: user.siteId || '',
      roleIds: user.roles.map(r => r.id),
      isActive: user.isActive,
    });
    setUserFormMode('edit');
    setSelectedUser(user);
    setUserFormErrors({});
    setUserDialogOpen(true);
  };

  const validateUserForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!userForm.name.trim()) {
      errors.name = 'Name is required';
    }
    if (!userForm.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email)) {
      errors.email = 'Invalid email format';
    }
    if (userFormMode === 'create') {
      if (!userForm.password) {
        errors.password = 'Password is required';
      } else if (userForm.password.length < 6) {
        errors.password = 'Password must be at least 6 characters';
      }
    }
    if (userForm.password && userForm.password !== userForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setUserFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUserSubmit = async () => {
    if (!validateUserForm()) return;
    
    setUserSubmitting(true);
    try {
      const url = userFormMode === 'create' ? '/api/users' : `/api/users/${selectedUser?.id}`;
      const method = userFormMode === 'create' ? 'POST' : 'PUT';
      
      const body: any = {
        name: userForm.name,
        email: userForm.email,
        siteId: userForm.siteId || null,
        roleIds: userForm.roleIds,
        isActive: userForm.isActive,
      };
      
      if (userForm.password) {
        body.password = userForm.password;
      }
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save user');
      }
      
      toast.success(userFormMode === 'create' ? 'User created successfully' : 'User updated successfully');
      setUserDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast.error(error.message || 'Failed to save user');
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    setDeleteUserLoading(true);
    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
      }
      
      toast.success('User deleted successfully');
      setDeleteUserDialog(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setDeleteUserLoading(false);
    }
  };

  const handleUserActiveToggle = async (user: User) => {
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      
      if (!response.ok) throw new Error('Failed to update user status');
      
      toast.success(`User ${!user.isActive ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('Failed to update user status');
    }
  };

  // ============================================
  // Role CRUD Operations
  // ============================================

  const resetRoleForm = () => {
    setRoleForm({
      name: '',
      code: '',
      description: '',
      siteId: '',
      permissions: [],
    });
    setRoleFormErrors({});
  };

  const openCreateRoleDialog = () => {
    resetRoleForm();
    setRoleFormMode('create');
    setSelectedRole(null);
    setRoleDialogOpen(true);
  };

  const openEditRoleDialog = (role: Role) => {
    setRoleForm({
      name: role.name,
      code: role.code,
      description: role.description || '',
      siteId: role.siteId || '',
      permissions: Array.isArray(role.permissions) ? role.permissions : [],
    });
    setRoleFormMode('edit');
    setSelectedRole(role);
    setRoleFormErrors({});
    setRoleDialogOpen(true);
  };

  const validateRoleForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!roleForm.name.trim()) {
      errors.name = 'Name is required';
    }
    if (!roleForm.code.trim()) {
      errors.code = 'Code is required';
    } else if (!/^[A-Z_]+$/.test(roleForm.code)) {
      errors.code = 'Code must be uppercase letters and underscores only';
    }
    
    setRoleFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRoleSubmit = async () => {
    if (!validateRoleForm()) return;
    
    setRoleSubmitting(true);
    try {
      const url = roleFormMode === 'create' ? '/api/roles' : `/api/roles/${selectedRole?.id}`;
      const method = roleFormMode === 'create' ? 'POST' : 'PUT';
      
      const body = {
        name: roleForm.name,
        code: roleForm.code,
        description: roleForm.description || null,
        siteId: roleForm.siteId || null,
        permissions: roleForm.permissions,
      };
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save role');
      }
      
      toast.success(roleFormMode === 'create' ? 'Role created successfully' : 'Role updated successfully');
      setRoleDialogOpen(false);
      fetchRoles();
    } catch (error: any) {
      console.error('Error saving role:', error);
      toast.error(error.message || 'Failed to save role');
    } finally {
      setRoleSubmitting(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;
    
    setDeleteRoleLoading(true);
    try {
      const response = await fetch(`/api/roles/${selectedRole.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete role');
      }
      
      toast.success('Role deleted successfully');
      setDeleteRoleDialog(false);
      setSelectedRole(null);
      fetchRoles();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      toast.error(error.message || 'Failed to delete role');
    } finally {
      setDeleteRoleLoading(false);
    }
  };

  const togglePermission = (permission: string) => {
    setRoleForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const toggleAllPermissions = (category: string, checked: boolean) => {
    const cat = permissionCategories.find(c => c.category === category);
    if (!cat) return;
    
    setRoleForm(prev => ({
      ...prev,
      permissions: checked
        ? [...new Set([...prev.permissions, ...cat.permissions])]
        : prev.permissions.filter(p => !cat.permissions.includes(p))
    }));
  };

  // ============================================
  // Audit Log Helpers
  // ============================================

  const toggleAuditRow = (id: string) => {
    setExpandedAuditRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getActionBadgeVariant = (action: string): 'default' | 'secondary' | 'destructive' => {
    switch (action.toUpperCase()) {
      case 'CREATE':
        return 'default';
      case 'UPDATE':
        return 'secondary';
      case 'DELETE':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const renderJsonDiff = (oldValue: any, newValue: any) => {
    return (
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <div className="font-semibold text-red-600 dark:text-red-400 mb-1">Previous</div>
          <pre className="bg-red-50 dark:bg-red-950 p-2 rounded overflow-auto max-h-40">
            {oldValue ? JSON.stringify(oldValue, null, 2) : 'null'}
          </pre>
        </div>
        <div>
          <div className="font-semibold text-green-600 dark:text-green-400 mb-1">New</div>
          <pre className="bg-green-50 dark:bg-green-950 p-2 rounded overflow-auto max-h-40">
            {newValue ? JSON.stringify(newValue, null, 2) : 'null'}
          </pre>
        </div>
      </div>
    );
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="flex flex-col min-h-0 flex-1 p-6 gap-6">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-balance">
            <Users className="size-8 text-primary" />
            Administration
          </h1>
          <p className="text-muted-foreground text-pretty">User, role, and audit management</p>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col flex-1 min-h-0 gap-4">
        <TabsList className="shrink-0">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="flex flex-col flex-1 min-h-0 gap-4 mt-0 data-[state=inactive]:hidden">
          <div className="flex justify-between items-center shrink-0">
            <div className="text-sm text-muted-foreground">
              {users.length} users total
            </div>
            <Button onClick={openCreateUserDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>

          <Card className="flex-1 min-h-0 flex flex-col">
            <CardContent className="flex-1 min-h-0 overflow-auto p-6">
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No users found. Create your first user to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="size-8 rounded-full bg-muted flex items-center justify-center">
                              <User className="size-4" />
                            </div>
                            {user.name}
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles.map((role) => (
                              <Badge key={role.id} variant="outline" className="text-xs">
                                {role.name}
                              </Badge>
                            ))}
                            {user.roles.length === 0 && (
                              <span className="text-muted-foreground text-xs">No roles</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{user.site?.name || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={user.isActive}
                              onCheckedChange={() => handleUserActiveToggle(user)}
                            />
                            <Badge variant={user.isActive ? 'default' : 'secondary'}>
                              {user.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
                            <Clock className="size-3" aria-hidden />
                            {user.lastLogin 
                              ? new Date(user.lastLogin).toLocaleString() 
                              : 'Never'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => openEditUserDialog(user)}
                              aria-label={`Edit ${user.name}`}
                            >
                              <Edit className="size-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => {
                                setSelectedUser(user);
                                setDeleteUserDialog(true);
                              }}
                              aria-label={`Delete ${user.name}`}
                            >
                              <Trash2 className="size-4" />
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

        {/* Roles Tab */}
        <TabsContent value="roles" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {roles.length} roles total • System roles cannot be deleted
            </div>
            <Button onClick={openCreateRoleDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Role
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rolesLoading ? (
              <div className="col-span-full flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : roles.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No roles found. Create your first role to get started.
              </div>
            ) : (
              roles.map((role) => (
                <Card key={role.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {role.name}
                        {role.isSystem && (
                          <Badge variant="outline" className="text-xs">System</Badge>
                        )}
                      </CardTitle>
                      <Badge variant="outline">{role.code}</Badge>
                    </div>
                    <CardDescription>
                      {role.description || 'No description'}
                      {role.site && ` • ${role.site.name}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1 mb-4 max-h-24 overflow-y-auto">
                      {Array.isArray(role.permissions) && role.permissions.length > 0 ? (
                        role.permissions.map((perm) => (
                          <Badge key={perm} variant="secondary" className="text-xs">
                            {perm}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">No permissions</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {role._count?.userRoles || 0} user(s)
                      </span>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => openEditRoleDialog(role)}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        {!role.isSystem && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => {
                              setSelectedRole(role);
                              setDeleteRoleDialog(true);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Audit Trail
                  </CardTitle>
                  <CardDescription>
                    Complete history of user actions and system events ({auditTotal} total)
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchAuditLogs}>
                  <Activity className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <Input
                    placeholder="Filter by action (e.g., CREATE, UPDATE, DELETE)"
                    value={auditFilters.action}
                    onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value })}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    placeholder="Filter by entity type (e.g., User, Role)"
                    value={auditFilters.entityType}
                    onChange={(e) => setAuditFilters({ ...auditFilters, entityType: e.target.value })}
                  />
                </div>
                <Button onClick={fetchAuditLogs}>
                  <Filter className="w-4 h-4 mr-1" />
                  Apply
                </Button>
              </div>

              {auditLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No audit logs found.
                </div>
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <>
                          <TableRow 
                            key={log.id} 
                            className="cursor-pointer"
                            onClick={() => toggleAuditRow(log.id)}
                          >
                            <TableCell>
                              {expandedAuditRows.has(log.id) ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {new Date(log.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell>{log.user?.name || 'System'}</TableCell>
                            <TableCell>
                              <Badge variant={getActionBadgeVariant(log.action)}>
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <span className="font-medium">{log.entityType}</span>
                                {log.entityId && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    ({log.entityId.slice(0, 8)}...)
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground max-w-xs truncate">
                              {log.details?.message || '-'}
                            </TableCell>
                          </TableRow>
                          {expandedAuditRows.has(log.id) && (
                            <TableRow key={`${log.id}-details`}>
                              <TableCell colSpan={6} className="bg-muted/50">
                                <div className="p-4 space-y-2">
                                  {log.oldValue || log.newValue ? (
                                    renderJsonDiff(log.oldValue, log.newValue)
                                  ) : (
                                    <p className="text-sm text-muted-foreground">No value changes recorded</p>
                                  )}
                                  {log.details && (
                                    <div className="mt-2">
                                      <div className="font-semibold text-sm mb-1">Details</div>
                                      <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded">
                                        {JSON.stringify(log.details, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-4">
          <IntegrationsSettings />
        </TabsContent>
      </Tabs>

      {/* User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {userFormMode === 'create' ? 'Create User' : 'Edit User'}
            </DialogTitle>
            <DialogDescription>
              {userFormMode === 'create' 
                ? 'Enter details for the new user account' 
                : 'Update user account details'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="userName">Name *</Label>
                <Input
                  id="userName"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className={userFormErrors.name ? 'border-destructive' : ''}
                />
                {userFormErrors.name && (
                  <p className="text-sm text-destructive">{userFormErrors.name}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="userEmail">Email *</Label>
                <Input
                  id="userEmail"
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className={userFormErrors.email ? 'border-destructive' : ''}
                />
                {userFormErrors.email && (
                  <p className="text-sm text-destructive">{userFormErrors.email}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="userPassword">
                  Password {userFormMode === 'create' ? '*' : '(leave empty to keep current)'}
                </Label>
                <Input
                  id="userPassword"
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className={userFormErrors.password ? 'border-destructive' : ''}
                />
                {userFormErrors.password && (
                  <p className="text-sm text-destructive">{userFormErrors.password}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="userConfirmPassword">Confirm Password</Label>
                <Input
                  id="userConfirmPassword"
                  type="password"
                  value={userForm.confirmPassword}
                  onChange={(e) => setUserForm({ ...userForm, confirmPassword: e.target.value })}
                  className={userFormErrors.confirmPassword ? 'border-destructive' : ''}
                />
                {userFormErrors.confirmPassword && (
                  <p className="text-sm text-destructive">{userFormErrors.confirmPassword}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="userSite">Site</Label>
                <Select
                  value={userForm.siteId}
                  onValueChange={(value) => setUserForm({ ...userForm, siteId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name} ({site.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Active Status</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={userForm.isActive}
                    onCheckedChange={(checked) => setUserForm({ ...userForm, isActive: checked })}
                  />
                  <span className="text-sm">{userForm.isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                {roles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No roles available</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {roles.map((role) => (
                      <div key={role.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`role-${role.id}`}
                          checked={userForm.roleIds.includes(role.id)}
                          onCheckedChange={(checked) => {
                            setUserForm(prev => ({
                              ...prev,
                              roleIds: checked 
                                ? [...prev.roleIds, role.id]
                                : prev.roleIds.filter(id => id !== role.id)
                            }));
                          }}
                        />
                        <label htmlFor={`role-${role.id}`} className="text-sm">
                          {role.name}
                          {role.isSystem && <span className="text-xs text-muted-foreground ml-1">(System)</span>}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUserSubmit} disabled={userSubmitting}>
              {userSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {userFormMode === 'create' ? 'Create User' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {roleFormMode === 'create' ? 'Create Role' : 'Edit Role'}
            </DialogTitle>
            <DialogDescription>
              {roleFormMode === 'create' 
                ? 'Define a new role with specific permissions' 
                : 'Update role details and permissions'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roleName">Name *</Label>
                <Input
                  id="roleName"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  className={roleFormErrors.name ? 'border-destructive' : ''}
                />
                {roleFormErrors.name && (
                  <p className="text-sm text-destructive">{roleFormErrors.name}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="roleCode">Code *</Label>
                <Input
                  id="roleCode"
                  value={roleForm.code}
                  onChange={(e) => setRoleForm({ ...roleForm, code: e.target.value.toUpperCase() })}
                  className={roleFormErrors.code ? 'border-destructive' : ''}
                  placeholder="ROLE_CODE"
                />
                {roleFormErrors.code && (
                  <p className="text-sm text-destructive">{roleFormErrors.code}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roleSite">Site</Label>
                <Select
                  value={roleForm.siteId}
                  onValueChange={(value) => setRoleForm({ ...roleForm, siteId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name} ({site.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="roleDescription">Description</Label>
                <Input
                  id="roleDescription"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  placeholder="Role description"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                {permissionCategories.map((category) => {
                  const allSelected = category.permissions.every(p => roleForm.permissions.includes(p));
                  const someSelected = category.permissions.some(p => roleForm.permissions.includes(p));
                  
                  return (
                    <div key={category.category} className="mb-4 last:mb-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Checkbox
                          id={`cat-${category.category}`}
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.dataset.state = someSelected && !allSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked';
                          }}
                          onCheckedChange={(checked) => toggleAllPermissions(category.category, !!checked)}
                        />
                        <label htmlFor={`cat-${category.category}`} className="font-semibold text-sm">
                          {category.category}
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2 ml-6">
                        {category.permissions.map((perm) => (
                          <div key={perm} className="flex items-center space-x-2">
                            <Checkbox
                              id={`perm-${perm}`}
                              checked={roleForm.permissions.includes(perm)}
                              onCheckedChange={() => togglePermission(perm)}
                            />
                            <label htmlFor={`perm-${perm}`} className="text-xs">{perm}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedRole?.isSystem && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-yellow-700 dark:text-yellow-400">
                  This is a system role. Some restrictions may apply.
                </span>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRoleSubmit} disabled={roleSubmitting}>
              {roleSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {roleFormMode === 'create' ? 'Create Role' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <ConfirmDialog
        open={deleteUserDialog}
        onOpenChange={setDeleteUserDialog}
        title="Delete User"
        description={`Are you sure you want to delete "${selectedUser?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        loading={deleteUserLoading}
        onConfirm={handleDeleteUser}
      />

      {/* Delete Role Confirmation */}
      <ConfirmDialog
        open={deleteRoleDialog}
        onOpenChange={setDeleteRoleDialog}
        title="Delete Role"
        description={`Are you sure you want to delete the role "${selectedRole?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        loading={deleteRoleLoading}
        onConfirm={handleDeleteRole}
      />
    </div>
  );
}
