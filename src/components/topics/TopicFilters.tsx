import React from 'react';
import { Search, Globe } from 'lucide-react';

interface TopicFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  countryFilter: string;
  setCountryFilter: (country: string) => void;
  countries: string[];
}

export function TopicFilters({ searchQuery, setSearchQuery, countryFilter, setCountryFilter, countries }: TopicFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
      <div className="relative flex-grow">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input 
          type="text"
          placeholder="Tìm kiếm theo tên, mô tả, tag..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>
      <div className="flex items-center gap-2 min-w-[150px]">
        <Globe size={18} className="text-gray-400" />
        <select 
          value={countryFilter}
          onChange={e => setCountryFilter(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {countries.map(c => (
            <option key={c} value={c}>{c === 'All' ? 'Tất cả quốc gia' : c}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
