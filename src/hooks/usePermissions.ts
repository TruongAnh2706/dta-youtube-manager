import { PermissionKey, StaffRole, RolePermissions } from '../types';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_PERMISSIONS: RolePermissions = {
  admin: [
    'dashboard_view', 'topics_view', 'topics_edit', 'sources_view', 'sources_edit', 'sources_analyze',
    'channels_view', 'channels_edit', 'channels_view_sensitive', 'channels_manage_proxy',
    'staff_view', 'staff_edit', 'staff_view_salary', 'calendar_view', 'calendar_edit', 'calendar_view_all', 'calendar_delete',
    'finance_view', 'finance_edit', 'finance_view_accounts', 'copyright_view', 'copyright_edit',
    'assets_view', 'assets_edit', 'tasks_view', 'tasks_edit', 'tasks_claim',
    'emails_view', 'emails_edit',
    'settings_view', 'settings_edit_keys', 'settings_edit_permissions'
  ],
  manager: [
    'dashboard_view', 'topics_view', 'topics_edit', 'sources_view', 'sources_edit', 'sources_analyze',
    'channels_view', 'channels_edit', 'emails_view', 'emails_edit', 'staff_view', 'calendar_view', 'calendar_edit', 'calendar_view_all',
    'finance_view', 'finance_edit', 'copyright_view', 'assets_view', 'assets_edit', 'tasks_view', 'tasks_edit', 'tasks_claim', 'settings_view'
  ],
  leader: [
    'dashboard_view', 'topics_view', 'sources_view', 'channels_view', 'emails_view', 'calendar_view', 'calendar_edit',
    'calendar_view_all', 'copyright_view', 'assets_view', 'tasks_view', 'tasks_edit', 'tasks_claim'
  ],
  member: [
    'dashboard_view', 'channels_view', 'channels_edit', 'emails_view', 'sources_view', 'calendar_view', 'calendar_edit', 'assets_view', 'tasks_view', 'tasks_claim'
  ]
};

export function usePermissions(dbRolePermissions?: RolePermissions) {
  const { currentUser } = useAuth();
  // P1.1: Ưu tiên permissions từ DB (systemSettings), fallback dùng DEFAULT
  const rolePermissions = dbRolePermissions || DEFAULT_PERMISSIONS;

  const hasPermission = (permission: PermissionKey): boolean => {
    if (!currentUser) return false;
    // Admin always has all permissions
    if (currentUser.role === 'admin') return true;

    const permissions = rolePermissions[currentUser.role] || [];
    return permissions.includes(permission);
  };

  const hasAnyPermission = (permissions: PermissionKey[]): boolean => {
    return permissions.some(p => hasPermission(p));
  };

  return {
    hasPermission,
    hasAnyPermission,
    role: currentUser?.role,
    permissions: currentUser ? (rolePermissions[currentUser.role] || []) : []
  };
}
