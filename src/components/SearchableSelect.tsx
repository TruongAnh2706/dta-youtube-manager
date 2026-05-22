import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

interface Option {
  id: string;
  name: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  emptyLabel?: string;
  className?: string;
  ringColorClass?: string; // e.g., 'focus:ring-orange-500' or 'focus:ring-blue-500'
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  emptyLabel = 'Không tìm thấy kết quả',
  className = '',
  ringColorClass = 'focus:ring-blue-500'
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Sắp xếp các option từ A-Z theo bảng chữ cái tiếng Việt
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
  }, [options]);

  // Lọc các option dựa trên query tìm kiếm
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return sortedOptions;
    const query = searchQuery.toLowerCase().trim();
    return sortedOptions.filter(opt => 
      (opt.name || '').toLowerCase().includes(query)
    );
  }, [sortedOptions, searchQuery]);

  // Tìm tên của option đang được chọn
  const selectedOptionName = useMemo(() => {
    if (value === 'all') return placeholder;
    const found = options.find(opt => opt.id === value);
    return found ? found.name : placeholder;
  }, [options, value, placeholder]);

  // Click bên ngoài để đóng dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reset tìm kiếm khi đóng/mở dropdown
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative min-w-[200px] text-sm text-gray-700 ${className}`}>
      {/* Nút bấm giả dạng Select */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 h-10 border border-gray-300 rounded-lg bg-white shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:border-transparent text-sm text-left cursor-pointer transition-all duration-150"
      >
        <span className={`block truncate ${value === 'all' ? 'text-gray-500' : 'text-gray-800 font-medium'}`}>
          {selectedOptionName}
        </span>
        <ChevronDown size={14} className={`text-gray-400 ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Menu dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Hộp tìm kiếm */}
          <div className="relative p-2 border-b border-gray-100 bg-gray-50 flex items-center">
            <Search size={12} className="absolute left-4.5 text-gray-400" />
            <input
              type="text"
              autoFocus
              placeholder="Nhập tìm chủ đề..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 border border-gray-200 rounded-md bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 text-gray-700"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-4 text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Danh sách các options */}
          <ul className="max-h-56 overflow-y-auto custom-scrollbar py-1">
            {/* Option mặc định "Tất cả" */}
            <li
              onClick={() => handleSelect('all')}
              className={`px-4 py-2 hover:bg-blue-50 hover:text-blue-600 cursor-pointer font-semibold transition-colors ${
                value === 'all' ? 'bg-blue-50/50 text-blue-600 font-bold border-l-2 border-blue-500' : 'text-gray-500'
              }`}
            >
              {placeholder}
            </li>

            {filteredOptions.length === 0 ? (
              <li className="px-4 py-3 text-center text-gray-400 font-medium italic">
                {emptyLabel}
              </li>
            ) : (
              filteredOptions.map(opt => (
                <li
                  key={opt.id}
                  onClick={() => handleSelect(opt.id)}
                  className={`px-4 py-2 hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition-colors ${
                    value === opt.id ? 'bg-blue-50 text-blue-600 font-bold border-l-2 border-blue-500' : 'text-gray-700'
                  }`}
                >
                  {opt.name}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
