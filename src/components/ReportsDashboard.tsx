import React, { useState, useMemo } from 'react';
import { DailyReport, Staff } from '../types';
import {
  BarChart3, CheckCircle, AlertCircle, Clock,
  LayoutGrid, Filter, Search, Calendar, FileText,
  TrendingDown, TrendingUp, DollarSign, Users
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
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table'); // Mặc định là table sắc nét theo yêu cầu

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

  // Logic phân nhóm nhân sự (HRM Grouping) hiển thị tổng hợp theo vai trò
  const hrmGroups = useMemo(() => {
    const groups: Record<string, { role: string; staffCount: number; totalDone: number; totalPending: number; totalExpenses: number; reportsWithIssues: number }> = {};
    
    // Khởi tạo các nhóm vai trò
    staffList.forEach(s => {
      if (s.role === 'admin') return;
      const roleKey = s.role as string;
      const roleLabel = 
        roleKey === 'manager' ? 'Quản lý (Manager)' : 
        roleKey === 'leader' ? 'Trưởng nhóm (Leader)' : 
        roleKey === 'member' ? 'Nhân viên (Member)' : 
        roleKey === 'editor' ? 'Editor (Dựng phim)' : 
        roleKey === 'voiceover' ? 'Voiceover (Thu âm)' : 
        roleKey === 'writer' ? 'Writer (Kịch bản)' : 
        roleKey === 'creator' ? 'Creator (Sáng tạo)' : 
        roleKey.toUpperCase();
      
      if (!groups[roleKey]) {
        groups[roleKey] = {
          role: roleLabel,
          staffCount: 0,
          totalDone: 0,
          totalPending: 0,
          totalExpenses: 0,
          reportsWithIssues: 0
        };
      }
      groups[roleKey].staffCount += 1;
    });

    // Cộng dồn dữ liệu báo cáo
    filteredReports.forEach(r => {
      const staff = staffList.find(s => s.id === r.staffId);
      if (!staff || staff.role === 'admin') return;
      
      const roleKey = staff.role as string;
      if (groups[roleKey]) {
        const done = r.completedTasks?.length ?? r.renderedCount;
        const pending = r.pendingTasks?.length || 0;
        groups[roleKey].totalDone += done;
        groups[roleKey].totalPending += pending;
        groups[roleKey].totalExpenses += r.expenses || 0;
        if (r.issues && r.issues.trim().toLowerCase() !== 'không') {
          groups[roleKey].reportsWithIssues += 1;
        }
      }
    });

    return Object.values(groups);
  }, [filteredReports, staffList]);

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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <BarChart3 size={28} className="mr-3 text-indigo-600" />
            Báo cáo Tổng thể Nhân sự DTA
          </h1>
          <p className="text-gray-500 mt-1">
            Giám sát hiệu suất làm việc, tiến độ công việc và khó khăn của toàn bộ nhân sự DTA Studio.
          </p>
        </div>
        
        {/* Bộ chuyển đổi viewMode */}
        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 shadow-sm shrink-0">
          <button
            onClick={() => setViewMode('card')}
            className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'card'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LayoutGrid size={14} /> Dạng Thẻ Grid
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'table'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={14} /> Dạng Bảng Sắc Nét
          </button>
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
          <span className="text-3xl font-black text-gray-900">{stats.totalExpenses.toLocaleString('vi-VN')} <span className="text-base font-semibold text-gray-500">VND</span></span>
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
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow text-sm"
            />
          </div>
          
          <select 
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="all">Tất cả nhân viên</option>
            {staffList.filter(s => s.role !== 'admin').map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Phân nhóm HRM Grouping (Chỉ hiện khi ở dạng Bảng Table View) */}
      {viewMode === 'table' && hrmGroups.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 transition-all">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center uppercase tracking-wider text-indigo-700">
            <Users size={18} className="mr-2" /> Hiệu suất tổng hợp theo Nhóm vai trò (HRM Groups)
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-gray-600">Nhóm Vai trò</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600">Số lượng nhân sự</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 text-green-600">Công việc hoàn thành</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 text-red-600">Tồn đọng / Trễ</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 text-amber-600">Báo cáo khó khăn</th>
                  <th className="px-4 py-3 text-right font-bold text-gray-600 text-blue-600">Tổng chi phí ứng trước</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {hrmGroups.map(group => (
                  <tr key={group.role} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-900">{group.role}</td>
                    <td className="px-4 py-3 text-center text-gray-600 font-medium">{group.staffCount}</td>
                    <td className="px-4 py-3 text-center font-bold text-green-600">{group.totalDone}</td>
                    <td className="px-4 py-3 text-center font-bold text-red-600">{group.totalPending}</td>
                    <td className="px-4 py-3 text-center font-bold text-amber-600">{group.reportsWithIssues}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{group.totalExpenses.toLocaleString('vi-VN')} VND</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="space-y-4">
         {filteredReports.length > 0 ? (
           viewMode === 'table' ? (
             /* BẢNG BIỂU HRM PREMIUM SẮC NÉT NỀN SÁNG */
             <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all">
               <div className="overflow-x-auto">
                 <table className="min-w-full divide-y divide-gray-200 text-sm">
                   <thead className="bg-gray-50">
                     <tr>
                       <th className="px-4 py-3.5 text-left font-bold text-gray-600">Nhân sự</th>
                       <th className="px-4 py-3.5 text-left font-bold text-gray-600">Thời gian báo cáo</th>
                       <th className="px-4 py-3.5 text-center font-bold text-gray-600 text-green-600">Đã Xong</th>
                       <th className="px-4 py-3.5 text-center font-bold text-gray-600 text-red-600">Trễ/Tồn</th>
                       <th className="px-4 py-3.5 text-left font-bold text-gray-600">Khó khăn / Vấn đề</th>
                       <th className="px-4 py-3.5 text-left font-bold text-gray-600">Kế hoạch ngày mai</th>
                       <th className="px-4 py-3.5 text-right font-bold text-gray-600">Đề xuất ứng</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-200 bg-white">
                     {filteredReports.map(report => {
                       const staff = staffList.find(s => s.id === report.staffId);
                       const completedCount = report.completedTasks?.length ?? report.renderedCount;
                       const pendingCount = report.pendingTasks?.length || 0;
                       
                       const isPerfectList = pendingCount === 0 && completedCount > 0;
                       const hasIssues = report.issues && report.issues.trim().toLowerCase() !== 'không';
                       
                       let rowClass = "hover:bg-gray-50 transition-colors";
                       // Tô màu nổi bật dòng nhân sự xuất sắc (đạt 100% KPI)
                       if (isPerfectList) {
                         rowClass = "bg-green-50/40 hover:bg-green-50/60 transition-colors";
                       }
                       // Tô màu nổi bật nhân sự có báo cáo khó khăn
                       if (hasIssues) {
                         rowClass = "bg-red-50/40 hover:bg-red-50/60 transition-colors";
                       }

                       return (
                         <tr key={report.id} className={rowClass}>
                           <td className="px-4 py-3.5">
                             <div className="flex items-center">
                               <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-bold text-xs mr-2.5 shadow-inner">
                                 {(staff?.name || '?').charAt(0)}
                               </div>
                               <div>
                                 <span className="font-bold text-gray-950 block leading-tight">{staff?.name}</span>
                                 <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{staff?.role}</span>
                               </div>
                             </div>
                           </td>
                           <td className="px-4 py-3.5 text-gray-600 text-xs font-medium">
                             {format(parseISO(report.timestamp), 'HH:mm - dd/MM/yyyy')}
                           </td>
                           <td className="px-4 py-3.5 text-center font-bold text-green-600">{completedCount}</td>
                           <td className="px-4 py-3.5 text-center font-bold text-red-600">{pendingCount}</td>
                           <td className="px-4 py-3.5 max-w-xs">
                             {hasIssues ? (
                               <div className="text-red-800 text-xs font-semibold bg-red-100/50 p-2 rounded border border-red-200 whitespace-pre-wrap shadow-sm">
                                 {report.issues}
                               </div>
                             ) : (
                               <span className="text-gray-400 text-xs italic">Không có khó khăn</span>
                             )}
                           </td>
                           <td className="px-4 py-3.5 max-w-xs text-gray-700 text-xs whitespace-pre-wrap font-medium">
                             {report.planTomorrow || <span className="text-gray-400 italic">Chưa lên kế hoạch</span>}
                           </td>
                           <td className="px-4 py-3.5 text-right font-mono font-bold text-gray-900">
                             {report.expenses ? `${report.expenses.toLocaleString('vi-VN')} VND` : <span className="text-gray-400">-</span>}
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               </div>
             </div>
           ) : (
             /* GRID THẺ CARD CŨ */
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
                         <span>{report.expenses.toLocaleString('vi-VN')} VND</span>
                       </div>
                     ) : null}
                   </div>
                 );
               })}
             </div>
           )
         ) : (
           <div className="py-20 flex flex-col justify-center items-center text-center bg-white rounded-xl border border-dashed border-gray-300">
              <FileText size={48} className="text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-1">Không có báo cáo nào</h3>
              <p className="text-gray-500 max-w-sm">Không tìm thấy báo cáo nào phù hợp với bộ lọc hiện tại. Thử chọn mốc thời gian khác.</p>
           </div>
         )}
      </div>

      {/* DTA Studio Premium Footer */}
      <div className="mt-12 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
        <p className="font-bold text-gray-700 text-sm">Phát triển bởi DTA Studio - Chủ quản: Đức Trường</p>
        <p className="mt-1.5 font-medium">
          Hotline/Zalo: <span className="font-bold text-indigo-600">0962.775.506</span> | 
          Email: <span className="font-bold text-indigo-600">ductruong.onl@gmail.com</span> | 
          Website: <a href="https://dta-studio.vercel.app/" target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 hover:underline">dta-studio.vercel.app</a>
        </p>
        <p className="mt-1 text-gray-400">© 2026 DTA Studio. Bảo lưu mọi quyền.</p>
      </div>
    </div>
  );
}
