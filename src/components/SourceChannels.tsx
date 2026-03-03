import React, { useState } from 'react';
import { SourceChannel, Topic, Channel, Staff } from '../types';
import { Plus, Edit2, Trash2, X, ExternalLink, Star, RefreshCw, ChevronDown, ChevronUp, Youtube, Calendar, Eye, Video, Clock, Upload, FileDown, AlertCircle, Sparkles, Search, Download, Users } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import * as XLSX from 'xlsx';
import { fetchYoutubeChannelInfo, sleep } from '../services/youtube';
import { analyzeChannelTopic } from '../services/aiService';
import { Copy, Check } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';

interface SourceChannelsProps {
  sourceChannels: SourceChannel[];
  setSourceChannels: React.Dispatch<React.SetStateAction<SourceChannel[]>>;
  topics: Topic[];
  setTopics: React.Dispatch<React.SetStateAction<Topic[]>>;
  channels: Channel[];
  youtubeApiKey?: string;
  geminiApiKey?: string;
  rotateYoutubeKey: () => boolean;
  staffList?: Staff[];
  currentUser?: { role: string; name: string; id: string } | null;
}

export function SourceChannels({ sourceChannels, setSourceChannels, topics, setTopics, channels, youtubeApiKey, geminiApiKey, rotateYoutubeKey, staffList = [], currentUser }: SourceChannelsProps) {
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<SourceChannel | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [expandedDesc, setExpandedDesc] = useState<Record<string, boolean>>({});
  const [viewingChannel, setViewingChannel] = useState<SourceChannel | null>(null);
  const formatDuration = (duration: string) => {
    if (!duration) return '';
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return duration;

    const hours = (match[1] || '').replace('H', '');
    const minutes = (match[2] || '').replace('M', '');
    const seconds = (match[3] || '').replace('S', '');

    let res = '';
    if (hours) res += `${hours}:`;
    res += `${minutes ? minutes.padStart(2, '0') : '00'}:`;
    res += `${seconds ? seconds.padStart(2, '0') : '00'}`;

    return res;
  };

  const [formData, setFormData] = useState<Omit<SourceChannel, 'id'>>({
    name: '',
    url: '',
    avatarUrl: '',
    topicIds: [],
    rating: 3,
    uploadFrequency: 'Hàng tuần',
    averageViews: 0,
    subscribers: 0,
    notes: '',
    allowedStaffIds: []
  });

  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [isAIAnalyzing, setIsAIAnalyzing] = useState(false);
  const [isCheckingViral, setIsCheckingViral] = useState(false);
  const [isAnalyzingGap, setIsAnalyzingGap] = useState(false);
  const [analyzingChannelId, setAnalyzingChannelId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTopic, setFilterTopic] = useState<string>('all');

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const downloadTemplate = () => {
    const template = [
      {
        'Tên kênh': 'Kênh Nguồn 1',
        'URL': 'https://www.youtube.com/@handle1',
        'Subscribers': 10000,
        'Tổng Views': 500000,
        'Số Video': 100,
        'Đánh giá': 4,
        'Ghi chú': 'Kênh tham khảo tốt'
      },
      {
        'Tên kênh': 'Kênh Nguồn 2',
        'URL': 'https://www.youtube.com/channel/UC...',
        'Subscribers': 20000,
        'Tổng Views': 1000000,
        'Số Video': 200,
        'Đánh giá': 5,
        'Ghi chú': 'Kênh đối thủ chính'
      },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "YouTube_Source_Channels_Template.xlsx");
  };

  const handleAITagging = async (channel?: SourceChannel) => {
    const targetChannel = channel || (editingChannel ? { ...editingChannel, ...formData } : null);
    if (!targetChannel) return;

    if (!geminiApiKey) {
      showToast('Vui lòng cấu hình Gemini API Key trong phần Cài đặt trước khi sử dụng tính năng này.', 'error');
      return;
    }

    setIsAIAnalyzing(true);
    try {
      const result = await analyzeChannelTopic(targetChannel.name, targetChannel.description || '', topics, geminiApiKey);

      let updatedTopicIds = [...(targetChannel.topicIds || [])];

      // Add suggested existing topics
      result.suggestedTopicIds.forEach(id => {
        if (!updatedTopicIds.includes(id)) {
          updatedTopicIds.push(id);
        }
      });

      // If we are in the modal, update form data
      if (!channel) {
        setFormData(prev => ({ ...prev, topicIds: updatedTopicIds }));

        // Handle new topics suggested by AI
        if (result.newTopics.length > 0) {
          if (confirm(`AI đề xuất thêm các chủ đề mới: ${result.newTopics.map(t => t.name).join(', ')}. Bạn có muốn tự động tạo các chủ đề này không?`)) {
            const newCreatedTopics: Topic[] = result.newTopics.map(nt => ({
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              name: nt.name,
              color: nt.color,
              description: `Được tạo tự động bởi AI cho kênh ${targetChannel.name}`,
              tags: [],
              hashtags: [],
              country: 'Vietnam'
            }));

            setTopics(prev => [...prev, ...newCreatedTopics]);
            setFormData(prev => ({
              ...prev,
              topicIds: [...prev.topicIds, ...newCreatedTopics.map(t => t.id)]
            }));
          }
        }
      } else {
        // If we are updating an existing channel directly
        setSourceChannels(prev => prev.map(c => c.id === channel.id ? { ...c, topicIds: updatedTopicIds } : c));
        showToast(`Đã tự động gán tag cho kênh ${targetChannel.name}.`, 'success');
      }
    } catch (error: any) {
      showToast('Lỗi phân tích AI: ' + error.message, 'error');
    } finally {
      setIsAIAnalyzing(false);
    }
  };

  const handleViralAlert = async (channel: SourceChannel) => {
    setIsCheckingViral(true);
    setAnalyzingChannelId(channel.id);
    try {
      if (!channel.latestVideos || channel.latestVideos.length === 0) {
        showToast('Không có dữ liệu video mới nhất để kiểm tra.', 'warning');
        return;
      }

      const avgViews = channel.averageViews || 0;
      const viralThreshold = avgViews * 2; // Viral if views > 2x average

      const viralVideos = channel.latestVideos.filter(v => (v.viewCount || 0) > viralThreshold);

      if (viralVideos.length > 0) {
        const topViral = viralVideos.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))[0];
        setSourceChannels(prev => prev.map(c => c.id === channel.id ? {
          ...c,
          isViral: true,
          viralVideoTitle: topViral.title,
          viralVideoViews: topViral.viewCount || 0
        } : c));
        showToast(`PHÁT HIỆN VIRAL! Video "${topViral.title}" đạt ${topViral.viewCount?.toLocaleString()} views.`, 'success');
      } else {
        setSourceChannels(prev => prev.map(c => c.id === channel.id ? { ...c, isViral: false } : c));
        showToast('Không phát hiện video viral mới.', 'info');
      }
    } catch (error) {
      showToast('Lỗi khi kiểm tra viral alert.', 'error');
    } finally {
      setIsCheckingViral(false);
      setAnalyzingChannelId(null);
    }
  };

  const handleContentGapAnalysis = async (channel: SourceChannel) => {
    setIsAnalyzingGap(true);
    setAnalyzingChannelId(channel.id);
    try {
      if (!geminiApiKey) {
        showToast('Vui lòng cấu hình Gemini API Key.', 'error');
        return;
      }

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const model = 'gemini-2.5-flash';

      const competitorContent = channel.topVideos?.map(v => v.title).join(', ') || channel.description;
      const myTopics = topics.map(t => t.name).join(', ');

      const prompt = `Phân tích "Content Gap" giữa đối thủ và hệ thống của tôi. 
      Nội dung đối thủ mạnh: ${competitorContent}. 
      Chủ đề tôi đang làm: ${myTopics}. 
      Hãy chỉ ra 3 ngách nội dung (content gap) mà đối thủ đang làm tốt nhưng tôi chưa khai thác hoặc có thể làm tốt hơn. Trả về 3 câu ngắn gọn.`;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      const gapAnalysis = response.text || 'Không có dữ liệu phân tích.';

      // Update notes with gap analysis
      const updatedNotes = `${channel.notes || ''}\n\n--- CONTENT GAP ANALYSIS (${new Date().toLocaleDateString()}) ---\n${gapAnalysis}`;

      setSourceChannels(prev => prev.map(c => c.id === channel.id ? { ...c, notes: updatedNotes } : c));
      showToast('Đã hoàn thành phân tích Content Gap. Xem trong phần Ghi chú.', 'success');
    } catch (error) {
      console.error('Gap Analysis Error:', error);
      showToast('Lỗi khi phân tích Content Gap.', 'error');
    } finally {
      setIsAnalyzingGap(false);
      setAnalyzingChannelId(null);
    }
  };

  const handleBulkAIAnalysis = async () => {
    if (sourceChannels.length === 0) return;

    if (topics.length === 0) {
      alert('Bạn cần tạo ít nhất một Chủ đề trong tab "Chủ đề" trước khi sử dụng tính năng AI Auto-Tag.');
      return;
    }

    if (!geminiApiKey) {
      showToast('Vui lòng cấu hình Gemini API Key trong phần Cài đặt trước khi sử dụng tính năng này.', 'error');
      return;
    }

    const mode = confirm(`Bạn muốn AI tự động phân tích và gắn tag cho ${sourceChannels.length} kênh?\n\n- Bấm OK để phân tích TOÀN BỘ (ghi đè tag cũ).\n- Bấm Cancel để chỉ phân tích các kênh CHƯA CÓ TAG.`)
      ? 'all'
      : 'untagged';

    const channelsToProcess = mode === 'all'
      ? sourceChannels
      : sourceChannels.filter(c => (c.topicIds || []).length === 0);

    if (channelsToProcess.length === 0) {
      alert('Không có kênh nào cần phân tích theo lựa chọn của bạn.');
      return;
    }

    setIsAIAnalyzing(true);
    setImportProgress({ current: 0, total: channelsToProcess.length });

    const updatedChannels = [...sourceChannels];
    const newTopicsToCreate: Map<string, { name: string, color: string }> = new Map();
    const channelToNewTopicNames: Map<string, string[]> = new Map();

    for (let i = 0; i < channelsToProcess.length; i++) {
      const target = channelsToProcess[i];
      setImportProgress(prev => ({ ...prev, current: i + 1 }));
      setAnalyzingChannelId(target.id);

      try {
        // Add a small delay for AI rate limits (Gemini Free is ~15 RPM)
        if (i > 0) await sleep(2000);

        // Use description if available, otherwise name
        const contentForAI = target.description || target.notes || target.name;
        const result = await analyzeChannelTopic(target.name, contentForAI, topics, geminiApiKey);

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
          // Update state incrementally for better feedback
          setSourceChannels([...updatedChannels]);
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
        setSourceChannels(finalUpdatedChannels);
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
          ...sourceChannels.map(sc => (sc.url || '').toLowerCase()),
          ...channels.map(c => (c.url || '').toLowerCase())
        ]);

        const uniqueUrls = urls.filter(url => !existingUrls.has((url || '').toLowerCase()));
        const duplicateCount = urls.length - uniqueUrls.length;

        if (uniqueUrls.length === 0) {
          alert('Tất cả các kênh trong file đều đã tồn tại trong hệ thống.');
          setIsBulkImporting(false);
          return;
        }

        setImportProgress({ current: 0, total: uniqueUrls.length });

        const apiKey = youtubeApiKey || '';
        if (!apiKey) {
          showToast('Vui lòng cấu hình YouTube API Key trong phần Cài đặt trước khi nhập hàng loạt.', 'error');
          setIsBulkImporting(false);
          return;
        }

        let successCount = 0;
        let errorCount = 0;
        let currentApiKey = youtubeApiKey || '';

        for (let i = 0; i < uniqueUrls.length; i++) {
          setImportProgress({ current: i + 1, total: uniqueUrls.length });
          const url = uniqueUrls[i];
          const row = data.find(r => (r.URL || r.url || r['Link'])?.toLowerCase() === (url || '').toLowerCase()) || {};

          let name = row['Tên kênh'] || row.name || row.Name || 'Kênh mới';
          let avatarUrl = '';
          let subscribers = parseInt(row.Subscribers || row.subscribers || '0') || 0;
          let totalViews = parseInt(row['Tổng Views'] || row.totalViews || '0') || 0;
          let videoCount = parseInt(row['Số Video'] || row.videoCount || '0') || 0;
          let rating = parseInt(row['Đánh giá'] || row.rating || '3') || 3;
          let notes = row['Ghi chú'] || row.notes || '';

          let averageViews = 0;
          let publishedAt = '';
          let description = '';
          let latestVideos: any[] = [];
          let topVideos: any[] = [];

          try {
            // Add a small delay to avoid hitting rate limits
            if (i > 0) await sleep(1000);

            // Skip top videos during bulk import to save quota
            const info = await fetchYoutubeChannelInfo(url, currentApiKey, true);
            name = info.name || name;
            avatarUrl = info.avatarUrl || avatarUrl;
            subscribers = info.subscribers || subscribers;
            totalViews = info.totalViews || totalViews;
            videoCount = info.videoCount || videoCount;
            rating = info.calculatedRating || rating;
            averageViews = info.totalViews && info.videoCount ? Math.floor(info.totalViews / info.videoCount) : 0;
            publishedAt = info.publishedAt || '';
            description = info.description || '';
            latestVideos = info.latestVideos || [];
            topVideos = info.topVideos || [];
          } catch (err: any) {
            console.error(`Lỗi lấy thông tin kênh ${url}:`, err);
            // If it's a quota error, try to rotate
            if (err.message?.includes('quota') || err.message?.includes('limit')) {
              const rotated = rotateYoutubeKey();
              if (rotated) {
                showToast('Hết quota, đang tự động đổi API Key...', 'info');
                i--;
                await sleep(1000);
                continue;
              }
              showToast('Hết quota API YouTube và không còn Key dự phòng. Quá trình nhập dừng lại.', 'error');
              errorCount += (uniqueUrls.length - i); // Count remaining as errors
              break;
            }
            // For other errors, skip this channel
            errorCount++;
            continue;
          }

          const newChannel: SourceChannel = {
            id: (Date.now() + i).toString(),
            name,
            url,
            avatarUrl,
            topicIds: [],
            rating,
            uploadFrequency: 'Hàng tuần',
            averageViews,
            subscribers,
            totalViews,
            videoCount,
            publishedAt,
            description,
            latestVideos,
            topVideos,
            notes
          };

          setSourceChannels(prev => [...prev, newChannel]);
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

  const handleOpenModal = (channel?: SourceChannel) => {
    if (channel) {
      setEditingChannel(channel);
      setFormData({
        name: channel.name,
        url: channel.url,
        avatarUrl: channel.avatarUrl || '',
        topicIds: channel.topicIds,
        rating: channel.rating,
        uploadFrequency: channel.uploadFrequency,
        averageViews: channel.averageViews,
        subscribers: channel.subscribers || 0,
        totalViews: channel.totalViews || 0,
        videoCount: channel.videoCount || 0,
        publishedAt: channel.publishedAt || '',
        description: channel.description || '',
        latestVideos: channel.latestVideos || [],
        topVideos: channel.topVideos || [],
        notes: channel.notes
      });
    } else {
      setEditingChannel(null);
      setFormData({
        name: '',
        url: '',
        avatarUrl: '',
        topicIds: [],
        rating: 3,
        uploadFrequency: 'Hàng tuần',
        averageViews: 0,
        subscribers: 0,
        totalViews: 0,
        videoCount: 0,
        publishedAt: '',
        description: '',
        latestVideos: [],
        topVideos: [],
        notes: ''
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
      const apiKey = youtubeApiKey || '';
      const info = await fetchYoutubeChannelInfo(formData.url, apiKey);
      setFormData(prev => ({
        ...prev,
        name: info.name || prev.name,
        avatarUrl: info.avatarUrl || prev.avatarUrl,
        subscribers: info.subscribers || prev.subscribers,
        totalViews: info.totalViews || prev.totalViews,
        videoCount: info.videoCount || prev.videoCount,
        publishedAt: info.publishedAt || prev.publishedAt,
        description: info.description || prev.description,
        latestVideos: info.latestVideos || prev.latestVideos,
        topVideos: info.topVideos || prev.topVideos,
        rating: info.calculatedRating || prev.rating,
        averageViews: info.totalViews && info.videoCount ? Math.floor(info.totalViews / info.videoCount) : prev.averageViews,
        notes: prev.notes // Keep user notes separate from description now
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
      ? sourceChannels.some(sc => (sc.url || '').toLowerCase() === (formData.url || '').toLowerCase() && sc.id !== editingChannel.id)
      : sourceChannels.some(sc => (sc.url || '').toLowerCase() === (formData.url || '').toLowerCase())) ||
      channels.some(c => (c.url || '').toLowerCase() === (formData.url || '').toLowerCase());

    if (isDuplicate) {
      if (!confirm('Kênh này đã tồn tại trong danh sách Tài khoản hoặc Kênh nguồn. Bạn vẫn muốn tiếp tục lưu?')) {
        return;
      }
    }

    if (editingChannel) {
      setSourceChannels(sourceChannels.map(c => c.id === editingChannel.id ? { ...c, ...formData } : c));
      showToast('Đã cập nhật kênh nguồn thành công!', 'success');
    } else {
      setSourceChannels([...sourceChannels, { id: Date.now().toString(), ...formData }]);
      showToast('Đã thêm kênh nguồn mới thành công!', 'success');
    }
    handleCloseModal();
  };

  const handleDelete = (id: string) => {
    setSourceChannels(prev => prev.filter(c => c.id !== id));
    showToast('Đã xóa kênh nguồn.', 'info');
  };

  const toggleTopic = (topicId: string) => {
    setFormData(prev => ({
      ...prev,
      topicIds: (prev.topicIds || []).includes(topicId)
        ? prev.topicIds.filter(id => id !== topicId)
        : [...(prev.topicIds || []), topicId]
    }));
  };

  const copyTags = (channel: SourceChannel) => {
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
    if (sourceChannels.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(sourceChannels.map(c => ({
      'Tên kênh': c.name,
      'URL': c.url,
      'Subscribers': c.subscribers,
      'Tổng Views': c.totalViews,
      'Số Video': c.videoCount,
      'Đánh giá': c.rating,
      'Chủ đề': (c.topicIds || []).map(tid => topics.find(t => t.id === tid)?.name).join(', '),
      'Ghi chú': c.notes
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SourceChannels');
    XLSX.writeFile(wb, `YT_SourceChannels_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredChannels = sourceChannels.filter(channel => {
    const matchesSearch = channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (channel.url || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTopic = filterTopic === 'all' || (channel.topicIds && channel.topicIds.includes(filterTopic));

    // Privacy Filter: Admin/Manager thấy hết. Nhân sự thì chỉ thấy kênh có ID của mình hoặc mảng rỗng (public)
    const isPublic = !channel.allowedStaffIds || channel.allowedStaffIds.length === 0;
    const isAllowed = currentUser?.role === 'admin' || currentUser?.role === 'manager' || isPublic || (currentUser && channel.allowedStaffIds?.includes(currentUser.id));

    return matchesSearch && matchesTopic && isAllowed;
  }).sort((a, b) => {
    // Sort by rating descending, then by subscribers descending
    if (a.rating !== b.rating) {
      return b.rating - a.rating;
    }
    return (b.subscribers || 0) - (a.subscribers || 0);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Kênh Nguồn (Tham khảo)
            <span className="ml-2 text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {filteredChannels.length} / {sourceChannels.length} kênh
            </span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý các kênh đối thủ, kênh lấy ý tưởng nội dung</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission('sources_analyze') && (
            <button
              onClick={handleBulkAIAnalysis}
              disabled={isAIAnalyzing || sourceChannels.length === 0}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Sparkles size={16} className="mr-2" /> AI Auto-Tag
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={sourceChannels.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Download size={16} className="mr-2" /> Xuất Excel
          </button>
          <button onClick={downloadTemplate} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors">
            <FileDown size={16} className="mr-2" /> File mẫu
          </button>
          {hasPermission('sources_edit') && (
            <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors cursor-pointer">
              <Upload size={16} className="mr-2" /> Nhập Excel
              <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleBulkImport} disabled={isBulkImporting} />
            </label>
          )}
          {hasPermission('sources_edit') && (
            <button
              onClick={() => handleOpenModal()}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors"
            >
              <Plus size={16} className="mr-2" /> Thêm kênh nguồn
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Tìm kiếm kênh nguồn..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <select
          value={filterTopic}
          onChange={e => setFilterTopic(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white min-w-[150px]"
        >
          <option value="all">Tất cả chủ đề</option>
          {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500">
              <th className="p-4 font-medium w-64">Kênh Nguồn</th>
              <th className="p-4 font-medium w-32">Chỉ số</th>
              <th className="p-4 font-medium">Chủ đề (Tags)</th>
              <th className="p-4 font-medium text-center w-24">Đánh giá</th>
              {hasPermission('sources_edit') && <th className="p-4 font-medium w-48">Phân Quyền Xem</th>}
              <th className="p-4 font-medium">Ghi chú</th>
              <th className="p-4 font-medium text-right w-24">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredChannels.map(channel => (
              <tr key={channel.id} className={`hover:bg-gray-50 transition-colors ${analyzingChannelId === channel.id ? 'bg-purple-50/50' : ''}`}>
                <td className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="relative shrink-0">
                      {channel.avatarUrl ? (
                        <img src={channel.avatarUrl} alt={channel.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-lg">
                          {(channel.name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      {channel.isViral && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white p-0.5 rounded-full border-2 border-white animate-bounce" title={`Viral: ${channel.viralVideoTitle}`}>
                          <AlertCircle size={10} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm truncate max-w-[150px]" title={channel.name}>{channel.name}</h3>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <a href={channel.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center">
                          Link <ExternalLink size={10} className="ml-0.5" />
                        </a>
                        <button onClick={() => setViewingChannel(channel)} className="text-[10px] text-gray-500 hover:text-red-500 flex items-center">
                          Chi tiết <Eye size={10} className="ml-0.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </td>

                <td className="p-4">
                  <div className="text-[11px] space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">Subs:</span> <span className="font-medium text-gray-900">{channel.subscribers ? (channel.subscribers >= 1000000 ? (channel.subscribers / 1000000).toFixed(1) + 'M' : channel.subscribers >= 1000 ? (channel.subscribers / 1000).toFixed(1) + 'K' : channel.subscribers) : 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Vid:</span> <span className="font-medium text-gray-900">{channel.videoCount || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">AvgV:</span> <span className="font-medium text-gray-900">{channel.averageViews >= 1000000 ? (channel.averageViews / 1000000).toFixed(1) + 'M' : channel.averageViews >= 1000 ? (channel.averageViews / 1000).toFixed(1) + 'K' : channel.averageViews}</span></div>
                  </div>
                </td>

                <td className="p-4">
                  <div className="flex items-start justify-between group">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {(channel.topicIds || []).length > 0 ? (
                        (channel.topicIds || []).map(tid => {
                          const topic = topics.find(t => t.id === tid);
                          if (!topic) return null;
                          return (
                            <span key={tid} className="text-[10px] px-1.5 py-0.5 rounded-full text-white whitespace-nowrap" style={{ backgroundColor: topic.color }}>
                              {topic.name}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">
                          {analyzingChannelId === channel.id ? 'Đang phân tích...' : 'Chưa gắn tag'}
                        </span>
                      )}
                    </div>
                    {((channel.topicIds || []).length > 0) && (
                      <button onClick={() => copyTags(channel)} className="opacity-0 group-hover:opacity-100 ml-1 p-1 text-gray-400 hover:text-blue-500 transition-opacity" title="Copy các tag này">
                        {copiedId === channel.id ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                      </button>
                    )}
                  </div>
                </td>

                <td className="p-4 text-center">
                  <div className="flex items-center justify-center space-x-0.5">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star key={star} size={12} className={star <= channel.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"} />
                    ))}
                  </div>
                </td>

                {hasPermission('sources_edit') && (
                  <td className="p-4 text-sm">
                    <div className="flex flex-col gap-1">
                      <select
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-gray-50 focus:ring-1 focus:ring-orange-500 hover:bg-white"
                        value=""
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          const currentArr = channel.allowedStaffIds || [];
                          if (!currentArr.includes(val)) {
                            const newArr = [...currentArr, val];
                            setSourceChannels(prev => prev.map(c => c.id === channel.id ? { ...c, allowedStaffIds: newArr } : c));
                            showToast('Đã thêm nhân viên vào danh sách Share kênh', 'success');
                          }
                        }}
                      >
                        <option value="">+ Thêm quyền xem...</option>
                        {staffList.filter(s => s.role !== 'admin' && !(channel.allowedStaffIds || []).includes(s.id)).map(st => (
                          <option key={st.id} value={st.id}>{st.name}</option>
                        ))}
                      </select>

                      {/* Hiển thị những nhân viên đang được share */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(!channel.allowedStaffIds || channel.allowedStaffIds.length === 0) ? (
                          <span className="text-[10px] text-gray-400 italic bg-gray-100 px-1.5 py-0.5 rounded">Công khai (Tất cả)</span>
                        ) : (
                          channel.allowedStaffIds.map(stId => {
                            const staf = staffList.find(s => s.id === stId);
                            if (!staf) return null;
                            return (
                              <span key={stId} className="flex items-center text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded">
                                {staf.name.split(' ')[0]}
                                <button onClick={() => {
                                  const newArr = channel.allowedStaffIds!.filter(id => id !== stId);
                                  setSourceChannels(prev => prev.map(c => c.id === channel.id ? { ...c, allowedStaffIds: newArr } : c));
                                }} className="ml-1 hover:text-red-500"><X size={10} /></button>
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </td>
                )}

                <td className="p-4">
                  <div className="text-[11px] text-gray-600 line-clamp-3 max-w-[200px]" title={channel.notes}>{channel.notes || '-'}</div>
                </td>

                <td className="p-4 text-right whitespace-nowrap space-x-1">
                  {hasPermission('sources_edit') && (
                    <button onClick={() => handleOpenModal(channel)} className="p-1.5 text-gray-400 hover:bg-orange-50 hover:text-orange-500 rounded transition-colors" title="Sửa kênh">
                      <Edit2 size={14} />
                    </button>
                  )}
                  <button onClick={() => handleViralAlert(channel)} disabled={isCheckingViral && analyzingChannelId === channel.id} className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded transition-colors" title="Check Viral">
                    <AlertCircle size={14} />
                  </button>
                  {hasPermission('sources_edit') && (
                    <button onClick={() => handleDelete(channel.id)} className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors" title="Xoá kênh này">
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filteredChannels.length === 0 && (
              <tr>
                <td colSpan={10} className="p-10 text-center text-gray-500">Không tìm thấy Kênh nguồn nào khớp với bộ lọc.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* View Details Modal */}
      {viewingChannel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-semibold flex items-center">
                <Youtube className="text-red-500 mr-2" /> Chi tiết kênh: {viewingChannel.name}
              </h2>
              <button onClick={() => setViewingChannel(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-6 space-y-8">
              {/* Header Stats */}
              <div className="flex items-start space-x-6">
                {viewingChannel.avatarUrl ? (
                  <img src={viewingChannel.avatarUrl} alt={viewingChannel.name} className="w-24 h-24 rounded-full object-cover border border-gray-200" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-3xl">
                    {(viewingChannel.name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900">{viewingChannel.name}</h1>
                  <a href={viewingChannel.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center mt-1 mb-4">
                    {viewingChannel.url} <ExternalLink size={14} className="ml-1" />
                  </a>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div className="text-xs text-gray-500 mb-1 flex items-center"><Star size={12} className="mr-1" /> Subscribers</div>
                      <div className="font-semibold text-gray-900">{viewingChannel.subscribers?.toLocaleString() || 'N/A'}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div className="text-xs text-gray-500 mb-1 flex items-center"><Eye size={12} className="mr-1" /> Tổng Views</div>
                      <div className="font-semibold text-gray-900">{viewingChannel.totalViews?.toLocaleString() || 'N/A'}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div className="text-xs text-gray-500 mb-1 flex items-center"><Video size={12} className="mr-1" /> Tổng Video</div>
                      <div className="font-semibold text-gray-900">{viewingChannel.videoCount?.toLocaleString() || 'N/A'}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div className="text-xs text-gray-500 mb-1 flex items-center"><Calendar size={12} className="mr-1" /> Ngày lập kênh</div>
                      <div className="font-semibold text-gray-900">{viewingChannel.publishedAt ? new Date(viewingChannel.publishedAt).toLocaleDateString('vi-VN') : 'N/A'}</div>
                    </div>
                  </div>

                  {/* Tags in Detail View */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(viewingChannel.topicIds || []).length > 0 ? (
                      (viewingChannel.topicIds || []).map(tid => {
                        const topic = topics.find(t => t.id === tid);
                        if (!topic) return null;
                        return (
                          <span key={tid} className="text-xs px-3 py-1 rounded-full text-white font-medium" style={{ backgroundColor: topic.color }}>
                            {topic.name}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-sm text-gray-400 italic">Chưa gắn tag chủ đề</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {viewingChannel.notes && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                  <h3 className="text-sm font-semibold text-yellow-800 mb-2">Ghi chú / Điểm mạnh</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewingChannel.notes}</p>
                </div>
              )}

              {/* Top Videos */}
              {viewingChannel.topVideos && viewingChannel.topVideos.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Video phổ biến nhất (Top Views)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {viewingChannel.topVideos.map(video => (
                      <a key={video.id} href={`https://youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" className="block group">
                        <div className="relative aspect-video rounded-lg overflow-hidden mb-2">
                          <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                          {video.duration && (
                            <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                              {formatDuration(video.duration)}
                            </div>
                          )}
                        </div>
                        <h4 className="font-medium text-sm text-gray-900 line-clamp-2 group-hover:text-blue-600">{video.title}</h4>
                        <div className="flex items-center text-xs text-gray-500 mt-1 space-x-2">
                          {video.viewCount && <span>{video.viewCount.toLocaleString()} views</span>}
                          <span>•</span>
                          <span>{new Date(video.publishedAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Latest Videos */}
              {viewingChannel.latestVideos && viewingChannel.latestVideos.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Video mới nhất</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {viewingChannel.latestVideos.map(video => (
                      <a key={video.id} href={`https://youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" className="block group">
                        <div className="relative aspect-video rounded-lg overflow-hidden mb-2">
                          <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                          {video.duration && (
                            <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                              {formatDuration(video.duration)}
                            </div>
                          )}
                        </div>
                        <h4 className="font-medium text-sm text-gray-900 line-clamp-2 group-hover:text-blue-600">{video.title}</h4>
                        <div className="flex items-center text-xs text-gray-500 mt-1 space-x-2">
                          {video.viewCount && <span>{video.viewCount.toLocaleString()} views</span>}
                          <span>•</span>
                          <span>{new Date(video.publishedAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-semibold">{editingChannel ? 'Sửa kênh nguồn' : 'Thêm kênh nguồn mới'}</h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <form id="source-form" onSubmit={handleSubmit} className="space-y-4">
                {fetchError && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-start">
                    <AlertCircle size={14} className="mr-2 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold mb-1">Lỗi lấy dữ liệu:</p>
                      <p>{fetchError}</p>
                      {!youtubeApiKey && (
                        <p className="mt-2 text-[10px] text-red-600 font-medium">
                          Mẹo: Hãy đảm bảo bạn đã thêm API Key trong tab "Cài đặt" và Key đó đang ở trạng thái "Hoạt động".
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL kênh (YouTube)</label>
                    <div className="flex space-x-2">
                      <input type="url" required value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} onBlur={handleFetchInfo} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="https://youtube.com/@handle" />
                      <button type="button" onClick={handleFetchInfo} disabled={isFetching || !formData.url} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-200 disabled:opacity-50 flex items-center">
                        <RefreshCw size={16} className={`mr-1 ${isFetching ? 'animate-spin' : ''}`} /> Lấy TT
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tên kênh</label>
                    <div className="flex items-center space-x-2">
                      {formData.avatarUrl && (
                        <img src={formData.avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-gray-200" referrerPolicy="no-referrer" />
                      )}
                      <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lượt đăng ký (Subscribers)</label>
                    <input type="number" min="0" value={formData.subscribers} onChange={e => setFormData({ ...formData, subscribers: parseInt(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tần suất ra video</label>
                    <input type="text" placeholder="VD: 2 video/tuần, Hàng ngày..." value={formData.uploadFrequency} onChange={e => setFormData({ ...formData, uploadFrequency: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">View trung bình / video</label>
                    <input type="number" min="0" value={formData.averageViews} onChange={e => setFormData({ ...formData, averageViews: parseInt(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Đánh giá chất lượng nguồn (1-5 sao)</label>
                    <div className="flex space-x-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star} type="button"
                          onClick={() => setFormData({ ...formData, rating: star })}
                          className="p-1 focus:outline-none"
                        >
                          <Star size={24} className={star <= formData.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">Chủ đề</label>
                    <button
                      type="button"
                      onClick={() => handleAITagging()}
                      disabled={isAIAnalyzing || !formData.description}
                      className="text-xs flex items-center text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
                    >
                      <Sparkles size={12} className="mr-1" /> AI Gợi ý tag
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topics.map(topic => (
                      <button
                        key={topic.id} type="button" onClick={() => toggleTopic(topic.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${formData.topicIds.includes(topic.id) ? 'border-transparent text-white' : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                          }`}
                        style={formData.topicIds.includes(topic.id) ? { backgroundColor: topic.color } : {}}
                      >
                        {topic.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú / Điểm mạnh của kênh này</label>
                  <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" rows={3} placeholder="VD: Kênh này làm thumbnail rất đẹp, content dễ re-up..." />
                </div>
              </form>
            </div>
            <div className="p-4 border-t border-gray-100 shrink-0 flex justify-end space-x-3 bg-gray-50">
              <button type="button" onClick={handleCloseModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors">Hủy</button>
              <button type="submit" form="source-form" className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors">Lưu kênh nguồn</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
