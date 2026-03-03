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
  const [activeTab, setActiveTab] = useState<'marketplace' | 'my-tasks' | 'reports'>('my-tasks');
  const [reportNotes, setReportNotes] = useState('');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskFormData, setTaskFormData] = useState<Partial<VideoTask>>({
    title: '',
    channelId: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    assigneeIds: [],
    status: 'idea',
    videoType: 'long',
    priority: 'medium',
    notes: '',
    linkedAssetIds: []
  });

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
    if (!taskFormData.title || !taskFormData.channelId || !taskFormData.dueDate) {
      showToast('Vui lòng điền đủ Tên việc, Kênh và Thời hạn.', 'error');
      return;
    }

    const newTask: VideoTask = {
      id: Date.now().toString(),
      title: taskFormData.title,
      channelId: taskFormData.channelId,
      status: taskFormData.status as TaskStatus || 'idea',
      assigneeIds: taskFormData.assigneeIds || [],
      dueDate: taskFormData.dueDate,
      videoType: taskFormData.videoType as any,
      priority: taskFormData.priority as any,
      notes: taskFormData.notes,
      isClaimable: (!taskFormData.assigneeIds || taskFormData.assigneeIds.length === 0),
      linkedAssetIds: taskFormData.linkedAssetIds || [],
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
      status: 'idea',
      videoType: 'long',
      priority: 'medium',
      notes: '',
      linkedAssetIds: []
    });
  };

  const workflowSteps: { id: TaskStatus; label: string; color: string }[] = [
    { id: 'idea', label: 'Ý tưởng', color: 'bg-gray-100 text-gray-600' },
    { id: 'script', label: 'Kịch bản', color: 'bg-blue-100 text-blue-600' },
    { id: 'voiceover', label: 'Thu âm', color: 'bg-purple-100 text-purple-600' },
    { id: 'editing', label: 'Dựng phim', color: 'bg-indigo-100 text-indigo-600' },
    { id: 'review', label: 'Duyệt', color: 'bg-orange-100 text-orange-600' },
    { id: 'published', label: 'Đã đăng', color: 'bg-green-100 text-green-600' }
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
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
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

      {activeTab === 'my-tasks' && (
        <div className="grid grid-cols-1 gap-4">
          {myTasks.length > 0 ? (
            myTasks.map(task => {
              const channel = channels.find(c => c.id === task.channelId);
              return (
                <div key={task.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <PlayCircle size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{task.title}</h3>
                        <div className="flex items-center text-xs text-gray-500 mt-1 flex-wrap gap-2">
                          <span className="font-bold text-blue-600">[{channel?.channelCode}] {channel?.name}</span>
                          <span className="mx-1">•</span>
                          <span className="flex items-center"><Clock size={12} className="mr-1" /> Hạn: {task.dueDate}</span>
                          {task.linkedAssetIds && task.linkedAssetIds.length > 0 && (
                            <>
                              <span className="mx-1">•</span>
                              <span className="flex items-center text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                <LinkIcon size={10} className="mr-1" /> {task.linkedAssetIds.length} tài nguyên
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${workflowSteps.find(s => s.id === task.status)?.color
                        }`}>
                        {workflowSteps.find(s => s.id === task.status)?.label}
                      </span>
                      {task.priority === 'high' && (
                        <span className="flex items-center text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                          <AlertCircle size={10} className="mr-1" /> ƯU TIÊN CAO
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Workflow Actions */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-50">
                    {workflowSteps.map(step => (
                      <button
                        key={step.id}
                        onClick={() => handleUpdateStatus(task.id, step.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${task.status === step.id
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600'
                          }`}
                      >
                        {step.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <Briefcase size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Bạn chưa có công việc nào được giao.</p>
              <button
                onClick={() => setActiveTab('marketplace')}
                className="mt-4 text-blue-600 font-bold hover:underline"
              >
                Ghé thăm Chợ việc để nhận task mới
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'marketplace' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {marketplaceTasks.length > 0 ? (
            marketplaceTasks.map(task => {
              const channel = channels.find(c => c.id === task.channelId);
              return (
                <div key={task.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <UserPlus size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{task.title}</h3>
                        <p className="text-xs text-blue-600 font-bold">[{channel?.channelCode}] {channel?.name}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600 mb-6 flex-grow">
                    <div className="flex items-center"><Calendar size={14} className="mr-2" /> Hạn: {task.dueDate}</div>
                    <div className="flex items-center"><FileText size={14} className="mr-2" /> Loại: {task.videoType === 'shorts' ? 'Shorts' : 'Video Dài'}</div>
                    {task.notes && <p className="text-xs italic bg-gray-50 p-2 rounded mt-2">{task.notes}</p>}
                  </div>
                  <button
                    onClick={() => handleClaimTask(task.id)}
                    className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-lg transition-all flex items-center justify-center shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                  >
                    <CheckCircle size={18} className="mr-2 animate-pulse" /> Nhận việc ngay
                  </button>
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
              <form id="create-task-form" onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Tiêu đề Công việc <span className="text-red-500">*</span></label>
                  <input type="text" required value={taskFormData.title} onChange={e => setTaskFormData({ ...taskFormData, title: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Nhập tên video / nội dung công việc..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Giao cho ai?</label>
                    <select value={taskFormData.assigneeIds?.[0] || ''} onChange={e => setTaskFormData({ ...taskFormData, assigneeIds: e.target.value ? [e.target.value] : [] })} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-purple-50 text-purple-900 border-purple-200">
                      <option value="" className="font-bold text-gray-500">🏆 Đẩy ra CHỢ VIỆC</option>
                      <optgroup label="Hoặc gán đích danh:">
                        {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Hạn chót <span className="text-red-500">*</span></label>
                    <input type="date" required value={taskFormData.dueDate} onChange={e => setTaskFormData({ ...taskFormData, dueDate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Bước tiến độ hiện tại</label>
                    <select value={taskFormData.status} onChange={e => setTaskFormData({ ...taskFormData, status: e.target.value as any })} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      {workflowSteps.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
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

                <div className="border border-indigo-100 rounded-lg p-4 bg-indigo-50/50">
                  <label className="block text-sm font-bold text-indigo-900 mb-2 flex items-center">
                    <LinkIcon size={16} className="mr-2" /> Đính kèm Tài Nguyên (Từ Kho Asset)
                  </label>
                  <p className="text-xs text-indigo-600 mb-3">Chọn các tài nguyên (nhạc, template, footage) cần thiết cho video này để tính chi phí sản xuất.</p>

                  {assets.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">Kho tài nguyên hiện đang trống.</p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {assets.map(asset => {
                        const isSelected = (taskFormData.linkedAssetIds || []).includes(asset.id);
                        return (
                          <div
                            key={asset.id}
                            onClick={() => toggleAssetLink(asset.id)}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border transition-colors ${isSelected
                                ? 'bg-indigo-100 border-indigo-300'
                                : 'bg-white border-gray-200 hover:border-indigo-200'
                              }`}
                          >
                            <div className="flex items-center space-x-2 overflow-hidden truncate">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'
                                }`}>
                                {isSelected && <CheckCircle2 size={12} />}
                              </div>
                              <span className="text-sm font-medium text-gray-800 truncate">{asset.name}</span>
                              <span className="text-[10px] uppercase font-bold text-gray-500 px-1.5 py-0.5 bg-gray-100 rounded shrink-0">{asset.type}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Ghi chú chi tiết cho NS</label>
                  <textarea value={taskFormData.notes || ''} onChange={e => setTaskFormData({ ...taskFormData, notes: e.target.value })} placeholder="Dặn dò team lưu ý góc quay, màu sắc, kỹ xảo..." className="w-full border border-gray-300 rounded-lg px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] text-sm" />
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
