import React, { useState, useMemo } from 'react';
import { Asset, VideoTask, TaskStatus, Channel, Staff, ManagedEmail } from '../types';
import {
  Plus, Edit2, Trash2, X, ChevronRight, ChevronLeft,
  Calendar as CalendarIcon, Sparkles, AlertCircle, Clock,
  CheckCircle2, Circle, User, BarChart3, TrendingUp,
  Youtube, Users, Target, CheckCircle, Video, Loader
} from 'lucide-react';
import {
  format, isPast, isToday, addDays, startOfMonth,
  endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, subMonths, parseISO
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase';
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
  managedEmails?: ManagedEmail[];
  systemSettings?: import('../types').SystemSettings;
  setActiveTab?: (tab: string) => void;
}

export function VideoCalendar({ tasks, setTasks, channels, staffList, assets = [], currentUser, geminiApiKey, managedEmails = [], systemSettings, setActiveTab }: VideoCalendarProps) {
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('month'); // Mặc định là chế độ xem tháng
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [editingTask, setEditingTask] = useState<VideoTask | null>(null);
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterStaff, setFilterStaff] = useState<string>('all');

  const [formData, setFormData] = useState<Omit<VideoTask, 'id'>>({
    title: '',
    channelId: channels[0]?.id || '',
    status: 'pending',
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
    isClaimable: false,
    bestPublishTimeExplanation: ''
  });

  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [isGeneratingSEO, setIsGeneratingSEO] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  const rawWorkflowSteps = systemSettings?.taskStatuses || [];
  const getIconForStatus = (id: string, size = 14) => {
    switch (id) {
      case 'pending':
      case 'idea': return <Target size={size} />;
      case 'in_progress':
      case 'script': return <Edit2 size={size} />;
      case 'voiceover': return <Users size={size} />;
      case 'completed':
      case 'editing': return <Video size={size} />;
      case 'review': return <CheckCircle size={size} />;
      case 'published': return <Youtube size={size} />;
      default: return <Circle size={size} />;
    }
  };

  const workflowSteps = rawWorkflowSteps.map(s => ({
    id: s.id,
    label: s.label,
    icon: getIconForStatus(s.id),
    color: s.color
  }));

  const defaultTaskStatus = workflowSteps.length > 0 ? workflowSteps[0].id : 'pending';

  // Calendar logic
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextDate = () => {
    if (calendarView === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (calendarView === 'week') {
      setCurrentDate(addDays(currentDate, 7));
    } else {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const prevDate = () => {
    if (calendarView === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (calendarView === 'week') {
      setCurrentDate(addDays(currentDate, -7));
    } else {
      setCurrentDate(addDays(currentDate, -1));
    }
  };

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
        isClaimable: task.isClaimable || false,
        bestPublishTimeExplanation: task.bestPublishTimeExplanation || ''
      });
    } else {
      // Find current user in staff list to auto-assign
      const currentUserStaff = staffList.find(s => s.name === currentUser?.name);
      const defaultAssignee = currentUserStaff ? [currentUserStaff.id] : (filterStaff !== 'all' ? [filterStaff] : []);

      setEditingTask(null);
      setFormData({
        title: '',
        channelId: filterChannel !== 'all' ? filterChannel : (channels[0]?.id || ''),
        status: defaultTaskStatus as TaskStatus,
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
        isClaimable: false,
        bestPublishTimeExplanation: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isVirtual = editingTask && editingTask.id.toString().startsWith('virtual-');
    if (editingTask && !isVirtual) {
      setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...formData } : t));
      showToast('Đã cập nhật lịch đăng video thành công!', 'success');
    } else {
      setTasks(prev => [...prev, { id: crypto.randomUUID(), ...formData }]);
      showToast('Đã lên lịch đăng video mới thành công!', 'success');
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (id.toString().startsWith('virtual-')) {
      showToast('Không thể xóa trực tiếp lịch định kỳ. Vào Kênh để sửa lịch mẫu.', 'warning');
      return;
    }
    if (confirm('Bạn có chắc chắn muốn xóa lịch đăng này?')) {
      setTasks(prev => prev.filter(t => t.id !== id));
      
      const { error } = await supabase.from('video_tasks').delete().eq('id', id);
      if (error) {
        showToast(`Lỗi xóa trên server: ${error.message}`, 'error');
      } else {
        showToast('Đã xóa lịch đăng video.', 'info');
      }
      setIsModalOpen(false);
    }
  };

  const toggleStatus = (task: VideoTask) => {
    const newStatus: TaskStatus = task.status === 'published' ? 'review' : 'published';
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
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
      const prompt = `Dựa trên thông tin kênh YouTube: "${channel?.name}". Chủ đề/Thị trường: "${channel?.topicIds.join(', ')}". 
Hãy phân tích và đề xuất 1 khung giờ đăng video tốt nhất trong ngày để đạt tỷ lệ tiếp cận (reach) và giữ chân người xem cao nhất, đồng thời giải thích chiến lược ngắn gọn (tối đa 2 câu).
YÊU CẦU: Trả về kết quả DUY NHẤT dưới dạng chuỗi JSON thô (không bọc trong tag code block), cấu trúc chính xác:
{ "time": "HH:mm", "explanation": "đoạn lý giải chiến lược bằng Tiếng Việt..." }`;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      const text = response.text?.trim() || '';
      let suggestedTime = '18:00';
      let explanation = 'Phù hợp với hành vi lướt mạng xã hội sau giờ làm việc và học tập.';

      try {
        const cleanJsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(cleanJsonStr);
        if (data.time) suggestedTime = data.time;
        if (data.explanation) explanation = data.explanation;
      } catch (e) {
        // Fallback trích xuất giờ nếu không parse được JSON
        const match = text.match(/(\d{2}:\d{2})/);
        if (match) suggestedTime = match[1];
        explanation = text || 'AI đề xuất khung giờ vàng phù hợp với kênh.';
      }

      setFormData(prev => ({ 
        ...prev, 
        publishTime: suggestedTime, 
        bestPublishTime: suggestedTime,
        bestPublishTimeExplanation: explanation
      }));
      showToast(`AI đề xuất giờ vàng: ${suggestedTime}`, 'success');
    } catch (error) {
      showToast('Lỗi khi gọi AI gợi ý giờ đăng.', 'error');
    } finally {
      setIsScheduling(false);
    }
  };

  const currentUserStaff = staffList.find(s => s.name === currentUser?.name);
  const canViewAll = hasPermission('calendar_view_all');

  const virtualTasks = useMemo(() => {
    const vTasks: VideoTask[] = [];
    let _startDate = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    let _endDate = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });

    if (calendarView === 'week') {
      _startDate = startOfWeek(addDays(currentDate, -7), { weekStartsOn: 1 });
      _endDate = endOfWeek(addDays(currentDate, 7), { weekStartsOn: 1 });
    } else if (calendarView === 'day') {
      _startDate = startOfWeek(addDays(currentDate, -2), { weekStartsOn: 1 });
      _endDate = endOfWeek(addDays(currentDate, 2), { weekStartsOn: 1 });
    }

    const _calendarDays = eachDayOfInterval({ start: _startDate, end: _endDate });
    const realTaskKeys = new Set(tasks.map(t => `${t.channelId}-${t.dueDate}-${t.publishTime}`));

    // Chỉ gen lịch cho kênh đã liên kết với email thực sự trong hệ thống
    const linkedChannels = channels.filter(c => 
      c.email && managedEmails.some(em => em.email.toLowerCase() === c.email!.toLowerCase())
    );
    linkedChannels.forEach(channel => {
      if (channel.postingSchedules && channel.postingSchedules.length > 0) {
        channel.postingSchedules.forEach(schedule => {
          const dayMap: { [key: string]: number } = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
          const targetDays = schedule.days.map(d => dayMap[d]);

          _calendarDays.forEach(day => {
            if (targetDays.includes(day.getDay())) {
               const dateStr = format(day, 'yyyy-MM-dd');
               const key = `${channel.id}-${dateStr}-${schedule.time}`;
               if (!realTaskKeys.has(key)) {
                 vTasks.push({
                   id: `virtual-${channel.id}-${day.getTime()}-${schedule.time}`,
                   title: `[Lịch Định Kỳ] ${channel.name}`,
                   channelId: channel.id,
                   status: 'pending', 
                   assigneeIds: [],
                   dueDate: dateStr,
                   publishTime: schedule.time,
                   videoType: 'long',
                   isClaimable: false,
                   priority: 'medium',
                   productionCost: 0,
                   notes: 'Lịch đăng định kỳ (Hệ thống tự tạo)',
                   scriptLink: '',
                   thumbnailLink: '',
                   scriptOutline: ''
                 });
               }
            }
          });
        });
      }
    });
    return vTasks;
  }, [channels, currentDate, tasks, managedEmails]);

  const viewableTasks = useMemo(() => {
    let list: VideoTask[] = [];

    // Lọc ra các ID của Kênh có bật Lịch Đăng Định Kỳ
    // Chỉ tính kênh có lịch đăng VÀ đã liên kết email thực sự
    const activeScheduleChannelIds = channels
      .filter(c => c.postingSchedules && c.postingSchedules.length > 0)
      .filter(c => c.email && managedEmails.some(em => em.email.toLowerCase() === c.email!.toLowerCase()))
      .map(c => c.id);

    // Chỉ những task (cả gốc lẫn tùy biến) thuộc về kênh có Lịch đăng mới được xuất hiện
    const validTasks = tasks.filter(t => activeScheduleChannelIds.includes(t.channelId));
    // virtualTasks vốn dĩ đã được gen từ mảng các kênh có lịch đăng rồi, nên không cần lọc lại ID

    if (canViewAll) {
       list = [...validTasks, ...virtualTasks];
    } else if (currentUserStaff) {
       // Nhân viên chỉ thấy task của mình được giao HOẶC task thuộc Kênh mà họ quản lý
       const myChannels = currentUserStaff.assignedChannelIds || [];
       
       const myTasks = validTasks.filter(t => 
         (t.assigneeIds || []).includes(currentUserStaff.id) || 
         myChannels.includes(t.channelId)
       );
       
       const myVirtuals = virtualTasks.filter(t => 
         myChannels.includes(t.channelId)
       );

       list = [...myTasks, ...myVirtuals];
    }
    // Lọc bỏ triệt để các Task mang Marker '[DELETED]' (để ẩn khỏi UI và không tính KPI)
    return list.filter(t => !t.title.startsWith('[DELETED]'));
  }, [tasks, virtualTasks, canViewAll, currentUserStaff]);

  const displayStaffList = useMemo(() => {
    if (canViewAll) return staffList;
    if (!currentUserStaff) return [];
    return [currentUserStaff];
  }, [staffList, canViewAll, currentUserStaff]);

  // KPI Calculations
  const monthTasks = viewableTasks.filter(t => isSameMonth(new Date(t.dueDate), currentDate));
  const publishedCount = monthTasks.filter(t => t.status === 'published').length;
  const totalTarget = monthTasks.length;

  const staffKPI = useMemo(() => {
    return displayStaffList.map(staff => {
      const assignedTasks = monthTasks.filter(t => (t.assigneeIds || []).includes(staff.id));
      const postedTasks = assignedTasks.filter(t => t.status === 'published');
      return {
        ...staff,
        assigned: assignedTasks.length,
        posted: postedTasks.length,
        percent: assignedTasks.length > 0 ? Math.round((postedTasks.length / assignedTasks.length) * 100) : 0
      };
    }).sort((a, b) => b.posted - a.posted);
  }, [monthTasks, displayStaffList]);

  const dailyProduction = useMemo(() => {
    const today = new Date();
    const todayTasks = viewableTasks.filter(t => isSameDay(new Date(t.dueDate), today));
    return {
      total: todayTasks.length,
      published: todayTasks.filter(t => t.status === 'published').length
    };
  }, [viewableTasks]);

  const filteredTasks = useMemo(() => {
    return viewableTasks.filter(t => {
      const channelMatch = filterChannel === 'all' || t.channelId === filterChannel;
      const staffMatch = filterStaff === 'all' || (t.assigneeIds || []).includes(filterStaff);

      return channelMatch && staffMatch;
    });
  }, [viewableTasks, filterChannel, filterStaff]);

  return (
    <div className="space-y-6 flex flex-col h-full pb-12">
      {/* Header & KPI Summary */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="text-blue-600" size={28} />
            Lịch Đăng & Quản lý KPI DTA
          </h1>
          <p className="text-sm text-gray-500 mt-1">Theo dõi tiến độ đăng video và hiệu suất nhân sự hàng ngày của DTA Studio.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Bộ chuyển đổi calendarView Premium */}
          <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 shadow-sm shrink-0">
            <button
              onClick={() => setCalendarView('month')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                calendarView === 'month'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Tháng
            </button>
            <button
              onClick={() => setCalendarView('week')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                calendarView === 'week'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Tuần
            </button>
            <button
              onClick={() => setCalendarView('day')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                calendarView === 'day'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Ngày
            </button>
          </div>

          <div className="flex bg-white border border-gray-300 rounded-lg p-1 shadow-sm shrink-0">
            <button onClick={prevDate} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"><ChevronLeft size={18} /></button>
            <button onClick={goToToday} className="px-3 py-1 text-sm font-bold hover:bg-gray-100 rounded-md transition-colors text-gray-700">
              {calendarView === 'month' && `Tháng ${format(currentDate, 'MM/yyyy')}`}
              {calendarView === 'week' && `Tuần ${format(currentDate, 'w/yyyy', { weekStartsOn: 1 })} (${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM')})`}
              {calendarView === 'day' && `Ngày ${format(currentDate, 'dd/MM/yyyy')}`}
            </button>
            <button onClick={nextDate} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"><ChevronRight size={18} /></button>
          </div>

          <select
            value={filterChannel}
            onChange={e => setFilterChannel(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
          >
            <option value="all">Tất cả kênh</option>
            {channels.map(c => <option key={c.id} value={c.id}>[{c.channelCode}] {c.name}</option>)}
          </select>

          {canViewAll && (
            <select
              value={filterStaff}
              onChange={e => setFilterStaff(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            >
              <option value="all">Tất cả nhân sự</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}

          {hasPermission('calendar_edit') && (
            <button
              onClick={() => {
                if (setActiveTab) setActiveTab('tasks');
                else handleOpenModal();
              }}
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
            <p className="text-xs text-gray-500 font-medium">{canViewAll ? 'Nhân sự tích cực' : 'Tiến độ'}</p>
            <p className="text-xl font-bold text-gray-900">{staffKPI.filter(s => s.posted > 0).length} / {displayStaffList.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        {/* Main Calendar Area */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden transition-all">
          
          {/* MONTH VIEW */}
          {calendarView === 'month' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Days of week header */}
              <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 shrink-0">
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
                  
                  const now = new Date();
                  now.setHours(0, 0, 0, 0);
                  const isPastDay = day < now;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (dayTasks.length > 0) {
                          setSelectedDay(day);
                        }
                      }}
                      className={`min-h-[100px] border-r border-b border-gray-100 p-2 transition-colors cursor-pointer hover:bg-gray-50/50 group 
                        ${!isCurrentMonth ? 'bg-gray-50/30' : ''} 
                        ${isTodayDay ? 'bg-blue-50 border-2 border-blue-400' : ''} 
                        ${isPastDay && !isTodayDay ? 'opacity-50 grayscale bg-gray-50/60' : ''}
                      `}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className={`text-xs font-bold ${isTodayDay ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center' :
                          isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                          }`}>
                          {format(day, 'd')}
                        </span>
                        {hasPermission('calendar_edit') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (setActiveTab) setActiveTab('tasks');
                              else handleOpenModal(undefined, day);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 transition-opacity"
                            title="Tạo lịch đăng mới"
                          >
                            <Plus size={14} />
                          </button>
                        )}
                      </div>

                      {dayTasks.length > 0 && (
                        <div className="flex flex-col gap-1 mt-2">
                          <div className="text-center p-1.5 bg-blue-50 border border-blue-100 rounded-lg">
                            <span className="text-lg font-black text-blue-600">{dayTasks.length}</span>
                            <p className="text-[10px] text-blue-500 font-medium tracking-wide uppercase mt-0.5">Video</p>
                          </div>
                          <div className="flex justify-between text-[10px] font-medium mt-1 px-1">
                            <span className="text-gray-500">Đã đăng:</span>
                            <span className="text-green-600 font-bold">{dayTasks.filter(t => t.status === 'published').length}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* WEEK VIEW */}
          {calendarView === 'week' && (
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
              {/* Header các ngày trong tuần */}
              <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 shrink-0">
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((dayName, index) => {
                  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
                  const dayDate = addDays(weekStart, index);
                  const isDayToday = isToday(dayDate);
                  return (
                    <div key={dayName} className={`py-2 text-center border-r border-gray-100 last:border-r-0 ${isDayToday ? 'bg-blue-50/50' : ''}`}>
                      <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{dayName}</div>
                      <div className={`mt-0.5 inline-flex w-7 h-7 items-center justify-center text-xs font-bold rounded-full ${
                        isDayToday ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-700'
                      }`}>
                        {format(dayDate, 'dd')}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Lưới các cột công việc theo tuần */}
              <div className="flex-1 grid grid-cols-7 overflow-y-auto divide-x divide-gray-100">
                {Array.from({ length: 7 }).map((_, index) => {
                  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
                  const dayDate = addDays(weekStart, index);
                  const dayTasks = filteredTasks
                    .filter(t => isSameDay(new Date(t.dueDate), dayDate))
                    .sort((a, b) => (a.publishTime || '00:00').localeCompare(b.publishTime || '00:00'));

                  return (
                    <div 
                      key={index} 
                      className={`p-2 space-y-2 min-h-[300px] hover:bg-gray-50/30 transition-colors flex flex-col`}
                      onClick={() => {
                        if (dayTasks.length > 0) {
                          setSelectedDay(dayDate);
                        }
                      }}
                    >
                      <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 pb-1 border-b border-gray-50 shrink-0">
                        <span>{dayTasks.length} Video</span>
                        {hasPermission('calendar_edit') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenModal(undefined, dayDate);
                            }}
                            className="p-0.5 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <Plus size={12} />
                          </button>
                        )}
                      </div>

                      <div className="flex-1 space-y-1.5 overflow-y-auto pr-0.5">
                        {dayTasks.map(task => {
                          const channel = channels.find(c => c.id === task.channelId);
                          const isPublished = task.status === 'published';
                          
                          return (
                            <div
                              key={task.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenModal(task);
                              }}
                              className={`p-2 rounded-lg border text-left transition-all hover:shadow-sm cursor-pointer ${
                                isPublished 
                                  ? 'bg-green-50/40 border-green-200 hover:bg-green-50/70' 
                                  : 'bg-white border-gray-100 hover:border-gray-200'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className={`font-mono text-[9px] font-bold px-1 py-0.5 rounded ${
                                  isPublished ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'
                                }`}>
                                  {task.publishTime || '10:00'}
                                </span>
                                <span className={`text-[8px] font-bold uppercase ${
                                  task.videoType === 'shorts' ? 'text-red-500' : 'text-blue-500'
                                }`}>
                                  {task.videoType === 'shorts' ? 'Shorts' : 'Long'}
                                </span>
                              </div>
                              <h4 className="text-[11px] font-bold text-gray-900 line-clamp-2 leading-tight" title={task.title}>
                                {task.title}
                              </h4>
                              {channel && (
                                <div className="text-[9px] text-gray-500 font-bold truncate mt-1">
                                  [{channel.channelCode}] {channel.name}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {dayTasks.length === 0 && (
                          <div className="h-full flex items-center justify-center text-center py-10">
                            <span className="text-[10px] text-gray-300 italic font-medium">Trống</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DAY VIEW */}
          {calendarView === 'day' && (
            <div className="flex-1 flex flex-col overflow-hidden bg-white p-5">
              {/* Thống kê nhanh ngày hôm nay */}
              {(() => {
                const dayTasks = filteredTasks
                  .filter(t => isSameDay(new Date(t.dueDate), currentDate))
                  .sort((a, b) => (a.publishTime || '00:00').localeCompare(b.publishTime || '00:00'));
                const published = dayTasks.filter(t => t.status === 'published').length;
                const pending = dayTasks.length - published;

                return (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-4 mb-4 shrink-0 gap-3">
                      <div>
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                          Danh sách video Ngày {format(currentDate, 'dd/MM/yyyy')}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">Quản lý trực quan chi tiết quy trình sản xuất.</p>
                      </div>
                      
                      <div className="flex gap-2">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-100">
                          Tổng số: {dayTasks.length} video
                        </span>
                        <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-lg border border-green-100">
                          Đã đăng: {published}
                        </span>
                        <span className="px-2.5 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-100">
                          Còn lại: {pending}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                      {dayTasks.map(task => {
                        const channel = channels.find(c => c.id === task.channelId);
                        const isPublished = task.status === 'published';
                        
                        return (
                          <div 
                            key={task.id}
                            className={`p-4 rounded-xl border transition-all hover:shadow-md cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                              isPublished ? 'bg-green-50/30 border-green-200' : 'bg-white border-gray-200'
                            }`}
                            onClick={() => handleOpenModal(task)}
                          >
                            <div className="flex-1 flex items-start gap-4">
                              {/* Vạch giờ giấc bên trái */}
                              <div className="flex flex-col items-center justify-center shrink-0 w-16 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                                <Clock size={16} className={`mb-1 ${isPublished ? 'text-green-600' : 'text-blue-600'}`} />
                                <span className="font-mono text-xs font-bold text-gray-900">{task.publishTime || '10:00'}</span>
                              </div>

                              {/* Chi tiết ở giữa */}
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                  {channel && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 rounded border border-indigo-100 uppercase tracking-wide">
                                      [{channel.channelCode}] {channel.name}
                                    </span>
                                  )}
                                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wide ${
                                    task.videoType === 'shorts' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                                  }`}>
                                    {task.videoType === 'shorts' ? 'Shorts' : 'Long Video'}
                                  </span>
                                  {task.priority === 'high' && (
                                    <span className="px-2 py-0.5 text-[9px] font-extrabold bg-red-100 text-red-800 rounded animate-pulse">
                                      ƯU TIÊN CAO
                                    </span>
                                  )}
                                </div>
                                
                                <h4 className="font-bold text-gray-950 text-sm leading-snug">{task.title}</h4>
                                
                                {/* AI Golden Hour Explanation (Lý giải AI) */}
                                {task.bestPublishTimeExplanation && (
                                  <div className="mt-2 p-2 bg-indigo-50/50 rounded-lg border border-indigo-100/50 text-[11px] text-indigo-800 flex items-start gap-1.5 max-w-2xl shadow-sm">
                                    <Sparkles size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                                    <span className="font-medium">{task.bestPublishTimeExplanation}</span>
                                  </div>
                                )}

                                {/* Links & Cost */}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-xs text-gray-500 font-medium">
                                  {task.scriptLink && (
                                    <a 
                                      href={task.scriptLink} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      onClick={e => e.stopPropagation()}
                                      className="text-blue-600 hover:underline flex items-center gap-1 font-bold"
                                    >
                                      📝 Kịch bản
                                    </a>
                                  )}
                                  {task.thumbnailLink && (
                                    <a 
                                      href={task.thumbnailLink} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      onClick={e => e.stopPropagation()}
                                      className="text-amber-600 hover:underline flex items-center gap-1 font-bold"
                                    >
                                      🖼️ Thumbnail
                                    </a>
                                  )}
                                  {task.productionCost ? (
                                    <span className="text-gray-700 font-bold bg-gray-100 px-1.5 py-0.5 rounded">
                                      Chi phí: {task.productionCost.toLocaleString('vi-VN')} VND
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            {/* Người phụ trách & Trạng thái Workflow */}
                            <div className="flex flex-col items-start md:items-end gap-3 shrink-0 self-stretch md:self-auto border-t md:border-t-0 pt-3 md:pt-0 mt-3 md:mt-0 border-gray-100">
                              <div className="flex flex-wrap items-center gap-1.5 justify-end">
                                {(() => {
                                  const channelStaffIds = staffList.filter(s => s.assignedChannelIds?.includes(channel?.id || '')).map(s => s.id);
                                  const effectiveAssignees = task.assigneeIds && task.assigneeIds.length > 0 ? task.assigneeIds : channelStaffIds;
                                  return effectiveAssignees.map(id => {
                                    const staff = staffList.find(s => s.id === id);
                                    return staff ? (
                                      <span key={id} className="inline-flex items-center text-[10px] font-bold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200 shadow-sm">
                                        <User size={10} className="mr-1 text-gray-400" />
                                        {staff.name}
                                      </span>
                                    ) : null;
                                  });
                                })()}
                              </div>

                              <div className="flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center shadow-sm ${
                                  isPublished ? 'bg-green-100 text-green-800 border-green-200' : 'bg-blue-50 text-blue-800 border-blue-200'
                                }`}>
                                  {isPublished ? <CheckCircle size={14} className="mr-1" /> : <Loader size={14} className="mr-1 animate-spin" />}
                                  {workflowSteps.find(s => s.id === task.status)?.label || task.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {dayTasks.length === 0 && (
                        <div className="py-20 flex flex-col justify-center items-center text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
                          <CalendarIcon size={48} className="text-gray-300 mb-3" />
                          <h4 className="text-sm font-bold text-gray-700">Trống lịch đăng</h4>
                          <p className="text-xs text-gray-400 max-w-xs mt-1">Hôm nay không có video nào được lên lịch. Nhấn "Thêm lịch đăng" ở bên dưới để lên lịch.</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Sidebar: Staff KPI & Performance */}
        <div className="space-y-6 overflow-y-auto pr-1">
          {/* Today's Staff Status */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
              <CheckCircle2 size={16} className="mr-2 text-green-600" /> Trạng thái Hôm nay
            </h2>
            <div className="space-y-3">
              {displayStaffList.map(staff => {
                const today = new Date();
                const todayTasks = viewableTasks.filter(t => (t.assigneeIds || []).includes(staff.id) && isSameDay(new Date(t.dueDate), today));
                const completedToday = todayTasks.length > 0 && todayTasks.every(t => t.status === 'published');
                const hasTasksToday = todayTasks.length > 0;
                
                // Xác định trạng thái nghỉ dựa trên log đăng nhập
                const isOnlineToday = staff.lastLoginAt && isSameDay(new Date(staff.lastLoginAt), today);
                const isOfflineToday = !isOnlineToday;

                return (
                  <div key={staff.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
                    <div className="flex items-center min-w-0">
                      <div className={`w-2 h-2 rounded-full mr-2 shrink-0 ${isOfflineToday ? 'bg-gray-300' : completedToday ? 'bg-green-500' : 'bg-orange-500'
                        }`} title={staff.lastLoginAt ? `Đăng nhập lần cuối: ${format(new Date(staff.lastLoginAt), 'HH:mm dd/MM/yyyy')}` : 'Chưa đăng nhập bao giờ'} />
                      <span className="text-xs font-medium text-gray-700 truncate">{staff.name}</span>
                    </div>
                    <div className="flex items-center shrink-0 ml-2">
                      {isOfflineToday ? (
                        <span className="text-[10px] text-gray-400 italic" title="Chưa đăng nhập hệ thống hôm nay">Nghỉ</span>
                      ) : hasTasksToday ? (
                        completedToday ? (
                          <span className="text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded">Xong</span>
                        ) : (
                          <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">Đang làm</span>
                        )
                      ) : (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">Online</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {displayStaffList.length === 0 && <p className="text-xs text-gray-500 italic text-center py-2">Chưa có nhân sự</p>}
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
              {displayStaffList.length === 0 && <p className="text-xs text-gray-500 italic text-center py-4">Chưa có dữ liệu nhân sự</p>}
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

      {/* Daily Tasks Popup Modal */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-bold text-lg">
                  {format(selectedDay, 'd')}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Danh sách Lịch đăng</h2>
                  <p className="text-sm text-gray-500">Thứ {format(selectedDay, 'i')}, ngày {format(selectedDay, 'dd/MM/yyyy')}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDay(null)} 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto p-5 space-y-3 bg-gray-50/50 flex-1">
              {filteredTasks
                .filter(t => isSameDay(new Date(t.dueDate), selectedDay))
                .sort((a, b) => (a.publishTime || '00:00').localeCompare(b.publishTime || '00:00'))
                .map(task => {
                  const channel = channels.find(c => c.id === task.channelId);
                  const isPublished = task.status === 'published';
                  const currentStepIdx = workflowSteps.findIndex(s => s.id === task.status);

                  return (
                    <div
                      key={task.id}
                      className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${isPublished
                        ? 'bg-green-50/50 border-green-200'
                        : 'bg-white border-gray-200'
                        }`}
                      onClick={() => {
                        setSelectedDay(null);
                        if (setActiveTab) setActiveTab('tasks');
                        else handleOpenModal(task);
                      }}
                    >
                      <div className="flex-1 flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex flex-col items-center justify-center shrink-0 w-16 p-2 bg-gray-50 rounded-lg border border-gray-100">
                          <Clock size={16} className={`mb-1 ${isPublished ? 'text-green-500' : 'text-blue-500'}`} />
                          <span className="font-mono text-sm font-bold text-gray-700">{task.publishTime || '--:--'}</span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {channel && (
                              <span className="px-2 py-0.5 text-xs font-bold bg-gray-100 text-gray-600 rounded">
                                [{channel.channelCode}]
                              </span>
                            )}
                            {task.id.toString().startsWith('virtual-') && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500">
                                ĐỊNH KỲ
                              </span>
                            )}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${task.videoType === 'shorts' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                              {task.videoType === 'shorts' ? 'SHORTS' : 'LONG VIDEO'}
                            </span>
                          </div>
                          <h3 className="font-bold text-gray-900 text-sm truncate">{task.title}</h3>
                          
                          {/* Workflow Progress Mini */}
                          <div className="flex items-center gap-1 mt-2 max-w-xs">
                            {workflowSteps.map((step, stepIdx) => (
                              <div
                                key={step.id}
                                className={`h-1.5 flex-1 rounded-full ${stepIdx <= currentStepIdx ? 'bg-blue-500' : 'bg-gray-200'}`}
                                title={step.label}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-start md:items-end mt-4 md:mt-0 shrink-0">
                         <div className="flex items-center gap-2 mb-2">
                            {(() => {
                               const channelStaffIds = staffList.filter(s => s.assignedChannelIds?.includes(channel?.id || '')).map(s => s.id);
                               const effectiveAssignees = task.assigneeIds && task.assigneeIds.length > 0 
                                  ? task.assigneeIds 
                                  : channelStaffIds;
                               
                               if (effectiveAssignees.length > 0) {
                                  return (
                                    <div className="flex flex-col items-end gap-1">
                                      {effectiveAssignees.map(id => {
                                        const staff = staffList.find(s => s.id === id);
                                        return staff ? (
                                          <div key={id} className="flex items-center text-[11px] text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 shrink-0">
                                            <User size={10} className="mr-1 text-gray-400" />
                                            <span className="font-medium whitespace-nowrap">{staff.name}</span>
                                          </div>
                                        ) : null;
                                      })}
                                    </div>
                                  );
                               }
                               return <span className="text-xs text-gray-400 italic">Chưa phân công</span>;
                            })()}
                         </div>
                         <div className={`px-2 py-1 flex items-center text-xs font-bold rounded-full ${isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                           {isPublished ? <CheckCircle2 size={12} className="mr-1" /> : <Loader size={12} className="mr-1 animate-spin-slow" />}
                           {workflowSteps.find(s => s.id === task.status)?.label || task.status}
                         </div>
                      </div>
                    </div>
                  );
                })}
              {filteredTasks.filter(t => isSameDay(new Date(t.dueDate), selectedDay)).length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Không có video nào được lên lịch cho ngày này.
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-white shrink-0 flex justify-between items-center">
               <button 
                  onClick={() => {
                    setSelectedDay(null);
                    if (setActiveTab) setActiveTab('tasks');
                    else handleOpenModal(undefined, selectedDay);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center transition-colors"
                >
                  <Plus size={16} className="mr-2" /> Thêm lịch đăng
                </button>
                <button 
                  onClick={() => setSelectedDay(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Đóng lại
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
