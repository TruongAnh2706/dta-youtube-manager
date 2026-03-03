import React, { useState, useMemo } from 'react';
import { Asset, VideoTask, TaskStatus, Channel, Staff } from '../types';
import {
  Plus, Edit2, Trash2, X, ChevronRight, ChevronLeft,
  Calendar as CalendarIcon, Sparkles, AlertCircle, Clock,
  CheckCircle2, Circle, User, BarChart3, TrendingUp,
  Youtube, Users, Target, CheckCircle, Video
} from 'lucide-react';
import {
  format, isPast, isToday, addDays, startOfMonth,
  endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, subMonths, parseISO
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { generateScriptOutline } from '../services/aiService';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';

interface VideoCalendarProps {
  tasks: VideoTask[];
  setTasks: React.Dispatch<React.SetStateAction<VideoTask[]>>;
  channels: Channel[];
  staffList: Staff[];
  currentUser: { role: string; name: string } | null;
  geminiApiKey?: string;
  assets?: Asset[];
}

export function VideoCalendar({ tasks, setTasks, channels, staffList, assets = [], currentUser, geminiApiKey }: VideoCalendarProps) {
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<VideoTask | null>(null);
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterStaff, setFilterStaff] = useState<string>('all');

  const [formData, setFormData] = useState<Omit<VideoTask, 'id'>>({
    title: '',
    channelId: channels[0]?.id || '',
    status: 'idea',
    assigneeIds: [],
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    publishTime: '10:00',
    videoType: 'long',
    scriptLink: '',
    thumbnailLink: '',
    productionCost: 0,
    notes: '',
    scriptOutline: '',
    priority: 'medium',
    isClaimable: false
  });

  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [isGeneratingSEO, setIsGeneratingSEO] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  const workflowSteps = [
    { id: 'idea', label: 'Ý tưởng', icon: <Target size={14} /> },
    { id: 'script', label: 'Kịch bản', icon: <Edit2 size={14} /> },
    { id: 'voiceover', label: 'Thu âm', icon: <Users size={14} /> },
    { id: 'editing', label: 'Dựng phim', icon: <Video size={14} /> },
    { id: 'review', label: 'Duyệt', icon: <CheckCircle size={14} /> },
    { id: 'published', label: 'Đã đăng', icon: <Youtube size={14} /> }
  ];

  // Calendar logic
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const handleOpenModal = (task?: VideoTask, date?: Date) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        title: task.title,
        channelId: task.channelId,
        status: task.status,
        assigneeIds: task.assigneeIds,
        dueDate: task.dueDate,
        publishTime: task.publishTime || '10:00',
        videoType: task.videoType || 'long',
        scriptLink: task.scriptLink || '',
        thumbnailLink: task.thumbnailLink || '',
        productionCost: task.productionCost || 0,
        notes: task.notes,
        scriptOutline: task.scriptOutline || '',
        priority: task.priority || 'medium',
        isClaimable: task.isClaimable || false
      });
    } else {
      // Find current user in staff list to auto-assign
      const currentUserStaff = staffList.find(s => s.name === currentUser?.name);
      const defaultAssignee = currentUserStaff ? [currentUserStaff.id] : (filterStaff !== 'all' ? [filterStaff] : []);

      setEditingTask(null);
      setFormData({
        title: '',
        channelId: filterChannel !== 'all' ? filterChannel : (channels[0]?.id || ''),
        status: 'idea',
        assigneeIds: defaultAssignee,
        dueDate: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        publishTime: '10:00',
        videoType: 'long',
        scriptLink: '',
        thumbnailLink: '',
        productionCost: 0,
        notes: '',
        scriptOutline: '',
        priority: 'medium',
        isClaimable: false
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTask) {
      setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...formData } : t));
      showToast('Đã cập nhật lịch đăng video thành công!', 'success');
    } else {
      setTasks([...tasks, { id: Date.now().toString(), ...formData }]);
      showToast('Đã lên lịch đăng video mới thành công!', 'success');
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa lịch đăng này?')) {
      setTasks(prev => prev.filter(t => t.id !== id));
      showToast('Đã xóa lịch đăng video.', 'info');
      setIsModalOpen(false);
    }
  };

  const toggleStatus = (task: VideoTask) => {
    const newStatus: TaskStatus = task.status === 'published' ? 'review' : 'published';
    setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
  };

  const handleSmartSchedule = async () => {
    if (!formData.channelId) {
      showToast('Vui lòng chọn kênh trước.', 'warning');
      return;
    }

    setIsScheduling(true);
    try {
      if (!geminiApiKey) {
        showToast('Vui lòng cấu hình Gemini API Key.', 'error');
        return;
      }

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const model = 'gemini-2.5-flash';

      const channel = channels.find(c => c.id === formData.channelId);
      const prompt = `Dựa trên thông tin kênh YouTube: ${channel?.name}. Chủ đề: ${channel?.topicIds.join(', ')}. Hãy đề xuất 1 khung giờ đăng video tốt nhất trong ngày (HH:mm) để đạt reach cao nhất. Chỉ trả về đúng định dạng HH:mm.`;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      const suggestedTime = response.text?.trim() || '18:00';
      setFormData(prev => ({ ...prev, publishTime: suggestedTime, bestPublishTime: suggestedTime }));
      showToast(`AI đề xuất khung giờ vàng: ${suggestedTime}`, 'success');
    } catch (error) {
      showToast('Lỗi khi gợi ý giờ đăng.', 'error');
    } finally {
      setIsScheduling(false);
    }
  };

  // KPI Calculations
  const monthTasks = tasks.filter(t => isSameMonth(new Date(t.dueDate), currentDate));
  const publishedCount = monthTasks.filter(t => t.status === 'published').length;
  const totalTarget = monthTasks.length;

  const staffKPI = useMemo(() => {
    return staffList.map(staff => {
      const assignedTasks = monthTasks.filter(t => (t.assigneeIds || []).includes(staff.id));
      const postedTasks = assignedTasks.filter(t => t.status === 'published');
      return {
        ...staff,
        assigned: assignedTasks.length,
        posted: postedTasks.length,
        percent: assignedTasks.length > 0 ? Math.round((postedTasks.length / assignedTasks.length) * 100) : 0
      };
    }).sort((a, b) => b.posted - a.posted);
  }, [monthTasks, staffList]);

  const dailyProduction = useMemo(() => {
    const today = new Date();
    const todayTasks = tasks.filter(t => isSameDay(new Date(t.dueDate), today));
    return {
      total: todayTasks.length,
      published: todayTasks.filter(t => t.status === 'published').length
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const currentUserStaff = staffList.find(s => s.name === currentUser?.name);
    const canViewAll = hasPermission('calendar_view_all');

    return tasks.filter(t => {
      const channelMatch = filterChannel === 'all' || t.channelId === filterChannel;
      const staffMatch = filterStaff === 'all' || (t.assigneeIds || []).includes(filterStaff);

      // Permission check: if not admin/manager and can't view all, only show own tasks
      const ownershipMatch = canViewAll || (currentUserStaff && (t.assigneeIds || []).includes(currentUserStaff.id));

      return channelMatch && staffMatch && ownershipMatch;
    });
  }, [tasks, filterChannel, filterStaff, hasPermission, staffList, currentUser]);

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Header & KPI Summary */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lịch Đăng & Quản lý KPI</h1>
          <p className="text-sm text-gray-500 mt-1">Theo dõi tiến độ đăng video và hiệu suất nhân sự hàng ngày</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white border border-gray-300 rounded-lg p-1 shadow-sm">
            <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"><ChevronLeft size={18} /></button>
            <button onClick={goToToday} className="px-3 py-1 text-sm font-medium hover:bg-gray-100 rounded-md transition-colors">Tháng {format(currentDate, 'MM/yyyy')}</button>
            <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"><ChevronRight size={18} /></button>
          </div>

          <select
            value={filterChannel}
            onChange={e => setFilterChannel(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
          >
            <option value="all">Tất cả kênh</option>
            {channels.map(c => <option key={c.id} value={c.id}>[{c.channelCode}] {c.name}</option>)}
          </select>

          <select
            value={filterStaff}
            onChange={e => setFilterStaff(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
          >
            <option value="all">Tất cả nhân sự</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          {hasPermission('calendar_edit') && (
            <button
              onClick={() => handleOpenModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors shadow-sm"
            >
              <Plus size={16} className="mr-2" /> Lên lịch mới
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg mr-4"><Youtube size={24} /></div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Tổng video tháng này</p>
            <p className="text-xl font-bold text-gray-900">{publishedCount} / {totalTarget}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg mr-4"><CheckCircle2 size={24} /></div>
          <div>
            <p className="text-xs text-gray-500 font-medium">KPI Hôm nay</p>
            <p className="text-xl font-bold text-gray-900">{dailyProduction.published} / {dailyProduction.total}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg mr-4"><TrendingUp size={24} /></div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Tỷ lệ hoàn thành</p>
            <p className="text-xl font-bold text-gray-900">{totalTarget > 0 ? Math.round((publishedCount / totalTarget) * 100) : 0}%</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-lg mr-4"><Users size={24} /></div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Nhân sự tích cực</p>
            <p className="text-xl font-bold text-gray-900">{staffKPI.filter(s => s.posted > 0).length} / {staffList.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        {/* Main Calendar Grid */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          {/* Days of week header */}
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => (
              <div key={day} className="py-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="flex-1 grid grid-cols-7 overflow-y-auto">
            {calendarDays.map((day, idx) => {
              const dayTasks = filteredTasks.filter(t => isSameDay(new Date(t.dueDate), day));
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isTodayDay = isToday(day);

              return (
                <div
                  key={idx}
                  className={`min-h-[120px] border-r border-b border-gray-100 p-2 transition-colors hover:bg-gray-50/50 group ${!isCurrentMonth ? 'bg-gray-50/30' : ''
                    } ${isTodayDay ? 'bg-blue-50/20' : ''}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-xs font-bold ${isTodayDay ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center' :
                      isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                      }`}>
                      {format(day, 'd')}
                    </span>
                    {hasPermission('calendar_edit') && (
                      <button
                        onClick={() => handleOpenModal(undefined, day)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 transition-opacity"
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    {dayTasks.map(task => {
                      const channel = channels.find(c => c.id === task.channelId);
                      const isPublished = task.status === 'published';

                      return (
                        <div
                          key={task.id}
                          className={`p-1.5 rounded border text-[10px] leading-tight transition-all cursor-pointer hover:shadow-sm ${isPublished
                            ? 'bg-green-50 border-green-200 text-green-800'
                            : 'bg-white border-gray-200 text-gray-700'
                            }`}
                          onClick={() => handleOpenModal(task)}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-bold truncate max-w-[60px]">[{channel?.channelCode || '??'}]</span>
                            <div className="flex items-center gap-1">
                              <span className={`px-1 rounded-sm text-[8px] font-bold ${task.videoType === 'shorts' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                {task.videoType === 'shorts' ? 'S' : 'L'}
                              </span>
                              {isPublished ? <CheckCircle size={10} className="text-green-600" /> : <Circle size={10} className="text-gray-300" />}
                            </div>
                          </div>
                          <p className="truncate font-medium">{task.title}</p>

                          {/* Workflow Progress Mini */}
                          <div className="flex gap-0.5 mt-1.5">
                            {workflowSteps.map(step => {
                              const stepIdx = workflowSteps.findIndex(s => s.id === step.id);
                              const currentIdx = workflowSteps.findIndex(s => s.id === task.status);
                              return (
                                <div
                                  key={step.id}
                                  className={`h-1 flex-1 rounded-full ${stepIdx <= currentIdx ? 'bg-blue-500' : 'bg-gray-200'}`}
                                />
                              );
                            })}
                          </div>

                          <div className="flex items-center justify-between mt-1 text-[9px] opacity-70">
                            <div className="flex items-center truncate">
                              <User size={8} className="mr-1" />
                              <span className="truncate">
                                {task.assigneeIds.map(id => staffList.find(s => s.id === id)?.name).join(', ') || 'Chưa giao'}
                              </span>
                            </div>
                            {task.publishTime && <span className="font-mono">{task.publishTime}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar: Staff KPI & Performance */}
        <div className="space-y-6 overflow-y-auto pr-1">
          {/* Today's Staff Status */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
              <CheckCircle2 size={16} className="mr-2 text-green-600" /> Trạng thái Hôm nay
            </h2>
            <div className="space-y-3">
              {staffList.map(staff => {
                const today = new Date();
                const todayTasks = tasks.filter(t => (t.assigneeIds || []).includes(staff.id) && isSameDay(new Date(t.dueDate), today));
                const completedToday = todayTasks.length > 0 && todayTasks.every(t => t.status === 'published');
                const hasTasksToday = todayTasks.length > 0;

                return (
                  <div key={staff.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
                    <div className="flex items-center min-w-0">
                      <div className={`w-2 h-2 rounded-full mr-2 shrink-0 ${!hasTasksToday ? 'bg-gray-300' : completedToday ? 'bg-green-500' : 'bg-orange-500'
                        }`} />
                      <span className="text-xs font-medium text-gray-700 truncate">{staff.name}</span>
                    </div>
                    <div className="flex items-center shrink-0 ml-2">
                      {hasTasksToday ? (
                        completedToday ? (
                          <span className="text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded">Xong</span>
                        ) : (
                          <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">Đang làm</span>
                        )
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">Nghỉ</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {staffList.length === 0 && <p className="text-xs text-gray-500 italic text-center py-2">Chưa có nhân sự</p>}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
              <BarChart3 size={16} className="mr-2 text-blue-600" /> KPI Nhân sự (Tháng này)
            </h2>
            <div className="space-y-4">
              {staffKPI.map(staff => (
                <div key={staff.id} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600 mr-2">
                        {(staff.name || '?').charAt(0)}
                      </div>
                      <span className="text-xs font-medium text-gray-700">{staff.name}</span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-500">{staff.posted}/{staff.assigned} video</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${staff.percent >= 100 ? 'bg-green-500' :
                        staff.percent >= 50 ? 'bg-blue-500' : 'bg-orange-500'
                        }`}
                      style={{ width: `${staff.percent}%` }}
                    ></div>
                  </div>
                </div>
              ))}
              {staffList.length === 0 && <p className="text-xs text-gray-500 italic text-center py-4">Chưa có dữ liệu nhân sự</p>}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
              <Target size={16} className="mr-2 text-red-600" /> Mục tiêu Sản xuất
            </h2>
            <div className="p-4 bg-red-50 rounded-lg border border-red-100 text-center">
              <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider mb-1">Hôm nay</p>
              <p className="text-3xl font-black text-red-700">{dailyProduction.total}</p>
              <p className="text-[10px] text-red-600 mt-1">Video cần sản xuất</p>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-[10px] font-medium text-gray-500">
                <span>Đã hoàn thành</span>
                <span className="text-green-600 font-bold">{dailyProduction.published} video</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${dailyProduction.total > 0 ? (dailyProduction.published / dailyProduction.total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Task Modal (Simplified for Calendar) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-semibold">{editingTask ? 'Sửa Lịch Đăng' : 'Lên Lịch Đăng mới'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <form id="task-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề Video</label>
                  <input type="text" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="VD: Top 10 sự thật..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Loại Video</label>
                    <select value={formData.videoType} onChange={e => setFormData({ ...formData, videoType: e.target.value as any })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="long">Video Dài</option>
                      <option value="shorts">Shorts</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Giờ đăng dự kiến</label>
                    <div className="flex space-x-2">
                      <input type="time" value={formData.publishTime} onChange={e => setFormData({ ...formData, publishTime: e.target.value })} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <button
                        type="button"
                        onClick={handleSmartSchedule}
                        disabled={isScheduling}
                        className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors"
                        title="AI gợi ý giờ vàng"
                      >
                        <Sparkles size={16} className={isScheduling ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kênh đăng</label>
                    <select required value={formData.channelId} onChange={e => setFormData({ ...formData, channelId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="" disabled>Chọn kênh</option>
                      {channels.map(c => <option key={c.id} value={c.id}>[{c.channelCode}] {c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ngày đăng</label>
                    <input type="date" required value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Link Kịch bản</label>
                    <input type="url" value={formData.scriptLink} onChange={e => setFormData({ ...formData, scriptLink: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://docs.google.com/..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Link Thumbnail</label>
                    <input type="url" value={formData.thumbnailLink} onChange={e => setFormData({ ...formData, thumbnailLink: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://drive.google.com/..." />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Chi phí sản xuất (VNĐ)</label>
                    <input type="number" value={formData.productionCost} onChange={e => setFormData({ ...formData, productionCost: parseInt(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Độ ưu tiên</label>
                    <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value as any })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="low">Thấp</option>
                      <option value="medium">Bình thường</option>
                      <option value="high">Gấp / Quan trọng</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Quy trình sản xuất (Workflow)</label>
                  <div className="flex items-center justify-between relative">
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -translate-y-1/2 z-0"></div>
                    {workflowSteps.map((step, idx) => {
                      const isActive = formData.status === step.id;
                      const isCompleted = workflowSteps.findIndex(s => s.id === formData.status) >= idx;

                      return (
                        <button
                          key={step.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, status: step.id as TaskStatus })}
                          className={`relative z-10 flex flex-col items-center group`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${isActive ? 'bg-blue-600 border-blue-600 text-white scale-110 shadow-md' :
                            isCompleted ? 'bg-blue-100 border-blue-400 text-blue-600' :
                              'bg-white border-gray-300 text-gray-400 hover:border-gray-400'
                            }`}>
                            {isCompleted && !isActive ? <CheckCircle size={16} /> : step.icon}
                          </div>
                          <span className={`text-[9px] mt-1 font-bold whitespace-nowrap ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                            {step.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nhân sự phụ trách (KPI)</label>
                  <div className="flex flex-wrap gap-2">
                    {staffList.map(staff => (
                      <button
                        key={staff.id} type="button" onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            assigneeIds: (prev.assigneeIds || []).includes(staff.id)
                              ? prev.assigneeIds.filter(id => id !== staff.id)
                              : [...(prev.assigneeIds || []), staff.id]
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${(formData.assigneeIds || []).includes(staff.id) ? 'bg-indigo-100 border-indigo-300 text-indigo-800' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        {staff.name}
                      </button>
                    ))}
                    {staffList.length === 0 && <span className="text-sm text-gray-500 italic">Chưa có nhân sự.</span>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú / Link video</label>
                  <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} placeholder="Link video đã hoàn thiện, link kịch bản..." />
                </div>

                <div className="flex items-center space-x-2 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                  <input
                    type="checkbox"
                    id="isClaimable"
                    checked={formData.isClaimable}
                    onChange={e => setFormData({ ...formData, isClaimable: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="isClaimable" className="text-sm font-bold text-indigo-700">
                    Đưa lên Chợ việc (Rao việc để nhân sự tự nhận)
                  </label>
                </div>
              </form>
            </div>
            <div className="p-4 border-t border-gray-100 shrink-0 flex justify-between items-center bg-gray-50">
              {editingTask && hasPermission('calendar_delete') && (
                <button onClick={() => handleDelete(editingTask.id)} className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center">
                  <Trash2 size={16} className="mr-1" /> Xóa lịch
                </button>
              )}
              <div className="flex space-x-3 ml-auto">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors">Hủy</button>
                {hasPermission('calendar_edit') && (
                  <button type="submit" form="task-form" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">Lưu Lịch Đăng</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
