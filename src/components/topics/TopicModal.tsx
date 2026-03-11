import React, { useState, useEffect } from 'react';
import { Topic, DEFAULT_NICHES, Staff } from '../../types';
import { X, Layers, Info, Globe, Tag, Plus, Target, Users } from 'lucide-react';

interface TopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (topic: Omit<Topic, 'id'>) => void;
  editingTopic: Topic | null;
  staffList: Staff[];
}

export function TopicModal({ isOpen, onClose, onSubmit, editingTopic, staffList }: TopicModalProps) {
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
    assignees: []
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
        assignees: editingTopic.assignees || []
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
        assignees: []
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
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center">
              <Tag size={16} className="mr-2 text-purple-500" /> Tags & Hashtags
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bộ 20 Tags (SEO)</label>
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
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">10 Hashtags phổ biến</label>
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
