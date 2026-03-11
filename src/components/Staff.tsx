import React, { useState } from 'react';
import { Staff, Channel, StaffRole, StaffSkill, VideoTask } from '../types';
import { Plus, Edit2, Trash2, X, UserCircle, Mail, Phone, Circle, Award, CheckSquare, DollarSign, Calculator, ShieldAlert, RefreshCw, Calendar, Clock, BarChart3 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../lib/supabase';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';

interface StaffProps {
  staffList: Staff[];
  setStaffList: React.Dispatch<React.SetStateAction<Staff[]>>;
  channels: Channel[];
  tasks: VideoTask[];
  geminiApiKey?: string;
  onExportPayroll?: (amount: number) => void;
}

const ROLES: { id: StaffRole; label: string }[] = [
  { id: 'admin', label: 'Admin (Chủ hệ thống)' },
  { id: 'manager', label: 'Manager (Quản lý)' },
  { id: 'leader', label: 'Leader (Trưởng nhóm)' },
  { id: 'member', label: 'Member (Nhân viên)' },
];

const SKILLS: { id: StaffSkill; label: string }[] = [
  { id: 'scriptwriter', label: 'Viết Kịch bản' },
  { id: 'voiceover', label: 'Thu âm (Voice)' },
  { id: 'editor', label: 'Dựng Video (Edit)' },
  { id: 'designer', label: 'Thiết kế (Design)' },
];

export function StaffManager({ staffList, setStaffList, channels, tasks, geminiApiKey, onExportPayroll }: StaffProps) {
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingStaffId, setAnalyzingStaffId] = useState<string | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  const [formData, setFormData] = useState<Omit<Staff, 'id'>>({
    name: '',
    role: 'member',
    skills: [],
    email: '',
    phone: '',
    username: '',
    password: '',
    assignedChannelIds: [],
    status: 'offline',
    baseSalary: 0,
    managedEmailCount: 0,
    kpiTargets: {
      daily: 1,
      weekly: 5,
      monthly: 20
    }
  });

  const handleOpenModal = (staff?: Staff) => {
    if (staff) {
      setEditingStaff(staff);
      const kpiTargets = staff.kpiTargets || { daily: 1, weekly: 6, monthly: 26 };
      setFormData({
        name: staff.name,
        role: staff.role,
        skills: staff.skills,
        email: staff.email,
        phone: staff.phone,
        username: staff.username || '',
        password: staff.password || '',
        assignedChannelIds: staff.assignedChannelIds,
        status: staff.status,
        baseSalary: staff.baseSalary,
        managedEmailCount: staff.managedEmailCount || 0,
        kpiTargets: kpiTargets
      });
    } else {
      setEditingStaff(null);
      setFormData({
        name: '',
        role: 'member',
        skills: [],
        email: '',
        phone: '',
        username: '',
        password: '',
        assignedChannelIds: [],
        status: 'offline',
        baseSalary: 0,
        managedEmailCount: 0,
        kpiTargets: { daily: 1, weekly: 6, monthly: 26 }
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingStaff(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStaff) {
      setStaffList(staffList.map(s => s.id === editingStaff.id ? { ...s, ...formData } : s));
      showToast('Đã cập nhật thông tin nhân sự thành công!', 'success');
    } else {
      // Đảm bảo có Dummy data nếu người dùng bỏ trống lúc tạo nhanh
      const newStaffId = Date.now().toString();
      const finalEmail = formData.email.trim() === '' ? `no-email-${newStaffId}@dta.local` : formData.email;
      const finalUsername = formData.username.trim() === '' ? `user_${newStaffId}` : formData.username;

      setStaffList([...staffList, {
        id: newStaffId,
        ...formData,
        email: finalEmail,
        username: finalUsername
      }]);
      showToast('Đã thêm nhân sự mới thành công!', 'success');
    }
    handleCloseModal();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa nhân sự này?')) {
      setStaffList(prev => prev.filter(s => s.id !== id));
      
      const { error } = await supabase.from('staff_list').delete().eq('id', id);
      if (error) {
        showToast(`Lỗi xóa trên server: ${error.message}`, 'error');
      } else {
        showToast('Đã xóa nhân sự.', 'info');
      }
    }
  };

  const calculateEarnings = (staff: Staff) => {
    const publishedTasks = tasks.filter(t =>
      (t.assigneeIds || []).includes(staff.id) &&
      t.status === 'published'
    );
    const bonus = publishedTasks.length * 50000; // 50k per video
    return {
      base: staff.baseSalary,
      bonus,
      total: staff.baseSalary + bonus,
      videoCount: publishedTasks.length
    };
  };

  const toggleChannel = (channelId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedChannelIds: (prev.assignedChannelIds || []).includes(channelId)
        ? prev.assignedChannelIds.filter(id => id !== channelId)
        : [...(prev.assignedChannelIds || []), channelId]
    }));
  };

  const toggleSkill = (skillId: StaffSkill) => {
    setFormData(prev => ({
      ...prev,
      skills: (prev.skills || []).includes(skillId)
        ? prev.skills.filter(id => id !== skillId)
        : [...(prev.skills || []), skillId]
    }));
  };

  const handleAIPerformanceReview = async (staff: Staff) => {
    setIsAnalyzing(true);
    setAnalyzingStaffId(staff.id);
    try {
      if (!geminiApiKey) {
        showToast('Vui lòng cấu hình Gemini API Key.', 'error');
        return;
      }

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const model = 'gemini-2.5-flash';

      const completedTasks = tasks.filter(t => (t.assigneeIds || []).includes(staff.id) && t.status === 'published');
      const performanceData = {
        name: staff.name,
        role: staff.role,
        skills: staff.skills,
        completedVideos: completedTasks.length,
        videoTitles: completedTasks.map(t => t.title).join(', ')
      };

      const prompt = `Đánh giá hiệu suất nhân sự YouTube: ${JSON.stringify(performanceData)}. 
      Hãy viết 1 đoạn nhận xét ngắn gọn về ưu điểm và 1 đề xuất để họ làm tốt hơn. Trả về 2-3 câu.`;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      const review = response.text || 'Không có nhận xét.';
      showToast(`ĐÁNH GIÁ AI (${staff.name}): ${review}`, 'success', 10000);
    } catch (error) {
      showToast('Lỗi khi đánh giá hiệu suất.', 'error');
    } finally {
      setIsAnalyzing(false);
      setAnalyzingStaffId(null);
    }
  };

  const handleBulkPayroll = () => {
    const totalPayroll = staffList.reduce((sum, staff) => {
      const earnings = calculateEarnings(staff);
      return sum + earnings.total;
    }, 0);

    if (confirm(`Tổng quỹ lương tháng này là: ${totalPayroll.toLocaleString()} VNĐ.\n\nBạn có muốn tự động xuất khoản này thành phiếu Chi (Expense) sang Tab Kế Toán không?`)) {
      if (onExportPayroll) {
        onExportPayroll(totalPayroll);
        showToast('Đã đẩy phiếu Chi Lương sang Kế Toán thành công!', 'success');
      } else {
        showToast('Tính năng liên kết Kế Toán chưa được kích hoạt.', 'error');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Nhân sự (HRM)</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý hồ sơ, phân quyền và kỹ năng chuyên môn</p>
        </div>
        <div className="flex items-center gap-3">
          {hasPermission('staff_view_salary') && (
            <button
              onClick={handleBulkPayroll}
              className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-4 py-2 rounded-lg flex items-center text-sm font-medium hover:bg-emerald-100 transition-colors"
            >
              <Calculator size={16} className="mr-2" /> Chốt Lương & Xuất Kế Toán
            </button>
          )}
          {hasPermission('staff_edit') && (
            <button
              onClick={() => handleOpenModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors"
            >
              <Plus size={16} className="mr-2" /> Thêm nhân sự
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staffList.map(staff => {
          const now = new Date();
          const staffTasks = tasks.filter(t => (t.assigneeIds || []).includes(staff.id));
          const publishedTasks = staffTasks.filter(t => t.status === 'published');

          const dailyCompleted = publishedTasks.filter(t =>
            isWithinInterval(parseISO(t.dueDate), { start: startOfDay(now), end: endOfDay(now) })
          ).length;

          // Rendered today: status is review or published and due today
          const renderedToday = staffTasks.filter(t =>
            (t.status === 'review' || t.status === 'published') &&
            isWithinInterval(parseISO(t.dueDate), { start: startOfDay(now), end: endOfDay(now) })
          ).length;

          const weeklyCompleted = publishedTasks.filter(t =>
            isWithinInterval(parseISO(t.dueDate), { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) })
          ).length;

          const monthlyCompleted = publishedTasks.filter(t =>
            isWithinInterval(parseISO(t.dueDate), { start: startOfMonth(now), end: endOfMonth(now) })
          ).length;

          const activeTasksCount = staffTasks.filter(t => t.status !== 'published').length;
          const earnings = calculateEarnings(staff);

          const targets = staff.kpiTargets || { daily: 1, weekly: 5, monthly: 20 };

          const getProgress = (current: number, target: number) => Math.min(Math.round((current / (target || 1)) * 100), 100);
          const getPerfColor = (progress: number) => {
            if (progress >= 100) return 'bg-emerald-500';
            if (progress >= 75) return 'bg-blue-500';
            if (progress >= 50) return 'bg-orange-500';
            return 'bg-red-500';
          };
          const getPerfTextColor = (progress: number) => {
            if (progress >= 100) return 'text-emerald-600';
            if (progress >= 75) return 'text-blue-600';
            if (progress >= 50) return 'text-orange-600';
            return 'text-red-600';
          };

          return (
            <div key={staff.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl">
                      {(staff.name || '?').charAt(0)}
                    </div>
                    <Circle size={12} className={`absolute bottom-0 right-0 fill-current border-2 border-white rounded-full ${staff.status === 'online' ? 'text-green-500' : staff.status === 'offline' ? 'text-gray-400' : 'text-red-500'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{staff.name}</h3>
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full capitalize">
                      {ROLES.find(r => r.id === staff.role)?.label.split(' ')[0] || staff.role}
                    </span>
                  </div>
                </div>
                {hasPermission('staff_edit') && (
                  <div className="flex space-x-1">
                    <button onClick={() => handleOpenModal(staff)} className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(staff.id)} className="p-1 text-gray-400 hover:text-red-600 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Management Metrics - Main Focus */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-indigo-50 p-2 rounded-lg border border-indigo-100 text-center">
                  <div className="text-[9px] font-bold text-indigo-500 uppercase mb-1">Render Hôm Nay</div>
                  <p className={`text-lg font-black ${getPerfTextColor(getProgress(renderedToday, targets.daily))}`}>
                    {renderedToday}
                  </p>
                  <p className="text-[8px] text-indigo-400">Target: {targets.daily}</p>
                </div>
                <div className="bg-amber-50 p-2 rounded-lg border border-amber-100 text-center">
                  <div className="text-[9px] font-bold text-amber-500 uppercase mb-1">Email Cầm</div>
                  <p className="text-lg font-black text-amber-700">
                    {staff.managedEmailCount || 0}
                  </p>
                  <p className="text-[8px] text-amber-400">Tài khoản</p>
                </div>
                <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100 text-center">
                  <div className="text-[9px] font-bold text-emerald-500 uppercase mb-1">Kênh Quản Lý</div>
                  <p className="text-lg font-black text-emerald-700">
                    {staff.assignedChannelIds?.length || 0}
                  </p>
                  <p className="text-[8px] text-emerald-400">Channel</p>
                </div>
              </div>

              {/* KPI Stats Multi-Period */}
              <div className="space-y-4 mb-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                    <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Tuần</div>
                    <p className={`text-sm font-bold ${getPerfTextColor(getProgress(weeklyCompleted, targets.weekly))}`}>
                      {weeklyCompleted}/{targets.weekly}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                    <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Tháng</div>
                    <p className={`text-sm font-bold ${getPerfTextColor(getProgress(monthlyCompleted, targets.monthly))}`}>
                      {monthlyCompleted}/{targets.monthly}
                    </p>
                  </div>
                </div>

                {/* Progress Indicators */}
                <div className="space-y-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase">
                      <span>Tiến độ tháng</span>
                      <span>{getProgress(monthlyCompleted, targets.monthly)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${getPerfColor(getProgress(monthlyCompleted, targets.monthly))}`}
                        style={{ width: `${getProgress(monthlyCompleted, targets.monthly)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center text-blue-600 font-medium">
                      <CheckSquare size={10} className="mr-1" /> {activeTasksCount} tasks đang làm
                    </div>
                    <div className="text-gray-400">
                      Mục tiêu: {targets.monthly} v/tháng
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600 flex-grow">
                <div className="flex items-center"><Mail size={14} className="mr-2 text-gray-400" /> {staff.email || 'Chưa cập nhật'}</div>
                <div className="flex items-center"><Phone size={14} className="mr-2 text-gray-400" /> {staff.phone || 'Chưa cập nhật'}</div>
                {hasPermission('staff_view_salary') ? (
                  <div className="pt-2 border-t border-gray-50 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">Thu nhập dự kiến:</span>
                      <span className="font-bold text-blue-600">{earnings.total.toLocaleString('vi-VN')} đ</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                      <span>Lương cứng: {earnings.base.toLocaleString()}đ</span>
                      <span>Thưởng ({earnings.videoCount} v): {earnings.bonus.toLocaleString()}đ</span>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-gray-50 mt-2 flex items-center text-gray-400 text-[10px] italic">
                    <ShieldAlert size={10} className="mr-1 opacity-50" /> Không có quyền xem lương
                  </div>
                )}

              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                <button
                  onClick={() => handleAIPerformanceReview(staff)}
                  disabled={isAnalyzing && analyzingStaffId === staff.id}
                  className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[10px] font-bold rounded-lg transition-colors border border-indigo-100 flex items-center justify-center"
                >
                  {isAnalyzing && analyzingStaffId === staff.id ? <RefreshCw size={12} className="mr-1 animate-spin" /> : <Award size={12} className="mr-1" />}
                  AI Review
                </button>
                <button
                  onClick={() => handleOpenModal(staff)}
                  className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-[10px] font-bold rounded-lg transition-colors border border-gray-200 flex items-center justify-center"
                >
                  <Edit2 size={12} className="mr-1" /> Sửa hồ sơ
                </button>
              </div>
            </div>
          );
        })}
        {staffList.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <p className="text-gray-500">Chưa có nhân sự nào. Hãy thêm thành viên vào team!</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-semibold">{editingStaff ? 'Sửa thông tin nhân sự' : 'Thêm nhân sự mới'}</h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <form id="staff-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
                    <input
                      type="text" required value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cấp bậc (Role)</label>
                    <select
                      value={formData.role}
                      onChange={e => setFormData({ ...formData, role: e.target.value as StaffRole })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {ROLES.map(r => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email" value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                    <input
                      type="text" value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập (Username)</label>
                    <input
                      type="text" value={formData.username}
                      onChange={e => setFormData({ ...formData, username: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Dùng để đăng nhập"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu (Password)</label>
                    <input
                      type="password" value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Dùng để đăng nhập"
                    />
                  </div>
                  {hasPermission('staff_view_salary') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Lương cơ bản (VNĐ)</label>
                      <input
                        type="number" value={formData.baseSalary}
                        onChange={e => setFormData({ ...formData, baseSalary: parseInt(e.target.value) || 0 })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Số Email đang cầm</label>
                    <input
                      type="number" value={formData.managedEmailCount}
                      onChange={e => setFormData({ ...formData, managedEmailCount: parseInt(e.target.value) || 0 })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">KPI Ngày</label>
                      <input
                        type="number" value={formData.kpiTargets?.daily}
                        onChange={e => {
                          const daily = parseInt(e.target.value) || 0;
                          setFormData({
                            ...formData,
                            kpiTargets: {
                              daily,
                              weekly: daily * 6,
                              monthly: daily * 26
                            }
                          });
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">KPI Tuần</label>
                      <input
                        type="number" value={formData.kpiTargets?.weekly}
                        onChange={e => setFormData({ ...formData, kpiTargets: { ...formData.kpiTargets!, weekly: parseInt(e.target.value) || 0 } })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">KPI Tháng</label>
                      <input
                        type="number" value={formData.kpiTargets?.monthly}
                        onChange={e => setFormData({ ...formData, kpiTargets: { ...formData.kpiTargets!, monthly: parseInt(e.target.value) || 0 } })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="online">Online (Đang làm việc)</option>
                      <option value="offline">Offline (Nghỉ)</option>
                      <option value="inactive">Đã nghỉ việc</option>
                    </select>
                  </div>
                </div>



                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phân công kênh quản lý/sản xuất</label>
                  <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50 max-h-48 overflow-y-auto">
                    {channels.map(channel => (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => toggleChannel(channel.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors flex items-center ${(formData.assignedChannelIds || []).includes(channel.id)
                          ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                          }`}
                      >
                        <span className="text-[10px] bg-gray-200 text-gray-600 px-1 rounded mr-2 font-bold">
                          {channel.channelCode}
                        </span>
                        {channel.name}
                      </button>
                    ))}
                    {channels.length === 0 && (
                      <p className="text-sm text-gray-500 italic">Chưa có kênh nào trong hệ thống.</p>
                    )}
                  </div>
                </div>
              </form>
            </div>
            <div className="p-4 border-t border-gray-100 shrink-0 flex justify-end space-x-3 bg-gray-50">
              <button
                type="button" onClick={handleCloseModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit" form="staff-form"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                {editingStaff ? 'Lưu thay đổi' : 'Thêm nhân sự'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
