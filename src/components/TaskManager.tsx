import React, { useState, useMemo } from 'react';
import { VideoTask, Staff, Channel, TaskStatus, DailyReport, Asset } from '../types';
import {
  Briefcase, CheckCircle2, Clock, MessageSquare,
  UserPlus, Send, ClipboardCheck, BarChart3,
  Search, Filter, AlertCircle, CheckCircle,
  PlayCircle, FileText, Calendar, User, Plus, X, Link as LinkIcon,
  LayoutGrid, Kanban
} from 'lucide-react';
import { format, isToday, parseISO, isSameMonth, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';

interface TaskManagerProps {
  tasks: VideoTask[];
  setTasks: React.Dispatch<React.SetStateAction<VideoTask[]>>;
  staffList: Staff[];
  channels: Channel[];
  assets: Asset[]; // Thêm assets vào props
  currentUser: { id: string; name: string; role: string } | null;
  dailyReports: DailyReport[];
  setDailyReports: React.Dispatch<React.SetStateAction<DailyReport[]>>;
  systemSettings?: import('../types').SystemSettings;
}

export function TaskManager({
  tasks, setTasks, staffList, channels, assets, currentUser,
  dailyReports, setDailyReports, systemSettings
}: TaskManagerProps) {
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'all-tasks' | 'marketplace' | 'my-tasks' | 'reports'>(
    (currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'leader') ? 'all-tasks' : 'my-tasks'
  );
  const [reportIssues, setReportIssues] = useState('');
  const [reportExpenses, setReportExpenses] = useState<number | ''>('');
  const [reportPlan, setReportPlan] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'board'>('grid');
  const [taskCommentModal, setTaskCommentModal] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskFormData, setTaskFormData] = useState<Partial<VideoTask>>({
    title: '',
    channelId: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    assigneeIds: [],
    status: 'pending',
    videoType: 'long',
    priority: 'medium',
    notes: '',
    linkedAssetIds: []
  });
  const [taskCategory, setTaskCategory] = useState<'video' | 'channel' | 'office'>('video');
  const [filterStaff, setFilterStaff] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const toggleAssetLink = (assetId: string) => {
    setTaskFormData(prev => {
      const currentLinks = prev.linkedAssetIds || [];
      if (currentLinks.includes(assetId)) {
        return { ...prev, linkedAssetIds: currentLinks.filter(id => id !== assetId) };
      } else {
        return { ...prev, linkedAssetIds: [...currentLinks, assetId] };
      }
    });
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const handleDrop = (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      handleUpdateStatus(taskId, newStatus);
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskCommentModal || !newCommentText.trim() || !currentUser) return;

    setTasks(prev => prev.map(t => {
      if (t.id === taskCommentModal) {
        const newComment = {
          id: Date.now().toString(),
          userId: currentUser.id,
          userName: currentUser.name,
          text: newCommentText.trim(),
          timestamp: new Date().toISOString()
        };
        return { ...t, comments: [...(t.comments || []), newComment] };
      }
      return t;
    }));
    setNewCommentText('');
  };

  const isManager = currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'leader';
  const workflowSteps = systemSettings?.taskStatuses || [];

  const currentStaff = useMemo(() =>
    staffList.find(s => s.name === currentUser?.name || s.id === currentUser?.id),
    [staffList, currentUser]
  );

  const marketplaceTasks = useMemo(() =>
    tasks.filter(t => t.isClaimable && (!t.assigneeIds || t.assigneeIds.length === 0)),
    [tasks]
  );

  // Đã gỡ bỏ virtualTasks khỏi TaskManager để chuyển Kanban thành bảng việc Ad-hoc thuần tuý.

  const myTasks = useMemo(() => {
    if (!currentStaff) return [];
    // Chỉ giữ lại những task thật được giao
    return tasks.filter(t => (t.assigneeIds || []).includes(currentStaff.id));
  }, [tasks, currentStaff]);

  const handleClaimTask = async (taskId: string) => {
    if (!currentStaff) {
      showToast('Không tìm thấy thông tin nhân sự của bạn.', 'error');
      return;
    }

    // Call Supabase carefully to avoid race conditions: Only modify if it is currently claimable
    const { data, error } = await supabase
      .from('video_tasks')
      .update({
        assignee_ids: [currentStaff.id],
        is_claimable: false
      })
      .eq('id', taskId)
      .eq('is_claimable', true)
      .select();

    if (error || !data || data.length === 0) {
      showToast('Lỗi: Công việc này đã có người nhận hoặc không còn tồn tại.', 'error');
      return;
    }

    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, assigneeIds: [currentStaff.id], isClaimable: false }
        : t
    ));
    showToast('Đã nhận việc thành công!', 'success');
  };

  const handleUpdateStatus = async (taskId: string, newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus } : t
    ));
    showToast(`Đã cập nhật trạng thái sang: ${newStatus}`, 'info');
    
    // Update Supabase
    await supabase.from('video_tasks').update({ status: newStatus }).eq('id', taskId);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa công việc này?')) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      showToast('Đã dọn dẹp công việc thành công!', 'info');
      await supabase.from('video_tasks').delete().eq('id', taskId);
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Bạn có chắc muốn xóa ${selectedTaskIds.length} công việc đã chọn?`)) {
      setTasks(prev => prev.filter(t => !selectedTaskIds.includes(t.id)));
      await supabase.from('video_tasks').delete().in('id', selectedTaskIds);
      setSelectedTaskIds([]);
      showToast(`Đã xóa hàng loạt thành công!`, 'info');
    }
  };

  const handleBulkUpdateStatus = async (newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t => selectedTaskIds.includes(t.id) ? { ...t, status: newStatus } : t));
    await supabase.from('video_tasks').update({ status: newStatus }).in('id', selectedTaskIds);
    setSelectedTaskIds([]);
    showToast(`Đã chuyển trạng thái ${selectedTaskIds.length} việc thành công!`, 'success');
  };

  const isTaskOverdue = (task: VideoTask) => {
    const lastStepId = workflowSteps.length > 0 ? workflowSteps[workflowSteps.length - 1].id : 'published';
    return task.status !== lastStepId && task.dueDate < format(new Date(), 'yyyy-MM-dd');
  };

  const dashboardMetrics = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const lastStepId = workflowSteps.length > 0 ? workflowSteps[workflowSteps.length - 1].id : 'published';
    const overdue = myTasks.filter(t => isTaskOverdue(t)).length;
    const inProgress = myTasks.filter(t => t.status !== 'pending' && t.status !== lastStepId).length;
    const completedToday = myTasks.filter(t => t.status === lastStepId && t.dueDate === today).length;
    const totalToday = myTasks.filter(t => t.dueDate === today).length;
    return { overdue, inProgress, completedToday, totalToday };
  }, [myTasks, workflowSteps]);

  const toggleTimeTracking = (taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const tracking = t.timeTracking || { totalSeconds: 0, isRunning: false };
        if (tracking.isRunning) {
          const startTime = tracking.lastStartTime ? new Date(tracking.lastStartTime).getTime() : Date.now();
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          return {
            ...t,
            timeTracking: {
              ...tracking,
              isRunning: false,
              totalSeconds: tracking.totalSeconds + elapsed,
              lastStartTime: undefined
            }
          };
        } else {
          return {
            ...t,
            timeTracking: {
              ...tracking,
              isRunning: true,
              lastStartTime: new Date().toISOString()
            }
          };
        }
      }
      return t;
    }));
  };

  const formatTaskTime = (tracking?: { totalSeconds: number, isRunning: boolean, lastStartTime?: string }) => {
    if (!tracking) return '0h 0m';
    let total = tracking.totalSeconds;
    if (tracking.isRunning && tracking.lastStartTime) {
      const startTime = new Date(tracking.lastStartTime).getTime();
      total += Math.floor((Date.now() - startTime) / 1000);
    }
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return `${h > 0 ? h + 'h ' : ''}${m}m`;
  };

  const displayedTasks = useMemo(() => {
    // CHỈ hiển thị Ad-hoc tasks (Loại bỏ Lịch Định Kỳ & Deleted) 
    let list = activeTab === 'all-tasks' ? tasks : myTasks;
    list = list.filter(t => !t.title.startsWith('[Lịch Định Kỳ]') && !t.title.startsWith('[DELETED]'));
    
    if (filterStaff !== 'all') {
       list = list.filter(t => t.assigneeIds?.includes(filterStaff));
    }
    if (filterStatus !== 'all') {
       list = list.filter(t => t.status === filterStatus);
    }
    if (filterCategory !== 'all') {
       list = list.filter(t => {
         let displayCat = '';
         if (t.title.startsWith('[')) {
           const cb = t.title.indexOf(']');
           if (cb !== -1) displayCat = t.title.substring(1, cb);
         }
         const isOffice = displayCat === 'Hành chính';
         const isChannelSetup = displayCat === 'Khởi tạo kênh' || displayCat.includes('Mail') || displayCat.includes('Khai thác');
         if (filterCategory === 'office') return isOffice;
         if (filterCategory === 'channel') return isChannelSetup;
         if (filterCategory === 'video') return !isOffice && !isChannelSetup;
         return true;
       });
    }

    return list.sort((a, b) => {
      const aOverdue = isTaskOverdue(a);
      const bOverdue = isTaskOverdue(b);
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      return 0;
    });
  }, [tasks, myTasks, activeTab, filterStaff, filterStatus, filterCategory, workflowSteps]);

  const reportFormMetrics = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const lastStepId = workflowSteps.length > 0 ? workflowSteps[workflowSteps.length - 1].id : 'published';
    const completedTasksToday = myTasks.filter(t => t.status === lastStepId && t.dueDate === today)
      .map(t => ({ id: t.id, title: t.title }));
    const pendingTasksToday = myTasks.filter(t => isTaskOverdue(t) || (t.status !== lastStepId && t.dueDate === today))
      .map(t => ({ id: t.id, title: t.title }));
    return { completedTasksToday, pendingTasksToday, today, lastStepId };
  }, [myTasks, workflowSteps]);

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStaff) return;

    const { today, completedTasksToday, pendingTasksToday } = reportFormMetrics;

    const newReport: DailyReport = {
      id: Date.now().toString(),
      staffId: currentStaff.id,
      date: today,
      renderedCount: completedTasksToday.length, // Backward compatibility
      notes: reportIssues, // Backward compatibility
      completedTasks: completedTasksToday,
      pendingTasks: pendingTasksToday,
      issues: reportIssues,
      expenses: Number(reportExpenses) || 0,
      planTomorrow: reportPlan,
      timestamp: new Date().toISOString()
    };

    setDailyReports(prev => [...prev, newReport]);
    setReportIssues('');
    setReportExpenses('');
    setReportPlan('');
    showToast('Đã gửi báo cáo cuối ngày phân tích tự động thành công!', 'success');
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskFormData.title || !taskFormData.dueDate) {
      showToast('Vui lòng điền đủ Tên việc và Thời hạn.', 'error');
      return;
    }
    
    if (taskCategory === 'video' && !taskFormData.channelId) {
       showToast('Vui lòng chọn Kênh đăng cho video.', 'error');
       return;
    }

    const newTask: VideoTask = {
      id: Date.now().toString(),
      title: taskCategory === 'office' ? `[Hành chính] ${taskFormData.title}` : (taskCategory === 'channel' ? `[Quản lý Kênh/Mail] ${taskFormData.title}` : taskFormData.title),
      channelId: taskCategory === 'video' ? (taskFormData.channelId || '') : '', // Việc ngoài kênh ko cần id
      status: 'pending', // Mặc định là pending khi mới tạo
      assigneeIds: taskFormData.assigneeIds || [],
      dueDate: taskFormData.dueDate,
      videoType: taskCategory === 'video' ? (taskFormData.videoType as any) : undefined,
      priority: taskFormData.priority as any,
      notes: taskFormData.notes || '',
      isClaimable: (!taskFormData.assigneeIds || taskFormData.assigneeIds.length === 0),
      linkedAssetIds: taskCategory === 'video' ? (taskFormData.linkedAssetIds || []) : [],
    };

    setTasks(prev => [...prev, newTask]);
    setIsTaskModalOpen(false);
    showToast(newTask.isClaimable ? 'Đã đẩy việc mới ra Chợ Việc!' : 'Đã giao việc thành công!', 'success');

    // Reset Form
    setTaskFormData({
      title: '',
      channelId: channels[0]?.id || '',
      dueDate: format(new Date(), 'yyyy-MM-dd'),
      assigneeIds: [],
      status: 'pending',
      videoType: 'long',
      priority: 'medium',
      notes: '',
      linkedAssetIds: []
    });
    setTaskCategory('video');
  };

  

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Công việc</h1>
          <p className="text-sm text-gray-500 mt-1">Giao việc, nhận việc và báo cáo hiệu suất hàng ngày</p>
        </div>
        {hasPermission('tasks_edit') && (
          <button
            onClick={() => setIsTaskModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center shadow-sm"
          >
            <Plus size={20} className="mr-2" /> Giao việc mới
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap gap-y-1">
        {isManager && (
          <button
            onClick={() => setActiveTab('all-tasks')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center ${activeTab === 'all-tasks' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Briefcase size={16} className="mr-2" /> Tất cả việc (Quản lý)
          </button>
        )}
        <button
          onClick={() => setActiveTab('my-tasks')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center ${activeTab === 'my-tasks' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <Briefcase size={16} className="mr-2" /> Việc của tôi
        </button>
        <button
          onClick={() => setActiveTab('marketplace')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center ${activeTab === 'marketplace' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <Search size={16} className="mr-2" /> Chợ việc (Rao việc)
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center ${activeTab === 'reports' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <ClipboardCheck size={16} className="mr-2" /> Báo cáo & KPI
        </button>
      </div>

      {/* BỘ LỌC VÀ THAO TÁC HÀNG LOẠT */}
      {(activeTab === 'my-tasks' || activeTab === 'all-tasks') && (
        <div className="space-y-4">
          
          {/* Mini Dashboard cho Việc Của Tôi */}
          {activeTab === 'my-tasks' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-20"><AlertCircle size={48} className="text-red-500" /></div>
                <p className="text-red-600 text-sm font-bold uppercase mb-1 relative z-10">Cần xử lý ngay</p>
                <div className="flex items-end space-x-2 relative z-10">
                  <span className="text-3xl font-black text-red-700 leading-none">{dashboardMetrics.overdue}</span>
                  <span className="text-red-600/80 text-xs font-semibold pb-1">việc quá hạn</span>
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-20"><Clock size={48} className="text-blue-500" /></div>
                <p className="text-blue-600 text-sm font-bold uppercase mb-1 relative z-10">Đang thực hiện</p>
                <div className="flex items-end space-x-2 relative z-10">
                  <span className="text-3xl font-black text-blue-700 leading-none">{dashboardMetrics.inProgress}</span>
                  <span className="text-blue-600/80 text-xs font-semibold pb-1">việc trên tay</span>
                </div>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-20"><CheckCircle2 size={48} className="text-emerald-500" /></div>
                <p className="text-emerald-600 text-sm font-bold uppercase mb-1 relative z-10">Đã xong hôm nay</p>
                <div className="flex items-end space-x-2 relative z-10">
                  <span className="text-3xl font-black text-emerald-700 leading-none">{dashboardMetrics.completedToday}</span>
                  <span className="text-emerald-600/80 text-xs font-semibold pb-1">/ {dashboardMetrics.totalToday} hạn hôm nay</span>
                </div>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-sm flex flex-col justify-center items-center text-center">
                <p className="text-amber-700 text-sm font-bold mb-2">Thông báo mới</p>
                <span className="text-amber-800 text-xs truncate w-full px-2 italic">Chưa có thông báo nào.</span>
                <button className="text-[10px] text-amber-600 font-bold uppercase mt-2 hover:underline">Xem tất cả</button>
              </div>
            </div>
          )}

          {/* Header Filters */}
          <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-100 items-center justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-gray-100 p-1 rounded-lg mr-2 shrink-0">
                <button onClick={() => setViewMode('grid')} className={`px-2.5 py-1.5 rounded-md flex items-center text-xs font-bold transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                  <LayoutGrid size={14} className="mr-1" /> Lưới
                </button>
                <button onClick={() => setViewMode('board')} className={`px-2.5 py-1.5 rounded-md flex items-center text-xs font-bold transition-all ${viewMode === 'board' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                  <Kanban size={14} className="mr-1" /> Bảng
                </button>
              </div>
              <div className="flex items-center text-gray-500 px-2 shrink-0">
                <Filter size={18} className="mr-2" /> Lọc việc:
              </div>
              
              {activeTab === 'all-tasks' && (
                <select 
                  value={filterStaff} 
                  onChange={e => setFilterStaff(e.target.value)} 
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white min-w-[150px]"
                >
                  <option value="all">Tất cả nhân sự</option>
                  {staffList.filter(s => s.role !== 'admin').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}

              <select 
                value={filterStatus} 
                onChange={e => setFilterStatus(e.target.value)} 
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white min-w-[150px]"
              >
                <option value="all">Tất cả trạng thái</option>
                {workflowSteps.map(step => <option key={step.id} value={step.id}>{step.label}</option>)}
              </select>

              <select 
                value={filterCategory} 
                onChange={e => setFilterCategory(e.target.value)} 
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white min-w-[150px]"
              >
                <option value="all">Tất cả loại việc</option>
                <option value="video">Sản xuất Video</option>
                <option value="channel">Kênh / Mail</option>
                <option value="office">Hành chính</option>
              </select>
            </div>
            
            {/* Nút Chọn Tất Cả */}
            <div className="shrink-0">
              <label className="flex items-center space-x-2 cursor-pointer text-sm font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors">
                <input 
                  type="checkbox" 
                  checked={displayedTasks.length > 0 && selectedTaskIds.length === displayedTasks.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTaskIds(displayedTasks.map(t => t.id));
                    } else {
                      setSelectedTaskIds([]);
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>Chọn tất cả</span>
              </label>
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selectedTaskIds.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-sm transform transition-all">
              <span className="text-sm font-medium text-blue-800 flex items-center">
                <CheckCircle2 size={16} className="mr-2" />
                Đã chọn <strong>{selectedTaskIds.length}</strong> công việc
              </span>
              <div className="flex space-x-2 flex-wrap gap-y-2">
                <select className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white font-medium" 
                  onChange={(e) => { 
                    if (e.target.value) handleBulkUpdateStatus(e.target.value as TaskStatus); 
                    e.target.value = ''; 
                  }}>
                  <option value="">-- Cập nhật trạng thái --</option>
                  {workflowSteps.map(step => <option key={step.id} value={step.id}>{step.label}</option>)}
                </select>
                
                {hasPermission('tasks_edit') && (
                  <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 transition-colors">
                    Xóa việc đã chọn
                  </button>
                )}
                <button onClick={() => setSelectedTaskIds([])} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300 transition-colors">
                  Hủy chọn
                </button>
              </div>
            </div>
          )}

          {/* Dàn GRID hiển thị Task */}
          {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedTasks.length > 0 ? (
              displayedTasks.map((task, index) => {
                const channel = channels.find(c => c.id === task.channelId);
                const assignedStaffArr = (task.assigneeIds || []).map(id => staffList.find(s => s.id === id)).filter(Boolean);
                const isSelected = selectedTaskIds.includes(task.id);
              
              // Tách phần prefix [Loại việc] nếu có
              let displayCategory = '';
              let displayTitle = task.title;
              if (task.title.startsWith('[')) {
                const closeBrackIndex = task.title.indexOf(']');
                if (closeBrackIndex !== -1) {
                  displayCategory = task.title.substring(1, closeBrackIndex);
                  displayTitle = task.title.substring(closeBrackIndex + 1).trim();
                }
              }

              // Color configs
              const isHighPriority = task.priority === 'high';
              const isChannelSetup = displayCategory === 'Khởi tạo kênh' || displayCategory.includes('Mail') || displayCategory.includes('Khai thác');
              const isOffice = displayCategory === 'Hành chính';
              const overdue = isTaskOverdue(task);
              
              const borderStyles = overdue
                ? 'border-2 border-red-500 bg-red-50 ring-4 ring-red-500/20'
                : isHighPriority 
                ? 'border-l-4 border-l-red-500 border-y border-r border-red-200 bg-red-50/20' 
                : isChannelSetup 
                  ? 'border-l-4 border-l-indigo-500 border-y border-r border-gray-200 bg-white' 
                  : isOffice
                    ? 'border-l-4 border-l-emerald-500 border-y border-r border-gray-200 bg-white'
                    : 'border-l-4 border-l-blue-500 border-y border-r border-gray-200 bg-white';

              return (
                <div key={task.id} className={`p-4 rounded-xl shadow-sm hover:shadow-md transition-all relative ${borderStyles} ${isSelected ? 'ring-2 ring-blue-500 scale-[1.01]' : ''}`}>
                  {/* Cột Checkbox bên trái trên cùng */}
                  <div className="absolute top-4 left-3 z-20">
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedTaskIds(prev => [...prev, task.id]);
                        else setSelectedTaskIds(prev => prev.filter(id => id !== task.id));
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm"
                    />
                  </div>

                  {/* Số thứ tự lớn ở góc phải */}
                  <div className="absolute top-2 right-4 text-4xl font-black text-gray-100/60 pointer-events-none select-none z-0">
                    #{index + 1}
                  </div>

                  <div className="flex justify-between items-start mb-3 relative z-10 pl-6">
                    <div className="flex items-start space-x-3 w-full pr-16">
                      {/* Left Icon (Avatar/Type) */}
                      <div className={`p-2.5 shrink-0 rounded-xl flex items-center justify-center ${
                          isHighPriority ? 'bg-red-100 text-red-600' : 
                          isChannelSetup ? 'bg-indigo-100 text-indigo-700' : 
                          isOffice ? 'bg-emerald-100 text-emerald-700' : 
                          'bg-blue-100 text-blue-700'
                        }`}>
                        {isOffice ? <Briefcase size={20} /> : isChannelSetup ? <UserPlus size={20} /> : <PlayCircle size={20} />}
                      </div>

                      {/* Main Info */}
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          {displayCategory && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                              isHighPriority ? 'bg-red-200 text-red-800' : 
                              isChannelSetup ? 'bg-indigo-600 text-white' : 
                              isOffice ? 'bg-emerald-600 text-white' : 
                              'bg-gray-200 text-gray-700'
                            }`}>
                              {displayCategory}
                            </span>
                          )}
                          {overdue && (
                            <span className="flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-600 text-white animate-pulse">
                              <AlertCircle size={10} className="mr-1" /> Chậm tiến độ
                            </span>
                          )}
                          {isHighPriority && !overdue && (
                            <span className="flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-800 border border-red-200">
                              <AlertCircle size={10} className="mr-1" /> P1 Cao
                            </span>
                          )}
                          {task.priority === 'medium' && !overdue && (
                            <span className="flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                              P2 TB
                            </span>
                          )}
                          {task.priority === 'low' && !overdue && (
                            <span className="flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-600 border border-gray-200">
                              P3 Thấp
                            </span>
                          )}
                        </div>
                        
                        <h3 className={`font-bold text-base mb-1.5 leading-tight ${isHighPriority ? 'text-red-900' : 'text-gray-900'}`}>{displayTitle}</h3>
                        
                        {assignedStaffArr.length > 0 && activeTab === 'all-tasks' && (
                          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                            <User size={12} className="text-gray-400" />
                            {assignedStaffArr.map(s => (
                              <span key={s?.id} className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                                {s?.name}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center text-xs gap-2">
                          {channel && (
                            <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                              [{channel.channelCode}] {channel.name}
                            </span>
                          )}
                          <span className={`flex items-center px-1.5 py-0.5 rounded font-medium ${isHighPriority ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                            <Clock size={12} className="mr-1" /> Hạn: {format(parseISO(task.dueDate), 'dd/MM/yyyy')}
                          </span>
                          
                          {task.linkedAssetIds && task.linkedAssetIds.length > 0 && (
                            <span className="flex items-center text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 font-medium">
                              <LinkIcon size={12} className="mr-1" /> {task.linkedAssetIds.length} tài nguyên
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Status current state */}
                    <div className="shrink-0 hidden md:block relative z-10">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border shadow-sm ${workflowSteps.find(s => s.id === task.status)?.color}`}>
                        {workflowSteps.find(s => s.id === task.status)?.label}
                      </span>
                    </div>
                  </div>

                  {/* Render SubTasks Lịch Đăng Nằm Ngang (nếu là dạng Grouped Mode) */}
                  {(task as any).isGrouped && (task as any).subTasks && (
                     <div className="flex flex-wrap items-center gap-2 mb-3 px-6 py-2 bg-gray-50/80 rounded-lg border border-gray-100">
                        {((task as any).subTasks as VideoTask[]).map(st => {
                           const isSuccess = workflowSteps.findIndex(s => s.id === st.status) === workflowSteps.length - 1;
                           return (
                             <div key={st.id} className={`flex items-center px-2 py-1 rounded shadow-sm text-xs font-bold transition-colors ${
                               isSuccess ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-white text-gray-600 border border-gray-200'
                             }`}>
                               <Clock size={12} className="mr-1" /> {st.publishTime || '--:--'}
                               {isSuccess && <CheckCircle2 size={12} className="ml-1" />}
                             </div>
                           )
                        })}
                     </div>
                  )}

                  {/* Workflow Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100 relative z-10 w-full">
                    <div className="flex flex-wrap gap-2">
                      {workflowSteps.map(step => (
                        <button
                          key={step.id}
                          onClick={() => handleUpdateStatus(task.id, step.id)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${task.status === step.id
                            ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600'
                            }`}
                        >
                          {step.label}
                        </button>
                      ))}
                    </div>
                    
                    {/* Actions right */}
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setTaskCommentModal(task.id)}
                        className="flex items-center text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors border border-gray-100 placeholder:shrink-0"
                        title="Bình luận"
                      >
                        <MessageSquare size={12} className="mr-1" /> {(task.comments || []).length}
                      </button>
                        {hasPermission('tasks_edit') && (
                          <button 
                            onClick={() => handleDeleteTask(task.id)}
                            className="flex items-center text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors border border-red-100 placeholder:shrink-0"
                            title="Xóa công việc này"
                          >
                            Xóa việc
                          </button>
                        )}
                      </div>
                      <div className="w-full flex justify-end mt-2 md:mt-0 md:w-auto">
                        <button
                          onClick={() => toggleTimeTracking(task.id)}
                          className={`flex items-center px-2 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                            task.timeTracking?.isRunning 
                              ? 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse shadow-inner' 
                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          <Clock size={12} className={`mr-1.5 ${task.timeTracking?.isRunning ? 'animate-spin-slow' : ''}`} />
                          {task.timeTracking?.isRunning ? 'Đang đo...' : 'Tính giờ'}
                          <span className="ml-1.5 px-1 bg-white/50 rounded">{formatTaskTime(task.timeTracking)}</span>
                        </button>
                      </div>
                    </div>
                </div>
              );
            })
            ) : (
              <div className="col-span-1 md:col-span-2 text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 shadow-sm">
                <Briefcase size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 font-medium">Bạn chưa có công việc nào (hoặc không tìm thấy theo bộ lọc hiện tại).</p>
                <button
                  onClick={() => {
                    setFilterCategory('all');
                    setFilterStaff('all');
                    setFilterStatus('all');
                  }}
                  className="mt-4 text-blue-600 font-bold hover:underline"
                >
                  Xóa bộ lọc
                </button>
              </div>
            )}
          </div>
          ) : (
            /* Board View */
            <div className="flex overflow-x-auto space-x-4 pb-6 items-start min-h-[70vh] custom-scrollbar">
              {workflowSteps.map(step => {
                const colTasks = displayedTasks.filter(t => t.status === step.id);
                return (
                  <div 
                    key={step.id} 
                    className="bg-gray-100 rounded-xl p-3 w-[min(100%,320px)] shrink-0 border border-gray-200 flex flex-col max-h-[70vh]"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, step.id)}
                  >
                    <div className="flex justify-between items-center mb-3 px-1 sticky top-0 bg-gray-100 z-10 py-1">
                      <h3 className={`font-bold text-sm ${step.color?.includes('text-') ? step.color.split(' ').find(c => c.startsWith('text-')) : 'text-gray-700'}`}>{step.label}</h3>
                      <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs font-bold">{colTasks.length}</span>
                    </div>
                    <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pb-2 px-1">
                      {colTasks.length === 0 ? (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg h-20 flex items-center justify-center text-xs text-gray-400">
                          Thả công việc vào đây
                        </div>
                      ) : (
                        colTasks.map((task, index) => {
                          const assignedStaffArr = (task.assigneeIds || []).map(id => staffList.find(s => s.id === id)).filter(Boolean);
                          const overdue = isTaskOverdue(task);
                          const isHighPriority = task.priority === 'high';
                          
                          let category = '';
                          let pureTitle = task.title;
                          if (pureTitle.startsWith('[')) {
                            const closeIdx = pureTitle.indexOf(']');
                            if (closeIdx !== -1) {
                              category = pureTitle.substring(1, closeIdx);
                              pureTitle = pureTitle.substring(closeIdx + 1).trim();
                            }
                          }

                          return (
                            <div 
                              key={task.id} 
                              draggable
                              onDragStart={(e) => handleDragStart(e, task.id)}
                              className={`p-3 rounded-lg shadow-sm border bg-white cursor-grab hover:shadow-md transition-all active:cursor-grabbing relative overflow-hidden ${overdue ? 'border-red-500 ring-2 ring-red-500/50' : isHighPriority ? 'border-l-4 border-l-red-500' : 'border-gray-200'}`}
                            >
                              <div className="flex justify-between items-start mb-2 gap-2">
                                <h4 className="text-sm font-bold text-gray-900 leading-snug">{pureTitle}</h4>
                                {overdue && <AlertCircle size={14} className="text-red-500 shrink-0" />}
                              </div>
                              {category && <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold rounded mb-2 uppercase ${overdue ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{category}</span>}
                              
                              {/* Khối này đã được dọn sạch do không còn Virtual Grouped Tasks */}
                              <div className="flex justify-between items-end mt-2">
                                <div className="flex -space-x-1.5 overflow-hidden">
                                  {assignedStaffArr.map(s => (
                                    <div key={s?.id} title={s?.name} className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold border-2 border-white">
                                      {s?.name?.charAt(0)}
                                    </div>
                                  ))}
                                  {assignedStaffArr.length === 0 && (
                                    <div className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 text-gray-400 flex items-center justify-center text-[10px]">?</div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => setTaskCommentModal(task.id)} className="flex items-center text-gray-500 hover:text-blue-600 text-xs bg-gray-50 px-1.5 py-0.5 rounded">
                                    <MessageSquare size={12} className="mr-1" /> {(task.comments || []).length}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'marketplace' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {marketplaceTasks.length > 0 ? (
            marketplaceTasks.map(task => {
              const channel = channels.find(c => c.id === task.channelId);
              const isChannelSetup = task.title.includes('[Khởi tạo kênh]');
              return (
                <div key={task.id} className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden border-l-4 ${isChannelSetup ? 'border-l-indigo-500 border-y border-r border-gray-100' : 'border-l-blue-500 border-y border-r border-gray-100'}`}>
                  <div className="p-5 flex-grow">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg mt-0.5 ${isChannelSetup ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'}`}>
                          {isChannelSetup ? <UserPlus size={20} /> : <PlayCircle size={20} />}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 leading-tight">{task.title}</h3>
                          <div className="mt-1.5 flex flex-wrap items-center text-xs gap-2">
                             <span className="font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded flex items-center">
                               {channel ? `[${channel.channelCode}]` : 'Kênh Mới'}
                             </span>
                             <span className="flex items-center text-gray-500">
                               <Calendar size={12} className="mr-1" /> {format(parseISO(task.dueDate), 'dd/MM/yyyy')}
                             </span>
                          </div>
                        </div>
                      </div>
                      {task.priority === 'high' && (
                        <span className="shrink-0 flex items-center text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100 ml-2">
                          <AlertCircle size={10} className="mr-1" /> ƯU TIÊN CAO
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-4 space-y-2">
                      <div className="flex items-start">
                        <FileText size={14} className="text-gray-400 mt-0.5 mr-2 shrink-0" />
                        <span className="text-sm font-medium text-gray-700">Loại: <span className="text-gray-900">{isChannelSetup ? 'Thiết lập Kênh / Ngâm Email' : (task.videoType === 'shorts' ? 'Video Shorts' : 'Video Dài')}</span></span>
                      </div>
                      {task.notes && (
                        <div className="bg-gray-50/80 p-3 rounded border border-gray-100 text-xs text-gray-600 mt-2 whitespace-pre-line">
                           {task.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50/50 border-t border-gray-100">
                    <button
                      onClick={() => handleClaimTask(task.id)}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center shadow-sm"
                    >
                      <CheckCircle size={18} className="mr-2" /> Nhận việc ngay
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <Search size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Hiện tại không có công việc nào đang rao.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Dashboard Cá Nhân - Left Column */}
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <BarChart3 size={18} className="mr-2 text-blue-600" /> Thống kê hôm nay của bạn
              </h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                  <p className="text-xs text-green-700 font-semibold mb-1">Đã hoàn thành</p>
                  <p className="text-2xl font-black text-green-600">{reportFormMetrics.completedTasksToday.length}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                  <p className="text-xs text-red-700 font-semibold mb-1">Trễ / Tồn đọng</p>
                  <p className="text-2xl font-black text-red-600">{reportFormMetrics.pendingTasksToday.length}</p>
                </div>
              </div>
              
              {reportFormMetrics.pendingTasksToday.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-bold text-red-600 mb-2">Công việc đang tồn đọng:</p>
                  <ul className="text-xs text-gray-600 space-y-1 pl-4 list-disc max-h-32 overflow-y-auto">
                    {reportFormMetrics.pendingTasksToday.map(t => <li key={t.id} className="truncate" title={t.title}>{t.title}</li>)}
                  </ul>
                </div>
              )}
            </div>

            {/* Form Gửi báo cáo */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative sticky top-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Send size={18} className="mr-2 text-blue-600" /> Nộp Báo cáo cuối ngày
              </h2>
              <form onSubmit={handleSubmitReport} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày báo cáo</label>
                  <input
                    type="text" disabled value={format(new Date(), 'dd/MM/yyyy')}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Khó khăn / Vấn đề <span className="text-red-500">*</span></label>
                  <textarea
                    required
                    value={reportIssues}
                    onChange={e => setReportIssues(e.target.value)}
                    placeholder="Bạn gặp vướng mắc gì hôm nay? (VD: Máy lag, thiếu tài nguyên... Hoặc ghi 'Không')"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kế hoạch ngày mai <span className="text-red-500">*</span></label>
                  <textarea
                    required
                    value={reportPlan}
                    onChange={e => setReportPlan(e.target.value)}
                    placeholder="Mục tiêu chính vào ngày mai là gì?"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chi phí cá nhân ứng trước (VND) (Nếu có)</label>
                  <input
                    type="number"
                    value={reportExpenses}
                    onChange={e => setReportExpenses(e.target.value ? Number(e.target.value) : '')}
                    placeholder="VD: 50000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!currentStaff}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center shadow-md mt-4"
                >
                  <ClipboardCheck size={18} className="mr-2" /> Xác nhận nộp báo cáo
                </button>
              </form>
            </div>
          </div>

          {/* New Feed Báo cáo - Right Column */}
          <div className="xl:col-span-2 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <LayoutGrid size={18} className="mr-2 text-indigo-600" /> 
              {isManager ? 'Bảng tin Báo cáo Toàn Nhóm' : 'Lịch sử Báo cáo của Tôi'}
            </h2>
            <div className="space-y-4">
              {dailyReports.filter(r => isManager || r.staffId === currentStaff?.id).length > 0 ? (
                dailyReports
                  .filter(r => isManager || r.staffId === currentStaff?.id)
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map(report => {
                    const staff = staffList.find(s => s.id === report.staffId);
                    const completedCount = report.completedTasks?.length ?? report.renderedCount;
                    const pendingCount = report.pendingTasks?.length || 0;
                    const isPerfectList = pendingCount === 0;

                    return (
                      <div key={report.id} className="p-5 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:justify-between sm:items-start mb-4 border-b border-gray-50 pb-3">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm mr-3 shadow-inner">
                              {(staff?.name || '?').charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">{staff?.name}</p>
                              <p className="text-xs text-gray-500 flex items-center">
                                <Clock size={12} className="mr-1" /> {format(parseISO(report.timestamp), 'HH:mm - dd/MM/yyyy')}
                              </p>
                            </div>
                          </div>
                          <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center self-start ${isPerfectList ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {isPerfectList ? <CheckCircle size={14} className="mr-1" /> : <AlertCircle size={14} className="mr-1" />}
                            KPI: {completedCount} Done / {pendingCount} Miss
                          </div>
                        </div>

                        <div className="space-y-3 bg-gray-50/80 p-4 rounded-lg text-sm border border-gray-100/50">
                          {report.issues && (
                            <div>
                              <span className="font-semibold text-gray-700 block mb-1">Khó khăn / Vấn đề:</span>
                              <p className="text-gray-600 text-sm italic">{report.issues}</p>
                            </div>
                          )}
                          {!report.issues && report.notes && (
                            <div>
                              <span className="font-semibold text-gray-700 block mb-1">Ghi chú:</span>
                              <p className="text-gray-600 text-sm italic">{report.notes}</p>
                            </div>
                          )}
                          {report.planTomorrow && (
                            <div>
                              <span className="font-semibold text-gray-700 block mb-1">🚀 Kế hoạch ngày mai:</span>
                              <p className="text-gray-600">{report.planTomorrow}</p>
                            </div>
                          )}
                          {report.expenses ? (
                            <div className="text-orange-600 font-semibold border-t border-orange-100 mt-2 pt-2 flex items-center">
                              <span className="mr-1">💰</span> Phát sinh chi phí: {report.expenses.toLocaleString()} VND
                            </div>
                          ) : null}
                        </div>
                        
                        {/* Expandable Task List */}
                        {((report.completedTasks && report.completedTasks.length > 0) || (report.pendingTasks && report.pendingTasks.length > 0)) && (
                           <div className="mt-4 text-xs flex flex-col sm:flex-row gap-4">
                              {report.completedTasks && report.completedTasks.length > 0 && (
                                <div className="flex-1 bg-green-50/30 p-3 rounded-lg border border-green-50">
                                  <p className="text-green-600 font-semibold mb-2">Hôm nay xong ({report.completedTasks.length}):</p>
                                  <ul className="text-gray-500 list-disc pl-4 space-y-1 max-h-32 overflow-y-auto">
                                    {report.completedTasks.map(t => <li key={t.id} className="truncate" title={t.title}>{t.title}</li>)}
                                  </ul>
                                </div>
                              )}
                              {report.pendingTasks && report.pendingTasks.length > 0 && (
                                <div className="flex-1 bg-red-50/30 p-3 rounded-lg border border-red-50">
                                  <p className="text-red-600 font-semibold mb-2">Tồn đọng ({report.pendingTasks.length}):</p>
                                  <ul className="text-gray-500 list-disc pl-4 space-y-1 max-h-32 overflow-y-auto">
                                    {report.pendingTasks.map(t => <li key={t.id} className="truncate" title={t.title}>{t.title}</li>)}
                                  </ul>
                                </div>
                              )}
                           </div>
                        )}
                      </div>
                    );
                  })
              ) : (
                <div className="text-center py-16 text-gray-400 italic text-sm bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                  <FileText size={32} className="mx-auto text-gray-300 mb-3" />
                  Chưa có báo cáo nào được gửi hoặc hiển thị.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task Creation Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0 bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <Briefcase size={20} className="mr-2 text-blue-600" /> Tạo Phiếu Giao Việc
              </h2>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              <form id="create-task-form" onSubmit={handleCreateTask} className="space-y-5">
                {/* Task Category Toggle */}
                <div className="flex gap-2 p-1.5 bg-gray-100 rounded-lg">
                  <button type="button" onClick={() => setTaskCategory('video')} className={`flex-1 flex justify-center items-center py-2 text-sm font-bold rounded-md transition-all ${taskCategory === 'video' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                    <PlayCircle size={16} className="mr-1.5" /> Sản xuất Video
                  </button>
                  <button type="button" onClick={() => setTaskCategory('channel')} className={`flex-1 flex justify-center items-center py-2 text-sm font-bold rounded-md transition-all ${taskCategory === 'channel' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                    <UserPlus size={16} className="mr-1.5 hidden sm:block" /> QL Kênh/Mail
                  </button>
                  <button type="button" onClick={() => setTaskCategory('office')} className={`flex-1 flex justify-center items-center py-2 text-sm font-bold rounded-md transition-all ${taskCategory === 'office' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                    <Briefcase size={16} className="mr-1.5 hidden sm:block" /> Hành chính
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Tiêu đề Công việc <span className="text-red-500">*</span></label>
                  <input type="text" required value={taskFormData.title} onChange={e => setTaskFormData({ ...taskFormData, title: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={taskCategory === 'video' ? "Nhập tên video muốn làm..." : "Nhập nội dung công việc..."} />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700">Người thực hiện</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setTaskFormData({...taskFormData, assigneeIds: []})}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${(!taskFormData.assigneeIds || taskFormData.assigneeIds.length === 0) ? 'bg-purple-100 border-purple-300 text-purple-700 ring-2 ring-purple-200' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                    >
                      🏆 Đẩy ra Chợ Việc
                    </button>
                    {staffList.filter(s => s.role !== 'admin').map(s => {
                      const isSelected = taskFormData.assigneeIds?.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            const current = taskFormData.assigneeIds || [];
                            if (isSelected) {
                              setTaskFormData({...taskFormData, assigneeIds: current.filter(id => id !== s.id)});
                            } else {
                              setTaskFormData({...taskFormData, assigneeIds: [...current, s.id]});
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center transition-all ${isSelected ? 'bg-blue-100 border-blue-300 text-blue-700 ring-2 ring-blue-200 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                          {isSelected && <CheckCircle2 size={12} className="mr-1" />}
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Hạn chót <span className="text-red-500">*</span></label>
                    <input type="date" required value={taskFormData.dueDate} onChange={e => setTaskFormData({ ...taskFormData, dueDate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Độ ưu tiên</label>
                    <select value={taskFormData.priority} onChange={e => setTaskFormData({ ...taskFormData, priority: e.target.value as any })} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                      <option value="low">Thấp</option>
                      <option value="medium">Bình thường</option>
                      <option value="high" className="text-red-600 font-bold">Gấp / Quan trọng</option>
                    </select>
                  </div>
                </div>

                {taskCategory === 'video' && (
                  <>
                    <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-5">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Kênh đăng <span className="text-red-500">*</span></label>
                        <select required value={taskFormData.channelId} onChange={e => setTaskFormData({ ...taskFormData, channelId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                          <option value="" disabled>Chọn kênh</option>
                          {channels.map(c => <option key={c.id} value={c.id}>[{c.channelCode}] {c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Loại Video</label>
                        <select value={taskFormData.videoType} onChange={e => setTaskFormData({ ...taskFormData, videoType: e.target.value as any })} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                          <option value="long">Video Dài</option>
                          <option value="shorts">Shorts</option>
                        </select>
                      </div>
                    </div>

                    <div className="border border-indigo-100 rounded-lg p-4 bg-indigo-50/50">
                      <label className="block text-sm font-bold text-indigo-900 mb-2 flex items-center">
                        <LinkIcon size={16} className="mr-2" /> Đính kèm Tài Nguyên (Từ Kho Asset)
                      </label>
                      <p className="text-xs text-indigo-600 mb-3">Chọn các tài nguyên để tính chi phí sản xuất.</p>

                      {assets.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">Kho tài nguyên hiện đang trống.</p>
                      ) : (
                        <div className="max-h-32 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                          {assets.map(asset => {
                            const isSelected = (taskFormData.linkedAssetIds || []).includes(asset.id);
                            return (
                              <div
                                key={asset.id}
                                onClick={() => toggleAssetLink(asset.id)}
                                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border transition-colors ${isSelected ? 'bg-indigo-100 border-indigo-300' : 'bg-white border-gray-200 hover:border-indigo-200'}`}
                              >
                                <div className="flex items-center space-x-2 overflow-hidden truncate">
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'}`}>
                                    {isSelected && <CheckCircle2 size={12} />}
                                  </div>
                                  <span className="text-sm font-medium text-gray-800 truncate">{asset.name}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="border-t border-gray-100 pt-5">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Ghi chú chi tiết cho NS</label>
                  <textarea value={taskFormData.notes || ''} onChange={e => setTaskFormData({ ...taskFormData, notes: e.target.value })} placeholder="Dặn dò team nội dung công việc, hoặc lưu ý..." className="w-full border border-gray-300 rounded-lg px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] text-sm" />
                </div>
              </form>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3 shrink-0">
              <button type="button" onClick={() => setIsTaskModalOpen(false)} className="px-5 py-2.5 text-gray-600 font-bold hover:bg-gray-200 rounded-lg transition-colors">
                Hủy bỏ
              </button>
              <button type="submit" form="create-task-form" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-sm flex items-center">
                <Send size={18} className="mr-2" /> Giao việc ngay
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Task Comment Modal */}
      {taskCommentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4">
          <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-md h-[80vh] sm:h-[600px] flex flex-col animate-in slide-in-from-bottom-5">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 sm:rounded-t-xl shrink-0">
              <h3 className="font-bold text-gray-900 flex items-center">
                <MessageSquare size={18} className="mr-2 text-blue-600" /> Bình luận nội bộ
              </h3>
              <button title="Đóng" onClick={() => setTaskCommentModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gray-50/50">
              {tasks.find(t => t.id === taskCommentModal)?.comments?.length ? (
                tasks.find(t => t.id === taskCommentModal)?.comments?.map(comment => {
                  const isMe = comment.userId === currentUser?.id;
                  return (
                    <div key={comment.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {!isMe && (
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs mr-2 shrink-0 mt-auto shadow-sm">
                          {comment.userName.charAt(0)}
                        </div>
                      )}
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'}`}>
                        {!isMe && <div className="text-[10px] font-bold text-gray-500 mb-0.5">{comment.userName}</div>}
                        <p className="whitespace-pre-wrap leading-relaxed">{comment.text}</p>
                        <div className={`text-[9px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                          {format(new Date(comment.timestamp), 'HH:mm dd/MM/yyyy')}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                  <MessageSquare size={48} className="text-gray-200" />
                  <p className="text-sm">Chưa có bình luận nào.</p>
                </div>
              )}
            </div>
            
            <form onSubmit={handleAddComment} className="p-3 bg-white border-t border-gray-100 shrink-0 sm:rounded-b-xl flex gap-2">
              <input 
                type="text"
                autoFocus
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Nhập bình luận để trao đổi..."
                className="flex-1 px-4 py-2.5 bg-gray-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-full text-sm transition-all outline-none"
              />
              <button 
                type="submit"
                disabled={!newCommentText.trim()}
                className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shrink-0 shadow-sm"
              >
                <Send size={16} className="ml-0.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
