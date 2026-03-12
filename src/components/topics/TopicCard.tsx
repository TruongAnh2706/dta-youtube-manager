import React from 'react';
import { Topic, Staff } from '../../types';
import { Edit2, Trash2, Globe, Target, BarChart3, ChevronUp, ChevronDown, Lightbulb, Tag, Hash } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

interface TopicCardProps {
  topic: Topic;
  onEdit: (topic: Topic) => void;
  onDelete: (id: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  staffList: Staff[];
}

export function TopicCard({ topic, onEdit, onDelete, isExpanded, onToggleExpand, staffList }: TopicCardProps) {
  const { hasPermission } = usePermissions();
  // Defensive checks for missing arrays
  const tags = topic.tags || [];
  const hashtags = topic.hashtags || [];

  return (
    <div 
      className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md"
      style={{ border: `2px solid ${topic.color}`, borderTopWidth: '6px' }}
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: topic.color }}></div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">{topic.name}</h3>
              <div className="flex items-center text-xs text-gray-500 mt-0.5">
                <Globe size={12} className="mr-1" /> {topic.country || 'Vietnam'}
              </div>
            </div>
          </div>
          {hasPermission('topics_edit') && (
            <div className="flex space-x-2">
              <button onClick={() => onEdit(topic)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                <Edit2 size={16} />
              </button>
              <button onClick={() => onDelete(topic.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
        
        <p className="text-sm text-gray-600 line-clamp-2 mb-4">{topic.description}</p>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-[10px] uppercase font-bold text-gray-400 mb-1 flex items-center">
              <Target size={10} className="mr-1" /> Đối tượng
            </div>
            <p className="text-xs text-gray-700 font-medium truncate">{topic.targetAudience || 'Chưa xác định'}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-[10px] uppercase font-bold text-gray-400 mb-1 flex items-center">
              <BarChart3 size={10} className="mr-1" /> Cạnh tranh
            </div>
            <p className="text-xs text-gray-700 font-medium capitalize">{topic.competitionLevel || 'medium'}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {tags.slice(0, 5).map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">#{tag}</span>
          ))}
          {tags.length > 5 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-medium">+{tags.length - 5}</span>
          )}
        </div>

        {/* Start Assignees Section */}
        {topic.assignees && topic.assignees.length > 0 && (
          <div className="mb-4 flex items-center gap-1 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-gray-400 mr-1">Nhân sự:</span>
            {topic.assignees.map(staffId => {
              const staff = staffList.find(s => s.id === staffId);
              if (!staff) return null;
              return (
                <div key={staff.id} className="w-6 h-6 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-[10px] font-bold text-blue-700 tooltip">
                  {staff.name.charAt(0).toUpperCase()}
                </div>
              );
            })}
          </div>
        )}
        {/* End Assignees Section */}

        <button 
          onClick={onToggleExpand}
          className="w-full py-2 text-xs font-semibold text-gray-500 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-all flex items-center justify-center border border-gray-100"
        >
          {isExpanded ? (
            <>Thu gọn <ChevronUp size={14} className="ml-1" /></>
          ) : (
            <>Xem chi tiết <ChevronDown size={14} className="ml-1" /></>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="px-5 pb-5 pt-2 border-t border-gray-50 bg-gray-50/30 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center">
              <Lightbulb size={12} className="mr-1 text-yellow-500" /> Chiến lược nội dung
            </h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{topic.contentStrategy || 'Chưa có chiến lược cụ thể.'}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center">
                <Tag size={12} className="mr-1 text-blue-500" /> Bộ 20 Tags
              </h4>
              <div className="flex flex-wrap gap-1">
                {tags.map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 bg-white border border-gray-200 text-gray-600 rounded text-[10px]">{tag}</span>
                ))}
                {tags.length === 0 && <span className="text-xs text-gray-400 italic">Chưa có tag</span>}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center">
                <Hash size={12} className="mr-1 text-purple-500" /> 10 Hashtags
              </h4>
              <div className="flex flex-wrap gap-1">
                {hashtags.map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 bg-white border border-gray-200 text-purple-600 rounded text-[10px]">#{tag}</span>
                ))}
                {hashtags.length === 0 && <span className="text-xs text-gray-400 italic">Chưa có hashtag</span>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-white rounded border border-gray-100">
              <div className="text-[9px] text-gray-400 uppercase font-bold mb-1">Độ khó</div>
              <div className="text-xs font-semibold text-gray-700 capitalize">{topic.difficultyLevel || 'medium'}</div>
            </div>
            <div className="text-center p-2 bg-white rounded border border-gray-100">
              <div className="text-[9px] text-gray-400 uppercase font-bold mb-1">Tiềm năng</div>
              <div className="text-xs font-semibold text-emerald-600 capitalize">{topic.monetizationPotential || 'medium'}</div>
            </div>
            <div className="text-center p-2 bg-white rounded border border-gray-100">
              <div className="text-[9px] text-gray-400 uppercase font-bold mb-1">Quốc gia</div>
              <div className="text-xs font-semibold text-gray-700">{topic.country || 'Vietnam'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
