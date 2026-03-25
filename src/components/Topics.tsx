import React, { useState, useMemo } from 'react';
import { Plus, Search, Layers, Download } from 'lucide-react';
import { TopicCard } from './topics/TopicCard';
import { TopicModal } from './topics/TopicModal';
import { TopicFilters } from './topics/TopicFilters';
import { Topic, Staff, DEFAULT_NICHES, Channel, SourceChannel } from '../types';
import { supabase } from '../lib/supabase';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import * as XLSX from 'xlsx';

interface TopicsProps {
  topics: Topic[];
  setTopics: React.Dispatch<React.SetStateAction<Topic[]>>;
  staffList: Staff[];
  channels: Channel[];
  sourceChannels: SourceChannel[];
  youtubeApiKey: string;
}

export function Topics({ topics = [], setTopics, staffList, channels, sourceChannels, youtubeApiKey }: TopicsProps) {
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('All');
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);

  const countries = useMemo(() => {
    if (!Array.isArray(topics)) return ['All'];
    const uniqueCountries = Array.from(new Set(topics.map(t => t.country || 'Vietnam')));
    return ['All', ...uniqueCountries.sort()];
  }, [topics]);

  const filteredTopics = useMemo(() => {
    if (!Array.isArray(topics)) return [];
    return topics.filter(topic => {
      const name = topic.name || '';
      const description = topic.description || '';
      const tags = topic.tags || [];
      const hashtags = topic.hashtags || [];
      const country = topic.country || 'Vietnam';

      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        hashtags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCountry = countryFilter === 'All' || country === countryFilter;

      return matchesSearch && matchesCountry;
    });
  }, [topics, searchQuery, countryFilter]);

  const handleOpenModal = (topic?: Topic) => {
    if (topic) {
      setEditingTopic(topic);
    } else {
      setEditingTopic(null);
    }
    setIsModalOpen(true);
  };

  const handleModalSubmit = (formData: Omit<Topic, 'id'>) => {
    if (editingTopic) {
      setTopics(topics.map(t => t.id === editingTopic.id ? { ...t, ...formData } : t));
      showToast('Đã cập nhật chủ đề thành công!', 'success');
    } else {
      setTopics([...topics, { id: Date.now().toString(), ...formData }]);
      showToast('Đã thêm chủ đề mới thành công!', 'success');
    }
    setIsModalOpen(false);
    setEditingTopic(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa chủ đề này?')) {
      setTopics(topics.filter(t => t.id !== id));
      
      const { error } = await supabase.from('topics').delete().eq('id', id);
      if (error) {
        showToast(`Lỗi xóa trên server: ${error.message}`, 'error');
      } else {
        showToast('Đã xóa chủ đề.', 'info');
      }
    }
  };

  const handleExport = () => {
    if (filteredTopics.length === 0) return;
    const exportData = filteredTopics.map(t => ({
      'Tên chủ đề': t.name || '',
      'Nhóm CĐ (Niche)': t.niche || 'Khác',
      'Quốc gia': t.country || 'Vietnam',
      'Mô tả': t.description || '',
      'Tags': (t.tags || []).join(', '),
      'Hashtags': (t.hashtags || []).join(', ')
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Topics');
    XLSX.writeFile(wb, `DanhSachChuDe_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(`Đã xuất ${filteredTopics.length} chủ đề ra file Excel`, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Chủ đề</h1>
          <p className="text-sm text-gray-500 mt-1">Nghiên cứu và lưu trữ thông tin ngách chi tiết</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExport} disabled={filteredTopics.length === 0} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors disabled:opacity-50 self-start md:self-center">
            <Download size={16} className="mr-2" /> Xuất Excel
          </button>
          {hasPermission('topics_edit') && (
            <button
              onClick={() => handleOpenModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors shadow-sm self-start md:self-center"
            >
              <Plus size={16} className="mr-2" /> Thêm chủ đề
            </button>
          )}
        </div>
      </div>

      <TopicFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        countryFilter={countryFilter}
        setCountryFilter={setCountryFilter}
        countries={countries}
      />

      <div className="space-y-8">
        {Object.entries(
          filteredTopics.reduce((acc, topic) => {
            const niche = topic.niche || 'Khác';
            if (!acc[niche]) acc[niche] = [];
            acc[niche].push(topic);
            return acc;
          }, {} as Record<string, Topic[]>)
        ).sort((a, b) => {
          if (a[0] === 'Khác') return 1;
          if (b[0] === 'Khác') return -1;
          return a[0].localeCompare(b[0]);
        }).map(([niche, nicheTopics]) => (
          <div key={niche} className="bg-white p-6 rounded-xl border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center justify-between">
              <span>{niche}</span>
              <span className="text-sm font-medium bg-gray-100 text-gray-500 px-3 py-1 rounded-full">{nicheTopics.length} chủ đề</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {nicheTopics.map(topic => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  onEdit={handleOpenModal}
                  onDelete={handleDelete}
                  isExpanded={expandedTopicId === topic.id}
                  onToggleExpand={() => setExpandedTopicId(expandedTopicId === topic.id ? null : topic.id)}
                  staffList={staffList}
                />
              ))}
            </div>
          </div>
        ))}

        {filteredTopics.length === 0 && (
          <div className="col-span-full text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search size={32} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Không tìm thấy chủ đề nào</h3>
            <p className="text-gray-500 max-w-xs mx-auto mt-1">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc quốc gia của bạn.</p>
          </div>
        )}
      </div>

      <TopicModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        editingTopic={editingTopic}
        staffList={staffList}
        channels={channels}
        sourceChannels={sourceChannels}
        youtubeApiKey={youtubeApiKey}
      />
    </div>
  );
}
