import React, { useState, useMemo } from 'react';
import { Plus, Search, Layers, Download, Upload, LayoutGrid, List } from 'lucide-react';
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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
    const normalizedNewName = (formData.name || '').trim().toLowerCase();
    const isDup = topics.some(t => (t.name || '').trim().toLowerCase() === normalizedNewName && t.id !== editingTopic?.id);
    
    if (isDup) {
      showToast(`Chủ đề "${formData.name}" đã tồn tại! Vui lòng chọn tên khác.`, 'error');
      return;
    }

    if (editingTopic) {
      setTopics(topics.map(t => t.id === editingTopic.id ? { ...t, ...formData } : t));
      showToast('Đã cập nhật chủ đề thành công!', 'success');
    } else {
      setTopics([...topics, { id: crypto.randomUUID(), ...formData }]);
      showToast('Đã thêm chủ đề mới thành công!', 'success');
    }
    setIsModalOpen(false);
    setEditingTopic(null);
  };

  const handleDelete = async (id: string) => {
    if (!hasPermission('topics_edit')) {
      showToast('Bạn không có quyền xóa chủ đề.', 'error');
      return;
    }
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

  const handleBulkDelete = async () => {
    if (!hasPermission('topics_edit')) {
      showToast('Bạn không có quyền xóa chủ đề.', 'error');
      return;
    }
    if (confirm(`Bạn có chắc muốn xóa ${selectedIds.length} chủ đề đã chọn?`)) {
      setTopics(topics.filter(t => !selectedIds.includes(t.id)));
      const { error } = await supabase.from('topics').delete().in('id', selectedIds);
      if (error) {
        showToast(`Lỗi xóa: ${error.message}`, 'error');
      } else {
        showToast(`Đã xóa ${selectedIds.length} chủ đề`, 'info');
      }
      setSelectedIds([]);
    }
  };

  const handleExport = () => {
    const topicsToExport = selectedIds.length > 0 
      ? filteredTopics.filter(t => selectedIds.includes(t.id))
      : filteredTopics;

    if (topicsToExport.length === 0) return;
    const exportData = topicsToExport.map(t => ({
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
    showToast(`Đã xuất ${topicsToExport.length} chủ đề ra file Excel`, 'success');
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        let successCount = 0;
        let duplicateCount = 0;
        let errorCount = 0;

        for (const row of data) {
          const name = row['Tên chủ đề'] || row.name || '';
          if (!name) continue;

          const normalizedName = name.trim().toLowerCase();
          const isDup = topics.some(t => (t.name || '').trim().toLowerCase() === normalizedName);

          if (isDup) {
            duplicateCount++;
            continue;
          }

          const newTopic: Topic = {
            id: crypto.randomUUID(),
            name: name.trim(),
            niche: row['Nhóm CĐ (Niche)'] || row.niche || 'Khác',
            country: row['Quốc gia'] || row.country || 'Vietnam',
            description: row['Mô tả'] || row.description || '',
            tags: (row['Tags'] || row.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean),
            hashtags: (row['Hashtags'] || row.hashtags || '').split(',').map((t: string) => t.trim()).filter(Boolean),
            color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
          };

          // Direct upsert vào Supabase ngay lập tức (tránh mất data)
          try {
            const dbPayload = {
              id: newTopic.id,
              name: newTopic.name,
              niche: newTopic.niche,
              country: newTopic.country,
              description: newTopic.description,
              tags: newTopic.tags,
              hashtags: newTopic.hashtags,
              color: newTopic.color,
            };
            const { error } = await supabase.from('topics').upsert(dbPayload, { onConflict: 'id' });
            if (error) {
              console.error(`❌ Lỗi lưu topic "${newTopic.name}":`, error.message);
              errorCount++;
              continue;
            }
          } catch (dbErr) {
            console.error(`❌ Lỗi DB topic "${newTopic.name}":`, dbErr);
            errorCount++;
            continue;
          }

          // Cập nhật state local ngay lập tức (hiển thị trên UI)
          setTopics(prev => [...prev, newTopic]);
          successCount++;
        }

        let message = `Nhập hoàn tất: Đã thêm ${successCount} chủ đề mới.`;
        if (duplicateCount > 0) message += ` (Bỏ qua ${duplicateCount} trùng lặp)`;
        if (errorCount > 0) message += ` (${errorCount} lỗi DB)`;
        showToast(message, successCount > 0 ? 'success' : 'info');
      } catch (err) {
        showToast('Lỗi khi đọc file Excel. Vui lòng kiểm tra lại định dạng.', 'error');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Chủ đề</h1>
          <p className="text-sm text-gray-500 mt-1">Nghiên cứu và lưu trữ thông tin ngách chi tiết</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex bg-gray-100 p-1 rounded-lg mr-2">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`} title="Hiển thị dạng Lưới">
              <LayoutGrid size={18} />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`} title="Hiển thị dạng Danh sách">
              <List size={18} />
            </button>
          </div>
          {selectedIds.length > 0 && hasPermission('topics_edit') && (
            <button onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors shadow-sm self-start md:self-center">
              Xóa {selectedIds.length} chủ đề
            </button>
          )}
          <button onClick={handleExport} disabled={filteredTopics.length === 0} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors disabled:opacity-50 self-start md:self-center">
            <Download size={16} className="mr-2" /> Xuất Excel
          </button>
          {hasPermission('topics_edit') && (
            <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors shadow-sm self-start md:self-center cursor-pointer">
              <Upload size={16} className="mr-2" /> Nhập Excel
              <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleBulkImport} />
            </label>
          )}
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
            {viewMode === 'grid' ? (
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
                    isSelected={selectedIds.includes(topic.id)}
                    onSelectToggle={() => {
                      if (selectedIds.includes(topic.id)) {
                        setSelectedIds(prev => prev.filter(id => id !== topic.id));
                      } else {
                        setSelectedIds(prev => [...prev, topic.id]);
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 w-10">
                        <input type="checkbox" checked={nicheTopics.length > 0 && nicheTopics.every(t => selectedIds.includes(t.id))} onChange={(e) => {
                          if (e.target.checked) {
                            const newIds = nicheTopics.map(t => t.id).filter(id => !selectedIds.includes(id));
                            setSelectedIds(prev => [...prev, ...newIds]);
                          } else {
                            setSelectedIds(prev => prev.filter(id => !nicheTopics.find(t => t.id === id)));
                          }
                        }} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4" />
                      </th>
                      <th className="px-4 py-3">Tên chủ đề</th>
                      <th className="px-4 py-3">Quốc gia</th>
                      <th className="px-4 py-3 hidden md:table-cell">Mô tả</th>
                      <th className="px-4 py-3 hidden lg:table-cell">Tags</th>
                      <th className="px-4 py-3 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {nicheTopics.map(topic => (
                      <tr key={topic.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selectedIds.includes(topic.id)} onChange={() => {
                            if (selectedIds.includes(topic.id)) {
                              setSelectedIds(prev => prev.filter(id => id !== topic.id));
                            } else {
                              setSelectedIds(prev => [...prev, topic.id]);
                            }
                          }} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center font-medium text-gray-900">
                            <span className="w-3 h-3 rounded-full mr-2 shadow-sm" style={{ backgroundColor: topic.color }}></span>
                            {topic.name}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-xs font-medium border border-gray-200">
                            {topic.country || 'Vietnam'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 max-w-xs truncate hidden md:table-cell" title={topic.description}>{topic.description || '--'}</td>
                        <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate hidden lg:table-cell">
                          <div className="flex gap-1 flex-wrap">
                             {(topic.tags || []).slice(0, 3).map(tag => (
                                <span key={tag} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{tag}</span>
                             ))}
                             {(topic.tags || []).length > 3 && <span className="text-[10px] text-gray-400">+{topic.tags!.length - 3}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            {hasPermission('topics_edit') && (
                              <>
                                <button onClick={() => handleOpenModal(topic)} className="text-blue-600 hover:text-blue-800 text-xs font-medium underline">Sửa</button>
                                <button onClick={() => handleDelete(topic.id)} className="text-red-600 hover:text-red-800 text-xs font-medium underline">Xóa</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
