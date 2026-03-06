// Permission constants for the UNS Platform
export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: 'dashboard.view',
  
  // SCADA
  SCADA_VIEW: 'scada.view',
  SCADA_CONTROL: 'scada.control',
  SCADA_EDIT: 'scada.edit',
  SCADA_CONFIG: 'scada.config',
  
  // MES
  MES_VIEW: 'mes.view',
  MES_EDIT: 'mes.edit',
  
  // Recipes
  RECIPES_VIEW: 'recipes.view',
  RECIPES_EDIT: 'recipes.edit',
  RECIPES_APPROVE: 'recipes.approve',
  
  // Tags
  TAGS_VIEW: 'tags.view',
  TAGS_EDIT: 'tags.edit',
  
  // Batches
  BATCHES_VIEW: 'batches.view',
  BATCHES_CONTROL: 'batches.control',
  
  // Monitoring
  MONITORING_VIEW: 'monitoring.view',
  MONITORING_EDIT: 'monitoring.edit',
  
  // Alarms
  ALARMS_VIEW: 'alarms.view',
  ALARMS_ACKNOWLEDGE: 'alarms.acknowledge',
  ALARMS_CONFIG: 'alarms.config',
  
  // Admin
  ADMIN_VIEW: 'admin.view',
  ADMIN_USERS_READ: 'admin.users.read',
  ADMIN_USERS_CREATE: 'admin.users.create',
  ADMIN_USERS_EDIT: 'admin.users.edit',
  ADMIN_USERS_DELETE: 'admin.users.delete',
  ADMIN_ROLES_READ: 'admin.roles.read',
  ADMIN_ROLES_CREATE: 'admin.roles.create',
  ADMIN_ROLES_EDIT: 'admin.roles.edit',
  ADMIN_ROLES_DELETE: 'admin.roles.delete',
  ADMIN_SETTINGS: 'admin.settings',
  ADMIN_AUDIT: 'admin.audit',
  
  // Hierarchy
  HIERARCHY_VIEW: 'hierarchy.view',
  HIERARCHY_EDIT: 'hierarchy.edit',
  
  // Traceability
  TRACEABILITY_VIEW: 'traceability.view',
  TRACEABILITY_EDIT: 'traceability.edit',
  
  // Edge
  EDGE_VIEW: 'edge.view',
  EDGE_CONFIG: 'edge.config',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
