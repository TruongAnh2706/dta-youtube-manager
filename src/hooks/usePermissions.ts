import { PermissionKey, StaffRole, RolePermissions } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { usePermissionsContext } from '../contexts/PermissionsContext';

export function usePermissions() {
  const { currentUser } = useAuth();
  const { rolePermissions } = usePermissionsContext();

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
