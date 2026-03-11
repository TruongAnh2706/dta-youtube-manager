import React, { useState, useMemo } from 'react';
import { VideoTask, Staff, Channel, TaskStatus, DailyReport, Asset } from '../types';
import {
  Briefcase, CheckCircle2, Clock, MessageSquare,
  UserPlus, Send, ClipboardCheck, BarChart3,
  Search, Filter, AlertCircle, CheckCircle,
  PlayCircle, FileText, Calendar, User, Plus, X, Link as LinkIcon
} from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';

interface TaskManagerProps {
  tasks: VideoTask[];
  setTasks: React.Dispatch<React.SetStateAction<VideoTask[]>>;
  staffList: Staff[];
  channels: Channel[];
  assets: Asset[]; // Thêm assets vào props
  currentUser: { id: string; name: string; role: string } | null;
  dailyReports: DailyReport[];
  setDailyReports: React.Dispatch<React.SetStateAction<DailyReport[]>>;
}

export function TaskManager({
  tasks, setTasks, staffList, channels, assets, currentUser,
  dailyReports, setDailyReports
}: TaskManagerProps) {
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'all-tasks' | 'marketplace' | 'my-tasks' | 'reports'>(
    (currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'leader') ? 'all-tasks' : 'my-tasks'
  );
  const [reportNotes, setReportNotes] = useState('');
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

  const isManager = currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'leader';

  const currentStaff = useMemo(() =>
    staffList.find(s => s.name === currentUser?.name || s.id === currentUser?.id),
    [staffList, currentUser]
  );

  const marketplaceTasks = useMemo(() =>
    tasks.filter(t => t.isClaimable && (!t.assigneeIds || t.assigneeIds.length === 0)),
    [tasks]
  );

  const myTasks = useMemo(() => {
    if (!currentStaff) return [];
    return tasks.filter(t => (t.assigneeIds || []).includes(currentStaff.id));
  }, [tasks, currentStaff]);

  const handleClaimTask = (taskId: string) => {
    if (!currentStaff) {
      showToast('Không tìm thấy thông tin nhân sự của bạn.', 'error');
      return;
    }

    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, assigneeIds: [currentStaff.id], isClaimable: false }
        : t
    ));
    showToast('Đã nhận việc thành công!', 'success');
  };

  const handleUpdateStatus = (taskId: string, newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus } : t
    ));
    showToast(`Đã cập nhật trạng thái sang: ${newStatus}`, 'info');
  };

  const handleDeleteTask = (taskId: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa công việc này? Thao tác này không thể hoàn tác.')) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      showToast('Đã xóa công việc thành công!', 'info');
    }
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Bạn có chắc muốn xóa ${selectedTaskIds.length} công việc đã chọn?`)) {
      setTasks(prev => prev.filter(t => !selectedTaskIds.includes(t.id)));
      setSelectedTaskIds([]);
      showToast(`Đã xóa ${selectedTaskIds.length} công việc!`, 'info');
    }
  };

  const handleBulkUpdateStatus = (newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t => selectedTaskIds.includes(t.id) ? { ...t, status: newStatus } : t));
    setSelectedTaskIds([]);
    showToast(`Đã chuyển trạng thái ${selectedTaskIds.length} việc thành công!`, 'success');
  };

  const displayedTasks = useMemo(() => {
    let list = activeTab === 'all-tasks' ? tasks : myTasks;
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
          const closeBrackIndex = t.title.indexOf(']');
          if (closeBrackIndex !== -1) {
            displayCat = t.title.substring(1, closeBrackIndex);
          }
        }
        
        const isOffice = displayCat === 'Hành chính';
        const isChannelSetup = displayCat === 'Khởi tạo kênh' || displayCat.includes('Mail') || displayCat.includes('Khai thác');
        
        if (filterCategory === 'office') return isOffice;
        if (filterCategory === 'channel') return isChannelSetup;
        if (filterCategory === 'video') return !isOffice && !isChannelSetup;
        return true;
      });
    }
    return list;
  }, [tasks, myTasks, activeTab, filterStaff, filterStatus, filterCategory]);

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStaff) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    const renderedToday = myTasks.filter(t =>
      (t.status === 'review' || t.status === 'published') && t.dueDate === today
    ).length;

    const newReport: DailyReport = {
      id: Date.now().toString(),
      staffId: currentStaff.id,
      date: today,
      renderedCount: renderedToday,
      notes: reportNotes,
      timestamp: new Date().toISOString()
    };

    setDailyReports(prev => [...prev, newReport]);
    setReportNotes('');
    showToast('Đã gửi báo cáo cuối ngày thành công!', 'success');
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

  const workflowSteps: { id: TaskStatus; label: string; color: string }[] = [
    { id: 'pending', label: 'Chờ nhận việc', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    { id: 'in_progress', label: 'Đang xử lý', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    { id: 'completed', label: 'Hoàn thành', color: 'bg-green-100 text-green-700 border-green-200' },
    { id: 'review', label: 'Chờ duyệt', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    { id: 'published', label: 'Đã hoàn tất', color: 'bg-teal-100 text-teal-700 border-teal-200' }
  ];

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
          {/* Header Filters */}
          {/* Header Filters */}
          <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-100 items-center justify-between">
            <div className="flex flex-wrap items-center gap-3">
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
              
              const borderStyles = isHighPriority 
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
                          {isHighPriority && (
                            <span className="flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-600 text-white animate-pulse">
                              <AlertCircle size={10} className="mr-1" /> Ưu tiên cao
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
                    
                    {/* Delete button (only for managers or creators ideally, but checking manager role here since permissions vary) */}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Report Form */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Send size={18} className="mr-2 text-blue-600" /> Báo cáo cuối ngày
              </h2>
              <form onSubmit={handleSubmitReport} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày báo cáo</label>
                  <input
                    type="text" disabled value={format(new Date(), 'dd/MM/yyyy')}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Video đã render hôm nay</label>
                  <div className="text-2xl font-black text-blue-600 bg-blue-50 p-3 rounded-lg text-center border border-blue-100">
                    {myTasks.filter(t => (t.status === 'review' || t.status === 'published') && t.dueDate === format(new Date(), 'yyyy-MM-dd')).length}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 italic">* Tự động tính từ các task ở trạng thái Duyệt/Đã đăng có hạn hôm nay.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú công việc / Vấn đề</label>
                  <textarea
                    value={reportNotes}
                    onChange={e => setReportNotes(e.target.value)}
                    placeholder="Hôm nay bạn đã làm gì? Có gặp khó khăn gì không?"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!currentStaff}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center shadow-md"
                >
                  <ClipboardCheck size={18} className="mr-2" /> Gửi báo cáo
                </button>
              </form>
            </div>
          </div>

          {/* History / Admin View */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <BarChart3 size={18} className="mr-2 text-indigo-600" /> Lịch sử báo cáo
              </h2>
              <div className="space-y-4">
                {dailyReports.length > 0 ? (
                  dailyReports.slice().reverse().map(report => {
                    const staff = staffList.find(s => s.id === report.staffId);
                    return (
                      <div key={report.id} className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs mr-3">
                              {(staff?.name || '?').charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">{staff?.name}</p>
                              <p className="text-[10px] text-gray-500">{format(parseISO(report.timestamp), 'HH:mm - dd/MM/yyyy')}</p>
                            </div>
                          </div>
                          <div className="bg-white px-3 py-1 rounded-full border border-gray-200 text-xs font-bold text-blue-600">
                            Rendered: {report.renderedCount}
                          </div>
                        </div>
                        {report.notes && (
                          <p className="text-xs text-gray-600 mt-2 pl-11 border-l-2 border-indigo-200 italic">
                            "{report.notes}"
                          </p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-400 italic text-sm">
                    Chưa có báo cáo nào được gửi.
                  </div>
                )}
              </div>
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
    </div>
  );
}
