import React, { useState } from 'react';
import { Channel, Topic, Proxy, SourceChannel, VideoTask, Staff, FinancialRecord, Strike, ManagedEmail } from '../types';
import { Plus, Edit2, Trash2, X, ExternalLink, Search, Eye, EyeOff, ShieldAlert, RefreshCw, Upload, FileDown, AlertCircle, Sparkles, Copy, Check, Download, Clock, Calendar, User, DollarSign, BarChart2, Users, KanbanSquare, ShieldCheck, Mail, Link2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import { fetchYoutubeChannelInfo, sleep } from '../services/youtube';
import { analyzeChannelTopic } from '../services/aiService';
import { format } from 'date-fns';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
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
  setStaffList: React.Dispatch<React.SetStateAction<Staff[]>>;
  financials: FinancialRecord[];
  strikes: Strike[];
  geminiApiKey?: string;
  managedEmails?: ManagedEmail[];
  setManagedEmails?: React.Dispatch<React.SetStateAction<ManagedEmail[]>>;
}

export function Channels({ channels, setChannels, topics, setTopics, proxies, privacyMode, sourceChannels, youtubeApiKey, rotateYoutubeKey, tasks, staffList, setStaffList, financials, strikes, geminiApiKey, managedEmails = [], setManagedEmails }: ChannelsProps) {
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [selectedChannelForDetail, setSelectedChannelForDetail] = useState<Channel | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTopic, setFilterTopic] = useState<string>('all');
  const [filterNiche, setFilterNiche] = useState<string>('all');
  const [filterStaff, setFilterStaff] = useState<string>('all');
  const [filterAliveStatus, setFilterAliveStatus] = useState<string>('all');
  const [isScanningDead, setIsScanningDead] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [editingStaffIds, setEditingStaffIds] = useState<string[]>([]);
  const [selectedManagedEmailId, setSelectedManagedEmailId] = useState<string>('');
  const [sourceTopicFilter, setSourceTopicFilter] = useState<string>('all');

  const [formData, setFormData] = useState<Omit<Channel, 'id'>>({
    channelCode: '', name: '', url: '', avatarUrl: '', subscribers: 0, totalViews: 0, topicIds: [], status: 'active', notes: '',
    email: '', password: '', recoveryEmail: '', twoFactorCode: '', proxyId: '',
    postingSchedules: [{ time: '18:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }],
    linkedSourceChannelIds: []
  });

  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [isAIAnalyzing, setIsAIAnalyzing] = useState(false);
  const [isOptimizingMetadata, setIsOptimizingMetadata] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [analyzingChannelId, setAnalyzingChannelId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Bulk action states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkTopicModalOpen, setIsBulkTopicModalOpen] = useState(false);
  const [bulkActionTopicIds, setBulkActionTopicIds] = useState<string[]>([]);
  const [isBulkStaffModalOpen, setIsBulkStaffModalOpen] = useState(false);
  const [bulkActionStaffId, setBulkActionStaffId] = useState<string>('');

  const handleBulkDelete = async () => {
    if (confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} kênh đã chọn?`)) {
      setChannels(prev => prev.filter(c => !selectedIds.includes(c.id)));
      
      const { error } = await supabase.from('channels').delete().in('id', selectedIds);
      if (error) {
        showToast(`Lỗi xóa trên server: ${error.message}`, 'error');
      } else {
        showToast(`Đã xóa ${selectedIds.length} kênh.`, 'info');
      }
      setSelectedIds([]);
    }
  };

  const handleBulkAssignTopicSubmit = () => {
    setChannels(prev => prev.map(c => {
      if (selectedIds.includes(c.id)) {
        return { ...c, topicIds: Array.from(new Set([...(c.topicIds || []), ...bulkActionTopicIds])) };
      }
      return c;
    }));
    showToast(`Đã cập nhật chủ đề cho ${selectedIds.length} kênh.`, 'success');
    setIsBulkTopicModalOpen(false);
    setSelectedIds([]);
  };

  const handleBulkAssignStaffSubmit = async () => {
    if (!bulkActionStaffId) return;
    
    // We don't have setStaffList passed as a prop to Channels.tsx!
    // We will have to update staff data either via calling a function passed down, or directly in supabase.
    // For now, let's just show a toast and tell the user to use the Staff tab.
    
    // It's better to update the assignedChannelIds on the chosen staff
    const selectedStaff = staffList.find(s => s.id === bulkActionStaffId);
    if (!selectedStaff) return;

    const currentAssigned = selectedStaff.assignedChannelIds || [];
    const newAssigned = Array.from(new Set([...currentAssigned, ...selectedIds]));

    const { error } = await supabase.from('staff_list').update({ assigned_channel_ids: newAssigned }).eq('id', bulkActionStaffId);
    
    if (error) {
      showToast(`Lỗi gán nhân sự: ${error.message}`, 'error');
    } else {
      setStaffList(prev => prev.map(s => s.id === bulkActionStaffId ? { ...s, assignedChannelIds: newAssigned } : s));
      showToast(`Đã giao ${selectedIds.length} kênh cho nhân sự ${selectedStaff.name}. F5 hoặc qua tab Nhân sự để thấy thay đổi!`, 'success');
      setIsBulkStaffModalOpen(false);
      setSelectedIds([]);
    }
  };

  const handleBulkRemoveStaffSubmit = async () => {
    const staffsToUpdate = staffList.filter(s => 
      (s.assignedChannelIds || []).some(id => selectedIds.includes(id))
    );

    if (staffsToUpdate.length === 0) {
      showToast('Các kênh này chưa có nhân sự nào quản lý.', 'info');
      setIsBulkStaffModalOpen(false);
      return;
    }

    if (!confirm(`Bạn có chắc muốn hủy bỏ nhân sự quản lý khỏi ${selectedIds.length} kênh này?`)) return;

    const promises = staffsToUpdate.map(staff => {
      const newAssigned = (staff.assignedChannelIds || []).filter(id => !selectedIds.includes(id));
      return supabase.from('staff_list').update({ assigned_channel_ids: newAssigned }).eq('id', staff.id)
        .then(({error}) => ({ staff, newAssigned, error }));
    });

    const results = await Promise.all(promises);
    
    if (results.some(r => r.error)) {
      showToast('Có lỗi xảy ra khi hủy nhân sự trên server.', 'error');
    } else {
      let newStaffList = [...staffList];
      results.forEach(r => {
        newStaffList = newStaffList.map(s => s.id === r.staff.id ? { ...s, assignedChannelIds: r.newAssigned } : s);
      });
      setStaffList(newStaffList);
      showToast(`Đã hủy nhân sự quản lý cho ${selectedIds.length} kênh.`, 'success');
      setIsBulkStaffModalOpen(false);
      setSelectedIds([]);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Mã kênh': 'CH001',
        'Tên kênh': 'Kênh Mẫu 1',
        'URL': 'https://www.youtube.com/@handle1',
        'Email': 'email1@example.com',
        'Mật khẩu': 'pass123',
        'Mã 2FA': 'ABCD EFGH',
        'Subscribers': 1000,
        'Tổng Views': 50000,
        'Chủ đề': 'Giải trí, Hài hước',
        'Ghi chú': 'Ghi chú mẫu'
      },
      {
        'Tên kênh': 'Kênh Mẫu 2',
        'URL': 'https://www.youtube.com/channel/UC...',
        'Mã 2FA': '',
        'Subscribers': 2000,
        'Tổng Views': 100000,
        'Chủ đề': 'Game',
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

      setChannels(prev => prev.map(c => c.id === channel.id ? {
        ...c,
        healthStatus,
        healthNotes,
        lastHealthCheck: new Date().toISOString()
      } : c));
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

      setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, notes: updatedNotes } : c));
      showToast(`Đã tối ưu hóa Metadata cho kênh ${channel.name}. Xem trong phần Ghi chú.`, 'success');
    } catch (error) {
      console.error('Metadata Optimization Error:', error);
      showToast('Lỗi khi tối ưu hóa Metadata.', 'error');
    } finally {
      setIsOptimizingMetadata(false);
      setAnalyzingChannelId(null);
    }
  };

  const handleScanDeadChannels = async () => {
    if (channels.length === 0) return;
    if (!youtubeApiKey) {
      showToast('Vui lòng cấu hình YouTube API Key.', 'error');
      return;
    }

    const channelsToScan = selectedIds.length > 0 
      ? channels.filter(c => selectedIds.includes(c.id))
      : channels;

    if (!confirm(`Bạn sắp quét ${channelsToScan.length} kênh để kiểm tra trạng thái sống/chết. Quá trình này có thể tốn thời gian. Tiếp tục?`)) return;

    setIsScanningDead(true);
    setImportProgress({ current: 0, total: channelsToScan.length });
    let deadCount = 0;

    for (let i = 0; i < channelsToScan.length; i++) {
       const target = channelsToScan[i];
       setImportProgress({ current: i + 1, total: channelsToScan.length });
       setAnalyzingChannelId(target.id);
       
       try {
         if (i > 0) await sleep(1000);
         await fetchYoutubeChannelInfo(target.url, youtubeApiKey, true);
       } catch (err: any) {
         if (err.message === "Không tìm thấy kênh. Vui lòng kiểm tra lại đường dẫn (URL) có chính xác không.") {
            setChannels(prev => prev.map(c => c.id === target.id ? { ...c, status: 'dead' } : c));
            deadCount++;
         } else if (err.message && (err.message.includes('quota') || err.message.includes('limit'))) {
             const rotated = rotateYoutubeKey();
             if (rotated) { i--; await sleep(1000); continue; }
             showToast('Hết quota API. Dừng quét.', 'error');
             break;
         }
       }
    }

    setIsScanningDead(false);
    setAnalyzingChannelId(null);
    setImportProgress({ current: 0, total: 0 });
    showToast(`Quét hoàn tất. Phát hiện ${deadCount} kênh đã chết.`, 'success');
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
          setChannels(prev => prev.map(c => {
            const match = updatedChannels.find(uc => uc.id === c.id);
            return match || c;
          }));
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
        setChannels(prev => prev.map(c => {
          const match = finalUpdatedChannels.find(uc => uc.id === c.id);
          return match || c;
        }));
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

        const validateUrlOrCode = (row: any) => {
          const urlStr = (row.URL || row.url || row['Link'] || '').toLowerCase();
          const codeStr = (row['Mã kênh'] || row.channelCode || '').toLowerCase();
          return { urlStr, codeStr };
        };

        const isValidRow = (row: any) => {
           const { urlStr, codeStr } = validateUrlOrCode(row);
           return urlStr !== '' || codeStr !== '';
        };

        const validRows = data.filter(isValidRow);

        let duplicateCount = 0;
        const newChannelsToImport: any[] = [];
        
        validRows.forEach(row => {
          const { urlStr, codeStr } = validateUrlOrCode(row);
          
          // Check duplicates against current channels
          const isDupUrl = urlStr ? channels.some(c => (c.url || '').toLowerCase() === urlStr) || sourceChannels.some(sc => (sc.url || '').toLowerCase() === urlStr) : false;
          const isDupCode = codeStr ? channels.some(c => (c.channelCode || '').toLowerCase() === codeStr) : false;

          // Check duplicates within the file itself (already pushed to newChannelsToImport)
          const isDupInFile = newChannelsToImport.some(c => {
             const cInfo = validateUrlOrCode(c);
             return (urlStr && cInfo.urlStr === urlStr) || (codeStr && cInfo.codeStr === codeStr);
          });

          if (isDupUrl || isDupCode || isDupInFile) {
            duplicateCount++;
          } else {
            newChannelsToImport.push(row);
          }
        });

        if (newChannelsToImport.length === 0) {
          alert('Tất cả các kênh trong file đều đã tồn tại (trùng URL hoặc Mã kênh) hoặc file trống.');
          setIsBulkImporting(false);
          return;
        }

        setImportProgress({ current: 0, total: newChannelsToImport.length });

        const apiKey = youtubeApiKey;
        if (!apiKey) {
          showToast('Vui lòng cấu hình YouTube API Key trong phần Cài đặt trước khi nhập hàng loạt.', 'error');
          setIsBulkImporting(false);
          return;
        }

        let successCount = 0;
        let errorCount = 0;
        let currentApiKey = youtubeApiKey;

        let createdTopicsMap = new Map<string, string>(); // name -> id
        const importedChannelIds: string[] = [];

        for (let i = 0; i < newChannelsToImport.length; i++) {
          setImportProgress({ current: i + 1, total: newChannelsToImport.length });
          const row = newChannelsToImport[i];
          const url = row.URL || row.url || row['Link'] || '';

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
          let rawTopicStr = row['Chủ đề'] || row.topics || row.tag || '';
          
          let topicIds: string[] = [];
          if (rawTopicStr) {
            const topicNames = rawTopicStr.split(',').map((t: string) => t.trim()).filter(Boolean);
            topicNames.forEach((tName: string) => {
               // check existing
               const existingTopic = topics.find(t => t.name.toLowerCase() === tName.toLowerCase());
               if (existingTopic) {
                 topicIds.push(existingTopic.id);
               } else if (createdTopicsMap.has(tName.toLowerCase())) {
                 topicIds.push(createdTopicsMap.get(tName.toLowerCase())!);
               } else {
                 // create new
                 const newTopicId = `topic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                 createdTopicsMap.set(tName.toLowerCase(), newTopicId);
                 topicIds.push(newTopicId);
                 
                 // Update global topics state immediately
                 setTopics(prev => [...prev, {
                    id: newTopicId,
                    name: tName,
                    description: 'Tạo tự động từ file Excel',
                    color: '#' + Math.floor(Math.random()*16777215).toString(16),
                    tags: [], hashtags: [], country: 'Vietnam',
                    niche: 'Khác'
                 }]);
               }
            });
          }

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
              errorCount += (newChannelsToImport.length - i);
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
            topicIds: Array.from(new Set(topicIds)),
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
          importedChannelIds.push(newChannel.id);
          successCount++;
        }

        if (successCount > 0 && currentUser && currentUser.role !== 'admin' && importedChannelIds.length > 0) {
           const staff = staffList.find(s => s.id === currentUser.id);
           if (staff) {
               const newAssigned = Array.from(new Set([...(staff.assignedChannelIds || []), ...importedChannelIds]));
               await supabase.from('staff_list').update({ assigned_channel_ids: newAssigned }).eq('id', currentUser.id);
               setStaffList(prev => prev.map(s => s.id === currentUser.id ? { ...s, assignedChannelIds: newAssigned } : s));
           }
        }

        showToast(`Nhập hoàn tất: Tổng ${newChannelsToImport.length} kênh mới, lỗi ${errorCount}.${duplicateCount > 0 ? ` (Bỏ qua ${duplicateCount} kênh trùng lặp)` : ''}${createdTopicsMap.size > 0 ? ` Đã tạo tự động ${createdTopicsMap.size} chủ đề.` : ''}`, successCount > 0 ? 'success' : 'error');
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
        postingSchedules: channel.postingSchedules || [{ time: '18:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }],
        linkedSourceChannelIds: channel.linkedSourceChannelIds || []
      });
      const assignedToChannel = staffList.filter(s => (s.assignedChannelIds || []).includes(channel.id)).map(s => s.id);
      setEditingStaffIds(assignedToChannel);
      const matchedEmail = managedEmails.find(em => em.email === channel.email);
      setSelectedManagedEmailId(matchedEmail ? matchedEmail.id : '');
    } else {
      setEditingChannel(null);
      setFormData({
        channelCode: '',
        name: '', url: '', avatarUrl: '', subscribers: 0, totalViews: 0, topicIds: [], status: 'active', notes: '',
        email: '', password: '', recoveryEmail: '', twoFactorCode: '', proxyId: '',
        postingSchedules: [{ time: '18:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }],
        linkedSourceChannelIds: []
      });
      const defaultStaffIds = currentUser && currentUser.role !== 'admin' ? [currentUser.id] : [];
      setEditingStaffIds(defaultStaffIds);
      setSelectedManagedEmailId('');
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

  const updateStaffChannelAssignment = (channelId: string, newStaffIds: string[]) => {
    const currentStaffIds = staffList.filter(s => (s.assignedChannelIds || []).includes(channelId)).map(s => s.id);
    const staffToAdd = newStaffIds.filter(id => !currentStaffIds.includes(id));
    const staffToRemove = currentStaffIds.filter(id => !newStaffIds.includes(id));

    if (staffToAdd.length === 0 && staffToRemove.length === 0) return;

    const newStaffList = staffList.map(staff => {
      let assigned = staff.assignedChannelIds || [];
      if (staffToAdd.includes(staff.id)) assigned = [...new Set([...assigned, channelId])];
      if (staffToRemove.includes(staff.id)) assigned = assigned.filter(id => id !== channelId);
      
      if (staffToAdd.includes(staff.id) || staffToRemove.includes(staff.id)) {
        supabase.from('staff_list').update({ assigned_channel_ids: assigned }).eq('id', staff.id).then();
      }
      return { ...staff, assignedChannelIds: assigned };
    });
    setStaffList(newStaffList);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check for duplicates
    const checkUrl = formData.url?.toLowerCase().trim() || '';
    const checkCode = formData.channelCode?.toLowerCase().trim() || '';

    const isDupUrl = checkUrl !== '' && (
      (editingChannel ? channels.some(c => (c.url || '').toLowerCase() === checkUrl && c.id !== editingChannel.id) : channels.some(c => (c.url || '').toLowerCase() === checkUrl)) ||
      sourceChannels.some(sc => (sc.url || '').toLowerCase() === checkUrl)
    );

    const isDupCode = checkCode !== '' && (
      editingChannel ? channels.some(c => (c.channelCode || '').toLowerCase() === checkCode && c.id !== editingChannel.id) : channels.some(c => (c.channelCode || '').toLowerCase() === checkCode)
    );

    if (isDupUrl || isDupCode) {
      if (!confirm(`Kênh này đã tồn tại (Trùng ${isDupUrl ? 'URL' : 'Mã kênh'}). Bạn vẫn muốn tiếp tục lưu?`)) {
        return;
      }
    }

    const channelIdToUse = editingChannel ? editingChannel.id : Date.now().toString();
    const finalChannelCode = formData.channelCode || channelIdToUse;

    // Tự động gán người thao tác làm nhân sự quản lý kênh (nếu không phải admin)
    let finalStaffIds = [...editingStaffIds];
    if (currentUser && currentUser.role !== 'admin' && !finalStaffIds.includes(currentUser.id)) {
      finalStaffIds.push(currentUser.id);
    }

    if (editingChannel) {
      setChannels(prev => prev.map(c => c.id === editingChannel.id ? { ...c, ...formData } : c));
      updateStaffChannelAssignment(editingChannel.id, finalStaffIds);
      showToast('Đã cập nhật thông tin kênh thành công!', 'success');
    } else {
      setChannels(prev => [...prev, { id: channelIdToUse, ...formData }]);
      updateStaffChannelAssignment(channelIdToUse, finalStaffIds);
      showToast('Đã thêm kênh mới thành công!', 'success');
    }

    if (formData.email && setManagedEmails) {
      const matchedEmail = managedEmails.find(em => em.email.toLowerCase() === formData.email?.toLowerCase());
      if (matchedEmail) {
         if (formData.status === 'dead') {
             supabase.from('managed_emails').update({ status: 'new', channel_code: '' }).eq('id', matchedEmail.id).then();
             setManagedEmails(prev => prev.map(em => em.id === matchedEmail.id ? { ...em, status: 'new', channelCode: '' } : em));
         } else {
             supabase.from('managed_emails').update({ status: 'Kênh đã tạo', channel_code: finalChannelCode }).eq('id', matchedEmail.id).then();
             setManagedEmails(prev => prev.map(em => em.id === matchedEmail.id ? { ...em, status: 'Kênh đã tạo', channelCode: finalChannelCode } : em));
         }
      }
    }

    handleCloseModal();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa kênh này?')) {
      const channelToDelete = channels.find(c => c.id === id);
      setChannels(prev => prev.filter(c => c.id !== id));
      
      if (channelToDelete?.email && setManagedEmails) {
          const matchedEmail = managedEmails.find(em => em.email.toLowerCase() === channelToDelete.email?.toLowerCase());
          if (matchedEmail) {
              supabase.from('managed_emails').update({ status: 'new', channel_code: '' }).eq('id', matchedEmail.id).then();
              setManagedEmails(prev => prev.map(em => em.id === matchedEmail.id ? { ...em, status: 'new', channelCode: '' } : em));
          }
      }

      const { error } = await supabase.from('channels').delete().eq('id', id);
      if (error) {
        showToast(`Lỗi xóa trên server: ${error.message}`, 'error');
      } else {
        showToast('Đã xóa kênh.', 'info');
      }
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
    
    let matchesNiche = true;
    if (filterNiche !== 'all') {
      matchesNiche = (c.topicIds || []).some(tId => {
        const t = topics.find(topic => topic.id === tId);
        return t && (t.niche || 'Khác') === filterNiche;
      });
    }

    let matchesStaff = true;
    if (filterStaff !== 'all' && hasPermission('staff_view')) {
      const staffMember = staffList.find(s => s.id === filterStaff);
      if (staffMember) {
        matchesStaff = (staffMember.assignedChannelIds || []).includes(c.id);
      }
    }
    
    const matchesAliveStatus = filterAliveStatus === 'all' || (filterAliveStatus === 'dead' ? c.status === 'dead' : c.status !== 'dead');

    return matchesSearch && matchesTopic && matchesNiche && matchesStaff && matchesAliveStatus;
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
            <>
              <button
                onClick={handleBulkAIAnalysis}
                disabled={isAIAnalyzing || channels.length === 0}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Sparkles size={16} className="mr-2" /> AI Auto-Tag
              </button>
              <button
                onClick={handleScanDeadChannels}
                disabled={isScanningDead || channels.length === 0}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <AlertCircle size={16} className="mr-2" /> Quét Kênh Chết
              </button>
            </>
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
              <p className="text-sm font-medium text-blue-900">{isAIAnalyzing ? 'AI đang phân tích chủ đề...' : isScanningDead ? 'Đang quét kiểm tra kênh chết...' : 'Đang nhập dữ liệu hàng loạt...'}</p>
              <p className="text-xs text-blue-700">Tiến độ: {importProgress.current}/{importProgress.total} kênh</p>
            </div>
          </div>
          <div className="w-48 h-2 bg-blue-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}></div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="Tìm kiếm kênh..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        
        <select value={filterAliveStatus} onChange={e => setFilterAliveStatus(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[150px]">
          <option value="all">Tất cả Trạng thái</option>
          <option value="active">Đang Sống</option>
          <option value="dead">Kênh Đã Chết</option>
        </select>

        <select value={filterNiche} onChange={e => setFilterNiche(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[150px]">
          <option value="all">Tất cả Nhóm CĐ</option>
          {Array.from(new Set(topics.map(t => t.niche || 'Khác'))).map(niche => (
            <option key={niche} value={niche}>{niche}</option>
          ))}
        </select>
        
        <select value={filterTopic} onChange={e => setFilterTopic(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[150px]">
          <option value="all">Tất cả tag chủ đề</option>
          {topics.filter(t => filterNiche === 'all' || (t.niche || 'Khác') === filterNiche).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {hasPermission('staff_view') && (
          <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[150px]">
            <option value="all">Tất cả nhân sự</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-center justify-between shadow-sm flex-wrap gap-2">
          <span className="text-sm font-medium text-blue-800">
            Đã chọn <strong>{selectedIds.length}</strong> kênh
          </span>
          <div className="flex flex-wrap space-x-2">
            <button onClick={() => { setBulkActionTopicIds([]); setIsBulkTopicModalOpen(true); }} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors">
              Gắn Chủ đề
            </button>
            {hasPermission('staff_edit') && (
              <>
                <button onClick={() => { setBulkActionStaffId(''); setIsBulkStaffModalOpen(true); }} className="px-3 py-1.5 bg-teal-600 text-white rounded text-sm hover:bg-teal-700 transition-colors">
                  Giao cho Nhân sự
                </button>
                <button onClick={handleBulkRemoveStaffSubmit} className="px-3 py-1.5 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 transition-colors shadow-sm">
                  Thu hồi Nhân sự
                </button>
              </>
            )}
            <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors">
              Xóa {selectedIds.length} kênh
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500">
                <th className="p-4 font-medium w-10">
                  <input 
                    type="checkbox" 
                    checked={filteredChannels.length > 0 && selectedIds.length === filteredChannels.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(filteredChannels.map(c => c.id));
                      else setSelectedIds([]);
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
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
                const isSelected = selectedIds.includes(channel.id);
                return (
                  <tr key={channel.id} className={`hover:bg-gray-50 transition-all ${isSelected ? 'bg-blue-50/30' : ''} ${analyzingChannelId === channel.id ? 'bg-purple-50 ring-1 ring-inset ring-purple-200' : ''} ${channel.status === 'dead' ? 'bg-red-50/80 !border-red-200' : ''}`}>
                    <td className="p-4">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(prev => [...prev, channel.id]);
                          else setSelectedIds(prev => prev.filter(id => id !== channel.id));
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
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
                          <div className="flex items-center space-x-2 flex-wrap gap-1">
                            {channel.status === 'dead' && <span className="text-red-700 text-[10px] px-1 bg-red-200 border border-red-300 rounded font-bold uppercase shrink-0 tracking-wider shadow-sm">Chết</span>}
                            <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200 shrink-0">
                              {channel.channelCode}
                            </span>
                            <span className="font-medium text-gray-900 truncate">{channel.name}</span>
                          </div>
                          
                          {/* Hiển thị nhân sự */}
                          {staffList.filter(s => (s.assignedChannelIds || []).includes(channel.id)).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                              <Users size={10} className="text-gray-400 mr-0.5" />
                              {staffList.filter(s => (s.assignedChannelIds || []).includes(channel.id)).map(staff => (
                                <span key={staff.id} className="text-[9px] font-medium bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded-md border border-teal-100">
                                  {staff.name}
                                </span>
                              ))}
                            </div>
                          )}
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
                          <div className="flex items-center space-x-2">
                             <span className="text-gray-700 font-medium">{channel.email || 'Chưa có email'}</span>
                             {managedEmails?.some(em => em.email === channel.email) && (
                               <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded border border-blue-200" title="Đã liên kết kho Email">Linked</span>
                             )}
                          </div>
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
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${channel.status === 'active' ? 'bg-green-100 text-green-800' : channel.status === 'suspended' ? 'bg-orange-100 text-orange-800' : channel.status === 'dead' ? 'bg-red-100 text-red-800 border border-red-200 shadow-sm' : 'bg-gray-100 text-gray-800'
                        }`}>
                        {channel.status === 'active' ? 'Hoạt động' : channel.status === 'suspended' ? 'Bị đình chỉ' : channel.status === 'dead' ? 'Bị YouTube xóa' : 'Tạm ngưng'}
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
              {filteredChannels.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-500">Không tìm thấy kênh nào.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Bulk Assign Topics */}
      {isBulkTopicModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white">
              <h2 className="text-lg font-semibold flex items-center">
                <Sparkles className="text-blue-500 mr-2" size={20} /> Gắn Chủ đề ({selectedIds.length} kênh)
              </h2>
              <button onClick={() => setIsBulkTopicModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-4">
              <p className="text-sm text-gray-600 font-medium">Chọn các chủ đề muốn gán thêm cho các kênh đã chọn:</p>
              <div className="flex flex-wrap gap-2">
                {topics.map(topic => (
                  <button key={topic.id} onClick={() => {
                    setBulkActionTopicIds(prev => prev.includes(topic.id) ? prev.filter(id => id !== topic.id) : [...prev, topic.id]);
                  }} className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${bulkActionTopicIds.includes(topic.id) ? 'border-transparent text-white shadow-sm scale-105' : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'}`} style={bulkActionTopicIds.includes(topic.id) ? { backgroundColor: topic.color } : {}}>
                    {topic.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end space-x-3 bg-gray-50">
              <button onClick={() => setIsBulkTopicModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg shadow-sm">Hủy</button>
              <button onClick={handleBulkAssignTopicSubmit} disabled={bulkActionTopicIds.length === 0} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 shadow-sm flex items-center">
                <Check size={16} className="mr-1" /> Áp dụng ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Bulk Assign Staff */}
      {isBulkStaffModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white">
              <h2 className="text-lg font-semibold flex items-center">
                <Users className="text-teal-500 mr-2" size={20} /> Giao Kênh ({selectedIds.length} kênh)
              </h2>
              <button onClick={() => setIsBulkStaffModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-4">
              <p className="text-sm text-gray-600 font-medium">Chọn nhân sự để gán thêm các kênh này:</p>
              <select value={bulkActionStaffId} onChange={e => setBulkActionStaffId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">
                <option value="" disabled>-- Chọn Nhân sự --</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
              </select>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-between bg-gray-50 items-center">
              <button onClick={handleBulkRemoveStaffSubmit} className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200">
                Bỏ quản lý
              </button>
              <div className="flex space-x-3">
                <button onClick={() => setIsBulkStaffModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg shadow-sm">Hủy</button>
                <button onClick={handleBulkAssignStaffSubmit} disabled={!bulkActionStaffId} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50 shadow-sm flex items-center">
                  <Check size={16} className="mr-1" /> Giao việc
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    {hasPermission('staff_edit') && (
                      <div className="md:col-span-2 mt-2 border-t border-gray-100 pt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nhân sự quản lý kênh</label>
                        <div className="flex flex-wrap gap-2">
                          {staffList.filter(s => s.role !== 'admin').map(staff => {
                            const isSelected = editingStaffIds.includes(staff.id);
                            return (
                              <button
                                key={staff.id}
                                type="button"
                                onClick={() => {
                                  setEditingStaffIds(prev => 
                                    prev.includes(staff.id) ? prev.filter(id => id !== staff.id) : [...prev, staff.id]
                                  );
                                }}
                                className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors flex items-center ${
                                  isSelected
                                    ? 'bg-teal-600 border-teal-600 text-white shadow-sm'
                                    : 'bg-white border-gray-300 text-gray-600 hover:bg-teal-50 hover:border-teal-300'
                                }`}
                              >
                                {isSelected ? <Check size={12} className="mr-1" /> : <Users size={12} className="mr-1" />}
                                {staff.name}
                              </button>
                            );
                          })}
                          {staffList.filter(s => s.role !== 'admin').length === 0 && (
                            <span className="text-sm text-gray-500 italic">Chưa có nhân sự nào trong hệ thống (Ngoài Admin).</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Liên kết Email từ kho - Hiển thị cho mọi role có channels_edit */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
                    <Mail size={16} className="mr-2" /> Liên kết Email từ kho
                    {selectedManagedEmailId && <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">✓ Đã chọn</span>}
                  </h3>
                  <select
                    value={selectedManagedEmailId}
                    onChange={(e) => {
                       const val = e.target.value;
                       setSelectedManagedEmailId(val);
                       if (val !== '') {
                          const em = managedEmails?.find(m => m.id === val);
                          if (em) setFormData(prev => ({ ...prev, email: em.email, password: em.password || prev.password, recoveryEmail: em.recoveryEmail || prev.recoveryEmail, twoFactorCode: em.twoFactorAuth || prev.twoFactorCode }));
                       } else {
                          setFormData(prev => ({ ...prev, email: '', password: '', recoveryEmail: '', twoFactorCode: '' }));
                       }
                    }}
                    className="w-full border border-blue-200 rounded-lg px-3 py-2 focus:ring-blue-500 bg-white"
                  >
                     <option value="">-- Chọn email từ kho đã gán --</option>
                     {managedEmails?.filter(m => !channels.some(c => c.email?.toLowerCase() === m.email.toLowerCase() && c.id !== editingChannel?.id)).map(em => (
                        <option key={em.id} value={em.id}>{em.email} {em.channelCode ? `(Mã dự kiến: ${em.channelCode})` : ''}</option>
                     ))}
                  </select>
                  {selectedManagedEmailId === '' && (
                     <input type="email" placeholder="Hoặc nhập email thủ công" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full border border-blue-200 rounded-lg px-3 py-2 focus:ring-blue-500 bg-white mt-2" />
                  )}
                  {managedEmails?.length === 0 && (
                    <p className="text-xs text-blue-600 italic mt-2">Chưa có email nào được gán. Liên hệ quản lý để được cấp email.</p>
                  )}
                </div>

                {/* Thông tin bảo mật - Chỉ admin/manager thấy */}
                {hasPermission('channels_view_sensitive') && (
                  <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                    <h3 className="text-sm font-semibold text-red-900 mb-3 flex items-center"><ShieldAlert size={16} className="mr-2" /> Thông tin Bảo mật (Nhạy cảm)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
                    <h4 className="text-sm font-bold text-blue-900 flex items-center uppercase tracking-wider">
                      <Clock size={16} className="mr-2" /> Lịch đăng video định kỳ
                    </h4>
                    <div className="flex gap-2 items-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (formData.topicIds && formData.topicIds.length > 0) {
                            const topic = topics.find(t => t.id === formData.topicIds[0]);
                            if (topic && topic.defaultSchedules && topic.defaultSchedules.length > 0) {
                              setFormData({
                                ...formData,
                                postingSchedules: topic.defaultSchedules
                              });
                              // window.alert không phù hợp, nhưng components này có dùng showToast
                              // Mặc định Channels.tsx đã có showToast
                            } else {
                              // Tùy chọn: báo chưa có
                            }
                          }
                        }}
                        className="flex items-center text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-200 transition-colors shadow-sm"
                        title="Áp dụng lịch từ Chủ đề (Niche) đầu tiên"
                      >
                         <Sparkles size={14} className="mr-1" /> Lấy từ Chủ đề
                      </button>
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
                  </div>

                  <div className="space-y-4">
                    {formData.postingSchedules?.map((schedule, index) => (
                      <div key={index} className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm relative group">
                        <button
                          type="button"
                          onClick={() => {
                            const newSchedules = formData.postingSchedules!.filter((_, i) => i !== index);
                            setFormData({ ...formData, postingSchedules: newSchedules });
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md z-10 hover:bg-red-600 transition-colors cursor-pointer"
                          title="Xóa lịch đăng này"
                        >
                          <X size={14} />
                        </button>
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

                {/* Liên kết Kênh Nguồn */}
                <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                  <h3 className="text-sm font-semibold text-emerald-900 mb-3 flex items-center">
                    <Link2 size={16} className="mr-2" /> Liên kết Kênh Nguồn
                    {(formData.linkedSourceChannelIds || []).length > 0 && (
                      <span className="ml-2 text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                        {(formData.linkedSourceChannelIds || []).length} kênh đã chọn
                      </span>
                    )}
                  </h3>

                  {/* Bộ lọc theo chủ đề */}
                  <div className="mb-3">
                    <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Lọc theo Chủ đề</label>
                    <select
                      value={sourceTopicFilter}
                      onChange={e => setSourceTopicFilter(e.target.value)}
                      className="w-full border border-emerald-200 rounded-lg px-3 py-2 focus:ring-emerald-500 bg-white text-sm"
                    >
                      <option value="all">-- Tất cả chủ đề --</option>
                      {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  {/* Danh sách kênh nguồn để chọn */}
                  <div className="max-h-48 overflow-y-auto space-y-1.5 mb-3 pr-1">
                    {sourceChannels
                      .filter(sc => {
                        // Lọc theo chủ đề
                        const matchesTopic = sourceTopicFilter === 'all' || (sc.topicIds || []).includes(sourceTopicFilter);
                        // Lọc theo quyền: admin thấy tất cả, member chỉ thấy kênh được giao
                        const matchesPermission = currentUser?.role === 'admin' || currentUser?.role === 'manager'
                          || (sc.allowedStaffIds || []).includes(currentUser?.id || '');
                        return matchesTopic && matchesPermission;
                      })
                      .map(sc => {
                        const isLinked = (formData.linkedSourceChannelIds || []).includes(sc.id);
                        return (
                          <button
                            key={sc.id}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                linkedSourceChannelIds: isLinked
                                  ? (prev.linkedSourceChannelIds || []).filter(id => id !== sc.id)
                                  : [...(prev.linkedSourceChannelIds || []), sc.id]
                              }));
                            }}
                            className={`w-full flex items-center p-2 rounded-lg border transition-all text-left ${
                              isLinked
                                ? 'bg-emerald-100 border-emerald-400 shadow-sm ring-1 ring-emerald-300'
                                : 'bg-white border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                            }`}
                          >
                            {/* Avatar */}
                            {sc.avatarUrl ? (
                              <img src={sc.avatarUrl} alt={sc.name} className="w-8 h-8 rounded-full object-cover border border-gray-200 shrink-0 mr-2.5" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs shrink-0 mr-2.5">
                                {(sc.name || '?').charAt(0).toUpperCase()}
                              </div>
                            )}
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{sc.name}</p>
                              <p className="text-[10px] text-gray-400 truncate">{sc.url}</p>
                            </div>
                            {/* Check indicator */}
                            {isLinked && (
                              <div className="ml-2 shrink-0">
                                <Check size={16} className="text-emerald-600" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    {sourceChannels.filter(sc => {
                      const matchesTopic = sourceTopicFilter === 'all' || (sc.topicIds || []).includes(sourceTopicFilter);
                      const matchesPermission = currentUser?.role === 'admin' || currentUser?.role === 'manager'
                        || (sc.allowedStaffIds || []).includes(currentUser?.id || '');
                      return matchesTopic && matchesPermission;
                    }).length === 0 && (
                      <p className="text-xs text-emerald-600 italic text-center py-3">
                        {sourceTopicFilter === 'all' ? 'Chưa có kênh nguồn nào được gán cho bạn.' : 'Không có kênh nguồn nào thuộc chủ đề này.'}
                      </p>
                    )}
                  </div>

                  {/* Hiển thị kênh nguồn đã chọn */}
                  {(formData.linkedSourceChannelIds || []).length > 0 && (
                    <div className="border-t border-emerald-200 pt-3">
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-2">Kênh nguồn đã liên kết</label>
                      <div className="flex flex-wrap gap-2">
                        {(formData.linkedSourceChannelIds || []).map(scId => {
                          const sc = sourceChannels.find(s => s.id === scId);
                          if (!sc) return null;
                          return (
                            <div key={scId} className="flex items-center bg-white border border-emerald-200 rounded-full pl-1 pr-2 py-0.5 shadow-sm">
                              {sc.avatarUrl ? (
                                <img src={sc.avatarUrl} alt={sc.name} className="w-5 h-5 rounded-full object-cover mr-1.5" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-500 mr-1.5">
                                  {(sc.name || '?').charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className="text-[11px] font-medium text-gray-800 mr-1 max-w-[120px] truncate">{sc.name}</span>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({
                                  ...prev,
                                  linkedSourceChannelIds: (prev.linkedSourceChannelIds || []).filter(id => id !== scId)
                                }))}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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

