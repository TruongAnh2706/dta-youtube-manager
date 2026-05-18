import React from 'react';
import { StaffRole, PermissionKey, RolePermissions } from '../types';
import { Shield, Check, X, Info, Save, RotateCcw } from 'lucide-react';
import { useToast } from '../hooks/useToast';

import { supabase } from '../lib/supabase';

interface PermissionSettingsProps {
  rolePermissions: RolePermissions;
  setRolePermissions: React.Dispatch<React.SetStateAction<RolePermissions>>;
}

import { DEFAULT_PERMISSIONS, PERMISSION_GROUPS } from '../constants/permissions';

export function PermissionSettings({ rolePermissions, setRolePermissions }: PermissionSettingsProps) {
  const { showToast } = useToast();
  const roles: StaffRole[] = ['admin', 'manager', 'leader', 'member'];

  const togglePermission = (role: StaffRole, permission: PermissionKey) => {
    setRolePermissions(prev => {
      const current = prev[role];
      if (current.includes(permission)) {
        return { ...prev, [role]: current.filter(p => p !== permission) };
      } else {
        return { ...prev, [role]: [...current, permission] };
      }
    });
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ role_permissions: rolePermissions })
        .eq('id', 'SYSTEM_DEFAULT_ID');
      
      if (error) throw error;
      showToast('Đã lưu phân quyền lên hệ thống thành công!', 'success');
    } catch (err: any) {
      console.error('Lỗi khi lưu phân quyền:', err);
      showToast('Lỗi lưu phân quyền: ' + err.message, 'error');
    }
  };

  const resetToDefault = () => {
    if (confirm('Bạn có chắc chắn muốn khôi phục phân quyền về mặc định?')) {
      setRolePermissions(DEFAULT_PERMISSIONS);
      showToast('Đã khôi phục phân quyền về mặc định.', 'info');
    }
  };

  const getRoleLabel = (role: StaffRole) => {
    switch(role) {
      case 'admin': return 'Quản trị viên';
      case 'manager': return 'Quản lý';
      case 'leader': return 'Trưởng nhóm';
      case 'member': return 'Thành viên';
      default: return role;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Phân quyền chi tiết</h1>
          <p className="text-sm text-gray-500 mt-1">Tùy chỉnh quyền hạn truy cập cho từng vai trò trong hệ thống</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={resetToDefault}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RotateCcw size={16} className="mr-2" /> Khôi phục mặc định
          </button>
          <button 
            onClick={handleSave}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Save size={16} className="mr-2" /> Lưu thay đổi
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[300px]">Quyền hạn / Chức năng</th>
                {roles.map(role => (
                  <th key={role} className="p-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <div className="flex flex-col items-center">
                      <Shield size={16} className={`mb-1 ${role === 'admin' ? 'text-red-500' : role === 'manager' ? 'text-blue-500' : 'text-gray-400'}`} />
                      {getRoleLabel(role)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {PERMISSION_GROUPS.map((group, gIdx) => (
                <React.Fragment key={gIdx}>
                  <tr className="bg-gray-50/50">
                    <td colSpan={roles.length + 1} className="p-3 text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50/30">
                      {group.group}
                    </td>
                  </tr>
                  {group.permissions.map(permission => (
                    <tr key={permission.key} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-900">{permission.label}</span>
                          <span className="text-xs text-gray-500">{permission.description}</span>
                        </div>
                      </td>
                      {roles.map(role => {
                        const hasPermission = rolePermissions[role].includes(permission.key);
                        const isAdmin = role === 'admin';
                        
                        return (
                          <td key={role} className="p-4 text-center">
                            <button
                              disabled={isAdmin} // Admin always has all permissions
                              onClick={() => togglePermission(role, permission.key)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                hasPermission 
                                  ? 'bg-green-100 text-green-600 border border-green-200' 
                                  : 'bg-gray-100 text-gray-300 border border-gray-200'
                              } ${!isAdmin && 'hover:scale-110 active:scale-95'}`}
                            >
                              {hasPermission ? <Check size={18} strokeWidth={3} /> : <X size={18} strokeWidth={3} />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start">
        <Info className="text-amber-600 mr-3 mt-0.5 shrink-0" size={20} />
        <div className="text-sm text-amber-800">
          <p className="font-bold mb-1">Lưu ý quan trọng:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Vai trò <strong>Quản trị viên (Admin)</strong> luôn có toàn bộ quyền hạn và không thể chỉnh sửa.</li>
            <li>Việc thay đổi phân quyền sẽ có hiệu lực ngay lập tức cho tất cả người dùng thuộc vai trò đó.</li>
            <li>Hãy cẩn trọng khi cấp quyền <strong>"Xem Email/Pass"</strong> hoặc <strong>"Quản lý API Keys"</strong>.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
