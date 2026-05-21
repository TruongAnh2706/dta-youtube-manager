import React, { useState } from 'react';
import { SystemSettings, ApiKey, CustomStatus } from '../types';
import { 
  Plus, Trash2, Key, Youtube, Sparkles, Save, AlertCircle, 
  CheckCircle2, RefreshCw, ShieldCheck, Database, ShieldAlert, SlidersHorizontal,
  Send, MessageCircle
} from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { sendTelegramMessage } from '../services/telegram';
import { sendZaloMessage } from '../services/zalo';

interface AdminSettingsProps {
  settings: SystemSettings;
  setSettings: React.Dispatch<React.SetStateAction<SystemSettings>>;
}

export function AdminSettings({ settings, setSettings }: AdminSettingsProps) {
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();
  const [newKey, setNewKey] = useState('');
  const [newKeyProvider, setNewKeyProvider] = useState<'youtube' | 'gemini'>('youtube');
  const [newKeyNote, setNewKeyNote] = useState('');

  // Status Management
  const [newStatusType, setNewStatusType] = useState<'emailStatuses' | 'taskStatuses'>('emailStatuses');
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusId, setNewStatusId] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('bg-gray-100 text-gray-700');

  // Telegram & Zalo Settings State
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [testingZalo, setTestingZalo] = useState(false);

  const handleTestTelegram = async () => {
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      showToast('Vui lòng điền đầy đủ Token và Chat ID trước khi test!', 'error');
      return;
    }
    setTestingTelegram(true);
    const success = await sendTelegramMessage(
      `🔔 <b>DTA STUDIO - KẾT NỐI THỬ NGHIỆM</b> 🔔\n\n---------------------------------------------\n✅ Cấu hình Telegram Bot trên DTA YouTube Manager đã kết nối thành công!\n⏰ <b>Thời gian test:</b> ${new Date().toLocaleString('vi-VN')}\n---------------------------------------------\nPhát triển bởi <b>DTA Studio</b> - Đức Trường AI (0962.775.506)`,
      settings
    );
    setTestingTelegram(false);
    if (success) {
      showToast('Gửi tin nhắn test thành công! Hãy kiểm tra Telegram.', 'success');
    } else {
      showToast('Gửi tin nhắn test thất bại! Vui lòng kiểm tra lại Token & Chat ID.', 'error');
    }
  };

  const handleTestZalo = async () => {
    if (!settings.zaloEnabled) {
      showToast('Vui lòng kích hoạt Zalo trước khi test!', 'error');
      return;
    }
    if (!settings.zaloApiUrl && (!settings.zaloAccessToken || !settings.zaloPhoneOrGroupId)) {
      showToast('Vui lòng điền Webhook URL hoặc (Access Token + ID người nhận) trước khi test!', 'error');
      return;
    }
    setTestingZalo(true);
    const success = await sendZaloMessage(
      `🔔 DTA STUDIO - KẾT NỐI THỬ NGHIỆM ZALO 🔔\n---------------------------------------------\n✅ Cấu hình thông báo Zalo trên DTA YouTube Manager đã hoạt động tốt!\n⏰ Thời gian test: ${new Date().toLocaleString('vi-VN')}\n---------------------------------------------\nPhát triển bởi DTA Studio - Đức Trường AI (0962.775.506)`,
      settings
    );
    setTestingZalo(false);
    if (success) {
      showToast('Gửi tin nhắn test Zalo thành công! Hãy kiểm tra Zalo.', 'success');
    } else {
      showToast('Gửi tin nhắn test Zalo thất bại! Vui lòng kiểm tra lại cấu hình.', 'error');
    }
  };

  const COLORS = [
    { id: 'gray', class: 'bg-gray-100 text-gray-700', label: 'Xám sáng' },
    { id: 'blue', class: 'bg-blue-100 text-blue-700', label: 'Xanh dương' },
    { id: 'green', class: 'bg-green-100 text-green-700', label: 'Xanh lá' },
    { id: 'yellow', class: 'bg-yellow-100 text-yellow-700', label: 'Vàng' },
    { id: 'red', class: 'bg-red-100 text-red-700', label: 'Đỏ' },
    { id: 'purple', class: 'bg-purple-100 text-purple-700', label: 'Tím' },
    { id: 'orange', class: 'bg-orange-100 text-orange-700', label: 'Cam' },
    { id: 'indigo', class: 'bg-indigo-100 text-indigo-700', label: 'Chàm' },
    { id: 'dark', class: 'bg-gray-800 text-white border border-gray-700', label: 'Đen nhám' },
  ];

  const handleAddKey = () => {
    if (!newKey.trim()) return;

    const keys = newKey.split('\n').map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) return;

    const newKeysObj: ApiKey[] = keys.map(k => ({
      id: crypto.randomUUID(),
      key: k,
      provider: newKeyProvider,
      status: 'active',
      note: newKeyNote.trim()
    }));

    if (newKeyProvider === 'youtube') {
      setSettings(prev => ({
        ...prev,
        youtubeApiKeys: [...prev.youtubeApiKeys, ...newKeysObj]
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        geminiApiKeys: [...prev.geminiApiKeys, ...newKeysObj]
      }));
    }

    setNewKey('');
    setNewKeyNote('');
    showToast(`Đã thêm ${newKeysObj.length} API Key ${newKeyProvider.toUpperCase()} thành công!`, 'success');
  };

  const handleDeleteKey = (id: string, provider: 'youtube' | 'gemini') => {
    if (confirm('Bạn có chắc chắn muốn xóa API Key này?')) {
      if (provider === 'youtube') {
        setSettings(prev => ({
          ...prev,
          youtubeApiKeys: prev.youtubeApiKeys.filter(k => k.id !== id),
          activeYoutubeKeyIndex: 0
        }));
      } else {
        setSettings(prev => ({
          ...prev,
          geminiApiKeys: prev.geminiApiKeys.filter(k => k.id !== id)
        }));
      }
      showToast(`Đã xóa API Key ${provider.toUpperCase()}.`, 'info');
    }
  };

  const toggleKeyStatus = (id: string, provider: 'youtube' | 'gemini') => {
    const updateKey = (keys: ApiKey[]): ApiKey[] => keys.map(k => {
      if (k.id === id) {
        const newStatus = (k.status === 'active' ? 'quota_exceeded' : 'active') as ApiKey['status'];
        showToast(`Đã cập nhật trạng thái Key sang: ${newStatus === 'active' ? 'Hoạt động' : 'Hết Quota'}`, 'info');
        return { ...k, status: newStatus };
      }
      return k;
    });

    if (provider === 'youtube') {
      setSettings(prev => ({ ...prev, youtubeApiKeys: updateKey(prev.youtubeApiKeys) }));
    } else {
      setSettings(prev => ({ ...prev, geminiApiKeys: updateKey(prev.geminiApiKeys) }));
    }
  };

  const handleAddStatus = () => {
    if (!newStatusLabel.trim()) return;
    const sId = newStatusId.trim() || newStatusLabel.trim().toLowerCase().replace(/\s+/g, '_');
    
    // Check if duplicate ID exists
    const existingList = settings[newStatusType] || [];
    if (existingList.some(s => s.id === sId)) {
      showToast('ID trạng thái đã tồn tại!', 'error');
      return;
    }

    const newObj: CustomStatus = {
      id: sId,
      label: newStatusLabel.trim(),
      color: newStatusColor
    };

    setSettings(prev => ({
      ...prev,
      [newStatusType]: [...(prev[newStatusType] || []), newObj]
    }));

    setNewStatusLabel('');
    setNewStatusId('');
    showToast('Đã thêm Trạng thái thành công!', 'success');
  };

  const handleDeleteStatus = (id: string, type: 'emailStatuses' | 'taskStatuses') => {
    if (confirm('Lưu ý: Nếu xóa, các luồng đang dùng trạng thái này có thể bị hiển thị sai chữ. Bạn có chắc muốn XÓA?')) {
      setSettings(prev => {
        const list = prev[type] || [];
        return {
          ...prev,
          [type]: list.filter(s => s.id !== id)
        };
      });
      showToast('Đã xóa trạng thái.', 'info');
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <ShieldCheck className="mr-2 text-blue-600" /> Cấu hình Hệ thống & Bảo mật
          </h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý API Keys, phân quyền và dữ liệu dùng chung cho toàn bộ hệ thống</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* API Key Management */}
        <div className="lg:col-span-2 space-y-6">
          {/* Add New Key */}
          {hasPermission('settings_edit_keys') ? (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Plus className="mr-2 text-blue-500" size={20} /> Thêm API Key mới
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dịch vụ</label>
                    <select 
                      value={newKeyProvider} 
                      onChange={e => setNewKeyProvider(e.target.value as any)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="youtube">YouTube Data API v3</option>
                      <option value="gemini">Google Gemini AI</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú (Tùy chọn)</label>
                    <input 
                      type="text" 
                      value={newKeyNote}
                      onChange={e => setNewKeyNote(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="VD: Key dự phòng 1..."
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key (Nhập nhiều key, mỗi key 1 dòng)</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Key className="absolute left-3 top-3 text-gray-400" size={16} />
                      <textarea 
                        value={newKey}
                        onChange={e => setNewKey(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 text-sm min-h-[80px]"
                        placeholder="Dán các API Key vào đây..."
                      />
                    </div>
                    <button 
                      onClick={handleAddKey}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center"
                    >
                      <Save size={16} className="mr-2" /> Lưu Key
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center text-center">
              <ShieldAlert size={32} className="text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Bạn không có quyền thêm hoặc chỉnh sửa API Keys.</p>
            </div>
          )}

          {/* YouTube Keys List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h2 className="text-sm font-bold text-gray-700 flex items-center uppercase tracking-wider">
                <Youtube className="mr-2 text-red-600" size={18} /> YouTube API Keys ({(settings?.youtubeApiKeys || []).length})
              </h2>
              <div className="flex items-center gap-2">
                {(settings?.youtubeApiKeys || []).some(k => k.status !== 'active') && (
                  <button 
                    onClick={() => {
                      setSettings(prev => ({
                        ...prev,
                        youtubeApiKeys: prev.youtubeApiKeys.map(k => ({ ...k, status: 'active' }))
                      }));
                      showToast('Đã kích hoạt lại toàn bộ YouTube API Keys.', 'success');
                    }}
                    className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold hover:bg-emerald-200 transition-colors"
                  >
                    Kích hoạt lại tất cả
                  </button>
                )}
                {(settings?.youtubeApiKeys || []).length > 1 && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                    Hỗ trợ xoay vòng Key tự động
                  </span>
                )}
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {(settings?.youtubeApiKeys || []).map((key, index) => (
                <div key={key.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-lg ${key.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {key.status === 'active' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-mono text-gray-600">••••••••{key.key.slice(-4)}</p>
                        {index === (settings?.activeYoutubeKeyIndex || 0) && (
                          <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase">Đang dùng</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{key.note || 'Không có ghi chú'}</p>
                    </div>
                  </div>
                  {hasPermission('settings_edit_keys') && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => toggleKeyStatus(key.id, 'youtube')}
                        className={`p-2 rounded-lg transition-colors ${key.status === 'active' ? 'text-gray-400 hover:text-red-600' : 'text-red-600 hover:bg-red-50'}`}
                        title={key.status === 'active' ? 'Đánh dấu hết Quota' : 'Kích hoạt lại'}
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteKey(key.id, 'youtube')}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {(settings?.youtubeApiKeys || []).length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm italic">Chưa có YouTube API Key nào được cài đặt.</div>
              )}
            </div>
          </div>

          {/* Gemini Keys List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-bold text-gray-700 flex items-center uppercase tracking-wider">
                <Sparkles className="mr-2 text-purple-600" size={18} /> Gemini AI Keys ({(settings?.geminiApiKeys || []).length})
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {(settings?.geminiApiKeys || []).map((key) => (
                <div key={key.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-lg ${key.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {key.status === 'active' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    </div>
                    <div>
                      <p className="text-sm font-mono text-gray-600">••••••••{key.key.slice(-4)}</p>
                      <p className="text-xs text-gray-400">{key.note || 'Không có ghi chú'}</p>
                    </div>
                  </div>
                  {hasPermission('settings_edit_keys') && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => toggleKeyStatus(key.id, 'gemini')}
                        className={`p-2 rounded-lg transition-colors ${key.status === 'active' ? 'text-gray-400 hover:text-red-600' : 'text-red-600 hover:bg-red-50'}`}
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteKey(key.id, 'gemini')}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {(settings?.geminiApiKeys || []).length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm italic">Chưa có Gemini API Key nào được cài đặt.</div>
              )}
            </div>
          </div>
        </div>

        {/* System Info & Data Management */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Database className="mr-2 text-emerald-500" size={20} /> Quản lý Dữ liệu
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                <p className="text-xs text-emerald-800 font-bold uppercase mb-1">Nguồn dữ liệu</p>
                <p className="text-sm text-emerald-700">Tất cả tài khoản đang sử dụng chung 1 cơ sở dữ liệu tập trung (Local Storage Sync).</p>
              </div>
              <div className="space-y-2">
                <button className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center">
                  Sao lưu Dữ liệu (Export JSON)
                </button>
                <button className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center">
                  Khôi phục Dữ liệu (Import JSON)
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <ShieldCheck className="mr-2 text-blue-500" size={20} /> Phân quyền Truy cập
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Admin</span>
                <span className="text-blue-600 font-bold">Toàn quyền</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Manager</span>
                <span className="text-gray-900">Quản lý Kênh, Tài chính, Nhân sự</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Leader</span>
                <span className="text-gray-900">Quản lý Kênh & Video</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Member</span>
                <span className="text-gray-900">Xem Dashboard, Video & Tài nguyên</span>
              </div>
            </div>
          </div>

          {/* Telegram Bot Settings (Premium DTA Studio) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Send className="mr-2 text-cyan-500" size={20} /> Thông báo Telegram Bot
              </h2>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.telegramEnabled || false}
                  onChange={e => setSettings(prev => ({ ...prev, telegramEnabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>
            
            <p className="text-xs text-gray-500">
              Tự động gửi cảnh báo khẩn cấp qua Telegram Bot khi Proxy bị lỗi, kênh nhận gậy bản quyền mới hoặc trễ lịch đăng video quá 15 phút.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Telegram Bot Token</label>
                <input 
                  type="password" 
                  value={settings.telegramBotToken || ''}
                  onChange={e => setSettings(prev => ({ ...prev, telegramBotToken: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:ring-cyan-500 font-mono"
                  placeholder="123456789:ABCdefGhIJKlmNoPQRsT..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Telegram Chat ID</label>
                <input 
                  type="text" 
                  value={settings.telegramChatId || ''}
                  onChange={e => setSettings(prev => ({ ...prev, telegramChatId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:ring-cyan-500 font-mono"
                  placeholder="-100123456789 hoặc ID cá nhân..."
                />
              </div>

              <button 
                onClick={handleTestTelegram}
                disabled={testingTelegram}
                className="w-full mt-2 py-2 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                <Send size={16} className={testingTelegram ? 'animate-bounce' : ''} />
                {testingTelegram ? 'Đang gửi...' : 'Gửi tin nhắn test'}
              </button>
            </div>
            <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400">
              <span>Phát triển bởi DTA Studio</span>
              <a href="https://dta-studio.vercel.app/" target="_blank" rel="noreferrer" className="hover:text-cyan-500 transition-colors font-semibold">Đức Trường</a>
            </div>
          </div>

          {/* Zalo Bot Settings (Premium DTA Studio) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <MessageCircle className="mr-2 text-blue-600 animate-pulse" size={20} /> Thông báo Zalo Bot
              </h2>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.zaloEnabled || false}
                  onChange={e => setSettings(prev => ({ ...prev, zaloEnabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <p className="text-xs text-gray-500">
              Tự động gửi cảnh báo qua Zalo (song song với Telegram) khi phát hiện Proxy chết, kênh nhận gậy bản quyền mới hoặc trễ lịch đăng video quá 15 phút.
            </p>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Cách A: Zalo Webhook 3rd Party</label>
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold">Khuyên dùng</span>
                </div>
                <input 
                  type="text" 
                  value={settings.zaloApiUrl || ''}
                  onChange={e => setSettings(prev => ({ ...prev, zaloApiUrl: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600 font-mono"
                  placeholder="https://api.webhook.vn/zalo/send/..."
                />
                <span className="text-[10px] text-gray-400 mt-1 block">Dành cho dịch vụ Zalo Solution, Webhook.vn hoặc bot tự host để gửi vào group chat Zalo.</span>
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-3">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Cách B: Zalo OA Chat API Chính thống</label>
                
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Zalo OA Access Token</label>
                  <input 
                    type="password" 
                    value={settings.zaloAccessToken || ''}
                    onChange={e => setSettings(prev => ({ ...prev, zaloAccessToken: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600 font-mono"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVC..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Zalo Recipient ID (SĐT hoặc User ID)</label>
                  <input 
                    type="text" 
                    value={settings.zaloPhoneOrGroupId || ''}
                    onChange={e => setSettings(prev => ({ ...prev, zaloPhoneOrGroupId: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600 font-mono"
                    placeholder="VD: 84962775506 hoặc ID người dùng..."
                  />
                </div>
              </div>

              <button 
                onClick={handleTestZalo}
                disabled={testingZalo || !settings.zaloEnabled}
                className="w-full mt-2 py-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-95 flex items-center justify-center gap-2 shadow-sm"
              >
                <Send size={16} className={testingZalo ? 'animate-bounce' : ''} />
                {testingZalo ? 'Đang gửi...' : 'Gửi tin nhắn test Zalo'}
              </button>
            </div>
            
            <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400">
              <span>Phát triển bởi DTA Studio</span>
              <a href="https://dta-studio.vercel.app/" target="_blank" rel="noreferrer" className="hover:text-blue-600 transition-colors font-semibold">Đức Trường</a>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Status Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <SlidersHorizontal className="mr-2 text-indigo-500" size={20} /> Tùy chỉnh Trạng thái (Dynamic Status)
        </h2>
        
        {hasPermission('settings_edit_permissions') ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại trạng thái</label>
                <select 
                  value={newStatusType}
                  onChange={e => setNewStatusType(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="emailStatuses">Quản lý Email thô</option>
                  <option value="taskStatuses">Quản lý Bảng Công việc (Task)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị (Label)</label>
                <input 
                  type="text" 
                  value={newStatusLabel}
                  onChange={e => setNewStatusLabel(e.target.value)}
                  placeholder="VD: Bị khóa mõm"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Màu sắc (Badge Color)</label>
                <select 
                  value={newStatusColor}
                  onChange={e => setNewStatusColor(e.target.value)}
                  className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium ${newStatusColor}`}
                >
                  {COLORS.map(c => (
                    <option key={c.id} value={c.class} className={c.class}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button 
                  onClick={handleAddStatus}
                  disabled={!newStatusLabel.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
                >
                  <Plus size={16} className="mr-2" /> Thêm Mới
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Email Statuses */}
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 font-medium text-sm text-gray-700 flex justify-between items-center">
                  Danh sách Trạng thái Email thô
                  <span className="bg-gray-200 text-gray-700 py-0.5 px-2 rounded-full text-xs">{(settings?.emailStatuses || []).length}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {(settings?.emailStatuses || []).map(status => (
                    <div key={status.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${status.color}`}>
                          {status.label}
                        </span>
                        <span className="ml-3 text-xs text-gray-400 font-mono">ID: {status.id}</span>
                      </div>
                      <button 
                        onClick={() => handleDeleteStatus(status.id, 'emailStatuses')}
                        className="text-gray-400 hover:text-red-600 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Task Statuses */}
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 font-medium text-sm text-gray-700 flex justify-between items-center">
                  Danh sách Trạng thái Công việc (Task)
                  <span className="bg-gray-200 text-gray-700 py-0.5 px-2 rounded-full text-xs">{(settings?.taskStatuses || []).length}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {(settings?.taskStatuses || []).map(status => (
                    <div key={status.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${status.color}`}>
                          {status.label}
                        </span>
                        <span className="ml-3 text-xs text-gray-400 font-mono">ID: {status.id}</span>
                      </div>
                      <button 
                        onClick={() => handleDeleteStatus(status.id, 'taskStatuses')}
                        className="text-gray-400 hover:text-red-600 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center text-center">
            <ShieldAlert size={32} className="text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">Chỉ Admin mới có quyền cấu hình hệ thống trạng thái động.</p>
          </div>
        )}
      </div>
    </div>
  );
}
