import React, { useState } from 'react';
import { Channel, SourceChannel, Topic } from '../types';
import { Search, Lightbulb, ArrowRight, Activity, Target, Star } from 'lucide-react';
import { performDeepAnalysis } from '../services/aiService';

interface AnalysisProps {
  channels: Channel[];
  sourceChannels: SourceChannel[];
  topics: Topic[];
  geminiApiKey?: string;
}

export function Analysis({ channels, sourceChannels, topics, geminiApiKey }: AnalysisProps) {
  const [selectedTopic, setSelectedTopic] = useState<string>(topics[0]?.id || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string[]>([]);

  const handleAnalyze = async () => {
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
      
      const results = await performDeepAnalysis(topicName, ourChannels, topicSources, geminiApiKey);
      setAnalysisResult(results);
    } catch (error) {
      console.error("Lỗi phân tích:", error);
      alert("Có lỗi xảy ra khi gọi AI phân tích. Vui lòng kiểm tra API Key.");
    } finally {
      setIsAnalyzing(false);
    }
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
          <button 
            onClick={handleAnalyze}
            disabled={!selectedTopic || isAnalyzing}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center"
          >
            {isAnalyzing ? (
              <span className="flex items-center"><Activity className="animate-spin mr-2" size={18} /> Đang phân tích...</span>
            ) : (
              <span className="flex items-center"><Search className="mr-2" size={18} /> Phân tích ngay</span>
            )}
          </button>
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
                      <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
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
    </div>
  );
}
