import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Channel, ChannelMetric, Staff } from '../types';
import { useToast } from '../hooks/useToast';
import { Calendar, DollarSign, TrendingUp, AlertTriangle, CheckCircle, Edit3, X, Eye, Lock, ChevronRight, ChevronDown, ChevronUp, Users, User, Percent, BarChart3 } from 'lucide-react';
import { format, subDays, isAfter, isBefore, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDaysInMonth, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';

interface MonetizationReportProps {
  channels: Channel[];
  setChannels: React.Dispatch<React.SetStateAction<Channel[]>>;
  metrics: ChannelMetric[];
  setMetrics: React.Dispatch<React.SetStateAction<ChannelMetric[]>>;
  currentStaff: Staff | null;
  isAdmin: boolean;
  staffList: Staff[];
}

const translateError = (err: any): string => {
  if (!err) return 'Đã xảy ra lỗi không xác định.';
  const msg = typeof err === 'string' ? err : (err.message || err.details || '');
  
  if (msg.includes('permission denied for table channel_metrics') || msg.includes('permission denied for table')) {
    return '🔒 Lỗi bảo mật (Chưa cấp quyền): Tài khoản nhân sự chưa được cấp quyền cập nhật số liệu BKT. Vui lòng liên hệ Admin (Anh Đức Trường - 0962.775.506) để chạy lệnh SQL cấp quyền trong Supabase SQL Editor.';
  }
  if (msg.includes('new row violates row-level security policy') || msg.includes('violates row-level security policy')) {
    return '🛡️ Lỗi chính sách bảo mật (RLS): Bạn không có quyền chỉnh sửa số liệu của kênh này. Kênh này chưa được gán quyền quản lý cho tài khoản của bạn.';
  }
  if (msg.includes('duplicate key value violates unique constraint') || msg.includes('violates unique constraint')) {
    return '⚠️ Lỗi trùng lặp dữ liệu: Kênh này đã có dữ liệu báo cáo doanh số/view cho ngày được chọn!';
  }
  if (msg.includes('Failed to fetch')) {
    return '🌐 Lỗi kết nối mạng: Không thể kết nối đến máy chủ API. Vui lòng kiểm tra lại kết nối Internet hoặc khởi động lại máy chủ Backend.';
  }
  if (msg.includes('JWT expired') || msg.includes('invalid jwt')) {
    return '🔑 Phiên đăng nhập hết hạn: Vui lòng đăng xuất và đăng nhập lại để tiếp tục sử dụng.';
  }
  if (msg.includes('quotaExceeded') || msg.includes('quota exceeded')) {
    return '⏳ Hết hạn mức API: Key YouTube đã hết lượt quét trong ngày. Vui lòng đổi API Key mới trong cài đặt hoặc thử lại vào ngày mai.';
  }
  if (msg.includes('Lỗi cập nhật CSDL') || msg.includes('dbError')) {
    return `💾 Lỗi ghi cơ sở dữ liệu: ${msg}`;
  }
  return msg || 'Đã xảy ra lỗi không xác định trên hệ thống.';
};

export function MonetizationReport({ channels, setChannels, metrics, setMetrics, currentStaff, isAdmin, staffList }: MonetizationReportProps) {
  const { showToast } = useToast();
  const [checkingMonetizationIds, setCheckingMonetizationIds] = useState<string[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'views' | 'revenue'>('views');
  
  const [selectedCell, setSelectedCell] = useState<{channelId: string, dateStr: string} | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editUsd, setEditUsd] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [currentExchangeRate, setCurrentExchangeRate] = useState(25400); // Tỉ giá mặc định
  const [adminViewMode, setAdminViewMode] = useState<'summary' | 'detail'>('summary');
  const [expandedStaffIds, setExpandedStaffIds] = useState<string[]>([]);

  // Lấy tỷ giá
  useEffect(() => {
    setCurrentExchangeRate(25400);
  }, []);

  // Lọc các kênh được phép xem
  const viewableChannels = useMemo(() => {
    if (isAdmin) return channels;
    if (!currentStaff) return [];
    return channels.filter(c => currentStaff.assignedChannelIds?.includes(c.id));
  }, [channels, isAdmin, currentStaff]);

  const monetizedChannels = viewableChannels.filter(c => c.isMonetized);
  const nonMonetizedChannels = viewableChannels.filter(c => !c.isMonetized);

  const toggleStaffExpand = (staffId: string) => {
    setExpandedStaffIds(prev => 
      prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
    );
  };

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const adminStats = useMemo(() => {
    let totalViews = 0;
    let totalRevenueUsd = 0;
    
    // Tính toán số liệu của từng nhân sự
    const staffData = staffList.map(staff => {
      // Lấy danh sách kênh BKT được phân công cho nhân sự này
      const staffChannels = viewableChannels.filter(c => c.isMonetized && staff.assignedChannelIds?.includes(c.id));
      let staffViews = 0;
      let staffRevenueUsd = 0;
      
      const channelDetails = staffChannels.map(c => {
        let channelViews = 0;
        let channelRevenueUsd = 0;
        
        daysInMonth.forEach(d => {
          const dateStr = format(d, 'yyyy-MM-dd');
          const m = metrics.find(metric => metric.channelId === c.id && metric.reportDate === dateStr);
          if (m) {
            channelViews += m.views || 0;
            channelRevenueUsd += m.revenueUsd || 0;
          }
        });
        
        staffViews += channelViews;
        staffRevenueUsd += channelRevenueUsd;
        
        return {
          ...c,
          views: channelViews,
          revenueUsd: channelRevenueUsd,
          revenueVnd: channelRevenueUsd * currentExchangeRate
        };
      });
      
      totalViews += staffViews;
      totalRevenueUsd += staffRevenueUsd;
      
      return {
        staff,
        channels: channelDetails,
        views: staffViews,
        revenueUsd: staffRevenueUsd,
        revenueVnd: staffRevenueUsd * currentExchangeRate,
        channelCount: staffChannels.length
      };
    }).filter(s => s.channelCount > 0); // Chỉ hiện nhân sự có kênh quản lý

    return {
      totalViews,
      totalRevenueUsd,
      totalRevenueVnd: totalRevenueUsd * currentExchangeRate,
      staffData
    };
  }, [viewableChannels, metrics, currentDate, staffList, daysInMonth, currentExchangeRate]);

  const handleCheckMonetization = async (channel: Channel) => {
    if (checkingMonetizationIds.includes(channel.id)) return;

    setCheckingMonetizationIds(prev => [...prev, channel.id]);
    showToast(`Đang quét trạng thái kiếm tiền của kênh: ${channel.name}...`, 'info');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        showToast('Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.', 'error');
        return;
      }

      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      const response = await fetch(`${API_BASE_URL}/api/youtube/check-monetization`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          channelUrl: channel.url || `https://www.youtube.com/channel/${channel.id}`,
          videoId: null
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Cào dữ liệu kiếm tiền từ YouTube thất bại.');
      }

      const isMonetized = result.isMonetized;

      const { error: dbError } = await supabase
        .from('channels')
        .update({ 
          is_monetized: isMonetized,
          monetization_date: isMonetized ? new Date().toISOString() : null
        })
        .eq('id', channel.id);

      if (dbError) {
        throw new Error(`Lỗi cập nhật CSDL: ${dbError.message}`);
      }

      setChannels(prev => prev.map(c => c.id === channel.id ? { 
        ...c, 
        isMonetized, 
        monetizationDate: isMonetized ? new Date().toISOString() : undefined 
      } : c));

      if (isMonetized === true) {
        showToast(`Đã xác minh: Kênh "${channel.name}" đang BẬT kiếm tiền! 🎉`, 'success');
      } else if (isMonetized === false) {
        showToast(`Cảnh báo: Kênh "${channel.name}" đã bị TẮT kiếm tiền! 🛑`, 'warning');
      } else {
        showToast(`Không xác định được trạng thái kiếm tiền của kênh "${channel.name}".`, 'info');
      }
    } catch (err: any) {
      showToast(translateError(err), 'error');
    } finally {
      setCheckingMonetizationIds(prev => prev.filter(id => id !== channel.id));
    }
  };

  const toggleMonetization = async (channelId: string, currentState: boolean) => {
    try {
      const { error } = await supabase.from('channels').update({
        is_monetized: !currentState,
        monetization_date: !currentState ? new Date().toISOString() : null
      }).eq('id', channelId);
      
      if (error) throw error;
      showToast(!currentState ? 'Đã thêm kênh vào danh sách BKT!' : 'Đã gỡ kênh khỏi danh sách BKT', 'success');

      setChannels(prev => prev.map(c => c.id === channelId ? { 
        ...c, 
        isMonetized: !currentState,
        monetizationDate: !currentState ? new Date().toISOString() : undefined
      } : c));
    } catch (err: any) {
      showToast(translateError(err), 'error');
    }
  };

  const getMetric = (channelId: string, dateStr: string) => {
    return metrics.find(m => m.channelId === channelId && m.reportDate === dateStr);
  };

  const isLocked = (date: Date, type: 'views' | 'revenue') => {
    const today = new Date();
    if (type === 'views') {
      return !isBefore(date, startOfDay(today));
    } else {
      return !isBefore(date, subDays(startOfDay(today), 1));
    }
  };

  const startOfDay = (d: Date) => {
    const newD = new Date(d);
    newD.setHours(0,0,0,0);
    return newD;
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN').format(val);

  const handleSaveMetric = async () => {
    if (!selectedCell) return;
    setIsSaving(true);
    
    try {
      const { channelId, dateStr } = selectedCell;
      const existing = getMetric(channelId, dateStr);
      
      const updateData: any = {
        channel_id: channelId,
        report_date: dateStr,
        updated_by: currentStaff?.id,
        updated_at: new Date().toISOString()
      };

      if (activeTab === 'views') {
        updateData.views = parseInt(editValue.replace(/,/g, '') || '0', 10);
      } else {
        const usd = parseFloat(editUsd.replace(/,/g, '') || '0');
        updateData.revenue_usd = usd;
        updateData.revenue_vnd = usd * currentExchangeRate;
        updateData.exchange_rate = currentExchangeRate;
      }

      let error;
      if (existing) {
        const res = await supabase.from('channel_metrics').update(updateData).eq('id', existing.id);
        error = res.error;
      } else {
        updateData.id = crypto.randomUUID();
        const res = await supabase.from('channel_metrics').insert([updateData]);
        error = res.error;
      }

      if (error) throw error;

      const savedMetric: ChannelMetric = {
        id: existing?.id || updateData.id,
        channelId: channelId,
        reportDate: dateStr,
        views: activeTab === 'views' ? updateData.views : (existing?.views ?? 0),
        revenueUsd: activeTab === 'revenue' ? updateData.revenue_usd : (existing?.revenueUsd ?? 0),
        revenueVnd: activeTab === 'revenue' ? updateData.revenue_vnd : (existing?.revenueVnd ?? 0),
        exchangeRate: activeTab === 'revenue' ? updateData.exchange_rate : (existing?.exchangeRate ?? currentExchangeRate),
        updatedBy: updateData.updated_by,
        updatedAt: updateData.updated_at
      };

      setMetrics(prev => {
        const exists = prev.some(m => m.id === savedMetric.id);
        if (exists) {
          return prev.map(m => m.id === savedMetric.id ? savedMetric : m);
        } else {
          return [...prev, savedMetric];
        }
      });

      showToast('Đã lưu báo cáo thành công!', 'success');
      setSelectedCell(null);
    } catch (err: any) {
      showToast(translateError(err), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const openCell = (channelId: string, date: Date) => {
    if (isLocked(date, activeTab)) {
      showToast(`Dữ liệu ${activeTab === 'views' ? 'View' : 'Doanh thu'} của ngày này chưa được Google cập nhật!`, 'warning');
      return;
    }
    const dateStr = format(date, 'yyyy-MM-dd');
    setSelectedCell({ channelId, dateStr });
    const metric = getMetric(channelId, dateStr);
    
    if (activeTab === 'views') {
      setEditValue(metric?.views ? metric.views.toString() : '');
    } else {
      setEditUsd(metric?.revenueUsd ? metric.revenueUsd.toString() : '');
    }
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  return (
    <div className="space-y-6 flex flex-col min-h-[700px] justify-between">
      <div className="space-y-6 flex-1">
        {/* Header Section phong cách phẳng sang trọng */}
        <div className="bg-white p-6 rounded-xl border border-gray-150 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center tracking-tight">
              <DollarSign className="mr-3 text-cyan-600 bg-cyan-50 p-1.5 rounded-lg border border-cyan-100 shadow-sm" size={32} />
              DTA AutoMonetize Report
            </h1>
            <p className="text-xs text-gray-600 font-medium mt-1">
              Hệ thống theo dõi View và Doanh thu tự động (Realtime USD ➔ VNĐ) • <span className="text-cyan-600 font-bold">DTA Studio</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Chuyển đổi chế độ xem cho Admin */}
            {isAdmin && (
              <div className="flex p-1 bg-gray-100/80 border border-gray-200/50 rounded-lg shadow-inner">
                <button 
                  onClick={() => setAdminViewMode('summary')}
                  className={`px-4 py-2 text-xs font-bold rounded-md flex items-center transition-all duration-200 ${
                    adminViewMode === 'summary' 
                      ? 'bg-white text-cyan-600 border border-gray-200 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-900 font-medium'
                  }`}
                >
                  <BarChart3 size={14} className="mr-1.5" />
                  Xem Tổng Hợp (Admin)
                </button>
                <button 
                  onClick={() => setAdminViewMode('detail')}
                  className={`px-4 py-2 text-xs font-bold rounded-md flex items-center transition-all duration-200 ${
                    adminViewMode === 'detail' 
                      ? 'bg-white text-cyan-600 border border-gray-200 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-900 font-medium'
                  }`}
                >
                  <Edit3 size={14} className="mr-1.5" />
                  Xem Chi Tiết (Staff)
                </button>
              </div>
            )}

            {/* Chọn Tháng */}
            <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border border-gray-250/80 shadow-sm hover:border-gray-300 transition-all">
              <button 
                onClick={() => changeMonth(-1)} 
                className="text-xs font-black text-gray-500 hover:text-cyan-600 transition-colors px-2 py-0.5"
                title="Tháng trước"
              >
                &lt;
              </button>
              <span className="text-xs font-extrabold text-gray-800 min-w-[90px] text-center">
                Tháng {format(currentDate, 'MM/yyyy')}
              </span>
              <button 
                onClick={() => changeMonth(1)} 
                className="text-xs font-black text-gray-500 hover:text-cyan-600 transition-colors px-2 py-0.5"
                title="Tháng sau"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>

        {/* Chế độ Xem Tổng Hợp Admin */}
        {isAdmin && adminViewMode === 'summary' ? (
          <div className="space-y-6">
            {/* Section 1: Thẻ KPI phong cách phẳng siêu sang trọng */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* KPI 1: Tổng kênh BKT */}
              <div className="bg-white border border-gray-150 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-cyan-300 transition-all duration-300 flex items-center justify-between group">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Tổng Kênh BKT Hệ Thống</p>
                  <h3 className="text-3xl font-extrabold text-cyan-600 mt-2 tracking-tight group-hover:scale-105 transition-transform duration-300">
                    {monetizedChannels.length} <span className="text-xs font-semibold text-gray-550">kênh</span>
                  </h3>
                  <p className="text-[10px] text-gray-500 font-medium mt-1">Đang liên kết đóng góp dữ liệu</p>
                </div>
                <div className="p-3.5 bg-cyan-50/70 text-cyan-600 border border-cyan-100/50 rounded-xl group-hover:bg-cyan-100/60 transition-all duration-300">
                  <TrendingUp size={24} />
                </div>
              </div>
              
              {/* KPI 2: Tổng Lượt Xem */}
              <div className="bg-white border border-gray-150 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-cyan-300 transition-all duration-300 flex items-center justify-between group">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Tổng Lượt Xem (Tháng)</p>
                  <h3 className="text-3xl font-extrabold text-cyan-600 mt-2 tracking-tight group-hover:scale-105 transition-transform duration-300">
                    {formatCurrency(adminStats.totalViews)}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-medium mt-1">Lượt xem tích lũy toàn hệ thống</p>
                </div>
                <div className="p-3.5 bg-cyan-50/70 text-cyan-600 border border-cyan-100/50 rounded-xl group-hover:bg-cyan-100/60 transition-all duration-300">
                  <Eye size={24} />
                </div>
              </div>

              {/* KPI 3: Tổng Doanh Thu */}
              <div className="bg-white border border-gray-150 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-rose-300 transition-all duration-300 flex items-center justify-between group">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Tổng Doanh Thu (Tháng)</p>
                  <h3 className="text-3xl font-extrabold text-rose-600 mt-2 tracking-tight group-hover:scale-105 transition-transform duration-300">
                    ${adminStats.totalRevenueUsd.toFixed(2)}
                  </h3>
                  <p className="text-xs text-rose-600 font-bold mt-1.5 bg-rose-50/60 px-2.5 py-0.5 rounded-md inline-block border border-rose-100/30">
                    ≈ {formatCurrency(adminStats.totalRevenueVnd)} VNĐ
                  </p>
                </div>
                <div className="p-3.5 bg-rose-50/70 text-rose-600 border border-rose-100/50 rounded-xl group-hover:bg-rose-100/60 transition-all duration-300">
                  <DollarSign size={24} />
                </div>
              </div>
            </div>

            {/* Section 2: Xếp hạng Đóng góp Doanh số Nhân sự */}
            <div className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-black text-gray-900 mb-6 flex items-center uppercase tracking-wider">
                <BarChart3 className="text-cyan-600 mr-2" size={18} />
                Bảng Xếp Hạng Đóng Góp Doanh Số Nhân Sự
              </h2>
              <div className="space-y-4">
                {adminStats.staffData.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-8 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                    Chưa có số liệu đóng góp của nhân sự trong tháng này.
                  </p>
                ) : (
                  adminStats.staffData
                    .sort((a, b) => b.revenueUsd - a.revenueUsd)
                    .map((s, idx) => {
                      const viewPercent = adminStats.totalViews > 0 ? (s.views / adminStats.totalViews) * 100 : 0;
                      const revenuePercent = adminStats.totalRevenueUsd > 0 ? (s.revenueUsd / adminStats.totalRevenueUsd) * 100 : 0;
                      
                      return (
                        <div key={s.staff.id} className="p-5 bg-slate-50/40 rounded-xl border border-gray-150 hover:bg-white hover:border-gray-300 hover:shadow-sm transition-all duration-300">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <div className="flex items-center space-x-2">
                              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-gray-100 text-xs font-black text-gray-700 border border-gray-200 shadow-sm">
                                #{idx + 1}
                              </span>
                              <User size={14} className="text-cyan-600" />
                              <span className="font-extrabold text-sm text-gray-900">{s.staff.name}</span>
                              <span className="text-xs text-gray-500 font-medium">({s.channelCount} kênh quản lý)</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-gray-800">
                              <div>
                                <span className="text-gray-500 font-normal">Views: </span>
                                <span className="text-cyan-600 font-extrabold">{formatCurrency(s.views)}</span>
                              </div>
                              <div className="border-l border-gray-200 pl-4">
                                <span className="text-gray-500 font-normal">Doanh thu: </span>
                                <span className="text-rose-600 font-extrabold">${s.revenueUsd.toFixed(2)}</span>
                                <span className="text-[11px] text-gray-500 font-semibold"> (~{formatCurrency(s.revenueVnd)}đ)</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Progress bars */}
                          <div className="space-y-3">
                            <div>
                              <div className="flex justify-between text-[11px] text-gray-600 mb-1 font-semibold">
                                <span>Đóng góp Lượt xem</span>
                                <span className="text-cyan-600 font-black">{viewPercent.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200/50">
                                <div 
                                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full" 
                                  style={{ width: `${viewPercent}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex justify-between text-[11px] text-gray-600 mb-1 font-semibold">
                                <span>Đóng góp Doanh thu</span>
                                <span className="text-rose-600 font-black">{revenuePercent.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200/50">
                                <div 
                                  className="h-full bg-gradient-to-r from-rose-400 to-rose-650 rounded-full" 
                                  style={{ width: `${revenuePercent}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Section 3: Phân nhóm Accordion nhân viên */}
            <div className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-black text-gray-900 mb-6 flex items-center uppercase tracking-wider">
                <Users className="text-cyan-600 mr-2" size={18} />
                Chi Tiết Phân Nhóm Nhân Sự Quản Lý
              </h2>
              <div className="space-y-3">
                {adminStats.staffData.map(s => {
                  const isExpanded = expandedStaffIds.includes(s.staff.id);
                  return (
                    <div key={s.staff.id} className="border border-gray-150 rounded-xl bg-white overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                      <button 
                        onClick={() => toggleStaffExpand(s.staff.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-slate-50/60 transition-colors duration-200"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-cyan-50 rounded-xl border border-cyan-100 text-cyan-600 shadow-sm">
                            <User size={16} />
                          </div>
                          <div className="text-left">
                            <h4 className="font-extrabold text-sm text-gray-900">{s.staff.name}</h4>
                            <p className="text-[11px] text-gray-500 font-semibold mt-0.5">{s.channelCount} kênh đang bật kiếm tiền</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-6">
                          <div className="hidden sm:flex items-center space-x-4 text-xs font-bold text-gray-800">
                            <div className="text-right">
                              <span className="text-gray-550 text-[10px] font-semibold block uppercase tracking-wider">Tổng Views</span>
                              <span className="text-cyan-600 font-extrabold">{formatCurrency(s.views)}</span>
                            </div>
                            <div className="text-right border-l border-gray-200 pl-4">
                              <span className="text-gray-550 text-[10px] font-semibold block uppercase tracking-wider">Tổng Doanh thu</span>
                              <span className="text-rose-600 font-extrabold">${s.revenueUsd.toFixed(2)}</span>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="text-gray-500" size={18} />
                          ) : (
                            <ChevronDown className="text-gray-500" size={18} />
                          )}
                        </div>
                      </button>

                      {/* Accordion content */}
                      {isExpanded && (
                        <div className="border-t border-gray-150 bg-slate-50/30 p-4">
                          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                            <table className="w-full text-xs text-left">
                              <thead>
                                <tr className="border-b border-gray-200 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-gray-600">
                                  <th className="py-3 px-4">Tên Kênh</th>
                                  <th className="py-3 px-4 text-center">Trạng Thái BKT</th>
                                  <th className="py-3 px-4 text-right">Lượt Xem (Tháng)</th>
                                  <th className="py-3 px-4 text-right">Doanh Thu (Tháng)</th>
                                  <th className="py-3 px-4 text-right">Quy Đổi VNĐ</th>
                                </tr>
                              </thead>
                              <tbody>
                                {s.channels.map(c => (
                                  <tr key={c.id} className="border-b border-gray-100 hover:bg-slate-50/40 transition-colors font-medium">
                                    <td className="py-3 px-4 font-extrabold text-gray-950">
                                      <div className="flex items-center space-x-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm animate-pulse"></span>
                                        <span>{c.name}</span>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-inner">
                                        Đang BKT
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-right text-cyan-600 font-extrabold">
                                      {formatCurrency(c.views)}
                                    </td>
                                    <td className="py-3 px-4 text-right text-rose-600 font-extrabold font-mono">
                                      ${c.revenueUsd.toFixed(2)}
                                    </td>
                                    <td className="py-3 px-4 text-right text-gray-600 font-semibold font-mono">
                                      {formatCurrency(c.revenueVnd)}đ
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Chế độ Xem Lưới Chi Tiết của Staff và Admin */
          <div className="space-y-6">
            {/* Chú ý độ trễ */}
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-4 flex items-start shadow-sm transition-all duration-300">
              <AlertTriangle className="text-amber-600 mr-3 shrink-0 mt-0.5" size={20} />
              <div className="text-xs text-amber-900">
                <p className="font-extrabold mb-1.5 uppercase tracking-wider text-amber-850">Quy chuẩn đồng bộ dữ liệu YouTube:</p>
                <ul className="list-disc pl-4 space-y-1 text-gray-700 font-medium">
                  <li><strong>Lượt xem (Views):</strong> Hệ thống YouTube cập nhật trễ 1 ngày. Cột ngày hôm nay sẽ tự động khóa.</li>
                  <li><strong>Doanh thu (Revenue):</strong> Hệ thống YouTube cập nhật trễ 2 ngày. Cột ngày hôm nay & hôm qua sẽ khóa.</li>
                  <li><strong>Màu đỏ nhấp nháy:</strong> Chỉ báo ô đến hạn báo cáo nhưng nhân sự đang để trống số liệu cần điền.</li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Cột trái: Quản lý trạng thái BKT */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-150 p-5 flex flex-col h-[600px]">
                <h2 className="text-xs font-black text-gray-900 mb-4 flex items-center uppercase tracking-wider border-b border-gray-100 pb-3">
                  <TrendingUp size={16} className="mr-2 text-emerald-600 shrink-0"/>
                  Kênh đang BKT ({monetizedChannels.length})
                </h2>
                <div className="overflow-y-auto flex-1 space-y-2.5 pr-1">
                  {monetizedChannels.map(c => (
                    <div key={c.id} className="p-3 border border-emerald-100/60 bg-emerald-50/30 hover:bg-emerald-50 hover:border-emerald-300 rounded-xl flex items-center justify-between transition-all duration-200">
                      <div className="flex items-center space-x-2.5 truncate">
                        <button
                          onClick={() => handleCheckMonetization(c)}
                          disabled={checkingMonetizationIds.includes(c.id)}
                          className="focus:outline-none transition-transform hover:scale-110 shrink-0"
                          title="Bấm để kiểm tra trạng thái kiếm tiền từ YouTube"
                        >
                          {checkingMonetizationIds.includes(c.id) ? (
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-cyan-500 animate-spin block"></span>
                          ) : c.isMonetized ? (
                            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse block shadow-sm border border-white"></span>
                          ) : c.isMonetized === false ? (
                            <span className="w-3.5 h-3.5 rounded-full bg-red-500 animate-pulse block shadow-sm border border-white"></span>
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full bg-gray-400 block border border-white"></span>
                          )}
                        </button>
                        <div className="truncate">
                          <div className="font-extrabold text-gray-900 text-xs truncate w-28" title={c.name}>{c.name}</div>
                          <div className="text-[10px] text-emerald-700 mt-0.5 font-bold">BKT: {c.monetizationDate ? format(new Date(c.monetizationDate), 'dd/MM/yyyy') : 'N/A'}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => toggleMonetization(c.id, true)}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200/50 hover:border-rose-300 transition-colors shrink-0" 
                        title="Bỏ BKT"
                      >
                        <X size={12}/>
                      </button>
                    </div>
                  ))}
                  {monetizedChannels.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-8 font-medium italic">Chưa có kênh nào được cấu hình BKT.</p>
                  )}
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-150">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase mb-3 tracking-wider">Các kênh chưa BKT</h3>
                  <div className="overflow-y-auto max-h-[200px] space-y-2 pr-1">
                    {nonMonetizedChannels.map(c => (
                      <div key={c.id} className="p-2.5 border border-gray-200 hover:border-cyan-300 hover:bg-white rounded-xl flex items-center justify-between group bg-slate-50/50 hover:shadow-sm transition-all duration-200">
                        <div className="flex items-center space-x-2 truncate">
                          <button
                            onClick={() => handleCheckMonetization(c)}
                            disabled={checkingMonetizationIds.includes(c.id)}
                            className="focus:outline-none transition-transform hover:scale-110 shrink-0"
                            title="Kiểm tra monetization từ YouTube"
                          >
                            {checkingMonetizationIds.includes(c.id) ? (
                              <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-cyan-500 animate-spin block"></span>
                            ) : c.isMonetized ? (
                              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse block border border-white"></span>
                            ) : c.isMonetized === false ? (
                              <span className="w-3.5 h-3.5 rounded-full bg-red-500 animate-pulse block border border-white"></span>
                            ) : (
                              <span className="w-3.5 h-3.5 rounded-full bg-gray-400 block border border-white"></span>
                            )}
                          </button>
                          <span className="font-bold text-gray-700 text-xs truncate w-24" title={c.name}>{c.name}</span>
                        </div>
                        <button 
                          onClick={() => toggleMonetization(c.id, false)}
                          className="text-[9px] bg-cyan-50 text-cyan-600 border border-cyan-200/60 px-2 py-0.5 rounded-md font-black opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hover:bg-cyan-100"
                        >
                          Kích hoạt
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bảng báo cáo chi tiết */}
              <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-150 flex flex-col h-[600px] overflow-hidden">
                <div className="p-4 border-b border-gray-150 flex justify-between items-center bg-slate-50/80">
                  <div className="flex space-x-2.5">
                    <button 
                      onClick={() => setActiveTab('views')} 
                      className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all duration-200 ${
                        activeTab === 'views' 
                          ? 'bg-cyan-600 text-white shadow-sm hover:bg-cyan-700' 
                          : 'bg-white text-gray-600 border border-gray-250 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      Báo Cáo View
                    </button>
                    <button 
                      onClick={() => setActiveTab('revenue')} 
                      className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all duration-200 ${
                        activeTab === 'revenue' 
                          ? 'bg-rose-600 text-white shadow-sm hover:bg-rose-700' 
                          : 'bg-white text-gray-600 border border-gray-250 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      Báo Cáo Doanh Thu
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto flex-1 p-4 text-gray-800">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="border border-gray-200 bg-slate-100/90 p-3 text-left sticky left-0 z-10 w-44 min-w-[170px] text-gray-900 font-black">Tên Kênh</th>
                        {daysInMonth.map(d => {
                          const locked = isLocked(d, activeTab);
                          return (
                            <th key={d.toString()} className={`border border-gray-200 p-2 min-w-[75px] text-center ${locked ? 'bg-gray-50/80 text-gray-400 opacity-90' : 'bg-slate-100/50 text-gray-800 font-extrabold'}`}>
                              <div className="font-mono">{format(d, 'dd/MM')}</div>
                              {locked && <Lock size={9} className="mx-auto mt-0.5 text-gray-400" />}
                            </th>
                          );
                        })}
                        <th className="border border-gray-200 bg-amber-50 p-2 text-center min-w-[100px] font-black text-amber-700 sticky right-0 z-10 shadow-sm">Tổng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monetizedChannels.map(channel => {
                        let rowTotal = 0;
                        
                        return (
                          <tr key={channel.id} className="hover:bg-slate-50/40">
                            <td className="border border-gray-200 p-2 bg-slate-50 sticky left-0 z-10 font-extrabold text-gray-900 truncate max-w-[170px] flex items-center space-x-2 shadow-sm">
                              <button
                                onClick={() => handleCheckMonetization(channel)}
                                disabled={checkingMonetizationIds.includes(channel.id)}
                                className="focus:outline-none transition-transform hover:scale-110 shrink-0"
                              >
                                {checkingMonetizationIds.includes(channel.id) ? (
                                  <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-cyan-500 animate-spin block"></span>
                                ) : channel.isMonetized ? (
                                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse block shadow-sm border border-white"></span>
                                ) : channel.isMonetized === false ? (
                                  <span className="w-3.5 h-3.5 rounded-full bg-red-500 animate-pulse block shadow-sm border border-white"></span>
                                ) : (
                                  <span className="w-3.5 h-3.5 rounded-full bg-gray-400 block border border-white"></span>
                                )}
                              </button>
                              <span className="truncate" title={channel.name}>{channel.name}</span>
                            </td>
                            {daysInMonth.map(d => {
                              const dateStr = format(d, 'yyyy-MM-dd');
                              const metric = getMetric(channel.id, dateStr);
                              const locked = isLocked(d, activeTab);
                              
                              let displayValue = '-';
                              let isMissing = false;
                              
                              if (activeTab === 'views') {
                                if (metric?.views !== undefined) {
                                  displayValue = formatCurrency(metric.views);
                                  rowTotal += metric.views;
                                } else if (!locked) {
                                  isMissing = true;
                                }
                              } else {
                                if (metric?.revenueUsd !== undefined) {
                                  displayValue = `$${metric.revenueUsd.toFixed(2)}`;
                                  rowTotal += metric.revenueUsd;
                                } else if (!locked) {
                                  isMissing = true;
                                }
                              }

                              if (isMissing && channel.monetizationDate && isBefore(d, startOfDay(new Date(channel.monetizationDate)))) {
                                 isMissing = false;
                                 displayValue = '';
                              }

                              return (
                                <td 
                                  key={d.toString()} 
                                  onClick={() => !locked && openCell(channel.id, d)}
                                  className={`border border-gray-200 p-2 text-center cursor-pointer font-bold transition-all duration-150
                                    ${locked ? 'bg-gray-50/40 text-gray-400 cursor-not-allowed font-normal' : 
                                      isMissing ? 'bg-red-50/80 border border-red-250 text-rose-600 font-extrabold hover:bg-red-100 animate-pulse' : 
                                      'hover:bg-cyan-50 text-gray-900 font-extrabold'
                                    }
                                  `}
                                >
                                  {displayValue}
                                </td>
                              );
                            })}
                            <td className="border border-gray-200 p-2 bg-amber-50/50 text-center font-black text-amber-700 sticky right-0 z-10 shadow-sm font-mono text-xs">
                              {activeTab === 'views' ? formatCurrency(rowTotal) : `$${rowTotal.toFixed(2)}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {selectedCell && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-[400px] shadow-2xl text-gray-800 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5 border-b border-gray-150 pb-3">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-cyan-600 flex items-center">
                <Edit3 className="mr-2 text-cyan-600 bg-cyan-50 p-1 rounded-md" size={18} />
                Cập nhật báo cáo {activeTab === 'views' ? 'Lượt xem' : 'Doanh thu'}
              </h3>
              <button 
                onClick={() => setSelectedCell(null)} 
                className="text-gray-400 hover:text-gray-800 transition-colors p-1 hover:bg-gray-100 rounded-lg"
              >
                <X size={18}/>
              </button>
            </div>
            
            <div className="text-xs text-gray-600 space-y-1.5 mb-5 bg-gray-50/80 p-4 rounded-xl border border-gray-200/80">
              <div>Kênh quản lý: <strong className="text-gray-900 font-extrabold">{channels.find(c => c.id === selectedCell.channelId)?.name}</strong></div>
              <div>Ngày báo cáo: <strong className="text-cyan-600 font-extrabold">{format(new Date(selectedCell.dateStr), 'dd/MM/yyyy')}</strong></div>
            </div>

            {activeTab === 'views' ? (
              <div className="mb-5">
                <label className="block text-xs font-black text-gray-500 mb-2 uppercase tracking-wider">Số Lượt Xem trong ngày</label>
                <input 
                  type="number" 
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-3 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 text-gray-900 focus:outline-none font-bold text-sm tracking-tight shadow-sm"
                  placeholder="Ví dụ: 15000"
                  autoFocus
                />
              </div>
            ) : (
              <div className="space-y-4 mb-5">
                <div>
                  <label className="block text-xs font-black text-gray-500 mb-2 uppercase tracking-wider">Doanh thu USD (YouTube Analytics)</label>
                  <div className="relative">
                    <DollarSign size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="number" 
                      step="0.01"
                      value={editUsd}
                      onChange={e => setEditUsd(e.target.value)}
                      className="w-full bg-white pl-9 border border-gray-300 rounded-xl p-3 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20 text-gray-900 focus:outline-none font-bold text-sm tracking-tight shadow-sm"
                      placeholder="Ví dụ: 15.50"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100/60 shadow-inner">
                  <div className="text-[10px] text-gray-550 mb-1 font-semibold">Tạm tính tỷ giá quy đổi ({formatCurrency(currentExchangeRate)}đ / 1 USD)</div>
                  <div className="font-black text-rose-600 text-lg">
                    ≈ {formatCurrency(parseFloat(editUsd || '0') * currentExchangeRate)} VNĐ
                  </div>
                </div>
              </div>
            )}

            {/* Log edit history */}
            {getMetric(selectedCell.channelId, selectedCell.dateStr)?.updatedAt && (
              <div className="text-[10px] text-gray-550 mb-5 italic border-t border-gray-200 pt-3.5 leading-relaxed font-semibold">
                Sửa lần cuối bởi: {staffList.find(s => s.id === getMetric(selectedCell.channelId, selectedCell.dateStr)?.updatedBy)?.name || 'Unknown'}<br/>
                Thời gian: {format(new Date(getMetric(selectedCell.channelId, selectedCell.dateStr)!.updatedAt!), 'HH:mm dd/MM/yyyy')}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setSelectedCell(null)} 
                className="px-4 py-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg font-extrabold transition-all"
              >
                Hủy
              </button>
              <button 
                onClick={handleSaveMetric}
                disabled={isSaving || (activeTab === 'views' ? !editValue : !editUsd)}
                className={`px-5 py-2 text-xs text-white rounded-lg font-black transition-all shadow-sm ${
                  activeTab === 'views' 
                    ? 'bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50' 
                    : 'bg-rose-600 hover:bg-rose-700 disabled:opacity-50'
                }`}
              >
                {isSaving ? 'Đang lưu...' : 'Lưu báo cáo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DTA Studio Branding Footer đồng bộ trực tiếp ở cuối trang */}
      <footer className="mt-8 pt-6 border-t border-gray-200 text-center text-xs text-gray-600 space-y-2">
        <p className="font-extrabold text-cyan-600 tracking-wider uppercase text-[11px]">
          Phát triển bởi DTA Studio - Chủ quản: Đức Trường
        </p>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-gray-500 text-[11px] font-semibold">
          <span>📞 Zalo: <a href="tel:0962775506" className="text-gray-700 hover:text-cyan-600 transition-all font-semibold">0962.775.506</a></span>
          <span>📧 Email: <a href="mailto:ductruong.onl@gmail.com" className="text-gray-700 hover:text-cyan-600 transition-all font-semibold">ductruong.onl@gmail.com</a></span>
          <span>🌐 Website: <a href="https://dta-studio.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-cyan-600 transition-all font-semibold">dta-studio.vercel.app</a></span>
          <span>📘 Facebook: <a href="https://www.facebook.com/phamductruong17/" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-cyan-600 transition-all font-semibold">phamductruong17</a></span>
        </div>
        <p className="text-[10px] text-gray-400 font-medium">© {new Date().getFullYear()} DTA Studio. Bảo lưu mọi quyền.</p>
      </footer>
    </div>
  );
}
