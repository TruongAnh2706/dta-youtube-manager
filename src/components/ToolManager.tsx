import React, { useState } from 'react';
import { License, Topic } from '../types';
import { Plus, Edit2, Trash2, X, Key, Calendar, Monitor, AlertCircle, Sparkles, BrainCircuit, RefreshCw } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { useToast } from '../hooks/useToast';

interface ToolManagerProps {
  licenses: License[];
  setLicenses: React.Dispatch<React.SetStateAction<License[]>>;
  privacyMode: boolean;
  topics: Topic[];
  geminiApiKey?: string;
}

export function ToolManager({ licenses, setLicenses, privacyMode, topics, geminiApiKey }: ToolManagerProps) {
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [isRecommending, setIsRecommending] = useState(false);
  const [formData, setFormData] = useState<Omit<License, 'id'>>({
    softwareName: '', accountEmail: '', password: '', licenseKey: '', expirationDate: '', cost: 0, status: 'active', devices: []
  });

  const [newDevice, setNewDevice] = useState('');

  const handleOpenModal = (license?: License) => {
    if (license) {
      setEditingLicense(license);
      setFormData({
        ...license,
        devices: license.devices || []
      });
    } else {
      setEditingLicense(null);
      setFormData({ softwareName: '', accountEmail: '', password: '', licenseKey: '', expirationDate: '', cost: 0, status: 'active', devices: [] });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLicense) {
      setLicenses(licenses.map(l => l.id === editingLicense.id ? { ...l, ...formData } : l));
    } else {
      setLicenses([...licenses, { id: Date.now().toString(), ...formData }]);
    }
    setIsModalOpen(false);
  };

  const calculateDaysLeft = (date: string) => {
    const diff = new Date(date).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  const handleAIToolRecommend = async () => {
    setIsRecommending(true);
    try {
      if (!geminiApiKey) {
        showToast('Vui lòng cấu hình Gemini API Key.', 'error');
        return;
      }

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const model = 'gemini-2.5-flash';

      const topicNames = topics.map(t => t.name).join(', ');
      const prompt = `Dựa trên các chủ đề nội dung: ${topicNames}. 
      Hãy đề xuất 3 công cụ (phần mềm, web app) "Must-have" để tối ưu hóa quy trình làm YouTube (ví dụ: edit video, nghiên cứu từ khóa, quản lý team). Trả về 3 dòng ngắn gọn.`;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      const recommendation = response.text || 'Không có đề xuất.';
      showToast(`ĐỀ XUẤT CÔNG CỤ AI: ${recommendation}`, 'success', 15000);
    } catch (error) {
      showToast('Lỗi khi nhận đề xuất công cụ.', 'error');
    } finally {
      setIsRecommending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Công cụ & License</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý tài khoản phần mềm (Adobe, Canva, CapCut...) và hạn sử dụng</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleAIToolRecommend}
            disabled={isRecommending}
            className="text-sm flex items-center text-teal-600 hover:text-teal-700 font-bold bg-teal-50 px-4 py-2 rounded-lg border border-teal-100 transition-colors"
          >
            {isRecommending ? <RefreshCw size={16} className="mr-2 animate-spin" /> : <BrainCircuit size={16} className="mr-2" />}
            AI Tool Recommender
          </button>
          <button onClick={() => handleOpenModal()} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors">
            <Plus size={16} className="mr-2" /> Thêm License
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {licenses.map(license => {
          const daysLeft = calculateDaysLeft(license.expirationDate);
          const isExpiringSoon = daysLeft <= 7 && daysLeft > 0;
          const isExpired = daysLeft <= 0;

          return (
            <div key={license.id} className={`bg-white p-5 rounded-xl shadow-sm border ${isExpired ? 'border-red-300' : isExpiringSoon ? 'border-yellow-300' : 'border-gray-100'}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-teal-50 text-teal-600 rounded-lg"><Key size={20} /></div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{license.softwareName}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${license.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{license.status.toUpperCase()}</span>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button onClick={() => handleOpenModal(license)} className="p-1 text-gray-400 hover:text-teal-600"><Edit2 size={16} /></button>
                  <button onClick={() => { if (confirm('Xóa license này?')) setLicenses(licenses.filter(l => l.id !== license.id)); }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <p><span className="font-medium">Email:</span> {license.accountEmail}</p>
                <p><span className="font-medium">Pass:</span> {privacyMode ? '••••••••' : (license.password || 'Không có')}</p>
                <p><span className="font-medium">Key:</span> {privacyMode ? '••••••••' : (license.licenseKey || 'Không có')}</p>
                <p><span className="font-medium">Chi phí:</span> {privacyMode ? '***' : `${license.cost.toLocaleString('vi-VN')} đ`}</p>
                {license.devices && license.devices.length > 0 && (
                  <div className="pt-1">
                    <span className="font-medium flex items-center mb-1"><Monitor size={12} className="mr-1" /> Thiết bị:</span>
                    <div className="flex flex-wrap gap-1">
                      {license.devices.map((d, i) => (
                        <span key={i} className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">{d}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isExpiringSoon && (
                <div className="mb-3 p-2 bg-red-50 border border-red-100 rounded-lg flex items-center text-red-700 text-xs font-bold animate-pulse">
                  <AlertCircle size={14} className="mr-1" /> Sắp hết hạn! Hãy gia hạn ngay.
                </div>
              )}

              <div className={`p-3 rounded-lg flex items-center justify-between text-sm font-medium ${isExpired ? 'bg-red-50 text-red-700' : isExpiringSoon ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-50 text-gray-700'}`}>
                <div className="flex items-center"><Calendar size={16} className="mr-2" /> {new Date(license.expirationDate).toLocaleDateString('vi-VN')}</div>
                <span>{isExpired ? 'Đã hết hạn' : `Còn ${daysLeft} ngày`}</span>
              </div>
            </div>
          );
        })}
        {licenses.length === 0 && <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300"><p className="text-gray-500">Chưa có license phần mềm nào.</p></div>}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100"><h2 className="text-lg font-semibold">License Phần mềm</h2><button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button></div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Tên phần mềm (VD: Canva Pro)</label><input type="text" required value={formData.softwareName} onChange={e => setFormData({ ...formData, softwareName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email đăng nhập</label><input type="email" required value={formData.accountEmail} onChange={e => setFormData({ ...formData, accountEmail: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label><input type="text" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">License Key (Dùng cho API YouTube...)</label><input type="text" value={formData.licenseKey} onChange={e => setFormData({ ...formData, licenseKey: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Ngày hết hạn</label><input type="date" required value={formData.expirationDate} onChange={e => setFormData({ ...formData, expirationDate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Chi phí (VNĐ)</label><input type="number" value={formData.cost} onChange={e => setFormData({ ...formData, cost: parseInt(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label><select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })} className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"><option value="active">Đang sử dụng</option><option value="expired">Đã hết hạn</option></select></div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quản lý thiết bị</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newDevice}
                    onChange={e => setNewDevice(e.target.value)}
                    placeholder="Tên máy tính/nhân viên..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newDevice.trim()) {
                        setFormData(prev => ({ ...prev, devices: [...(prev.devices || []), newDevice.trim()] }));
                        setNewDevice('');
                      }
                    }}
                    className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    Thêm
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {formData.devices?.map((d, i) => (
                    <span key={i} className="bg-teal-50 text-teal-700 px-2 py-1 rounded text-xs flex items-center">
                      {d}
                      <button type="button" onClick={() => setFormData(prev => ({ ...prev, devices: prev.devices?.filter((_, idx) => idx !== i) }))} className="ml-1 hover:text-red-500">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg">Hủy</button><button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded-lg">Lưu</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
