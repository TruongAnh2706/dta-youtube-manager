import { PermissionKey, StaffRole, RolePermissions } from '../types';

export const PERMISSION_GROUPS: { group: string; permissions: { key: PermissionKey; label: string; description: string }[] }[] = [
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

export const DEFAULT_PERMISSIONS: RolePermissions = {
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
