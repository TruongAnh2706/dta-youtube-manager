import React, { useState } from 'react';
import { Channel, SourceChannel, Topic, Staff, VideoTask } from '../types';
import { Search, Lightbulb, ArrowRight, Activity, Target, Star, X, Plus } from 'lucide-react';
import { performDeepAnalysis } from '../services/aiService';

interface AnalysisProps {
  channels: Channel[];
  sourceChannels: SourceChannel[];
  topics: Topic[];
  geminiApiKey?: string;
  currentUser?: Staff | { role: string; name: string; id: string } | null;
  staffList?: Staff[];
  tasks?: VideoTask[];
  setTasks?: React.Dispatch<React.SetStateAction<VideoTask[]>>;
}

export function Analysis({ channels, sourceChannels, topics, geminiApiKey, currentUser, staffList = [], tasks = [], setTasks }: AnalysisProps) {
  const [selectedTopic, setSelectedTopic] = useState<string>(topics[0]?.id || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskIdea, setTaskIdea] = useState('');
  const [assignedStaff, setAssignedStaff] = useState<string>('');

  const canUseAI = currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'leader';
  const isMember = currentUser?.role === 'member';

  const handleAnalyze = async () => {
    if (!canUseAI) {
      alert("Tài khoản Member chỉ được phép xem dữ liệu, không có quyền gọi AI Phân tích.");
      return;
    }

    if (!selectedTopic) return;
    
    if (!geminiApiKey) {
      alert("Vui lòng cấu hình Gemini API Key trong phần Cài đặt trước khi sử dụng tính năng này.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult([]);
    
    try {
      const topicName = topics.find(t => t.id === selectedTopic)?.name || '';
      const ourChannels = channels.filter(c => (c.topicIds || []).includes(selectedTopic));
      const topicSources = sourceChannels.filter(c => (c.topicIds || []).includes(selectedTopic));
      
      const results = await performDeepAnalysis(topicName, ourChannels, topicSources, geminiApiKey, staffList.length);
      setAnalysisResult(results);
    } catch (error) {
      console.error("Lỗi phân tích:", error);
      alert("Có lỗi xảy ra khi gọi AI phân tích. Vui lòng kiểm tra API Key.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateQuickTask = () => {
    if (!taskIdea.trim() || !assignedStaff || !setTasks) {
      alert("Vui lòng nhập nội dung và chọn nhân sự thực hiện");
      return;
    }

    const newTask: VideoTask = {
      id: Date.now().toString(),
      title: `[Chiến lược AI] ${taskIdea}`,
      status: 'pending',
      assigneeIds: [assignedStaff],
      dueDate: new Date().toISOString(),
      priority: 'high',
      channelId: channels[0]?.id || '', // Gan tam cho kenh dau tien, hoac bo trong
      notes: ''
    };

    setTasks(prev => [...prev, newTask]);
    alert("Đã tạo Task thành công! Bạn có thể xem task ở tab Lịch Đăng & KPI.");
    setShowTaskModal(false);
    setTaskIdea('');
  };

  const topicChannels = channels.filter(c => (c.topicIds || []).includes(selectedTopic));
  const topicSources = sourceChannels.filter(c => (c.topicIds || []).includes(selectedTopic));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Phân tích & Khám phá Chủ đề</h1>
        <p className="text-sm text-gray-500 mt-1">Sử dụng dữ liệu từ kênh nguồn để tìm kiếm cơ hội và ngách nội dung mới</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <label className="block text-sm font-medium text-gray-700 mb-2">Chọn chủ đề cần phân tích</label>
        <div className="flex gap-4">
          <select 
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {topics.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
            {topics.length === 0 && <option value="">Chưa có chủ đề nào</option>}
          </select>
          <div className="flex flex-col flex-1 items-end gap-2">
            <button 
              onClick={handleAnalyze}
              disabled={!selectedTopic || isAnalyzing || isMember}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center h-full w-[240px] justify-center"
            >
              {isAnalyzing ? (
                <span className="flex items-center"><Activity className="animate-spin mr-2" size={18} /> Đang phân tích...</span>
              ) : (
                <span className="flex items-center"><Search className="mr-2" size={18} /> Phân tích ngay {isMember && "(Khóa)"}</span>
              )}
            </button>
            {isMember && <span className="text-xs text-red-500 font-medium">* Chỉ Leader/Quản lý mới có quyền gọi AI Phân tích</span>}
          </div>
        </div>
      </div>

      {selectedTopic && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột dữ liệu hiện tại */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                <Target className="mr-2 text-red-500" size={18} /> Kênh của chúng ta ({topicChannels.length})
              </h3>
              <ul className="space-y-3">
                {topicChannels.map(c => (
                  <li key={c.id} className="flex justify-between items-center text-sm">
                    <span className="text-gray-700 truncate pr-2">{c.name}</span>
                    <span className="text-gray-500 font-medium">{c.subscribers >= 1000 ? (c.subscribers/1000).toFixed(1) + 'k' : c.subscribers}</span>
                  </li>
                ))}
                {topicChannels.length === 0 && <p className="text-sm text-gray-400 italic">Chưa có kênh nào thuộc chủ đề này.</p>}
              </ul>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                <Lightbulb className="mr-2 text-orange-500" size={18} /> Kênh Nguồn / Đối thủ ({topicSources.length})
              </h3>
              <ul className="space-y-3">
                {topicSources.map(c => (
                  <li key={c.id} className="flex flex-col text-sm border-b border-gray-50 pb-2 last:border-0">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-medium truncate pr-2">{c.name}</span>
                      <span className="text-yellow-500 text-xs flex items-center">{c.rating} <Star size={10} className="fill-yellow-500 ml-0.5"/></span>
                    </div>
                    <span className="text-gray-400 text-xs mt-1">~{c.averageViews.toLocaleString()} views/video</span>
                  </li>
                ))}
                {topicSources.length === 0 && <p className="text-sm text-gray-400 italic">Chưa có kênh nguồn nào để tham khảo.</p>}
              </ul>
            </div>
          </div>

          {/* Cột kết quả phân tích */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-xl shadow-sm border border-indigo-100 h-full">
              <h3 className="text-lg font-semibold text-indigo-900 mb-4">Kết quả phân tích & Đề xuất</h3>
              
              {analysisResult.length > 0 ? (
                <div className="space-y-4">
                  {analysisResult.map((result, idx) => (
                    <div key={idx} className="flex items-start bg-white/60 p-4 rounded-lg border border-white">
                      <ArrowRight className="text-indigo-500 mr-3 mt-0.5 shrink-0" size={18} />
                      <p className="text-gray-800 leading-relaxed">{result}</p>
                    </div>
                  ))}
                  <div className="mt-6 pt-6 border-t border-indigo-200/50">
                    <p className="text-sm text-indigo-600 font-medium mb-3">Hành động tiếp theo:</p>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => {
                           setTaskIdea(analysisResult[0] || ''); // Lấy ý tưởng đầu tiên làm mồi
                           setShowTaskModal(true);
                        }}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                      >
                        Tạo Task cho Nhân sự
                      </button>
                      <button className="bg-white text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors">
                        Lưu báo cáo
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-indigo-300">
                  <Lightbulb size={48} className="mb-4 opacity-50" />
                  <p>Nhấn "Phân tích ngay" để hệ thống tổng hợp dữ liệu</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Quick Task */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Plus size={20} className="mr-2 text-indigo-500" />
                Dịch AI Result thành Giao Việc
              </h3>
              <button onClick={() => setShowTaskModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung Task (AI Gợi ý)</label>
                <textarea
                  value={taskIdea}
                  onChange={(e) => setTaskIdea(e.target.value)}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border min-h-[100px]"
                  placeholder="Ghi ngắn gọn nội dung cần nhân sự phải làm..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giao cho nhân sự</label>
                <select
                  value={assignedStaff}
                  onChange={(e) => setAssignedStaff(e.target.value)}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                >
                  <option value="">-- Chọn nhân sự --</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button 
                onClick={() => setShowTaskModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleCreateQuickTask}
                className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg"
              >
                Tạo Task Ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
