import React, { useState } from 'react';
import { Channel, Topic, Proxy, SourceChannel, VideoTask, Staff, FinancialRecord, Strike } from '../types';
import { Plus, Edit2, Trash2, X, ExternalLink, Search, Eye, EyeOff, ShieldAlert, RefreshCw, Upload, FileDown, AlertCircle, Sparkles, Copy, Check, Download, Clock, Calendar, User, DollarSign, BarChart2, Users, KanbanSquare, ShieldCheck } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import * as XLSX from 'xlsx';
import { fetchYoutubeChannelInfo, sleep } from '../services/youtube';
import { analyzeChannelTopic } from '../services/aiService';
import { format } from 'date-fns';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';

interface ChannelsProps {
  channels: Channel[];
  setChannels: React.Dispatch<React.SetStateAction<Channel[]>>;
  topics: Topic[];
  setTopics: React.Dispatch<React.SetStateAction<Topic[]>>;
  proxies: Proxy[];
  privacyMode: boolean;
  sourceChannels: SourceChannel[];
  youtubeApiKey: string;
  rotateYoutubeKey: () => boolean;
  tasks: VideoTask[];
  staffList: Staff[];
  financials: FinancialRecord[];
  strikes: Strike[];
  geminiApiKey?: string;
}

export function Channels({ channels, setChannels, topics, setTopics, proxies, privacyMode, sourceChannels, youtubeApiKey, rotateYoutubeKey, tasks, staffList, financials, strikes, geminiApiKey }: ChannelsProps) {
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [selectedChannelForDetail, setSelectedChannelForDetail] = useState<Channel | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTopic, setFilterTopic] = useState<string>('all');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const [formData, setFormData] = useState<Omit<Channel, 'id'>>({
    channelCode: '', name: '', url: '', avatarUrl: '', subscribers: 0, totalViews: 0, topicIds: [], status: 'active', notes: '',
    email: '', password: '', recoveryEmail: '', twoFactorCode: '', proxyId: '',
    postingSchedules: [{ time: '18:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }]
  });

  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [isAIAnalyzing, setIsAIAnalyzing] = useState(false);
  const [isOptimizingMetadata, setIsOptimizingMetadata] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [analyzingChannelId, setAnalyzingChannelId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const downloadTemplate = () => {
    const template = [
      {
        'Mã kênh': 'CH001',
        'Tên kênh': 'Kênh Mẫu 1',
        'URL': 'https://www.youtube.com/@handle1',
        'Email': 'email1@example.com',
        'Mật khẩu': 'pass123',
        'Email khôi phục': 'recovery1@example.com',
        'Mã 2FA': 'ABCD EFGH',
        'Subscribers': 1000,
        'Tổng Views': 50000,
        'Ghi chú': 'Ghi chú mẫu'
      },
      {
        'Tên kênh': 'Kênh Mẫu 2',
        'URL': 'https://www.youtube.com/channel/UC...',
        'Email': 'email2@example.com',
        'Mật khẩu': 'pass456',
        'Email khôi phục': 'recovery2@example.com',
        'Subscribers': 2000,
        'Tổng Views': 100000,
        'Ghi chú': 'Ghi chú mẫu 2'
      },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "YouTube_Channels_Template.xlsx");
  };

  const handleAITagging = async (channel?: Channel) => {
    const targetChannel = channel || (editingChannel ? { ...editingChannel, ...formData } : null);
    if (!targetChannel) return;

    if (!geminiApiKey) {
      showToast('Vui lòng cấu hình Gemini API Key trong phần Cài đặt trước khi sử dụng tính năng này.', 'error');
      return;
    }

    setIsAIAnalyzing(true);
    try {
      // Extract description from notes if available
      const descMatch = targetChannel.notes.match(/Mô tả: (.*)/s);
      const description = descMatch ? descMatch[1] : targetChannel.notes;

      const result = await analyzeChannelTopic(targetChannel.name, description, topics, geminiApiKey);

      let updatedTopicIds = [...(targetChannel.topicIds || [])];
      result.suggestedTopicIds.forEach(id => {
        if (!updatedTopicIds.includes(id)) {
          updatedTopicIds.push(id);
        }
      });

      if (channel) {
        setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, topicIds: updatedTopicIds } : c));
      } else {
        setFormData(prev => ({ ...prev, topicIds: updatedTopicIds }));
      }

      showToast(`Đã tự động gắn ${result.suggestedTopicIds.length} chủ đề phù hợp.`, 'success');
    } catch (error) {
      showToast('Lỗi khi phân tích chủ đề AI.', 'error');
    } finally {
      setIsAIAnalyzing(false);
    }
  };

  const handleHealthCheck = async (channel: Channel) => {
    setIsCheckingHealth(true);
    setAnalyzingChannelId(channel.id);
    try {
      // Simulate API check for strikes, monetization, etc.
      await sleep(2000);

      const channelStrikes = strikes.filter(s => s.channelId === channel.id && s.status === 'active');
      let healthStatus: 'healthy' | 'warning' | 'danger' = 'healthy';
      let healthNotes = 'Kênh hoạt động bình thường.';

      if (channelStrikes.length > 0) {
        healthStatus = channelStrikes.length >= 3 ? 'danger' : 'warning';
        healthNotes = `Phát hiện ${channelStrikes.length} cảnh báo bản quyền/cộng đồng đang hoạt động.`;
      }

      if (channel.status === 'suspended') {
        healthStatus = 'danger';
        healthNotes = 'Kênh đã bị đình chỉ hoạt động.';
      }

      const updatedChannels = channels.map(c => c.id === channel.id ? {
        ...c,
        healthStatus,
        healthNotes,
        lastHealthCheck: new Date().toISOString()
      } : c);

      setChannels(updatedChannels);
      showToast(`Đã hoàn thành kiểm tra sức khỏe kênh ${channel.name}.`, 'success');
    } catch (error) {
      showToast('Lỗi khi kiểm tra sức khỏe kênh.', 'error');
    } finally {
      setIsCheckingHealth(false);
      setAnalyzingChannelId(null);
    }
  };

  const handleMetadataOptimization = async (channel: Channel) => {
    setIsOptimizingMetadata(true);
    setAnalyzingChannelId(channel.id);
    try {
      if (!geminiApiKey) {
        showToast('Vui lòng cấu hình Gemini API Key.', 'error');
        return;
      }

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const model = 'gemini-2.5-flash';

      const prompt = `Tối ưu hóa Metadata (Tiêu đề, Mô tả, Tags) cho kênh YouTube sau để tăng khả năng hiển thị và thu hút người xem. Tên kênh: ${channel.name}. Ghi chú hiện tại: ${channel.notes}. Trả về định dạng JSON: { "suggestedTitle": "...", "suggestedDescription": "...", "suggestedTags": ["...", "..."] }`;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const result = JSON.parse(response.text || '{}');

      // Update channel notes with optimized metadata
      const updatedNotes = `${channel.notes}\n\n--- AI OPTIMIZED METADATA (${format(new Date(), 'dd/MM/yyyy')}) ---\nTiêu đề gợi ý: ${result.suggestedTitle}\nMô tả gợi ý: ${result.suggestedDescription}\nTags gợi ý: ${result.suggestedTags?.join(', ')}`;

      setChannels(channels.map(c => c.id === channel.id ? { ...c, notes: updatedNotes } : c));
      showToast(`Đã tối ưu hóa Metadata cho kênh ${channel.name}. Xem trong phần Ghi chú.`, 'success');
    } catch (error) {
      console.error('Metadata Optimization Error:', error);
      showToast('Lỗi khi tối ưu hóa Metadata.', 'error');
    } finally {
      setIsOptimizingMetadata(false);
      setAnalyzingChannelId(null);
    }
  };

  const handleBulkAIAnalysis = async () => {
    if (channels.length === 0) return;

    if (topics.length === 0) {
      alert('Bạn cần tạo ít nhất một Chủ đề trong tab "Chủ đề" trước khi sử dụng tính năng AI Auto-Tag.');
      return;
    }

    if (!geminiApiKey) {
      showToast('Vui lòng cấu hình Gemini API Key trong phần Cài đặt trước khi sử dụng tính năng này.', 'error');
      return;
    }

    const mode = confirm(`Bạn muốn AI tự động phân tích và gắn tag cho ${channels.length} kênh?\n\n- Bấm OK để phân tích TOÀN BỘ (ghi đè tag cũ).\n- Bấm Cancel để chỉ phân tích các kênh CHƯA CÓ TAG.`)
      ? 'all'
      : 'untagged';

    const channelsToProcess = mode === 'all'
      ? channels
      : channels.filter(c => (c.topicIds || []).length === 0);

    if (channelsToProcess.length === 0) {
      alert('Không có kênh nào cần phân tích theo lựa chọn của bạn.');
      return;
    }

    setIsAIAnalyzing(true);
    setImportProgress({ current: 0, total: channelsToProcess.length });

    const updatedChannels = [...channels];
    const newTopicsToCreate: Map<string, { name: string, color: string }> = new Map();
    const channelToNewTopicNames: Map<string, string[]> = new Map();

    for (let i = 0; i < channelsToProcess.length; i++) {
      const target = channelsToProcess[i];
      setImportProgress(prev => ({ ...prev, current: i + 1 }));
      setAnalyzingChannelId(target.id);

      try {
        // Add a small delay for AI rate limits
        if (i > 0) await sleep(2000);

        const descMatch = target.notes.match(/Mô tả: (.*)/s);
        const description = descMatch ? descMatch[1] : target.notes;
        const result = await analyzeChannelTopic(target.name, description, topics, geminiApiKey);

        const channelIndex = updatedChannels.findIndex(c => c.id === target.id);
        if (channelIndex !== -1) {
          const existingIds = mode === 'all' ? [] : (updatedChannels[channelIndex].topicIds || []);

          // Collect new topics
          if (result.newTopics && result.newTopics.length > 0) {
            const names: string[] = [];
            result.newTopics.forEach(nt => {
              names.push(nt.name);
              if (!newTopicsToCreate.has(nt.name)) {
                newTopicsToCreate.set(nt.name, nt);
              }
            });
            channelToNewTopicNames.set(target.id, names);
          }

          updatedChannels[channelIndex] = {
            ...updatedChannels[channelIndex],
            topicIds: [...new Set([...existingIds, ...result.suggestedTopicIds])]
          };
          setChannels([...updatedChannels]);
        }
      } catch (err) {
        console.error(`Lỗi AI cho kênh ${target.name}:`, err);
      }
    }

    // After bulk analysis, if there are new topics, ask to create them
    if (newTopicsToCreate.size > 0) {
      const newTopicNames = Array.from(newTopicsToCreate.keys());
      if (confirm(`AI đã phát hiện ${newTopicNames.length} chủ đề mới: ${newTopicNames.join(', ')}.\nBạn có muốn tự động tạo các chủ đề này và gắn vào các kênh tương ứng không?`)) {
        const createdTopics: Topic[] = [];
        const nameToIdMap: Record<string, string> = {};

        newTopicsToCreate.forEach((nt, name) => {
          const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
          createdTopics.push({
            id,
            name: nt.name,
            color: nt.color,
            description: 'Được tạo tự động bởi AI trong quá trình phân tích hàng loạt',
            tags: [],
            hashtags: [],
            country: 'Vietnam'
          });
          nameToIdMap[name] = id;
        });

        setTopics(prev => [...prev, ...createdTopics]);

        // Re-run through updatedChannels to add the newly created topic IDs
        const finalUpdatedChannels = updatedChannels.map(channel => {
          const newTopicNamesForThisChannel = channelToNewTopicNames.get(channel.id) || [];
          const newTopicIds = newTopicNamesForThisChannel.map(name => nameToIdMap[name]).filter(Boolean);
          if (newTopicIds.length > 0) {
            return {
              ...channel,
              topicIds: [...new Set([...(channel.topicIds || []), ...newTopicIds])]
            };
          }
          return channel;
        });
        setChannels(finalUpdatedChannels);
      }
    }

    setIsAIAnalyzing(false);
    setAnalyzingChannelId(null);
    setImportProgress({ current: 0, total: 0 });
    showToast('Đã hoàn thành phân tích AI cho danh sách được chọn!', 'success');
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsBulkImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const urls = data.map(row => row.URL || row.url || row['Link']).filter(url => !!url);

        // Filter out duplicates from current lists
        const existingUrls = new Set([
          ...channels.map(c => (c.url || '').toLowerCase()),
          ...sourceChannels.map(sc => (sc.url || '').toLowerCase())
        ]);

        const uniqueUrls = urls.filter(url => !existingUrls.has((url || '').toLowerCase()));
        const duplicateCount = urls.length - uniqueUrls.length;

        if (uniqueUrls.length === 0) {
          alert('Tất cả các kênh trong file đều đã tồn tại trong hệ thống.');
          setIsBulkImporting(false);
          return;
        }

        setImportProgress({ current: 0, total: uniqueUrls.length });

        const apiKey = youtubeApiKey;
        if (!apiKey) {
          showToast('Vui lòng cấu hình YouTube API Key trong phần Cài đặt trước khi nhập hàng loạt.', 'error');
          setIsBulkImporting(false);
          return;
        }

        let successCount = 0;
        let errorCount = 0;
        let currentApiKey = youtubeApiKey;

        for (let i = 0; i < uniqueUrls.length; i++) {
          setImportProgress({ current: i + 1, total: uniqueUrls.length });
          const url = uniqueUrls[i];
          const row = data.find(r => (r.URL || r.url || r['Link'])?.toLowerCase() === (url || '').toLowerCase()) || {};

          let channelCode = row['Mã kênh'] || row.channelCode || `CH-${Date.now().toString().slice(-4)}${i}`;
          let name = row['Tên kênh'] || row.name || row.Name || 'Kênh mới';
          let avatarUrl = '';
          let subscribers = parseInt(row.Subscribers || row.subscribers || '0') || 0;
          let totalViews = parseInt(row['Tổng Views'] || row.totalViews || '0') || 0;
          let notes = row['Ghi chú'] || row.notes || '';
          let email = row.Email || row.email || '';
          let password = row['Mật khẩu'] || row.password || row.Password || '';
          let recoveryEmail = row['Email khôi phục'] || row.recoveryEmail || '';
          let twoFactorCode = row['Mã 2FA'] || row.twoFactorCode || '';

          try {
            // Add delay to avoid rate limits
            if (i > 0) await sleep(1000);

            // Skip top videos to save quota
            const info = await fetchYoutubeChannelInfo(url, currentApiKey, true);
            name = info.name || name;
            avatarUrl = info.avatarUrl || avatarUrl;
            subscribers = info.subscribers || subscribers;
            totalViews = info.totalViews || totalViews;
            notes = info.description ? `Mô tả: ${info.description}\n${notes}` : notes;
          } catch (err: any) {
            console.error(`Lỗi lấy thông tin kênh ${url}:`, err);
            if (err.message?.includes('quota') || err.message?.includes('limit')) {
              // Try rotating key
              const rotated = rotateYoutubeKey();
              if (rotated) {
                showToast('Hết quota, đang tự động đổi API Key...', 'info');
                i--;
                await sleep(1000);
                continue;
              }
              showToast('Hết quota API YouTube và không còn Key dự phòng. Quá trình nhập dừng lại.', 'error');
              errorCount += (uniqueUrls.length - i);
              break;
            }
            // Skip failed channel
            errorCount++;
            continue;
          }

          const newChannel: Channel = {
            id: (Date.now() + i).toString(),
            channelCode,
            name,
            url,
            avatarUrl,
            subscribers,
            totalViews,
            topicIds: [],
            status: 'active',
            notes,
            email,
            password,
            recoveryEmail,
            twoFactorCode,
            proxyId: '',
            postingSchedules: [{ time: '18:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }]
          };

          setChannels(prev => [...prev, newChannel]);
          successCount++;
        }

        showToast(`Nhập hoàn tất: Tổng ${uniqueUrls.length} kênh, thành công ${successCount}, lỗi ${errorCount}.${duplicateCount > 0 ? ` (Bỏ qua ${duplicateCount} kênh trùng lặp)` : ''}`, successCount > 0 ? 'success' : 'error');
      } catch (err) {
        showToast('Lỗi khi đọc file Excel. Vui lòng kiểm tra lại định dạng.', 'error');
      } finally {
        setIsBulkImporting(false);
        setImportProgress({ current: 0, total: 0 });
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleOpenModal = (channel?: Channel) => {
    if (channel) {
      setEditingChannel(channel);
      setFormData({
        channelCode: channel.channelCode || '',
        name: channel.name, url: channel.url, avatarUrl: channel.avatarUrl || '', subscribers: channel.subscribers, totalViews: channel.totalViews || 0, topicIds: channel.topicIds, status: channel.status, notes: channel.notes,
        email: channel.email || '', password: channel.password || '', recoveryEmail: channel.recoveryEmail || '', twoFactorCode: channel.twoFactorCode || '', proxyId: channel.proxyId || '',
        postingSchedules: channel.postingSchedules || [{ time: '18:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }]
      });
    } else {
      setEditingChannel(null);
      setFormData({
        channelCode: '',
        name: '', url: '', avatarUrl: '', subscribers: 0, totalViews: 0, topicIds: [], status: 'active', notes: '',
        email: '', password: '', recoveryEmail: '', twoFactorCode: '', proxyId: '',
        postingSchedules: [{ time: '18:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }]
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingChannel(null);
    setFetchError('');
  };

  const handleFetchInfo = async () => {
    if (!formData.url) return;

    setIsFetching(true);
    setFetchError('');

    try {
      const info = await fetchYoutubeChannelInfo(formData.url, youtubeApiKey);
      setFormData(prev => ({
        ...prev,
        name: info.name || prev.name,
        avatarUrl: info.avatarUrl || prev.avatarUrl,
        subscribers: info.subscribers || prev.subscribers,
        totalViews: info.totalViews || prev.totalViews,
        notes: info.description ? `${prev.notes ? prev.notes + '\n\n' : ''}Mô tả: ${info.description}` : prev.notes
      }));
    } catch (error: any) {
      if (error.message?.includes('quota') || error.message?.includes('limit')) {
        const rotated = rotateYoutubeKey();
        if (rotated) {
          showToast('Hết quota, đang tự động đổi API Key. Vui lòng thử lại sau giây lát.', 'info');
          setIsFetching(false);
          return;
        }
      }
      setFetchError(error.message || 'Lỗi khi lấy thông tin kênh');
    } finally {
      setIsFetching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check for duplicates
    const isDuplicate = (editingChannel
      ? channels.some(c => (c.url || '').toLowerCase() === (formData.url || '').toLowerCase() && c.id !== editingChannel.id)
      : channels.some(c => (c.url || '').toLowerCase() === (formData.url || '').toLowerCase())) ||
      sourceChannels.some(sc => (sc.url || '').toLowerCase() === (formData.url || '').toLowerCase());

    if (isDuplicate) {
      if (!confirm('Kênh này đã tồn tại trong danh sách Tài khoản hoặc Kênh nguồn. Bạn vẫn muốn tiếp tục lưu?')) {
        return;
      }
    }

    if (editingChannel) {
      setChannels(channels.map(c => c.id === editingChannel.id ? { ...c, ...formData } : c));
      showToast('Đã cập nhật thông tin kênh thành công!', 'success');
    } else {
      setChannels([...channels, { id: Date.now().toString(), ...formData }]);
      showToast('Đã thêm kênh mới thành công!', 'success');
    }
    handleCloseModal();
  };

  const handleDelete = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa kênh này?')) {
      setChannels(prev => prev.filter(c => c.id !== id));
      showToast('Đã xóa kênh.', 'info');
    }
  };

  const toggleTopic = (topicId: string) => {
    setFormData(prev => ({
      ...prev,
      topicIds: (prev.topicIds || []).includes(topicId) ? prev.topicIds.filter(id => id !== topicId) : [...(prev.topicIds || []), topicId]
    }));
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyTags = (channel: Channel) => {
    const tagNames = (channel.topicIds || [])
      .map(tid => topics.find(t => t.id === tid)?.name)
      .filter(Boolean)
      .join(', ');

    if (tagNames) {
      navigator.clipboard.writeText(tagNames);
      setCopiedId(channel.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleExport = () => {
    if (channels.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(channels.map(c => ({
      'Mã kênh': c.channelCode,
      'Tên kênh': c.name,
      'URL': c.url,
      'Email': c.email,
      'Mật khẩu': c.password,
      'Email khôi phục': c.recoveryEmail,
      'Mã 2FA': c.twoFactorCode,
      'Subscribers': c.subscribers,
      'Tổng Views': c.totalViews,
      'Chủ đề': (c.topicIds || []).map(tid => topics.find(t => t.id === tid)?.name).join(', '),
      'Ghi chú': c.notes
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Channels');
    XLSX.writeFile(wb, `YT_Channels_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredChannels = channels.filter(c => {
    const matchesSearch = (c.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (c.channelCode || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (c.notes || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    const matchesTopic = filterTopic === 'all' || (c.topicIds || []).includes(filterTopic);
    return matchesSearch && matchesTopic;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Quản lý Kênh (Tài khoản)
          <span className="ml-2 text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {filteredChannels.length} / {channels.length} kênh
          </span>
        </h1>
        <div className="flex flex-wrap gap-2">
          {hasPermission('sources_analyze') && (
            <button
              onClick={handleBulkAIAnalysis}
              disabled={isAIAnalyzing || channels.length === 0}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Sparkles size={16} className="mr-2" /> AI Auto-Tag
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={channels.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Download size={16} className="mr-2" /> Xuất Excel
          </button>
          <button onClick={downloadTemplate} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors">
            <FileDown size={16} className="mr-2" /> File mẫu
          </button>
          {hasPermission('channels_edit') && (
            <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors cursor-pointer">
              <Upload size={16} className="mr-2" /> Nhập Excel
              <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleBulkImport} disabled={isBulkImporting} />
            </label>
          )}
          {hasPermission('channels_edit') && (
            <button onClick={() => handleOpenModal()} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors whitespace-nowrap">
              <Plus size={16} className="mr-2" /> Thêm kênh
            </button>
          )}
        </div>
      </div>

      {(isBulkImporting || isAIAnalyzing) && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center">
            <RefreshCw size={20} className="text-blue-600 animate-spin mr-3" />
            <div>
              <p className="text-sm font-medium text-blue-900">{isAIAnalyzing ? 'AI đang phân tích chủ đề...' : 'Đang nhập dữ liệu hàng loạt...'}</p>
              <p className="text-xs text-blue-700">Tiến độ: {importProgress.current}/{importProgress.total} kênh</p>
            </div>
          </div>
          <div className="w-48 h-2 bg-blue-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}></div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="Tìm kiếm kênh..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filterTopic} onChange={e => setFilterTopic(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[150px]">
          <option value="all">Tất cả chủ đề</option>
          {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500">
                <th className="p-4 font-medium">Kênh</th>
                <th className="p-4 font-medium">Bảo mật (Email/Pass)</th>
                <th className="p-4 font-medium">Proxy/VPS</th>
                <th className="p-4 font-medium">Trạng thái</th>
                <th className="p-4 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredChannels.map(channel => {
                const proxy = proxies.find(p => p.id === channel.proxyId);
                return (
                  <tr key={channel.id} className={`hover:bg-gray-50 transition-all ${analyzingChannelId === channel.id ? 'bg-purple-50 ring-1 ring-inset ring-purple-200' : ''}`}>
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          {channel.avatarUrl ? (
                            <img src={channel.avatarUrl} alt={channel.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-lg shrink-0">
                              {(channel.name || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                          {(analyzingChannelId === channel.id || isCheckingHealth || isOptimizingMetadata) && analyzingChannelId === channel.id && (
                            <div className="absolute inset-0 bg-purple-500/20 rounded-full flex items-center justify-center">
                              <RefreshCw size={16} className="text-purple-600 animate-spin" />
                            </div>
                          )}
                          {channel.healthStatus && (
                            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${channel.healthStatus === 'healthy' ? 'bg-green-500' :
                                channel.healthStatus === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                              }`} title={channel.healthNotes}></div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                              {channel.channelCode}
                            </span>
                            <span className="font-medium text-gray-900">{channel.name}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1 items-center">
                            {(channel.topicIds || []).length > 0 ? (
                              <>
                                {(channel.topicIds || []).map(tid => {
                                  const topic = topics.find(t => t.id === tid);
                                  if (!topic) return null;
                                  return (
                                    <span key={tid} className="text-[8px] px-1 py-0.5 rounded-full text-white whitespace-nowrap" style={{ backgroundColor: topic.color }}>
                                      {topic.name}
                                    </span>
                                  );
                                })}
                                <button
                                  onClick={() => copyTags(channel)}
                                  className="ml-1 p-0.5 text-gray-400 hover:text-blue-500 transition-colors"
                                  title="Copy các tag này"
                                >
                                  {copiedId === channel.id ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
                                </button>
                              </>
                            ) : (
                              <span className="text-[8px] text-gray-400 italic">
                                {analyzingChannelId === channel.id ? 'Đang phân tích...' : 'Chưa gắn tag'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center mt-1 space-x-2">
                            <span className="text-xs text-gray-500">{channel.subscribers >= 1000 ? (channel.subscribers / 1000).toFixed(1) + 'k' : channel.subscribers} sub</span>
                            {channel.totalViews ? <span className="text-xs text-gray-400">• {(channel.totalViews / 1000000).toFixed(1)}M views</span> : null}
                            <a href={channel.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center"><ExternalLink size={12} className="ml-1" /></a>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {privacyMode || !hasPermission('channels_view_sensitive') ? (
                        <div className="flex items-center text-gray-400 text-sm italic">
                          <ShieldAlert size={14} className="mr-1" />
                          {!hasPermission('channels_view_sensitive') ? 'Không có quyền xem' : 'Đã ẩn (Privacy Mode)'}
                        </div>
                      ) : (
                        <div className="flex flex-col space-y-1 text-sm">
                          <span className="text-gray-700">{channel.email || 'Chưa có email'}</span>
                          <div className="flex items-center text-gray-500">
                            <span className="font-mono mr-2">{showPasswords[channel.id] ? channel.password : '••••••••'}</span>
                            {channel.password && (
                              <button onClick={() => togglePasswordVisibility(channel.id)} className="text-gray-400 hover:text-gray-600">
                                {showPasswords[channel.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            )}
                          </div>
                          {channel.twoFactorCode && (
                            <div className="text-[10px] text-red-500 font-bold flex items-center mt-1">
                              2FA: {showPasswords[channel.id] ? channel.twoFactorCode : '••••••••'}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {proxy ? <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{proxy.ip}</span> : <span className="text-gray-400 italic">Không dùng proxy</span>}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${channel.status === 'active' ? 'bg-green-100 text-green-800' : channel.status === 'suspended' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                        {channel.status === 'active' ? 'Hoạt động' : channel.status === 'suspended' ? 'Bị đình chỉ' : 'Tạm ngưng'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleHealthCheck(channel)}
                          disabled={isCheckingHealth && analyzingChannelId === channel.id}
                          className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                          title="Kiểm tra sức khỏe kênh"
                        >
                          <ShieldCheck size={16} className={isCheckingHealth && analyzingChannelId === channel.id ? 'animate-pulse' : ''} />
                        </button>
                        <button
                          onClick={() => handleMetadataOptimization(channel)}
                          disabled={isOptimizingMetadata && analyzingChannelId === channel.id}
                          className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                          title="Tối ưu Metadata AI"
                        >
                          <Sparkles size={16} className={isOptimizingMetadata && analyzingChannelId === channel.id ? 'animate-pulse' : ''} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedChannelForDetail(channel);
                            setIsDetailModalOpen(true);
                          }}
                          className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                          title="Xem chi tiết"
                        >
                          <Eye size={16} />
                        </button>
                        {hasPermission('channels_edit') && (
                          <button onClick={() => handleOpenModal(channel)} className="p-1 text-gray-400 hover:text-blue-600 transition-colors"><Edit2 size={16} /></button>
                        )}
                        {hasPermission('channels_edit') && (
                          <button onClick={() => handleDelete(channel.id)} className="p-1 text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredChannels.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-500">Không tìm thấy kênh nào.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-semibold">{editingChannel ? 'Sửa thông tin kênh' : 'Thêm kênh mới'}</h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-4">
              <form id="channel-form" onSubmit={handleSubmit} className="space-y-6">

                {/* Thông tin cơ bản */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 border-b pb-1">Thông tin cơ bản</h3>
                  {fetchError && <div className="mb-3 p-2 bg-red-50 text-red-600 text-sm rounded border border-red-200">{fetchError}</div>}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mã kênh (Dùng để nhận diện)</label>
                      <input type="text" required value={formData.channelCode} onChange={e => setFormData({ ...formData, channelCode: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500" placeholder="VD: KENH-01" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">URL kênh (YouTube)</label>
                      <div className="flex space-x-2">
                        <input type="url" required value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} onBlur={handleFetchInfo} className="flex-1 border border-gray-300 rounded-lg px-3 py-2" placeholder="https://youtube.com/@handle" />
                        <button type="button" onClick={handleFetchInfo} disabled={isFetching || !formData.url} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-200 disabled:opacity-50 flex items-center">
                          <RefreshCw size={16} className={`mr-1 ${isFetching ? 'animate-spin' : ''}`} /> Lấy TT
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tên kênh</label>
                      <div className="flex items-center space-x-2">
                        {formData.avatarUrl && (
                          <img src={formData.avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-gray-200 shrink-0" referrerPolicy="no-referrer" />
                        )}
                        <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="flex-1 border border-gray-300 rounded-lg px-3 py-2" />
                      </div>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Lượt đăng ký</label><input type="number" min="0" required value={formData.subscribers} onChange={e => setFormData({ ...formData, subscribers: parseInt(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Tổng lượt xem (Views)</label><input type="number" min="0" value={formData.totalViews} onChange={e => setFormData({ ...formData, totalViews: parseInt(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                      <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })} className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">
                        <option value="active">Đang hoạt động</option><option value="inactive">Tạm ngưng</option><option value="suspended">Bị đình chỉ (Bay màu)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Thông tin bảo mật */}
                {hasPermission('channels_view_sensitive') && (
                  <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                    <h3 className="text-sm font-semibold text-red-900 mb-3 flex items-center"><ShieldAlert size={16} className="mr-2" /> Thông tin Bảo mật (Nhạy cảm)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className="block text-sm font-medium text-red-800 mb-1">Email đăng nhập</label><input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full border border-red-200 rounded-lg px-3 py-2 focus:ring-red-500" /></div>
                      <div><label className="block text-sm font-medium text-red-800 mb-1">Mật khẩu</label><input type="text" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full border border-red-200 rounded-lg px-3 py-2 focus:ring-red-500" /></div>
                      <div><label className="block text-sm font-medium text-red-800 mb-1">Email khôi phục</label><input type="email" value={formData.recoveryEmail} onChange={e => setFormData({ ...formData, recoveryEmail: e.target.value })} className="w-full border border-red-200 rounded-lg px-3 py-2 focus:ring-red-500" /></div>
                      <div><label className="block text-sm font-medium text-red-800 mb-1">Mã 2FA (Secret Key)</label><input type="text" value={formData.twoFactorCode} onChange={e => setFormData({ ...formData, twoFactorCode: e.target.value })} className="w-full border border-red-200 rounded-lg px-3 py-2 focus:ring-red-500" placeholder="VD: JBSWY3DPEHPK3PXP" /></div>

                      {hasPermission('channels_manage_proxy') && (
                        <div className="col-span-full mt-2">
                          <label className="block text-sm font-medium text-red-800 mb-1">Gán Proxy/VPS</label>
                          <select value={formData.proxyId} onChange={e => setFormData({ ...formData, proxyId: e.target.value })} className="w-full border border-red-200 rounded-lg px-3 py-2 bg-white focus:ring-red-500">
                            <option value="">Không dùng proxy</option>
                            {proxies.map(p => <option key={p.id} value={p.id}>{p.ip}:{p.port}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Lịch đăng video định kỳ */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-blue-900 flex items-center uppercase tracking-wider">
                      <Clock size={16} className="mr-2" /> Lịch đăng video định kỳ
                    </h4>
                    <button
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        postingSchedules: [...(formData.postingSchedules || []), { time: '18:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }]
                      })}
                      className="flex items-center text-xs font-bold text-blue-600 hover:text-blue-700 bg-white px-2 py-1 rounded border border-blue-200 shadow-sm"
                    >
                      <Plus size={14} className="mr-1" /> Thêm khung giờ
                    </button>
                  </div>

                  <div className="space-y-4">
                    {formData.postingSchedules?.map((schedule, index) => (
                      <div key={index} className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm relative group">
                        {formData.postingSchedules!.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newSchedules = formData.postingSchedules!.filter((_, i) => i !== index);
                              setFormData({ ...formData, postingSchedules: newSchedules });
                            }}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10"
                          >
                            <X size={14} />
                          </button>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Giờ đăng (HH:mm)</label>
                            <input
                              type="time"
                              value={schedule.time}
                              onChange={e => {
                                const newSchedules = [...formData.postingSchedules!];
                                newSchedules[index] = { ...schedule, time: e.target.value };
                                setFormData({ ...formData, postingSchedules: newSchedules });
                              }}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Các ngày trong tuần</label>
                            <div className="flex flex-wrap gap-1">
                              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => {
                                    const currentDays = schedule.days;
                                    const newDays = currentDays.includes(day)
                                      ? currentDays.filter(d => d !== day)
                                      : [...currentDays, day];
                                    const newSchedules = [...formData.postingSchedules!];
                                    newSchedules[index] = { ...schedule, days: newDays };
                                    setFormData({ ...formData, postingSchedules: newSchedules });
                                  }}
                                  className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors ${schedule.days.includes(day)
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : 'bg-white text-gray-400 border-gray-200 hover:border-blue-300'
                                    }`}
                                >
                                  {day}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">Chủ đề</label>
                    <button
                      type="button"
                      onClick={() => handleAITagging()}
                      disabled={isAIAnalyzing || !formData.notes}
                      className="text-xs flex items-center text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
                    >
                      <Sparkles size={12} className="mr-1" /> AI Gợi ý tag
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topics.map(topic => (
                      <button key={topic.id} type="button" onClick={() => toggleTopic(topic.id)} className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${formData.topicIds.includes(topic.id) ? 'border-transparent text-white' : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'}`} style={formData.topicIds.includes(topic.id) ? { backgroundColor: topic.color } : {}}>
                        {topic.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div><label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label><textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" rows={2} /></div>
              </form>
            </div>
            <div className="p-4 border-t border-gray-100 shrink-0 flex justify-end space-x-3 bg-gray-50">
              <button type="button" onClick={handleCloseModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors">Hủy</button>
              <button type="submit" form="channel-form" className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">Lưu kênh</button>
            </div>
          </div>
        </div>
      )}

      {isDetailModalOpen && selectedChannelForDetail && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-white sticky top-0 z-10">
              <div className="flex items-center space-x-5">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0 border-4 border-white shadow-md">
                  {selectedChannelForDetail.avatarUrl ? (
                    <img src={selectedChannelForDetail.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-2xl bg-slate-100">
                      {(selectedChannelForDetail.name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded uppercase tracking-tighter">
                      {selectedChannelForDetail.channelCode}
                    </span>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                      {selectedChannelForDetail.name}
                    </h2>
                    <a href={selectedChannelForDetail.url} target="_blank" rel="noopener noreferrer" className="p-1 text-slate-400 hover:text-blue-600 transition-colors">
                      <ExternalLink size={18} />
                    </a>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center text-slate-500 text-sm">
                      <Users size={14} className="mr-1.5 opacity-60" />
                      <span className="font-semibold">{selectedChannelForDetail.subscribers.toLocaleString()}</span>
                      <span className="ml-1 opacity-60">subscribers</span>
                    </div>
                    <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                    <div className="flex items-center text-slate-500 text-sm">
                      <BarChart2 size={14} className="mr-1.5 opacity-60" />
                      <span className="font-semibold">{selectedChannelForDetail.totalViews?.toLocaleString()}</span>
                      <span className="ml-1 opacity-60">views</span>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Column: Info & Security */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Security Card */}
                  <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                    <h3 className="text-xs font-black text-slate-400 mb-5 flex items-center uppercase tracking-[0.2em]">
                      <ShieldAlert size={14} className="mr-2 text-red-500" /> Bảo mật & Tài khoản
                    </h3>
                    <div className="space-y-4">
                      <div className="group">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Email chính</label>
                        <div className="text-sm font-medium text-slate-900 break-all bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {selectedChannelForDetail.email || 'N/A'}
                        </div>
                      </div>
                      <div className="group">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mật khẩu</label>
                        <div className="text-sm font-mono text-slate-900 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {privacyMode ? '••••••••' : (selectedChannelForDetail.password || 'N/A')}
                        </div>
                      </div>
                      <div className="group">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Email khôi phục</label>
                        <div className="text-sm font-medium text-slate-900 break-all bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {selectedChannelForDetail.recoveryEmail || 'N/A'}
                        </div>
                      </div>
                      <div className="group">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">2FA Secret Key</label>
                        <div className="text-sm font-mono text-red-600 font-bold bg-red-50/50 p-2 rounded-lg border border-red-100/50">
                          {privacyMode ? '••••••••' : (selectedChannelForDetail.twoFactorCode || 'N/A')}
                        </div>
                      </div>
                      <div className="pt-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Proxy / VPS</label>
                        <div className="text-sm font-medium text-slate-900 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {proxies.find(p => p.id === selectedChannelForDetail.proxyId)
                            ? `${proxies.find(p => p.id === selectedChannelForDetail.proxyId)?.ip}:${proxies.find(p => p.id === selectedChannelForDetail.proxyId)?.port}`
                            : 'Không sử dụng'}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Schedule Card */}
                  <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <h3 className="text-xs font-black text-slate-400 mb-5 flex items-center uppercase tracking-[0.2em]">
                      <Clock size={14} className="mr-2 text-blue-500" /> Lịch đăng video
                    </h3>
                    {selectedChannelForDetail.postingSchedules && selectedChannelForDetail.postingSchedules.length > 0 ? (
                      <div className="space-y-6">
                        {selectedChannelForDetail.postingSchedules.map((schedule, idx) => (
                          <div key={idx} className={idx > 0 ? "pt-4 border-t border-slate-100" : ""}>
                            <div className="flex items-center bg-blue-50 text-blue-700 px-4 py-2 rounded-xl mb-3">
                              <Clock size={16} className="mr-2 opacity-50" />
                              <span className="text-xl font-black tracking-tight">{schedule.time}</span>
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                                const isActive = schedule.days.includes(day);
                                return (
                                  <div
                                    key={day}
                                    className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[9px] font-black transition-all ${isActive
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-slate-50 text-slate-300 border border-slate-100'
                                      }`}
                                  >
                                    {day.toUpperCase()}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <p className="text-xs text-slate-400 font-medium italic">Chưa thiết lập lịch đăng</p>
                      </div>
                    )}
                  </section>

                  {/* Staff Card */}
                  <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-teal-500"></div>
                    <h3 className="text-xs font-black text-slate-400 mb-5 flex items-center uppercase tracking-[0.2em]">
                      <Users size={14} className="mr-2 text-teal-500" /> Nhân sự phụ trách
                    </h3>
                    <div className="space-y-3">
                      {staffList.filter(s => (s.assignedChannelIds || []).includes(selectedChannelForDetail.id)).length > 0 ? (
                        staffList.filter(s => (s.assignedChannelIds || []).includes(selectedChannelForDetail.id)).map(staff => (
                          <div key={staff.id} className="flex items-center p-2 bg-slate-50 rounded-xl border border-slate-100 hover:border-teal-200 transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-black mr-3">
                              {(staff.name || '?').charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">{staff.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{staff.role}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          <p className="text-xs text-slate-400 font-medium italic">Chưa gán nhân sự</p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                {/* Right Column: Stats & Tables */}
                <div className="lg:col-span-8 space-y-8">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm group hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
                          <DollarSign size={20} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Doanh thu tháng này</span>
                      </div>
                      <div className="text-3xl font-black text-slate-900 tracking-tight">
                        {financials
                          .filter(f => f.channelId === selectedChannelForDetail.id && f.month === format(new Date(), 'yyyy-MM'))
                          .reduce((sum, f) => sum + f.revenue, 0)
                          .toLocaleString('vi-VN')} <span className="text-sm font-bold text-slate-400">đ</span>
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm group hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
                          <KanbanSquare size={20} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Công việc đang chạy</span>
                      </div>
                      <div className="text-3xl font-black text-slate-900 tracking-tight">
                        {tasks.filter(t => t.channelId === selectedChannelForDetail.id && t.status !== 'published').length} <span className="text-sm font-bold text-slate-400">Task</span>
                      </div>
                    </div>
                  </div>

                  {/* Recent Tasks Table */}
                  <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center">
                        <Calendar size={14} className="mr-2" /> Công việc gần đây
                      </h3>
                      <span className="text-[10px] font-bold text-slate-400">5 Task mới nhất</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-white">
                            <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Tiêu đề</th>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Trạng thái</th>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Hạn chót</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {tasks.filter(t => t.channelId === selectedChannelForDetail.id).slice(0, 5).map(task => (
                            <tr key={task.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <p className="font-bold text-slate-900 truncate max-w-[280px]">{task.title}</p>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${task.status === 'published' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                                  }`}>
                                  {task.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-slate-500 font-medium">{task.dueDate}</td>
                            </tr>
                          ))}
                          {tasks.filter(t => t.channelId === selectedChannelForDetail.id).length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-6 py-12 text-center">
                                <div className="flex flex-col items-center">
                                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                                    <Calendar size={20} className="text-slate-200" />
                                  </div>
                                  <p className="text-xs text-slate-400 font-medium italic">Không có công việc nào</p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {/* Strikes History */}
                  <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center">
                        <ShieldAlert size={14} className="mr-2" /> Lịch sử gậy (Strikes)
                      </h3>
                    </div>
                    <div className="p-6 space-y-4">
                      {strikes.filter(s => s.channelId === selectedChannelForDetail.id).length > 0 ? (
                        strikes.filter(s => s.channelId === selectedChannelForDetail.id).map(strike => (
                          <div key={strike.id} className="p-4 rounded-xl border border-red-100 bg-red-50/30 flex items-start justify-between group hover:bg-red-50/50 transition-colors">
                            <div className="flex items-start space-x-3">
                              <div className="mt-1 p-1.5 bg-red-100 text-red-600 rounded-lg">
                                <ShieldAlert size={14} />
                              </div>
                              <div>
                                <div className="font-black text-red-900 text-sm uppercase tracking-tight">
                                  {strike.type === 'copyright' ? 'Bản quyền' : 'Nguyên tắc cộng đồng'}
                                </div>
                                <div className="text-xs text-slate-600 mt-1 leading-relaxed">{strike.details}</div>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                              <div className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-full inline-block mb-1">
                                {strike.status.toUpperCase()}
                              </div>
                              <div className="text-[10px] text-slate-400 font-bold">Hết hạn: {strike.expirationDate}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-6 rounded-2xl border border-emerald-100 bg-emerald-50/30 text-emerald-700 text-sm flex items-center justify-center font-bold">
                          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center mr-3">
                            <Check size={16} />
                          </div>
                          Kênh hiện tại sạch, không có gậy nào.
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Notes & Strategy */}
                  <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Ghi chú & Chiến lược</h3>
                    </div>
                    <div className="p-6">
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-sm text-slate-600 whitespace-pre-wrap leading-relaxed italic font-medium">
                        {selectedChannelForDetail.notes || 'Chưa có ghi chú chiến lược cho kênh này.'}
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-white flex justify-end sticky bottom-0 z-10">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all shadow-xl shadow-slate-200 active:scale-95"
              >
                ĐÓNG CỬA SỔ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

