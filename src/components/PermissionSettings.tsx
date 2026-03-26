import React from 'react';
import { StaffRole, PermissionKey, RolePermissions } from '../types';
import { Shield, Check, X, Info, Save, RotateCcw } from 'lucide-react';
import { useToast } from '../hooks/useToast';

import { supabase } from '../lib/supabase';

interface PermissionSettingsProps {
  rolePermissions: RolePermissions;
  setRolePermissions: React.Dispatch<React.SetStateAction<RolePermissions>>;
}

const PERMISSION_GROUPS: { group: string; permissions: { key: PermissionKey; label: string; description: string }[] }[] = [

  {
    group: 'Tổng quan & Dashboard',
    permissions: [
      { key: 'dashboard_view', label: 'Xem Dashboard', description: 'Cho phép xem biểu đồ và số liệu tổng quát' },
      { key: 'reports_view_all', label: 'Dashboard Báo cáo', description: 'Xem Báo cáo Tổng hợp của mọi nhân sự' },
    ]
  },
  {
    group: 'Quản lý Chủ đề (Topics)',
    permissions: [
      { key: 'topics_view', label: 'Xem danh sách', description: 'Xem danh sách các chủ đề nội dung' },
      { key: 'topics_edit', label: 'Thêm/Sửa/Xóa', description: 'Quản lý thông tin chi tiết các chủ đề' },
    ]
  },
  {
    group: 'Nguồn tham khảo (Sources)',
    permissions: [
      { key: 'sources_view', label: 'Xem nguồn', description: 'Xem danh sách các kênh đối thủ/tham khảo' },
      { key: 'sources_edit', label: 'Quản lý nguồn', description: 'Thêm hoặc chỉnh sửa thông tin nguồn' },
      { key: 'sources_analyze', label: 'Phân tích AI', description: 'Sử dụng AI để phân tích nội dung nguồn' },
    ]
  },
  {
    group: 'Kênh & Email thô (Raw)',
    permissions: [
      { key: 'emails_view', label: 'Xem Email Raw', description: 'Xem danh sách các email thô chưa lập kênh' },
      { key: 'emails_edit', label: 'Quản lý Email Raw', description: 'Thêm, sửa trạng thái, giao việc lập kênh' },
    ]
  },
  {
    group: 'Quản lý Kênh (Channels)',
    permissions: [
      { key: 'channels_view', label: 'Xem danh sách kênh', description: 'Xem thông tin cơ bản các kênh đang quản lý' },
      { key: 'channels_edit', label: 'Chỉnh sửa kênh', description: 'Thay đổi thông tin, trạng thái kênh' },
      { key: 'channels_view_sensitive', label: 'Xem Email/Pass', description: 'Xem thông tin đăng nhập nhạy cảm' },
      { key: 'channels_manage_proxy', label: 'Quản lý Proxy', description: 'Cấu hình Proxy cho từng kênh' },
    ]
  },
  {
    group: 'Nhân sự (Staff)',
    permissions: [
      { key: 'staff_view', label: 'Xem danh sách', description: 'Xem danh sách nhân viên và vai trò' },
      { key: 'staff_edit', label: 'Quản lý nhân sự', description: 'Thêm, sửa, xóa hoặc đổi vai trò nhân viên' },
      { key: 'staff_view_salary', label: 'Xem Lương', description: 'Xem thông tin lương cơ bản của nhân viên' },
    ]
  },
  {
    group: 'Lịch đăng & KPI (Calendar)',
    permissions: [
      { key: 'calendar_view', label: 'Xem lịch', description: 'Xem lịch đăng video hàng tháng' },
      { key: 'calendar_edit', label: 'Lên lịch/Cập nhật', description: 'Thêm mới hoặc sửa đổi lịch đăng' },
      { key: 'calendar_view_all', label: 'Xem tất cả nhân sự', description: 'Xem lịch của mọi người (nếu tắt chỉ xem của mình)' },
      { key: 'calendar_delete', label: 'Xóa lịch', description: 'Cho phép xóa các mục đã lên lịch' },
    ]
  },
  {
    group: 'Tài chính (Finance)',
    permissions: [
      { key: 'finance_view', label: 'Xem báo cáo', description: 'Xem doanh thu, chi phí và lợi nhuận' },
      { key: 'finance_edit', label: 'Quản lý giao dịch', description: 'Thêm hoặc sửa các khoản thu chi' },
      { key: 'finance_view_accounts', label: 'Xem TK Ngân hàng', description: 'Xem chi tiết số dư và số tài khoản' },
    ]
  },
  {
    group: 'Bản quyền & Tài nguyên',
    permissions: [
      { key: 'copyright_view', label: 'Xem gậy/cảnh báo', description: 'Theo dõi tình trạng bản quyền các kênh' },
      { key: 'copyright_edit', label: 'Cập nhật gậy', description: 'Thêm hoặc xử lý các khiếu nại bản quyền' },
      { key: 'assets_view', label: 'Xem tài nguyên', description: 'Truy cập kho dữ liệu, template, font' },
      { key: 'assets_edit', label: 'Quản lý tài nguyên', description: 'Thêm hoặc xóa các tài nguyên dùng chung' },
    ]
  },
  {
    group: 'Giao & Nhận Việc (Tasks)',
    permissions: [
      { key: 'tasks_view', label: 'Xem danh sách việc', description: 'Xem danh sách công việc cá nhân và chợ việc' },
      { key: 'tasks_edit', label: 'Quản lý công việc', description: 'Giao việc, chỉnh sửa task, rao việc lên chợ' },
      { key: 'tasks_claim', label: 'Nhận việc từ chợ', description: 'Cho phép nhân sự tự nhận việc từ chợ việc' },
    ]
  },
  {
    group: 'Hệ thống & Phân quyền',
    permissions: [
      { key: 'settings_view', label: 'Xem cài đặt', description: 'Xem các cấu hình hệ thống' },
      { key: 'settings_edit_keys', label: 'Quản lý API Keys', description: 'Thay đổi key Youtube, Gemini' },
      { key: 'settings_edit_permissions', label: 'Chỉnh sửa Phân quyền', description: 'Thay đổi quyền hạn của các vai trò (Nguy hiểm)' },
    ]
  }
];

const DEFAULT_PERMISSIONS: RolePermissions = {
  admin: PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key)),
  manager: [
    'dashboard_view', 'reports_view_all', 'topics_view', 'topics_edit', 'sources_view', 'sources_edit', 'sources_analyze',
    'channels_view', 'channels_edit', 'emails_view', 'emails_edit', 'staff_view', 'calendar_view', 'calendar_edit', 'calendar_view_all',
    'finance_view', 'finance_edit', 'copyright_view', 'assets_view', 'assets_edit', 'tasks_view', 'tasks_edit', 'tasks_claim', 'settings_view'
  ],
  leader: [
    'dashboard_view', 'reports_view_all', 'topics_view', 'sources_view', 'channels_view', 'emails_view', 'calendar_view', 'calendar_edit', 
    'calendar_view_all', 'copyright_view', 'assets_view', 'tasks_view', 'tasks_edit', 'tasks_claim'
  ],
  member: [
    'dashboard_view', 'calendar_view', 'calendar_edit', 'assets_view', 'tasks_view', 'tasks_claim'
  ]
};

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
