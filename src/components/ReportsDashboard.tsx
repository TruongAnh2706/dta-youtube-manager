import React, { useState, useMemo } from 'react';
import { DailyReport, Staff } from '../types';
import {
  BarChart3, CheckCircle, AlertCircle, Clock,
  LayoutGrid, Filter, Search, Calendar, FileText,
  TrendingDown, TrendingUp, DollarSign
} from 'lucide-react';
import { format, parseISO, isSameDay, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';

interface ReportsDashboardProps {
  dailyReports: DailyReport[];
  staffList: Staff[];
  currentUser: { id: string; name: string; role: string } | null;
}

export function ReportsDashboard({ dailyReports, staffList, currentUser }: ReportsDashboardProps) {
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'all'>('today');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredReports = useMemo(() => {
    let reports = [...dailyReports];

    // Lọc theo Staff
    if (staffFilter !== 'all') {
      reports = reports.filter(r => r.staffId === staffFilter);
    }

    // Lọc theo Date
    const now = new Date();
    if (dateFilter === 'today') {
      reports = reports.filter(r => isSameDay(parseISO(r.timestamp), now));
    } else if (dateFilter === 'yesterday') {
      reports = reports.filter(r => isSameDay(parseISO(r.timestamp), subDays(now, 1)));
    } else if (dateFilter === '7days') {
      reports = reports.filter(r => isWithinInterval(parseISO(r.timestamp), { start: subDays(now, 7), end: now }));
    } else if (dateFilter === '30days') {
      reports = reports.filter(r => isWithinInterval(parseISO(r.timestamp), { start: subDays(now, 30), end: now }));
    }

    // Lọc theo Text (Notes, Plan...)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      reports = reports.filter(r => 
        (r.notes || '').toLowerCase().includes(q) ||
        (r.issues || '').toLowerCase().includes(q) ||
        (r.planTomorrow || '').toLowerCase().includes(q)
      );
    }

    // Sắp xếp mới nhất lên đầu
    return reports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [dailyReports, dateFilter, staffFilter, searchQuery]);

  // Thống kê tổng quan dựa trên filteredReports
  const stats = useMemo(() => {
    let totalDone = 0;
    let totalPending = 0;
    let totalExpenses = 0;
    let reportsWithIssues = 0;

    filteredReports.forEach(r => {
      const done = r.completedTasks?.length ?? r.renderedCount;
      const pending = r.pendingTasks?.length || 0;
      totalDone += done;
      totalPending += pending;
      totalExpenses += r.expenses || 0;
      if (r.issues && r.issues.trim().toLowerCase() !== 'không') {
        reportsWithIssues += 1;
      }
    });

    return { totalDone, totalPending, totalExpenses, reportsWithIssues };
  }, [filteredReports]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <BarChart3 size={28} className="mr-3 text-indigo-600" />
            Báo cáo Tổng thể Nhân sự
          </h1>
          <p className="text-gray-500 mt-1">
            Giám sát hiệu suất làm việc, tiến độ công việc và khó khăn của toàn bộ nhân sự.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm font-semibold text-gray-500">Đã hoàn thành</span>
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <CheckCircle size={20} />
            </div>
          </div>
          <span className="text-3xl font-black text-gray-900">{stats.totalDone} <span className="text-base font-semibold text-gray-500">việc</span></span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm font-semibold text-gray-500">Tồn đọng / Trễ</span>
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <AlertCircle size={20} />
            </div>
          </div>
          <span className="text-3xl font-black text-gray-900">{stats.totalPending} <span className="text-base font-semibold text-gray-500">việc</span></span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm font-semibold text-gray-500">Báo cáo Khó khăn</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <TrendingDown size={20} />
            </div>
          </div>
          <span className="text-3xl font-black text-gray-900">{stats.reportsWithIssues} <span className="text-base font-semibold text-gray-500">báo cáo</span></span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm font-semibold text-gray-500">Đề xuất Ứng chi</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <DollarSign size={20} />
            </div>
          </div>
          <span className="text-3xl font-black text-gray-900">{stats.totalExpenses.toLocaleString()} <span className="text-base font-semibold text-gray-500">VND</span></span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center w-full sm:w-auto p-1.5 bg-gray-100 rounded-lg">
           {['today', 'yesterday', '7days', '30days', 'all'].map(t => (
             <button 
               key={t}
               onClick={() => setDateFilter(t as any)}
               className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex-1 sm:flex-none text-center ${dateFilter === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             >
               {t === 'today' ? 'Hôm nay' : t === 'yesterday' ? 'Hôm qua' : t === '7days' ? '7 Ngày' : t === '30days' ? '30 Ngày' : 'Tất cả'}
             </button>
           ))}
        </div>

        <div className="flex w-full sm:w-auto gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm nội dung báo cáo..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
            />
          </div>
          
          <select 
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-4 py-2 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tất cả nhân viên</option>
            {staffList.filter(s => s.role !== 'admin').map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Feed List */}
      <div className="space-y-4">
         {filteredReports.length > 0 ? (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
             {filteredReports.map(report => {
               const staff = staffList.find(s => s.id === report.staffId);
               const completedCount = report.completedTasks?.length ?? report.renderedCount;
               const pendingCount = report.pendingTasks?.length || 0;
               const isPerfectList = pendingCount === 0;

               return (
                 <div key={report.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md">
                   <div className="p-4 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                     <div className="flex items-center">
                       <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-bold text-sm mr-3 shadow-inner">
                         {(staff?.name || '?').charAt(0)}
                       </div>
                       <div>
                         <p className="font-bold text-gray-900 leading-tight">{staff?.name}</p>
                         <p className="text-xs text-gray-500 flex items-center font-medium mt-0.5">
                           <Clock size={12} className="mr-1" /> {format(parseISO(report.timestamp), 'HH:mm - dd/MM/yyyy')}
                         </p>
                       </div>
                     </div>
                     <div className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center ${isPerfectList ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                       {isPerfectList ? <CheckCircle size={12} className="mr-1" /> : <AlertCircle size={12} className="mr-1" />}
                       {completedCount} Done / {pendingCount} Miss
                     </div>
                   </div>

                   <div className="p-4 flex-1 space-y-4">
                     {/* Vấn đề & Kế hoạch */}
                     <div className="space-y-3">
                       {report.issues && report.issues.toLowerCase() !== 'không' && (
                         <div className="bg-red-50/50 p-3 rounded-lg border border-red-100">
                           <span className="font-bold text-red-800 text-xs uppercase tracking-wide block mb-1">Khó khăn / Vấn đề:</span>
                           <p className="text-gray-700 text-sm whitespace-pre-wrap">{report.issues}</p>
                         </div>
                       )}
                       {report.notes && !report.issues && (
                         <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                           <span className="font-bold text-gray-600 text-xs block mb-1">Ghi chú:</span>
                           <p className="text-gray-700 text-sm">{report.notes}</p>
                         </div>
                       )}
                       {report.planTomorrow && (
                         <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                           <span className="font-bold text-blue-800 text-xs uppercase tracking-wide block mb-1">Kế hoạch ngày mai:</span>
                           <p className="text-gray-700 text-sm whitespace-pre-wrap">{report.planTomorrow}</p>
                         </div>
                       )}
                     </div>

                     {/* Danh sách công việc */}
                     {((report.completedTasks && report.completedTasks.length > 0) || (report.pendingTasks && report.pendingTasks.length > 0)) && (
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                         {report.completedTasks && report.completedTasks.length > 0 && (
                           <div className="bg-green-50/30 p-2.5 rounded-lg border border-green-50">
                             <p className="text-xs font-bold text-green-700 mb-2 border-b border-green-100 pb-1">Đã Xong ({report.completedTasks.length})</p>
                             <ul className="text-gray-600 text-xs space-y-1.5 list-disc pl-3">
                               {report.completedTasks.map(t => <li key={t.id} className="truncate">{t.title}</li>)}
                             </ul>
                           </div>
                         )}
                         {report.pendingTasks && report.pendingTasks.length > 0 && (
                           <div className="bg-red-50/30 p-2.5 rounded-lg border border-red-50">
                             <p className="text-xs font-bold text-red-700 mb-2 border-b border-red-100 pb-1">Tồn Đọng ({report.pendingTasks.length})</p>
                             <ul className="text-gray-600 text-xs space-y-1.5 list-disc pl-3">
                               {report.pendingTasks.map(t => <li key={t.id} className="truncate">{t.title}</li>)}
                             </ul>
                           </div>
                         )}
                       </div>
                     )}
                   </div>

                   {report.expenses ? (
                     <div className="bg-orange-50 border-t border-orange-100 px-4 py-2.5 flex justify-between items-center text-sm font-semibold text-orange-800">
                       <span className="flex items-center"><DollarSign size={16} className="mr-1" /> Chi phí ứng trước:</span>
                       <span>{report.expenses.toLocaleString()} VND</span>
                     </div>
                   ) : null}
                 </div>
               );
             })}
           </div>
         ) : (
           <div className="py-20 flex flex-col justify-center items-center text-center bg-white rounded-xl border border-dashed border-gray-300">
              <FileText size={48} className="text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-1">Không có báo cáo nào</h3>
              <p className="text-gray-500 max-w-sm">Không tìm thấy báo cáo nào phù hợp với bộ lọc hiện tại. Thử chọn mốc thời gian khác.</p>
           </div>
         )}
      </div>
    </div>
  );
}
