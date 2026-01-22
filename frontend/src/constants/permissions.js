/**
 * Role-Based Access Control (RBAC) Definitions
 * As defined in FRONTEND_PLAN.md
 * 
 * NOTE: In Dev Mode, all users have admin permissions
 */

export const ROLES = {
  ADMIN: {
    name: 'admin',
    label: 'Administrator',
    permissions: ['*'], // Full access
  },
  SALES_MANAGER: {
    name: 'sales_manager',
    label: 'Sales Manager',
    permissions: [
      'leads.*',
      'deals.*',
      'contacts.*',
      'companies.*',
      'reports.*',
      'users.read',
      'analytics.*',
    ],
  },
  SALES_REP: {
    name: 'sales_rep',
    label: 'Sales Representative',
    permissions: [
      'leads.read',
      'leads.update',
      'deals.*',
      'contacts.*',
      'companies.read',
      'events.read',
    ],
  },
  MARKETING: {
    name: 'marketing',
    label: 'Marketing',
    permissions: [
      'leads.*',
      'campaigns.*',
      'analytics.*',
      'automations.*',
      'events.*',
    ],
  },
  LAB_TECHNICIAN: {
    name: 'lab_technician',
    label: 'Lab Technician',
    permissions: [
      'orders.read',
      'samples.*',
      'webhooks.read',
    ],
  },
  VIEWER: {
    name: 'viewer',
    label: 'Viewer',
    permissions: ['*.read'],
  },
};

/**
 * Check if user has permission
 * In dev mode, always returns true
 */
export const hasPermission = (userPermissions, requiredPermission) => {
  // Dev mode: always allow
  if (userPermissions.includes('*')) return true;
  
  // Check exact match
  if (userPermissions.includes(requiredPermission)) return true;
  
  // Check wildcard permissions
  const [resource, action] = requiredPermission.split('.');
  
  // Check resource.* permission
  if (userPermissions.includes(`${resource}.*`)) return true;
  
  // Check *.action permission
  if (userPermissions.includes(`*.${action}`)) return true;
  
  return false;
};

export default ROLES;
