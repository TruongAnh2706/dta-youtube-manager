import React, { useState } from 'react';
import { Strike, StrikeType, StrikeStatus, Channel } from '../types';
import { Plus, Edit2, Trash2, X, ShieldAlert, AlertTriangle, CheckCircle, History, BarChart2, BrainCircuit, RefreshCw, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { GoogleGenAI } from '@google/genai';
import { useToast } from '../hooks/useToast';
import ReactMarkdown from 'react-markdown';

interface CopyrightManagerProps {
  strikes: Strike[];
  setStrikes: React.Dispatch<React.SetStateAction<Strike[]>>;
  channels: Channel[];
  geminiApiKey?: string;
}

const TYPE_LABELS: Record<StrikeType, string> = {
  copyright: 'Bản quyền',
  community: 'Cộng đồng'
};

const STATUS_LABELS: Record<StrikeStatus, string> = {
  active: 'Đang bị gậy',
  appealed: 'Đang kháng cáo',
  expired: 'Đã hết hạn',
  resolved: 'Đã gỡ gậy'
};

const STATUS_COLORS: Record<StrikeStatus, string> = {
  active: 'bg-red-100 text-red-800',
  appealed: 'bg-yellow-100 text-yellow-800',
  expired: 'bg-gray-100 text-gray-800',
  resolved: 'bg-green-100 text-green-800'
};

export function CopyrightManager({ strikes, setStrikes, channels, geminiApiKey }: CopyrightManagerProps) {
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStrike, setEditingStrike] = useState<Strike | null>(null);
  const [isAnalyzingRisk, setIsAnalyzingRisk] = useState(false);
  const [isAdvising, setIsAdvising] = useState<string | null>(null);
  const [riskAssessment, setRiskAssessment] = useState<string | null>(null);

  const [formData, setFormData] = useState<Omit<Strike, 'id'>>({
    channelId: channels[0]?.id || '',
    type: 'copyright',
    dateReceived: new Date().toISOString().split('T')[0],
    expirationDate: '',
    status: 'active',
    details: '',
    appealHistory: [],
    errorType: 'Video Content'
  });

  const [newAppeal, setNewAppeal] = useState('');

  const handleOpenModal = (strike?: Strike) => {
    if (strike) {
      setEditingStrike(strike);
      setFormData({
        channelId: strike.channelId,
        type: strike.type,
        dateReceived: strike.dateReceived,
        expirationDate: strike.expirationDate,
        status: strike.status,
        details: strike.details,
        appealHistory: strike.appealHistory || [],
        errorType: strike.errorType || 'Video Content'
      });
    } else {
      setEditingStrike(null);

      const today = new Date();
      const expDate = new Date(today.setDate(today.getDate() + 90));

      setFormData({
        channelId: channels[0]?.id || '',
        type: 'copyright',
        dateReceived: new Date().toISOString().split('T')[0],
        expirationDate: expDate.toISOString().split('T')[0],
        status: 'active',
        details: '',
        appealHistory: [],
        errorType: 'Video Content'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStrike) {
      setStrikes(strikes.map(s => s.id === editingStrike.id ? { ...s, ...formData } : s));
    } else {
      setStrikes([...strikes, { id: Date.now().toString(), ...formData }]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setStrikes(prev => prev.filter(s => s.id !== id));
  };

  const calculateDaysLeft = (expirationDate: string) => {
    const today = new Date();
    const exp = new Date(expirationDate);
    const diffTime = exp.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const errorTypeStats = strikes.reduce((acc: any, s) => {
    const type = s.errorType || 'Khác';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(errorTypeStats).map(([name, value]) => ({ name, value }));

  const handleRiskAssessment = async () => {
    setIsAnalyzingRisk(true);
    try {
      if (!geminiApiKey) {
        showToast('Vui lòng cấu hình Gemini API Key.', 'error');
        return;
      }

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const model = 'gemini-2.5-flash';

      const activeStrikes = strikes.filter(s => s.status === 'active');
      const strikeData = activeStrikes.map(s => ({
        channel: channels.find(c => c.id === s.channelId)?.name,
        type: s.type,
        error: s.errorType,
        details: s.details
      }));

      const prompt = `Phân tích rủi ro hệ thống YouTube dựa trên danh sách gậy hiện tại: ${JSON.stringify(strikeData)}. 
      Hãy đưa ra: 1. Điểm rủi ro (1-100). 2. Nhận định tổng quát. 3. 3 bước hành động khẩn cấp để giảm rủi ro. Trả về Markdown.`;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      setRiskAssessment(response.text || 'Không có phân tích.');
      showToast('Đã hoàn thành phân tích rủi ro hệ thống.', 'success');
    } catch (error) {
      showToast('Lỗi khi phân tích rủi ro.', 'error');
    } finally {
      setIsAnalyzingRisk(false);
    }
  };

  const handlePolicyAdvisor = async (strike: Strike) => {
    setIsAdvising(strike.id);
    try {
      if (!geminiApiKey) {
        showToast('Vui lòng cấu hình Gemini API Key.', 'error');
        return;
      }

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const model = 'gemini-2.5-flash';

      const channel = channels.find(c => c.id === strike.channelId);
      const prompt = `Bạn là chuyên gia chính sách YouTube. Tôi nhận được 1 gậy ${strike.type} tại kênh ${channel?.name}. 
      Lỗi: ${strike.errorType}. Chi tiết: ${strike.details}. 
      Hãy tư vấn cách kháng cáo hoặc xử lý tối ưu nhất để gỡ gậy hoặc giảm thiệt hại. Trả về 2-3 câu ngắn gọn.`;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      const advice = response.text || 'Không có tư vấn.';
      showToast(`TƯ VẤN AI (${channel?.name}): ${advice}`, 'success', 10000);
    } catch (error) {
      showToast('Lỗi khi nhận tư vấn chính sách.', 'error');
    } finally {
      setIsAdvising(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bản quyền & Rủi ro</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý gậy, lịch sử kháng cáo và phân tích rủi ro</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors"
        >
          <Plus size={16} className="mr-2" /> Thêm cảnh báo
        </button>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center">
              <BarChart2 size={16} className="mr-2 text-red-500" /> Thống kê loại lỗi hay gặp
            </h3>
            <button
              onClick={handleRiskAssessment}
              disabled={isAnalyzingRisk}
              className="text-xs bg-red-50 text-red-600 px-3 py-1 rounded-full font-bold hover:bg-red-100 transition-colors flex items-center border border-red-100"
            >
              {isAnalyzingRisk ? <RefreshCw size={12} className="mr-1 animate-spin" /> : <Activity size={12} className="mr-1" />}
              AI Risk Assessment
            </button>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" fontSize={10} width={100} />
                <Tooltip />
                <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
          <ShieldAlert size={48} className="text-red-500 mb-2" />
          <h3 className="text-2xl font-bold text-gray-900">{strikes.filter(s => s.status === 'active').length}</h3>
          <p className="text-sm text-gray-500">Gậy đang hoạt động</p>
          <div className="mt-4 w-full bg-red-50 p-3 rounded-lg border border-red-100">
            <p className="text-xs text-red-700 font-medium">Mẹo: Luôn kiểm tra kỹ nhạc và footage trước khi đăng để tránh gậy bản quyền.</p>
          </div>
        </div>
      </div>

      {riskAssessment && (
        <div className="bg-red-900 text-white p-6 rounded-xl shadow-lg border border-red-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ShieldAlert size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center">
                <BrainCircuit size={20} className="mr-2" /> AI Risk Assessment Report
              </h3>
              <button onClick={() => setRiskAssessment(null)} className="text-red-300 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="prose prose-invert max-w-none text-red-100 text-sm">
              <ReactMarkdown>{riskAssessment}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {strikes.map(strike => {
          const channel = channels.find(c => c.id === strike.channelId);
          const daysLeft = calculateDaysLeft(strike.expirationDate);
          const isExpired = daysLeft <= 0;

          return (
            <div key={strike.id} className={`bg-white rounded-xl shadow-sm border p-5 flex flex-col ${strike.status === 'active' && !isExpired ? 'border-red-200' : 'border-gray-100'}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${strike.type === 'copyright' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                    {strike.type === 'copyright' ? <ShieldAlert size={20} /> : <AlertTriangle size={20} />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 flex items-center">
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 mr-2 font-bold">
                        {channel?.channelCode || '??'}
                      </span>
                      {channel?.name || 'Kênh đã xóa'}
                    </h3>
                    <span className="text-xs text-gray-500">{TYPE_LABELS[strike.type]}</span>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button onClick={() => handleOpenModal(strike)} className="p-1 text-gray-400 hover:text-red-600"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(strike.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              </div>

              <div className="space-y-3 flex-grow">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Ngày nhận:</span>
                  <span className="font-medium text-gray-900">{new Date(strike.dateReceived).toLocaleDateString('vi-VN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Ngày hết hạn:</span>
                  <span className="font-medium text-gray-900">{new Date(strike.expirationDate).toLocaleDateString('vi-VN')}</span>
                </div>

                {strike.status === 'active' && (
                  <div className={`p-2 rounded-lg text-sm text-center font-medium ${isExpired ? 'bg-gray-100 text-gray-600' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                    {isExpired ? 'Đã qua ngày hết hạn' : `Còn ${daysLeft} ngày nữa hết hạn`}
                  </div>
                )}

                {strike.details && (
                  <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                    {strike.details}
                  </p>
                )}

                {strike.appealHistory && strike.appealHistory.length > 0 && (
                  <div className="mt-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center mb-1">
                      <History size={10} className="mr-1" /> Lịch sử kháng cáo
                    </span>
                    <ul className="text-xs text-gray-500 space-y-1">
                      {strike.appealHistory.map((h, i) => (
                        <li key={i} className="bg-gray-50 p-1 rounded">• {h}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center gap-2">
                <button
                  onClick={() => handlePolicyAdvisor(strike)}
                  disabled={isAdvising === strike.id}
                  className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-bold rounded-lg transition-colors border border-red-100 flex items-center justify-center"
                >
                  {isAdvising === strike.id ? <RefreshCw size={12} className="mr-1 animate-spin" /> : <BrainCircuit size={12} className="mr-1" />}
                  AI Advisor
                </button>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[strike.status]}`}>
                    {STATUS_LABELS[strike.status]}
                  </span>
                  {strike.status === 'active' && isExpired && (
                    <button
                      onClick={() => {
                        setStrikes(strikes.map(s => s.id === strike.id ? { ...s, status: 'expired' } : s));
                      }}
                      className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center"
                    >
                      <CheckCircle size={14} className="mr-1" /> Đã hết hạn
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {strikes.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <ShieldAlert size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Kênh của bạn đang an toàn. Chưa có gậy bản quyền nào!</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-semibold">{editingStrike ? 'Sửa cảnh báo' : 'Thêm cảnh báo mới'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-4">
              <form id="strike-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kênh bị gậy</label>
                    <select required value={formData.channelId} onChange={e => setFormData({ ...formData, channelId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                      {channels.map(c => <option key={c.id} value={c.id}>[{c.channelCode}] {c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Loại gậy</label>
                    <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as StrikeType })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                      {Object.entries(TYPE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                    <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as StrikeStatus })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                      {Object.entries(STATUS_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ngày nhận gậy</label>
                    <input type="date" required value={formData.dateReceived} onChange={e => setFormData({ ...formData, dateReceived: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ngày hết hạn</label>
                    <input type="date" required value={formData.expirationDate} onChange={e => setFormData({ ...formData, expirationDate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Loại lỗi</label>
                    <select value={formData.errorType} onChange={e => setFormData({ ...formData, errorType: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                      <option value="Video Content">Nội dung Video</option>
                      <option value="Audio/Music">Âm thanh/Nhạc</option>
                      <option value="Thumbnail">Ảnh thu nhỏ</option>
                      <option value="Metadata">Siêu dữ liệu (Tags/Desc)</option>
                      <option value="Community Guidelines">Tiêu chuẩn cộng đồng</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chi tiết (Video nào bị, lý do...)</label>
                  <textarea value={formData.details} onChange={e => setFormData({ ...formData, details: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500" rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kháng cáo mới</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAppeal}
                      onChange={e => setNewAppeal(e.target.value)}
                      placeholder="Nhập nội dung kháng cáo..."
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newAppeal.trim()) {
                          setFormData(prev => ({
                            ...prev,
                            appealHistory: [...(prev.appealHistory || []), `${new Date().toLocaleDateString('vi-VN')}: ${newAppeal.trim()}`]
                          }));
                          setNewAppeal('');
                        }
                      }}
                      className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
                    >
                      Thêm
                    </button>
                  </div>
                </div>
              </form>
            </div>
            <div className="p-4 border-t border-gray-100 shrink-0 flex justify-end space-x-3 bg-gray-50">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors">Hủy</button>
              <button type="submit" form="strike-form" className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">Lưu cảnh báo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
