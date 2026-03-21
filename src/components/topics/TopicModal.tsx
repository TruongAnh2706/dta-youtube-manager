import React, { useState, useEffect } from 'react';
import { Topic, DEFAULT_NICHES, Staff, Channel, SourceChannel } from '../../types';
import { X, Layers, Info, Globe, Tag, Plus, Target, Users, Clock, RefreshCw, Copy } from 'lucide-react';
import { fetchYoutubeChannelInfo, sleep } from '../../services/youtube';

interface TopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (topic: Omit<Topic, 'id'>) => void;
  editingTopic: Topic | null;
  staffList: Staff[];
  channels: Channel[];
  sourceChannels: SourceChannel[];
  youtubeApiKey: string;
}

export function TopicModal({ isOpen, onClose, onSubmit, editingTopic, staffList, channels, sourceChannels, youtubeApiKey }: TopicModalProps) {
  const [formData, setFormData] = useState<Omit<Topic, 'id'>>({
    name: '',
    description: '',
    color: '#3b82f6',
    tags: [],
    hashtags: [],
    country: 'Vietnam',
    targetAudience: '',
    contentStrategy: '',
    difficultyLevel: 'medium',
    monetizationPotential: 'medium',
    competitionLevel: 'medium',
    niche: '',
    assignees: [],
    defaultSchedules: []
  });

  const [tagInput, setTagInput] = useState('');
  const [hashtagInput, setHashtagInput] = useState('');

  useEffect(() => {
    if (editingTopic) {
      setFormData({
        name: editingTopic.name,
        description: editingTopic.description,
        color: editingTopic.color,
        tags: editingTopic.tags || [],
        hashtags: editingTopic.hashtags || [],
        country: editingTopic.country || 'Vietnam',
        targetAudience: editingTopic.targetAudience || '',
        contentStrategy: editingTopic.contentStrategy || '',
        difficultyLevel: editingTopic.difficultyLevel || 'medium',
        monetizationPotential: editingTopic.monetizationPotential || 'medium',
        competitionLevel: editingTopic.competitionLevel || 'medium',
        niche: editingTopic.niche || '',
        assignees: editingTopic.assignees || [],
        defaultSchedules: editingTopic.defaultSchedules || []
      });
    } else {
      setFormData({
        name: '',
        description: '',
        color: '#3b82f6',
        tags: [],
        hashtags: [],
        country: 'Vietnam',
        targetAudience: '',
        contentStrategy: '',
        difficultyLevel: 'medium',
        monetizationPotential: 'medium',
        competitionLevel: 'medium',
        niche: '',
        assignees: [],
        defaultSchedules: []
      });
    }
  }, [editingTopic, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tagToRemove) });
  };

  const addHashtag = () => {
    let clean = hashtagInput.trim();
    if (clean.startsWith('#')) clean = clean.substring(1);
    if (clean && !formData.hashtags.includes(clean)) {
      setFormData({ ...formData, hashtags: [...formData.hashtags, clean] });
      setHashtagInput('');
    }
  };

  const removeHashtag = (tagToRemove: string) => {
    setFormData({ ...formData, hashtags: formData.hashtags.filter(t => t !== tagToRemove) });
  };

  const [isFetchingTags, setIsFetchingTags] = useState(false);
  const [scanProgress, setScanProgress] = useState<{current: number, total: number, channelName: string, tagsFound: number, hashtagsFound: number} | null>(null);

  // Auto quét Tag từ các kênh
  const fetchTagsFromChannels = async () => {
    if (!editingTopic || !editingTopic.id) {
       alert("Vui lòng lưu chủ đề này trước rồi mới quét được kênh đối thủ (vì chủ đề mới chưa liên kết kênh nào).");
       return;
    }
    
    // Đã đính chính: Tìm kênh Nguồn/Đối thủ (sourceChannels)
    const topicChannels = sourceChannels.filter(c => c.topicIds && c.topicIds.includes(editingTopic.id));
    if (topicChannels.length === 0) {
       alert("Chủ đề này hiện chưa có kênh đối thủ / kênh nguồn nào. Bạn cần vào tab Kênh Nguồn để gán kênh vào chủ đề trước.");
       return;
    }

    if (!youtubeApiKey) {
       alert("Lỗi: Không tìm thấy Youtube API Key. Vui lòng cài đặt tại Settings.");
       return;
    }

    setIsFetchingTags(true);
    
    // Sử dụng Map để đếm tần suất thay vì Set
    let tagCounts = new Map<string, number>();
    let hashtagCounts = new Map<string, number>();
    let tempTagsFound = 0;
    let tempHashtagsFound = 0;

    setScanProgress({ current: 0, total: topicChannels.length, channelName: 'Đang khởi tạo...', tagsFound: 0, hashtagsFound: 0 });
    
    try {
      for (let i = 0; i < topicChannels.length; i++) {
         const channel = topicChannels[i];
         if (!channel.url) continue;
         
         setScanProgress({ 
            current: i + 1, 
            total: topicChannels.length, 
            channelName: channel.name, 
            tagsFound: tempTagsFound, 
            hashtagsFound: tempHashtagsFound 
         });

         try {
           const info = await fetchYoutubeChannelInfo(channel.url, youtubeApiKey, false);
           if (info.channelKeywords) {
             const keywords = info.channelKeywords.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
             keywords.forEach(k => {
               const kw = k.replace(/"/g, '').trim();
               if (kw) {
                 tagCounts.set(kw, (tagCounts.get(kw) || 0) + 1);
                 tempTagsFound++;
               }
             });
           }
           
           const allScannedVideos = [...(info.latestVideos || []), ...(info.topVideos || [])];
           
           allScannedVideos.forEach(v => {
             // Thêm Tag, đếm tần suất
             if (v.tags) {
                v.tags.forEach(t => {
                   const tw = t.trim();
                   if (tw) {
                     tagCounts.set(tw, (tagCounts.get(tw) || 0) + 1);
                     tempTagsFound++;
                   }
                });
             }
             
             // Parse Hashtag từ mô tả và phân tích tiêu đề (Hỗ trợ Unicode Đa Ngôn Ngữ)
             const fullTextContext = (v.description + " " + v.title).replace(/\n/g, ' ');
             // Sử dụng \p{L} cho các chữ cái (Letters) đa ngôn ngữ, \p{N} cho số, hỗ trợ tiếng Việt, Nhật, Hàn...
             const hashMatches = fullTextContext.match(/#[\p{L}\p{N}_]+/gu);
             
             if (hashMatches) {
               hashMatches.forEach((h: string) => {
                 const cleanH = h.substring(1).toLowerCase(); // Không cần dùng replace ASCII nữa vì regex /#[\p{L}\p{N}_]+/gu đã tự động loại bỏ punctuation
                 if (cleanH.length > 2) { // Hashtag phải dài hơn 2 ký tự
                   hashtagCounts.set(cleanH, (hashtagCounts.get(cleanH) || 0) + 1);
                   tempHashtagsFound++;
                 }
               });
             }
           });
           
           await sleep(1000); // Tránh rate limit
         } catch (e) {
           console.log("Lỗi khi quét kênh", channel.name, e);
         }
      }
      
      // Sort tags and hashtags by frequency (descending)
      const sortedTags = Array.from(tagCounts.entries())
                              .sort((a, b) => b[1] - a[1])
                              .map(e => e[0]);
      
      const sortedHashtags = Array.from(hashtagCounts.entries())
                                  .sort((a, b) => b[1] - a[1])
                                  .map(e => e[0]);

      // Merge avoiding duplicates and keep under limits
      const finalTags = [...formData.tags];
      for (const t of sortedTags) {
         if (!finalTags.includes(t)) finalTags.push(t);
         if (finalTags.length >= 30) break;
      }

      const finalHashtags = [...formData.hashtags];
      for (const h of sortedHashtags) {
         if (!finalHashtags.includes(h)) finalHashtags.push(h);
         if (finalHashtags.length >= 20) break;
      }
      
      setFormData({ 
        ...formData, 
        tags: finalTags,
        hashtags: finalHashtags
      });
      alert(`Đã quét xong! Phân tích hàng trăm từ khóa và đã nạp thành công ${finalTags.length - formData.tags.length} Tag xịn nhất cùng ${finalHashtags.length - formData.hashtags.length} Hashtag phổ biến nhất (Đã lọc tần suất).`);
      
    } catch (error) {
       alert("Có lỗi xảy ra: " + error);
    } finally {
       setIsFetchingTags(false);
       setScanProgress(null);
    }
  };

  const copyTags = () => {
    if (formData.tags.length === 0) return;
    navigator.clipboard.writeText(formData.tags.join(', '));
    alert('Đã copy Tags vào Clipboard!');
  };

  const copyHashtags = () => {
    if (formData.hashtags.length === 0) return;
    navigator.clipboard.writeText(formData.hashtags.map(h => `#${h}`).join(' '));
    alert('Đã copy Hashtags vào Clipboard!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Layers size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{editingTopic ? 'Cập nhật chủ đề' : 'Thêm chủ đề mới'}</h2>
              <p className="text-xs text-gray-500">Điền thông tin chi tiết để tối ưu hóa nghiên cứu ngách</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <form id="topic-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Basic Info */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center">
              <Info size={16} className="mr-2 text-blue-500" /> Thông tin cơ bản
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tên chủ đề</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                  placeholder="VD: Tài chính cá nhân cho Gen Z"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quốc gia</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    required
                    value={formData.country}
                    onChange={e => setFormData({ ...formData, country: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                    placeholder="VD: Vietnam, USA..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Thị trường ngách (Niche)</label>
                <select
                  value={formData.niche}
                  onChange={e => setFormData({ ...formData, niche: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 text-sm"
                >
                  <option value="">Chọn một ngách (Tùy chọn)</option>
                  {DEFAULT_NICHES.map(niche => (
                    <option key={niche} value={niche}>{niche}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Màu sắc nhận diện</label>
                <div className="flex items-center space-x-3 bg-gray-50/50 border border-gray-200 rounded-xl px-3 py-2">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                    className="h-8 w-8 rounded cursor-pointer border-0 p-0"
                  />
                  <span className="text-sm font-mono text-gray-500">{formData.color}</span>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mô tả tổng quan</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                rows={3}
                placeholder="Tóm tắt về chủ đề, xu hướng hiện tại..."
              />
            </div>
          </section>

          {/* Tags & Hashtags */}
          <section className="space-y-4 relative">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 flex items-center">
                <Tag size={16} className="mr-2 text-purple-500" /> Tags & Hashtags
              </h3>
              <div className="flex items-center gap-3">
                {isFetchingTags && scanProgress && (
                  <div className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100 flex items-center animate-pulse">
                     <span className="mr-2 border-r border-purple-200 pr-2">Quét {scanProgress.current}/{scanProgress.total}</span>
                     <span className="text-gray-500 font-normal truncate max-w-[150px]" title={scanProgress.channelName}>{scanProgress.channelName}</span>
                  </div>
                )}
                {editingTopic && editingTopic.id && (
                  <button
                    type="button"
                    onClick={fetchTagsFromChannels}
                    disabled={isFetchingTags}
                    className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center transition-colors shadow-sm disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={`mr-1.5 ${isFetchingTags ? 'animate-spin' : ''}`} />
                    {isFetchingTags ? 'Đang quét API...' : 'Quét từ Kênh Đối thủ'}
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase">Bộ 20 Tags (SEO)</label>
                  {formData.tags.length > 0 && (
                    <button type="button" onClick={copyTags} className="text-blue-500 hover:text-blue-700 text-xs font-bold flex items-center transition-colors">
                      <Copy size={12} className="mr-1" /> Copy
                    </button>
                  )}
                </div>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Thêm tag..."
                  />
                  <button type="button" onClick={addTag} className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg transition-colors">
                    <Plus size={18} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-gray-50 rounded-xl border border-gray-100">
                  {formData.tags.map(tag => (
                    <span key={tag} className="flex items-center px-2 py-1 bg-white border border-gray-200 text-gray-600 rounded text-xs group">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="ml-1.5 text-gray-300 hover:text-red-500">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {formData.tags.length === 0 && <span className="text-xs text-gray-400 p-1">Chưa có tag nào</span>}
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">Gợi ý: {formData.tags.length}/20 tags</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase">10 Hashtags phổ biến</label>
                  {formData.hashtags.length > 0 && (
                    <button type="button" onClick={copyHashtags} className="text-blue-500 hover:text-blue-700 text-xs font-bold flex items-center transition-colors">
                      <Copy size={12} className="mr-1" /> Copy
                    </button>
                  )}
                </div>
                <div className="flex gap-2 mb-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">#</span>
                    <input
                      type="text"
                      value={hashtagInput}
                      onChange={e => setHashtagInput(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addHashtag())}
                      className="w-full border border-gray-200 rounded-lg pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Hashtag..."
                    />
                  </div>
                  <button type="button" onClick={addHashtag} className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg transition-colors">
                    <Plus size={18} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-gray-50 rounded-xl border border-gray-100">
                  {formData.hashtags.map(tag => (
                    <span key={tag} className="flex items-center px-2 py-1 bg-white border border-gray-200 text-purple-600 rounded text-xs">
                      #{tag}
                      <button type="button" onClick={() => removeHashtag(tag)} className="ml-1.5 text-gray-300 hover:text-red-500">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {formData.hashtags.length === 0 && <span className="text-xs text-gray-400 p-1">Chưa có hashtag nào</span>}
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">Gợi ý: {formData.hashtags.length}/10 hashtags</p>
              </div>
            </div>
          </section>

          {/* Strategy & Analysis */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center">
              <Target size={16} className="mr-2 text-emerald-500" /> Chiến lược & Phân tích
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Độ khó triển khai</label>
                <select
                  value={formData.difficultyLevel}
                  onChange={e => setFormData({ ...formData, difficultyLevel: e.target.value as any })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 text-sm"
                >
                  <option value="easy">Dễ (Easy)</option>
                  <option value="medium">Trung bình (Medium)</option>
                  <option value="hard">Khó (Hard)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tiềm năng kiếm tiền</label>
                <select
                  value={formData.monetizationPotential}
                  onChange={e => setFormData({ ...formData, monetizationPotential: e.target.value as any })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 text-sm"
                >
                  <option value="low">Thấp (Low)</option>
                  <option value="medium">Trung bình (Medium)</option>
                  <option value="high">Cao (High)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mức độ cạnh tranh</label>
                <select
                  value={formData.competitionLevel}
                  onChange={e => setFormData({ ...formData, competitionLevel: e.target.value as any })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 text-sm"
                >
                  <option value="low">Thấp (Low)</option>
                  <option value="medium">Trung bình (Medium)</option>
                  <option value="high">Cao (High)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Đối tượng khán giả mục tiêu</label>
              <input
                type="text"
                value={formData.targetAudience}
                onChange={e => setFormData({ ...formData, targetAudience: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 text-sm"
                placeholder="VD: Học sinh sinh viên, Nhà đầu tư mới, Nội trợ..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Chiến lược nội dung chi tiết</label>
              <textarea
                value={formData.contentStrategy}
                onChange={e => setFormData({ ...formData, contentStrategy: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 text-sm"
                rows={4}
                placeholder="Kế hoạch phát triển nội dung, phong cách video, tần suất đăng..."
              />
            </div>
            
            {/* Lịch đăng mẫu (Default Schedules) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center">
                  <Clock size={16} className="mr-2 text-indigo-500" />
                  Lịch đăng video mẫu (Định kỳ)
                </label>
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    defaultSchedules: [...(formData.defaultSchedules || []), { time: '18:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }]
                  })}
                  className="flex items-center text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-200 transition-colors"
                >
                  <Plus size={14} className="mr-1" /> Thêm khung giờ
                </button>
              </div>
              
              <div className="space-y-3">
                {formData.defaultSchedules?.map((schedule, index) => (
                  <div key={index} className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 shadow-sm relative group">
                    <button
                      type="button"
                      onClick={() => {
                        const newSchedules = formData.defaultSchedules!.filter((_, i) => i !== index);
                        setFormData({ ...formData, defaultSchedules: newSchedules });
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md z-10 hover:bg-red-600 transition-colors cursor-pointer"
                      title="Xóa lịch đăng này"
                    >
                      <X size={14} />
                    </button>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Giờ đăng (HH:mm)</label>
                        <input
                          type="time"
                          value={schedule.time}
                          onChange={e => {
                            const newSchedules = [...formData.defaultSchedules!];
                            newSchedules[index] = { ...schedule, time: e.target.value };
                            setFormData({ ...formData, defaultSchedules: newSchedules });
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-indigo-500 text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Các ngày trong tuần</label>
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
                                const newSchedules = [...formData.defaultSchedules!];
                                newSchedules[index] = { ...schedule, days: newDays };
                                setFormData({ ...formData, defaultSchedules: newSchedules });
                              }}
                              className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors ${schedule.days.includes(day)
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-gray-400 border-gray-200 hover:border-indigo-300'
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
                {(!formData.defaultSchedules || formData.defaultSchedules.length === 0) && (
                  <div className="text-[11px] text-gray-500 italic p-3 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-center">
                    Chưa có lịch đăng mẫu nào được thiết lập.
                  </div>
                )}
              </div>
            </div>

            {/* Phân công nhân sự */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Phân công Nhân sự phụ trách (Assignees)</label>
              <div className="bg-gray-50/50 border border-gray-200 rounded-xl p-4 max-h-[160px] overflow-y-auto">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {staffList.map((staff) => (
                    <label key={staff.id} className="flex items-center space-x-3 bg-white p-2 rounded-lg border border-gray-100 cursor-pointer hover:border-blue-300 transition-colors">
                      <input
                        type="checkbox"
                        checked={(formData.assignees || []).includes(staff.id)}
                        onChange={(e) => {
                          const newAssignees = e.target.checked
                            ? [...(formData.assignees || []), staff.id]
                            : (formData.assignees || []).filter(id => id !== staff.id);
                          setFormData({ ...formData, assignees: newAssignees });
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-700">{staff.name}</span>
                        <span className="text-[10px] text-gray-400 capitalize">{staff.role}</span>
                      </div>
                    </label>
                  ))}
                  {staffList.length === 0 && (
                    <div className="col-span-full text-sm text-gray-500 text-center py-2">
                      Hiện chưa có nhân sự nào trong hệ thống.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </form>

        <div className="p-6 border-t border-gray-100 shrink-0 flex justify-end space-x-3 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition-all"
          >
            Hủy
          </button>
          <button
            type="submit"
            form="topic-form"
            className="px-8 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-200"
          >
            {editingTopic ? 'Cập nhật chủ đề' : 'Thêm chủ đề mới'}
          </button>
        </div>
      </div>
    </div>
  );
}
