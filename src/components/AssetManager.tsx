import React, { useState } from 'react';
import { Asset, AssetType, Proxy, Topic, ManagedEmail, Staff } from '../types';
import { Plus, Edit2, Trash2, X, HardDrive, Video, Music, LayoutTemplate, Globe, Server, Type, Film, ExternalLink, RefreshCw, AlertCircle, Sparkles, Calendar, BrainCircuit, Mail, Copy, Check } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { useToast } from '../hooks/useToast';

interface AssetManagerProps {
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  proxies: Proxy[];
  setProxies: React.Dispatch<React.SetStateAction<Proxy[]>>;
  topics: Topic[];
  geminiApiKey?: string;
  managedEmails: ManagedEmail[];
  setManagedEmails: React.Dispatch<React.SetStateAction<ManagedEmail[]>>;
  staffList: Staff[];
}

const ASSET_TYPES: { id: AssetType; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'drive', label: 'Google Drive / Cloud', icon: HardDrive, color: 'text-blue-600 bg-blue-50' },
  { id: 'stock_video', label: 'Video Stock', icon: Video, color: 'text-emerald-600 bg-emerald-50' },
  { id: 'audio', label: 'Nhạc / SFX', icon: Music, color: 'text-purple-600 bg-purple-50' },
  { id: 'template', label: 'Template (Pr, Ae, CapCut)', icon: LayoutTemplate, color: 'text-orange-600 bg-orange-50' },
  { id: 'font', label: 'Font chữ', icon: Type, color: 'text-indigo-600 bg-indigo-50' },
  { id: 'footage', label: 'Footage quay sẵn', icon: Film, color: 'text-red-600 bg-red-50' },
  { id: 'license', label: 'License / Bản quyền', icon: Calendar, color: 'text-amber-600 bg-amber-50' },
];

