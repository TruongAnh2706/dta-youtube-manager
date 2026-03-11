import React, { useState } from 'react';
import { Competitor, Topic, Staff } from '../types';
import { Plus, Edit2, Trash2, X, Search, ExternalLink, TrendingUp, Users, PlayCircle, RefreshCw, AlertCircle, Sparkles, BrainCircuit, ChevronDown, ChevronUp, BarChart3, MessageSquare, Lightbulb } from 'lucide-react';
import { fetchYoutubeChannelInfo } from '../services/youtube';
import { GoogleGenAI } from '@google/genai';
import { useToast } from '../hooks/useToast';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

interface CompetitorSpyProps {
  competitors: Competitor[];
  setCompetitors: React.Dispatch<React.SetStateAction<Competitor[]>>;
  youtubeApiKey: string;
  geminiApiKey: string;
  rotateYoutubeKey: () => boolean;
  topics: Topic[];
  staffList?: Staff[];
  currentUser?: { role: string; name: string; id: string } | null;
}

export function CompetitorSpy({ competitors, setCompetitors, youtubeApiKey, geminiApiKey, rotateYoutubeKey, topics, staffList = [], currentUser }: CompetitorSpyProps) {
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompetitor, setEditingCompetitor] = useState<Competitor | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [isPredicting, setIsPredicting] = useState<string | null>(null);
  const [isAnalyzingStrategy, setIsAnalyzingStrategy] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Omit<Competitor, 'id'>>({
    name: '',
    url: '',
    subscriberCount: '0',
    videoCount: '0',
    notes: '',
    topicIds: [],
    allowedStaffIds: []
  });

  const isFullAccess = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const handleOpenModal = (competitor?: Competitor) => {
    if (competitor) {
      setEditingCompetitor(competitor);
      setFormData({
        name: competitor.name,
        url: competitor.url,
        subscriberCount: competitor.subscriberCount,
        videoCount: competitor.videoCount,
        notes: competitor.notes || '',
        topicIds: competitor.topicIds || [],
        allowedStaffIds: competitor.allowedStaffIds || []
      });
    } else {
      setEditingCompetitor(null);
      setFormData({ name: '', url: '', subscriberCount: '0', videoCount: '0', notes: '', topicIds: [], allowedStaffIds: [] });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCompetitor) {
      setCompetitors(competitors.map(c => c.id === editingCompetitor.id ? { ...c, ...formData } : c));
    } else {
      setCompetitors([...competitors, { id: Date.now().toString(), ...formData }]);
    }
    setIsModalOpen(false);
  };

  const handleAnalyze = async (id: string) => {
    const competitor = competitors.find(c => c.id === id);
    if (!competitor) return;

    if (!youtubeApiKey) {
      alert("Vui lòng cấu hình YouTube API Key trong phần Cài đặt để cập nhật dữ liệu đối thủ.");
      return;
    }

    setIsAnalyzing(id);

    try {
      const info = await fetchYoutubeChannelInfo(competitor.url, youtubeApiKey);

      setCompetitors(prev => prev.map(c => {
        if (c.id === id) {
          return {
            ...c,
            name: info.name || c.name,
            subscriberCount: info.subscribers.toLocaleString(),
            videoCount: info.videoCount.toString(),
            lastVideoTitle: info.latestVideos?.[0]?.title || c.lastVideoTitle,
            lastVideoDate: info.latestVideos?.[0]?.publishedAt?.split('T')[0] || c.lastVideoDate
          };
        }
        return c;
      }));
    } catch (error: any) {
      console.error("Lỗi phân tích đối thủ:", error);
      if (error.message?.includes('quota') || error.message?.includes('limit')) {
        const rotated = rotateYoutubeKey();
        if (rotated) {
          showToast('Hết quota, đang tự động đổi API Key. Vui lòng thử lại sau giây lát.', 'info');
          setIsAnalyzing(null);
          return;
        }
      }
      alert(`Lỗi: ${error.message}`);
    } finally {
      setIsAnalyzing(null);
    }
  };

  const handleTrendPredictor = async (competitor: Competitor) => {
    setIsPredicting(competitor.id);
    try {
      if (!geminiApiKey) {
        showToast('Vui lòng cấu hình Gemini API Key.', 'error');
        return;
      }

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const model = 'gemini-2.5-flash';

      const competitorInfo = `Kênh: ${competitor.name}. Video mới nhất: ${competitor.lastVideoTitle}. Ghi chú: ${competitor.notes}`;
      const prompt = `Dựa trên thông tin đối thủ YouTube: ${competitorInfo}. 
      Hãy dự đoán 1 xu hướng (trend) sắp tới trong ngách này mà đối thủ có thể sẽ làm hoặc thị trường đang cần. Trả về 1 câu dự đoán mạnh mẽ.`;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      const prediction = response.text || 'Không có dự đoán.';
      showToast(`DỰ ĐOÁN XU HƯỚNG (${competitor.name}): ${prediction}`, 'success', 8000);
    } catch (error) {
      showToast('Lỗi khi dự đoán xu hướng.', 'error');
    } finally {
      setIsPredicting(null);
    }
  };

  const handleStrategyAnalysis = async (competitor: Competitor) => {
    setIsAnalyzingStrategy(competitor.id);
    try {
      if (!geminiApiKey) {
        showToast('Vui lòng cấu hình Gemini API Key.', 'error');
        return;
      }

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const model = 'gemini-2.5-flash';

      const competitorInfo = `Kênh: ${competitor.name}. Subs: ${competitor.subscriberCount}. Video mới nhất: ${competitor.lastVideoTitle}. Ghi chú: ${competitor.notes}`;
      const prompt = `Phân tích chiến lược của đối thủ YouTube: ${competitorInfo}. 
      Hãy đề xuất 1 "Phản đòn" (Counter-strategy) để hệ thống của tôi có thể cạnh tranh hoặc chiếm lĩnh ngách này. Trả về 2 câu ngắn gọn.`;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      const strategy = response.text || 'Không có phân tích.';

      // Update notes with strategy
      const updatedNotes = `${competitor.notes || ''}\n\n--- AI STRATEGY (${new Date().toLocaleDateString()}) ---\n${strategy}`;
      setCompetitors(prev => prev.map(c => c.id === competitor.id ? { ...c, notes: updatedNotes } : c));

      showToast('Đã phân tích chiến lược đối thủ. Xem trong Ghi chú.', 'success');
    } catch (error) {
      showToast('Lỗi khi phân tích chiến lược.', 'error');
    } finally {
      setIsAnalyzingStrategy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Spy Đối thủ</h1>
          <p className="text-sm text-gray-500 mt-1">Theo dõi các kênh đối thủ để học hỏi và tối ưu nội dung</p>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors">
          <Plus size={16} className="mr-2" /> Thêm đối thủ
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {competitors.map(competitor => {
          const isExpanded = expandedId === competitor.id;

          return (
            <motion.div
              layout
              key={competitor.id}
              className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow ${isExpanded ? 'ring-2 ring-indigo-500/20' : ''}`}
            >
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-xl">
                      {(competitor.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 leading-tight">{competitor.name}</h3>
                      <a href={competitor.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center mt-0.5">
                        Xem kênh <ExternalLink size={10} className="ml-1" />
                      </a>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <button onClick={() => handleAnalyze(competitor.id)} className={`p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors ${isAnalyzing === competitor.id ? 'animate-spin text-indigo-600' : ''}`} title="Cập nhật dữ liệu">
                      <RefreshCw size={16} />
                    </button>
                    <button onClick={() => handleOpenModal(competitor)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={16} /></button>
                    <button onClick={() => setCompetitors(prev => prev.filter(c => c.id !== competitor.id))} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">
                      <Users size={12} className="mr-1" /> Subscribers
                    </div>
                    <p className="text-lg font-black text-slate-900">{competitor.subscriberCount}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">
                      <PlayCircle size={12} className="mr-1" /> Videos
                    </div>
                    <p className="text-lg font-black text-slate-900">{competitor.videoCount}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {competitor.topicIds && competitor.topicIds.length > 0 ? (
                    competitor.topicIds.map(tid => {
                      const topic = topics.find(t => t.id === tid);
                      if (!topic) return null;
                      return (
                        <span key={tid} className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white shadow-sm" style={{ backgroundColor: topic.color }}>
                          {topic.name}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-[10px] text-gray-400 italic">Chưa gắn chủ đề</span>
                  )}
                </div>

                {competitor.lastVideoTitle && (
                  <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 mb-4">
                    <div className="flex items-center text-indigo-600 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                      <TrendingUp size={12} className="mr-1" /> Video mới nhất
                    </div>
                    <p className="text-sm font-semibold text-gray-900 line-clamp-1">{competitor.lastVideoTitle}</p>
                    <p className="text-[10px] text-indigo-400 mt-1 font-medium">{new Date(competitor.lastVideoDate!).toLocaleDateString('vi-VN')}</p>
                  </div>
                )}

                <button
                  onClick={() => setExpandedId(isExpanded ? null : competitor.id)}
                  className="w-full py-2 flex items-center justify-center text-xs font-bold text-gray-500 hover:text-indigo-600 hover:bg-gray-50 rounded-xl transition-all border border-transparent hover:border-indigo-100"
                >
                  {isExpanded ? (
                    <>Thu gọn <ChevronUp size={14} className="ml-1" /></>
                  ) : (
                    <>Xem chi tiết & AI Insights <ChevronDown size={14} className="ml-1" /></>
                  )}
                </button>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="border-t border-gray-100 bg-slate-50/30"
                  >
                    <div className="p-5 pt-2 space-y-5">
                      {/* AI Actions Section */}
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => handleTrendPredictor(competitor)}
                          disabled={isPredicting === competitor.id}
                          className="flex flex-col items-center justify-center p-3 bg-white hover:bg-orange-50 text-orange-600 rounded-xl transition-all border border-gray-100 hover:border-orange-200 shadow-sm group"
                        >
                          <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            {isPredicting === competitor.id ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest">Trend AI</span>
                        </button>
                        <button
                          onClick={() => handleStrategyAnalysis(competitor)}
                          disabled={isAnalyzingStrategy === competitor.id}
                          className="flex flex-col items-center justify-center p-3 bg-white hover:bg-indigo-50 text-indigo-600 rounded-xl transition-all border border-gray-100 hover:border-indigo-200 shadow-sm group"
                        >
                          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            {isAnalyzingStrategy === competitor.id ? <RefreshCw size={16} className="animate-spin" /> : <BrainCircuit size={16} />}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest">Strategy AI</span>
                        </button>
                      </div>

                      {/* Notes Section */}
                      <div className="space-y-2">
                        <div className="flex items-center text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                          <MessageSquare size={12} className="mr-1" /> Ghi chú & Chiến thuật
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm min-h-[100px]">
                          {competitor.notes ? (
                            <div className="prose prose-sm max-w-none text-gray-600 text-xs leading-relaxed">
                              <ReactMarkdown>{competitor.notes}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic text-center py-4">Chưa có ghi chú chiến thuật nào.</p>
                          )}
                        </div>
                      </div>

                      {/* Quick Insights Placeholder */}
                      <div className="p-4 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200 relative overflow-hidden">
                        <div className="relative z-10">
                          <div className="flex items-center text-[10px] font-bold uppercase tracking-widest opacity-80 mb-2">
                            <Lightbulb size={12} className="mr-1" /> Quick Insight
                          </div>
                          <p className="text-xs font-medium leading-relaxed">
                            {Number(competitor.subscriberCount.replace(/[^0-9]/g, '')) > 1000000
                              ? "Đối thủ lớn, tập trung vào chất lượng sản xuất và thương hiệu cá nhân."
                              : "Đối thủ tầm trung, có thể cạnh tranh bằng cách tối ưu SEO và ngách nhỏ hơn."}
                          </p>
                        </div>
                        <div className="absolute -right-4 -bottom-4 opacity-10">
                          <BarChart3 size={80} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
        {competitors.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <Search size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Chưa theo dõi đối thủ nào. Hãy thêm kênh đối thủ để bắt đầu!</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100"><h2 className="text-lg font-semibold">{editingCompetitor ? 'Sửa đối thủ' : 'Thêm đối thủ'}</h2><button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button></div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Tên kênh đối thủ</label><input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Link kênh</label><input type="url" required value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Subscribers</label><input type="text" value={formData.subscriberCount} onChange={e => setFormData({ ...formData, subscriberCount: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Video Count</label><input type="text" value={formData.videoCount} onChange={e => setFormData({ ...formData, videoCount: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú chiến thuật</label><textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" rows={3} placeholder="Họ hay làm về chủ đề gì? Thumbnail thế nào?..." /></div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Chủ đề (Tags)</label>
                <div className="flex flex-wrap gap-2">
                  {topics.map(topic => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => {
                        const newTopicIds = formData.topicIds.includes(topic.id)
                          ? formData.topicIds.filter(id => id !== topic.id)
                          : [...formData.topicIds, topic.id];
                        setFormData({ ...formData, topicIds: newTopicIds });
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${formData.topicIds.includes(topic.id)
                          ? 'text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      style={{ backgroundColor: formData.topicIds.includes(topic.id) ? topic.color : undefined }}
                    >
                      {topic.name}
                    </button>
                  ))}
                </div>
              </div>
              
              {isFullAccess && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phân quyền Nhân sự theo dõi</label>
                  <div className="flex flex-wrap gap-2">
                    {staffList.map(staff => {
                      const isAssigned = formData.allowedStaffIds?.includes(staff.id);
                      return (
                        <button
                          key={staff.id}
                          type="button"
                          onClick={() => {
                            const newStaffIds = isAssigned
                              ? (formData.allowedStaffIds || []).filter(id => id !== staff.id)
                              : [...(formData.allowedStaffIds || []), staff.id];
                            setFormData({ ...formData, allowedStaffIds: newStaffIds });
                          }}
                          className={`px-3 py-1 rounded-lg border text-xs font-medium transition-all ${isAssigned
                              ? 'bg-blue-50 border-blue-200 text-blue-700'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                            }`}
                        >
                          <div className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-2 ${isAssigned ? 'bg-blue-500' : 'bg-gray-300'}`} />
                            {staff.name}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg">Hủy</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Lưu đối thủ</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
