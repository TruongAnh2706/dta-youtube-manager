import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Channel, ChannelMetric, Staff } from '../types';
import { useToast } from '../hooks/useToast';
import { Calendar, DollarSign, TrendingUp, AlertTriangle, CheckCircle, Edit3, X, Eye, Lock } from 'lucide-react';
import { format, subDays, isAfter, isBefore, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDaysInMonth, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';

interface MonetizationReportProps {
  channels: Channel[];
  metrics: ChannelMetric[];
  currentStaff: Staff | null;
  isAdmin: boolean;
  staffList: Staff[];
}

export function MonetizationReport({ channels, metrics, currentStaff, isAdmin, staffList }: MonetizationReportProps) {
  const { showToast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'views' | 'revenue'>('views');
  
  const [selectedCell, setSelectedCell] = useState<{channelId: string, dateStr: string} | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editUsd, setEditUsd] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [currentExchangeRate, setCurrentExchangeRate] = useState(25400); // Tỉ giá mặc định

  // Lấy tỷ giá (giả lập hoặc fetch từ API nếu cần)
  useEffect(() => {
      // Ở đây có thể fetch API thật, ví dụ:
      // fetch('https://api.exchangerate-api.com/v4/latest/USD')
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

  const toggleMonetization = async (channelId: string, currentState: boolean) => {
    try {
      const { error } = await supabase.from('channels').update({
        is_monetized: !currentState,
        monetization_date: !currentState ? new Date().toISOString() : null
      }).eq('id', channelId);
      
      if (error) throw error;
      showToast(!currentState ? 'Đã thêm kênh vào danh sách BKT!' : 'Đã gỡ kênh khỏi danh sách BKT', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    // Nếu tháng này là tháng hiện tại, không hiển thị quá ngày hiện tại để đỡ rác
    const today = new Date();
    const endDateToUse = isBefore(today, end) ? today : end;
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const getMetric = (channelId: string, dateStr: string) => {
    return metrics.find(m => m.channelId === channelId && m.reportDate === dateStr);
  };

  const isLocked = (date: Date, type: 'views' | 'revenue') => {
    const today = new Date();
    // YouTube trễ 1 ngày cho View, 2 ngày cho Doanh thu
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
        // Cần log lại history vào audit_log hoặc system_settings (ở đây tạm update trực tiếp)
        const res = await supabase.from('channel_metrics').update(updateData).eq('id', existing.id);
        error = res.error;
      } else {
        updateData.id = crypto.randomUUID();
        const res = await supabase.from('channel_metrics').insert([updateData]);
        error = res.error;
      }

      if (error) throw error;
      showToast('Đã lưu báo cáo thành công!', 'success');
      setSelectedCell(null);
    } catch (err: any) {
      showToast(err.message, 'error');
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <DollarSign className="mr-3 text-green-600" size={28} />
            Báo Cáo Kênh Bật Kiếm Tiền
          </h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý View và Doanh thu hàng ngày (Realtime USD -&gt; VNĐ)</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start shadow-sm">
          <AlertTriangle className="text-blue-500 mr-3 shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-blue-900">
              <p className="font-bold mb-1">Lưu ý về độ trễ dữ liệu của YouTube:</p>
              <ul className="list-disc pl-4 space-y-1 text-blue-800">
                  <li><strong>View:</strong> YouTube cập nhật chậm 1 ngày. Cột ngày hôm nay sẽ bị khóa.</li>
                  <li><strong>Doanh thu:</strong> YouTube cập nhật chậm 2 ngày. Cột hôm nay và hôm qua sẽ bị khóa.</li>
                  <li><strong>Cảnh báo (Màu Đỏ):</strong> Nếu một ô đã đến hạn báo cáo mà để trống, nó sẽ bị bôi đỏ.</li>
              </ul>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Danh sách quản lý kênh BKT */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col h-[600px]">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center">
            <TrendingUp size={18} className="mr-2 text-green-500"/>
            Kênh đang BKT ({monetizedChannels.length})
          </h2>
          <div className="overflow-y-auto flex-1 space-y-2 pr-2">
            {monetizedChannels.map(c => (
              <div key={c.id} className="p-3 border border-green-200 bg-green-50 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-bold text-green-900 text-sm truncate w-32">{c.name}</div>
                  <div className="text-xs text-green-700 mt-0.5">Từ: {c.monetizationDate ? format(new Date(c.monetizationDate), 'dd/MM/yyyy') : 'N/A'}</div>
                </div>
                <button 
                  onClick={() => toggleMonetization(c.id, true)}
                  className="p-1.5 bg-white text-red-500 rounded hover:bg-red-50 border border-red-100 transition-colors" title="Bỏ BKT"
                >
                  <X size={14}/>
                </button>
              </div>
            ))}
            {monetizedChannels.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Chưa có kênh nào</p>
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Các kênh khác của bạn</h3>
            <div className="overflow-y-auto max-h-[200px] space-y-2 pr-2">
              {nonMonetizedChannels.map(c => (
                <div key={c.id} className="p-2 border border-gray-200 hover:border-blue-300 rounded-lg flex items-center justify-between group">
                  <span className="font-medium text-gray-700 text-xs truncate w-32">{c.name}</span>
                  <button 
                    onClick={() => toggleMonetization(c.id, false)}
                    className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Đánh dấu BKT
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bảng báo cáo */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[600px] overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div className="flex space-x-2">
              <button onClick={() => setActiveTab('views')} className={`px-4 py-2 text-sm font-bold rounded-lg ${activeTab === 'views' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>Theo View</button>
              <button onClick={() => setActiveTab('revenue')} className={`px-4 py-2 text-sm font-bold rounded-lg ${activeTab === 'revenue' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>Theo Doanh Thu</button>
            </div>
            <div className="flex items-center space-x-3 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
              <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded"><X size={16} className="hidden"/></button>
              <button onClick={() => changeMonth(-1)} className="text-sm font-bold text-gray-600 hover:text-gray-900">&lt;</button>
              <span className="text-sm font-bold w-24 text-center">Tháng {format(currentDate, 'MM/yyyy')}</span>
              <button onClick={() => changeMonth(1)} className="text-sm font-bold text-gray-600 hover:text-gray-900">&gt;</button>
            </div>
          </div>

          <div className="overflow-x-auto flex-1 p-4">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-gray-200 bg-gray-100 p-2 text-left sticky left-0 z-10 w-40 min-w-[160px]">Kênh</th>
                  {daysInMonth.map(d => {
                    const locked = isLocked(d, activeTab);
                    return (
                      <th key={d.toString()} className={`border border-gray-200 p-2 min-w-[80px] text-center ${locked ? 'bg-gray-50 opacity-50' : 'bg-gray-100'}`}>
                        {format(d, 'dd/MM')}
                        {locked && <Lock size={10} className="mx-auto mt-1 text-gray-400" />}
                      </th>
                    );
                  })}
                  <th className="border border-gray-200 bg-yellow-50 p-2 text-center min-w-[100px] font-bold">Tổng</th>
                </tr>
              </thead>
              <tbody>
                {monetizedChannels.map(channel => {
                  let rowTotal = 0;
                  
                  return (
                    <tr key={channel.id} className="hover:bg-gray-50">
                      <td className="border border-gray-200 p-2 bg-white sticky left-0 z-10 font-bold text-gray-700 truncate max-w-[160px]">
                        {channel.name}
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
                            rowTotal += metric.revenueUsd; // Tính tổng USD
                          } else if (!locked) {
                            isMissing = true;
                          }
                        }

                        // Không tính missing nếu ngày chưa BKT
                        if (isMissing && channel.monetizationDate && isBefore(d, startOfDay(new Date(channel.monetizationDate)))) {
                           isMissing = false;
                           displayValue = ''; // Không cần nhập trước khi BKT
                        }

                        return (
                          <td 
                            key={d.toString()} 
                            onClick={() => !locked && openCell(channel.id, d)}
                            className={`border border-gray-200 p-2 text-center text-xs cursor-pointer transition-colors
                              ${locked ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 
                                isMissing ? 'bg-red-50 text-red-600 font-bold hover:bg-red-100' : 
                                'hover:bg-blue-50 text-gray-800'
                              }
                            `}
                          >
                            {displayValue}
                          </td>
                        );
                      })}
                      <td className="border border-gray-200 p-2 bg-yellow-50 text-center font-bold text-yellow-800">
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

      {/* Edit Modal */}
      {selectedCell && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[400px] shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">
                Cập nhật {activeTab === 'views' ? 'View' : 'Doanh thu'} 
              </h3>
              <button onClick={() => setSelectedCell(null)} className="text-gray-400 hover:text-gray-700"><X size={20}/></button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Kênh: <strong>{channels.find(c => c.id === selectedCell.channelId)?.name}</strong><br/>
              Ngày: <strong>{format(new Date(selectedCell.dateStr), 'dd/MM/yyyy')}</strong>
            </p>

            {activeTab === 'views' ? (
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">Số View trong ngày</label>
                <input 
                  type="number" 
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                  placeholder="Ví dụ: 15000"
                  autoFocus
                />
              </div>
            ) : (
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Doanh thu USD (YouTube)</label>
                  <div className="relative">
                    <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input 
                      type="number" 
                      step="0.01"
                      value={editUsd}
                      onChange={e => setEditUsd(e.target.value)}
                      className="w-full border rounded-lg pl-8 p-2 focus:ring-2 focus:ring-green-500"
                      placeholder="Ví dụ: 15.50"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-500 mb-1">Quy đổi tạm tính (Tỷ giá: {formatCurrency(currentExchangeRate)}đ)</div>
                  <div className="font-bold text-green-700 text-lg">
                    {formatCurrency(parseFloat(editUsd || '0') * currentExchangeRate)} VNĐ
                  </div>
                </div>
              </div>
            )}

            {/* Hiển thị log sửa đổi nếu có */}
            {getMetric(selectedCell.channelId, selectedCell.dateStr)?.updatedAt && (
              <div className="text-xs text-gray-400 mb-4 italic">
                Sửa lần cuối bởi {staffList.find(s => s.id === getMetric(selectedCell.channelId, selectedCell.dateStr)?.updatedBy)?.name || 'Unknown'} 
                vào lúc {format(new Date(getMetric(selectedCell.channelId, selectedCell.dateStr)!.updatedAt!), 'HH:mm dd/MM/yyyy')}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setSelectedCell(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Hủy</button>
              <button 
                onClick={handleSaveMetric}
                disabled={isSaving || (activeTab === 'views' ? !editValue : !editUsd)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu báo cáo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