export function AssetManager({ assets, setAssets, proxies, setProxies, topics, geminiApiKey, managedEmails, setManagedEmails, staffList }: AssetManagerProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'assets' | 'proxies' | 'emails'>('assets');
  const [isCheckingProxies, setIsCheckingProxies] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);

  // Asset Modal State
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [assetForm, setAssetForm] = useState<Omit<Asset, 'id'>>({ name: '', type: 'drive', url: '', notes: '', expirationDate: '' });

  // Proxy Modal State
  const [isProxyModalOpen, setIsProxyModalOpen] = useState(false);
  const [editingProxy, setEditingProxy] = useState<Proxy | null>(null);
  const [proxyForm, setProxyForm] = useState<Omit<Proxy, 'id'>>({ ip: '', port: '', username: '', password: '', status: 'active', notes: '' });

  // Email Modal State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState<ManagedEmail | null>(null);
  const [emailForm, setEmailForm] = useState<Omit<ManagedEmail, 'id'>>({ channelCode: '', email: '', password: '', recoveryEmail: '', twoFactorAuth: '', verificationPhone: '', assignedTo: '', status: 'new', notes: '' });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Đã copy vào clipboard', 'success');
  };

  const handleAssetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAsset) {
      setAssets(assets.map(a => a.id === editingAsset.id ? { ...a, ...assetForm } : a));
    } else {
      setAssets([...assets, { id: Date.now().toString(), ...assetForm }]);
    }
    setIsAssetModalOpen(false);
  };

  const handleProxySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProxy) {
      setProxies(proxies.map(p => p.id === editingProxy.id ? { ...p, ...proxyForm } : p));
    } else {
      setProxies([...proxies, { id: Date.now().toString(), ...proxyForm }]);
    }
    setIsProxyModalOpen(false);
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEmail) {
      setManagedEmails(managedEmails.map(m => m.id === editingEmail.id ? { ...m, ...emailForm } : m));
    } else {
      setManagedEmails([...managedEmails, { id: Date.now().toString(), ...emailForm }]);
    }
    setIsEmailModalOpen(false);
  };

  const handleAIRecommend = async () => {
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
      Hãy đề xuất 3 nguồn tài nguyên (website, thư viện) hữu ích nhất (ví dụ: kho nhạc, kho video stock, tool AI) để hỗ trợ sản xuất nội dung này. Trả về 3 dòng ngắn gọn kèm link.`;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      const recommendation = response.text || 'Không có đề xuất.';
      showToast(`ĐỀ XUẤT TÀI NGUYÊN AI: ${recommendation}`, 'success', 15000);
    } catch (error) {
      showToast('Lỗi khi nhận đề xuất tài nguyên.', 'error');
    } finally {
      setIsRecommending(false);
    }
  };

  const checkLicenseStatus = (expirationDate?: string) => {
    if (!expirationDate) return null;
    const today = new Date();
    const exp = new Date(expirationDate);
    const diffTime = exp.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: 'Hết hạn', color: 'text-red-600 bg-red-50 border-red-200' };
    if (diffDays <= 7) return { label: `Sắp hết hạn (${diffDays} ngày)`, color: 'text-orange-600 bg-orange-50 border-orange-200' };
    return { label: `Còn ${diffDays} ngày`, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tài nguyên & Proxy</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý kho nguyên liệu dùng chung và danh sách IP/VPS</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('assets')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'assets' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Kho nguyên liệu
          </button>
          <button
            onClick={() => setActiveTab('proxies')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'proxies' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Quản lý Proxy/VPS
          </button>
          <button
            onClick={() => setActiveTab('emails')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'emails' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Quản lý Email
          </button>
        </div>
      </div>

      {activeTab === 'assets' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <button
              onClick={handleAIRecommend}
              disabled={isRecommending}
              className="text-sm flex items-center text-indigo-600 hover:text-indigo-700 font-bold bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100 transition-colors"
            >
              {isRecommending ? <RefreshCw size={16} className="mr-2 animate-spin" /> : <BrainCircuit size={16} className="mr-2" />}
              AI Resource Recommender
            </button>
            <button onClick={() => { setEditingAsset(null); setAssetForm({ name: '', type: 'drive', url: '', notes: '', expirationDate: '' }); setIsAssetModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors">
              <Plus size={16} className="mr-2" /> Thêm tài nguyên
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map(asset => {
              const typeInfo = ASSET_TYPES.find(t => t.id === asset.type);
              const Icon = typeInfo?.icon || HardDrive;
              const licenseStatus = checkLicenseStatus(asset.expirationDate);

              return (
                <div key={asset.id} className={`bg-white p-5 rounded-xl shadow-sm border flex flex-col hover:shadow-md transition-shadow ${licenseStatus?.label === 'Hết hạn' ? 'border-red-300' : 'border-gray-100'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${typeInfo?.color || 'bg-gray-100 text-gray-600'}`}><Icon size={20} /></div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{asset.name}</h3>
                        <span className="text-xs text-gray-500">{typeInfo?.label}</span>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <button onClick={() => { setEditingAsset(asset); setAssetForm(asset); setIsAssetModalOpen(true); }} className="p-1 text-gray-400 hover:text-blue-600"><Edit2 size={16} /></button>
                      <button onClick={() => setAssets(prev => prev.filter(a => a.id !== asset.id))} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </div>

                  {licenseStatus && (
                    <div className={`mb-3 px-2 py-1 rounded text-[10px] font-bold border flex items-center w-fit ${licenseStatus.color}`}>
                      <AlertCircle size={10} className="mr-1" /> {licenseStatus.label}
                    </div>
                  )}

                  <a
                    href={asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-500 hover:underline truncate mb-2 flex items-center"
                  >
                    <ExternalLink size={12} className="mr-1 shrink-0" />
                    {asset.url}
                  </a>
                  {asset.notes && <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded mt-auto italic">"{asset.notes}"</p>}
                </div>
              );
            })}
            {assets.length === 0 && <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300"><p className="text-gray-500">Chưa có tài nguyên nào.</p></div>}
          </div>
        </div>
      )}

      {activeTab === 'proxies' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <button
              onClick={() => {
                setIsCheckingProxies(true);
                setTimeout(() => {
                  setProxies(prev => prev.map(p => ({ ...p, status: Math.random() > 0.2 ? 'active' : 'dead' })));
                  setIsCheckingProxies(false);
                }, 2000);
              }}
              disabled={isCheckingProxies || proxies.length === 0}
              className="text-sm flex items-center text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
            >
              <RefreshCw size={16} className={`mr-2 ${isCheckingProxies ? 'animate-spin' : ''}`} />
              {isCheckingProxies ? 'Đang kiểm tra...' : 'Check Live Proxy'}
            </button>
            <button onClick={() => { setEditingProxy(null); setProxyForm({ ip: '', port: '', username: '', password: '', status: 'active', notes: '' }); setIsProxyModalOpen(true); }} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors">
              <Plus size={16} className="mr-2" /> Thêm Proxy/VPS
            </button>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500">
                  <th className="p-4 font-medium">IP : Port</th>
                  <th className="p-4 font-medium">Auth</th>
                  <th className="p-4 font-medium">Trạng thái</th>
                  <th className="p-4 font-medium">Ghi chú</th>
                  <th className="p-4 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {proxies.map(proxy => (
                  <tr key={proxy.id} className="hover:bg-gray-50">
                    <td className="p-4 font-mono text-sm text-gray-900 flex items-center"><Globe size={16} className="mr-2 text-gray-400" /> {proxy.ip}:{proxy.port}</td>
                    <td className="p-4 text-sm text-gray-600">{proxy.username ? `${proxy.username}:***` : 'No Auth'}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${proxy.status === 'active' ? 'bg-green-100 text-green-800' : proxy.status === 'inactive' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'}`}>
                        {proxy.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-600">{proxy.notes}</td>
                    <td className="p-4 text-right">
                      <button onClick={() => { setEditingProxy(proxy); setProxyForm(proxy); setIsProxyModalOpen(true); }} className="p-1 text-gray-400 hover:text-purple-600"><Edit2 size={16} /></button>
                      <button onClick={() => setProxies(prev => prev.filter(p => p.id !== proxy.id))} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                {proxies.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-500">Chưa có Proxy/VPS nào.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'emails' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center"><Mail className="mr-2" size={20} /> Kho Email</h2>
            <button onClick={() => { setEditingEmail(null); setEmailForm({ channelCode: '', email: '', password: '', recoveryEmail: '', twoFactorAuth: '', verificationPhone: '', assignedTo: '', status: 'new', notes: '' }); setIsEmailModalOpen(true); }} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors">
              <Plus size={16} className="mr-2" /> Thêm Email mới
            </button>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500">
                  <th className="p-4 font-medium">Kênh</th>
                  <th className="p-4 font-medium">Email</th>
                  <th className="p-4 font-medium">Bảo mật</th>
                  <th className="p-4 font-medium">Khôi phục & SĐT</th>
                  <th className="p-4 font-medium">Nhân sự</th>
                  <th className="p-4 font-medium">Ghi chú</th>
                  <th className="p-4 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {managedEmails.map(mail => (
                  <tr key={mail.id} className="hover:bg-gray-50">
                    <td className="p-4 text-sm font-medium text-gray-900">{mail.channelCode || '-'}</td>
                    <td className="p-4 text-sm font-semibold text-blue-600">
                      <div className="flex items-center space-x-2">
                        <span>{mail.email}</span>
                        <button onClick={() => handleCopy(mail.email)} className="text-gray-400 hover:text-blue-600"><Copy size={14} /></button>
                      </div>
                    </td>
                    <td className="p-4 text-sm">
                      <button onClick={() => handleCopy(mail.password || '')} className="text-gray-500 hover:text-gray-900 flex items-center text-xs border rounded bg-white px-2 py-1 shadow-sm">
                        <Copy size={12} className="mr-1" /> Copy Pass
                      </button>
                      {mail.twoFactorAuth && (
                        <div className="mt-1 text-[10px] text-gray-400 font-mono truncate max-w-[100px]" title={mail.twoFactorAuth}>2FA: {mail.twoFactorAuth}</div>
                      )}
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      <div>{mail.recoveryEmail || '-'}</div>
                      <div className="text-gray-400 text-xs mt-0.5">{mail.verificationPhone || '-'}</div>
                    </td>
                    <td className="p-4 text-sm">
                      <select
                        title="staff-assigned"
                        value={mail.assignedTo || ''}
                        onChange={(e) => {
                          const newStaffId = e.target.value;
                          setManagedEmails(managedEmails.map(m => m.id === mail.id ? { ...m, assignedTo: newStaffId } : m));
                          showToast('Bàn giao Email thành công!', 'success');
                        }}
                        className="w-full text-xs font-medium border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 bg-gray-50 hover:bg-white text-gray-700"
                      >
                        <option value="">-- Thu hồi / Chưa giao --</option>
                        {staffList.map(staff => (
                          <option key={staff.id} value={staff.id}>{staff.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4 text-sm text-gray-500 ">{mail.notes}</td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <button onClick={() => { setEditingEmail(mail); setEmailForm(mail); setIsEmailModalOpen(true); }} className="p-1 text-gray-400 hover:text-rose-600"><Edit2 size={16} /></button>
                      <button onClick={() => {
                        if (confirm('Xóa Email này ra khỏi cơ sở dữ liệu?')) setManagedEmails(prev => prev.filter(m => m.id !== mail.id));
                      }} className="p-1 text-gray-400 hover:text-red-600 ml-1"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                {managedEmails.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-gray-500">Chưa có Email nào được quản lý.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Asset Modal */}
      {isAssetModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100"><h2 className="text-lg font-semibold">Tài nguyên</h2><button onClick={() => setIsAssetModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button></div>
            <form onSubmit={handleAssetSubmit} className="p-4 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Tên tài nguyên</label><input type="text" required value={assetForm.name} onChange={e => setAssetForm({ ...assetForm, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Loại</label><select value={assetForm.type} onChange={e => setAssetForm({ ...assetForm, type: e.target.value as AssetType })} className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">{ASSET_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Ngày hết hạn (Nếu có)</label><input type="date" value={assetForm.expirationDate} onChange={e => setAssetForm({ ...assetForm, expirationDate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">URL / Link Drive</label><input type="url" required value={assetForm.url} onChange={e => setAssetForm({ ...assetForm, url: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label><textarea value={assetForm.notes} onChange={e => setAssetForm({ ...assetForm, notes: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" rows={2} /></div>
              <div className="flex justify-end space-x-3 pt-4"><button type="button" onClick={() => setIsAssetModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg">Hủy</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Lưu</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Proxy Modal */}
      {isProxyModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100"><h2 className="text-lg font-semibold">Proxy / VPS</h2><button onClick={() => setIsProxyModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button></div>
            <form onSubmit={handleProxySubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">IP</label><input type="text" required value={proxyForm.ip} onChange={e => setProxyForm({ ...proxyForm, ip: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="192.168.1.1" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Port</label><input type="text" required value={proxyForm.port} onChange={e => setProxyForm({ ...proxyForm, port: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="8080" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Username (Tùy chọn)</label><input type="text" value={proxyForm.username} onChange={e => setProxyForm({ ...proxyForm, username: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Password (Tùy chọn)</label><input type="password" value={proxyForm.password} onChange={e => setProxyForm({ ...proxyForm, password: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label><select value={proxyForm.status} onChange={e => setProxyForm({ ...proxyForm, status: e.target.value as any })} className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"><option value="active">Active</option><option value="inactive">Inactive</option><option value="dead">Dead</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú (Dùng cho kênh nào...)</label><textarea value={proxyForm.notes} onChange={e => setProxyForm({ ...proxyForm, notes: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" rows={2} /></div>
              <div className="flex justify-end space-x-3 pt-4"><button type="button" onClick={() => setIsProxyModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg">Hủy</button><button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg">Lưu</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold flex items-center"><Mail className="mr-2" size={20} /> {editingEmail ? 'Sửa thông tin Email' : 'Thêm Email mới'}</h2>
              <button onClick={() => setIsEmailModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleEmailSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ Email *</label><input type="email" required value={emailForm.email} onChange={e => setEmailForm({ ...emailForm, email: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="abc@gmail.com" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu *</label><input type="text" required value={emailForm.password} onChange={e => setEmailForm({ ...emailForm, password: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Password@123" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Email khôi phục</label><input type="email" value={emailForm.recoveryEmail} onChange={e => setEmailForm({ ...emailForm, recoveryEmail: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="backup@gmail.com" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">SĐT Xác minh</label><input type="text" value={emailForm.verificationPhone} onChange={e => setEmailForm({ ...emailForm, verificationPhone: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="0987654321" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Mã 2FA / Backup Code</label><textarea value={emailForm.twoFactorAuth} onChange={e => setEmailForm({ ...emailForm, twoFactorAuth: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm" placeholder="Mã 2FA..." rows={2} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Mã Kênh Định Danh</label><input type="text" value={emailForm.channelCode} onChange={e => setEmailForm({ ...emailForm, channelCode: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="VD: CH_1..." /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú thêm</label><textarea value={emailForm.notes} onChange={e => setEmailForm({ ...emailForm, notes: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" rows={2} /></div>
              <div className="flex justify-end space-x-3 pt-4"><button type="button" onClick={() => setIsEmailModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg">Hủy</button><button type="submit" className="px-4 py-2 bg-rose-600 text-white rounded-lg">Lưu</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
