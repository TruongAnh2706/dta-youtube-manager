import React, { useState, useMemo } from 'react';
import { Channel, Topic, Staff, FinancialRecord, VideoTask } from '../types';
import { Youtube, TrendingUp, AlertCircle, Hash, Users, DollarSign, Activity, CheckCircle2, KanbanSquare, Trophy, Clock, Calendar, Sparkles, LineChart, BrainCircuit, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { format, startOfYear, endOfYear, eachDayOfInterval, isSameDay, subDays, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { useToast } from '../hooks/useToast';
import { GoogleGenAI } from '@google/genai';

interface DashboardProps {
  channels: Channel[];
  topics: Topic[];
  staffList?: Staff[];
  financials?: FinancialRecord[];
  tasks?: VideoTask[];
  geminiApiKey?: string;
  currentUser?: Staff | { role: string; name: string; id: string } | null;
}

export function Dashboard({ channels, topics, staffList = [], financials = [], tasks = [], geminiApiKey, currentUser }: DashboardProps) {
  const { showToast } = useToast();
  const [isAIAnalyzing, setIsAIAnalyzing] = useState(false);
  const [aiInsights, setAiInsights] = useState<string[]>([]);

  const today = new Date();
  const activeChannels = channels.filter(c => c.status === 'active').length;
  const suspendedChannels = channels.filter(c => c.status === 'suspended').length;
  const totalSubscribers = channels.reduce((sum, c) => sum + c.subscribers, 0);
  const isManagement = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  // Calculate current month cashflow
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthFinancials = financials.filter(f => f.month === currentMonth);
  const totalRevenue = currentMonthFinancials.reduce((sum, f) => sum + f.revenue, 0);
  const totalExpenses = currentMonthFinancials.reduce((sum, f) => sum + f.expenses, 0);
  const netProfit = totalRevenue - totalExpenses;

  // Online staff
  const onlineStaff = staffList.filter(s => s.status === 'online');

  // Task stats
  const todayTasks = tasks.filter(t => isSameDay(new Date(t.dueDate), today));
  const todayPublished = todayTasks.filter(t => t.status === 'published').length;
  const todayTarget = todayTasks.length;

  const recentTasks = [...tasks].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()).slice(0, 5);

  // Top Channels
  const topChannels = [...channels].sort((a, b) => b.subscribers - a.subscribers).slice(0, 5);

  // Heatmap Data (Last 30 days)
  const last30Days = eachDayOfInterval({
    start: subDays(today, 29),
    end: today
  });

  const getTaskCountForDay = (date: Date) => {
    return tasks.filter(t => t.status === 'published' && isSameDay(new Date(t.dueDate), date)).length;
  };

  const getHeatmapColor = (count: number) => {
    if (count === 0) return 'bg-gray-100';
    if (count === 1) return 'bg-green-200';
    if (count === 2) return 'bg-green-300';
    if (count === 3) return 'bg-green-400';
    return 'bg-green-600';
  };

  // AI BI Logic
  const handleAIAnalysis = async () => {
    setIsAIAnalyzing(true);
    try {
      if (!geminiApiKey) {
        showToast('Vui lòng cấu hình Gemini API Key trong phần Cài đặt.', 'error');
        return;
      }

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const model = 'gemini-2.5-flash';

      const systemData = {
        totalChannels: channels.length,
        activeChannels,
        suspendedChannels,
        totalSubscribers,
        currentMonthProfit: isManagement ? netProfit : undefined,
        currentMonthRevenue: isManagement ? totalRevenue : undefined,
        todayKpi: `${todayPublished}/${todayTarget}`,
        onlineStaff: onlineStaff.length,
        topTopics: topics.slice(0, 3).map(t => t.name).join(', ')
      };

      const prompt = isManagement
        ? `Tư cách là quản lý MCN YouTube. Phân tích dữ liệu quản trị sau và đưa ra 3-5 lời khuyên chiến lược vận hành và tăng doanh thu ngắn gọn (mỗi lời khuyên 1 câu): ${JSON.stringify(systemData)}`
        : `Tư cách quản lý MCN. Phân tích dữ liệu sản xuất sau (không liên quan tài chính) và đưa ra 3-5 lời khuyên tối ưu năng suất, chất lượng video ngắn gọn (mỗi lời khuyên 1 câu): ${JSON.stringify(systemData)}`;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      const insights = response.text?.split('\n').filter(line => line.trim().length > 0).slice(0, 5) || [];
      setAiInsights(insights);
      showToast('AI đã hoàn thành phân tích hệ thống!', 'success');
    } catch (error) {
      console.error('AI BI Error:', error);
      showToast('Lỗi khi phân tích AI BI.', 'error');
    } finally {
      setIsAIAnalyzing(false);
    }
  };

  // Revenue Forecasting Logic
  const forecastData = useMemo(() => {
    if (financials.length < 2) return null;

    // Simple linear trend based on last 3 months
    const last3Months = financials
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 3);

    if (last3Months.length < 2) return null;

    const avgGrowth = last3Months.length >= 2
      ? (last3Months[0].revenue - last3Months[last3Months.length - 1].revenue) / (last3Months.length - 1)
      : 0;

    const nextMonthRevenue = Math.max(0, last3Months[0].revenue + avgGrowth);
    const growthRate = last3Months[0].revenue > 0 ? (avgGrowth / last3Months[0].revenue) * 100 : 0;

    return {
      nextMonth: format(addMonths(new Date(last3Months[0].month + '-01'), 1), 'MM/yyyy'),
      estimatedRevenue: nextMonthRevenue,
      growthRate
    };
  }, [financials]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Tổng quan Hệ thống (Heatmap)</h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleAIAnalysis}
            disabled={isAIAnalyzing}
            className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50"
          >
            {isAIAnalyzing ? <RefreshCw size={16} className="mr-2 animate-spin" /> : <BrainCircuit size={16} className="mr-2" />}
            AI Business Intelligence
          </button>
          <div className="flex items-center space-x-2 text-sm text-gray-500 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
            <Activity size={16} className="text-green-500" />
            <span>Trạng thái: <strong className="text-green-600">Hoạt động tốt</strong></span>
          </div>
        </div>
      </div>

      {/* AI Insights Panel */}
      {aiInsights.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 p-5 rounded-xl shadow-sm">
          <h3 className="text-purple-900 font-bold flex items-center mb-3">
            <Sparkles size={18} className="mr-2" /> AI Strategic Insights
          </h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {aiInsights.map((insight, idx) => (
              <li key={idx} className="flex items-start text-sm text-purple-800 bg-white/50 p-2 rounded-lg border border-purple-50">
                <span className="mr-2 mt-1 text-purple-400">•</span>
                {insight.replace(/^\d+\.\s*/, '')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg mr-4"><Youtube size={24} /></div>
          <div><p className="text-sm text-gray-500 font-medium">Tổng số kênh</p><p className="text-2xl font-bold text-gray-900">{channels.length}</p></div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg mr-4"><TrendingUp size={24} /></div>
          <div><p className="text-sm text-gray-500 font-medium">Kênh hoạt động</p><p className="text-2xl font-bold text-gray-900">{activeChannels}</p></div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-lg mr-4"><CheckCircle2 size={24} /></div>
          <div><p className="text-sm text-gray-500 font-medium">KPI Hôm nay</p><p className="text-2xl font-bold text-gray-900">{todayPublished}/{todayTarget}</p></div>
        </div>
        <div className={`bg-white p-5 rounded-xl shadow-sm border ${suspendedChannels > 0 ? 'border-red-500 animate-[pulse_2s_ease-in-out_infinite] shadow-red-100' : 'border-gray-100'} flex items-center`}>
          <div className="p-3 bg-red-50 text-red-600 rounded-lg mr-4"><AlertCircle size={24} /></div>
          <div><p className={`text-sm font-medium ${suspendedChannels > 0 ? 'text-red-600' : 'text-gray-500'}`}>Kênh bay màu</p><p className="text-2xl font-bold text-gray-900">{suspendedChannels}</p></div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg mr-4"><Users size={24} /></div>
          <div><p className="text-sm text-gray-500 font-medium">Người đăng ký</p><p className="text-2xl font-bold text-gray-900">{(totalSubscribers / 1000000).toFixed(2)}M</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Heatmap - Full Width */}
        <div className="lg:col-span-3 bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Calendar size={18} className="mr-2 text-green-500" /> Tần suất Xuất bản Video (30 ngày gần nhất)
            </h2>
            <div className="flex items-center space-x-2 text-[10px] text-gray-500">
              <span>Ít</span>
              <div className="w-3 h-3 bg-gray-100 rounded-sm"></div>
              <div className="w-3 h-3 bg-green-200 rounded-sm"></div>
              <div className="w-3 h-3 bg-green-400 rounded-sm"></div>
              <div className="w-3 h-3 bg-green-600 rounded-sm"></div>
              <span>Nhiều</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {last30Days.map((day, i) => {
              const count = getTaskCountForDay(day);
              return (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-medium transition-all hover:scale-110 cursor-help ${getHeatmapColor(count)} ${count > 0 ? 'text-white' : 'text-gray-400'}`}
                  title={`${format(day, 'dd/MM/yyyy')}: ${count} video đã xuất bản`}
                >
                  {format(day, 'd')}
                </div>
              );
            })}
          </div>
        </div>

        {/* Left Column: Top Channels & Tasks */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center"><Trophy size={18} className="mr-2 text-yellow-500" /> Top Kênh (Subscribers)</h2>
            <div className="space-y-3">
              {topChannels.map(channel => (
                <div key={channel.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-bold text-xs">
                      {(channel.name || '?').charAt(0)}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900 truncate w-32">{channel.name}</p>
                      <p className="text-[10px] text-gray-500">{(channel.subscribers / 1000).toFixed(1)}K subs</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${channel.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {channel.status}
                  </span>
                </div>
              ))}
              {topChannels.length === 0 && <p className="text-sm text-gray-500 text-center py-2">Chưa có dữ liệu kênh.</p>}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center"><Clock size={18} className="mr-2 text-blue-500" /> Lịch đăng hôm nay</h2>
            <div className="space-y-3">
              {todayTasks.map(task => {
                const channel = channels.find(c => c.id === task.channelId);
                return (
                  <div key={task.id} className={`flex items-center justify-between p-2 border-l-2 rounded-r-lg ${task.status === 'published' ? 'border-green-500 bg-green-50/30' : 'border-blue-500 bg-blue-50/30'}`}>
                    <div className="ml-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">[{channel?.channelCode || '??'}] {task.title}</p>
                      <p className="text-[10px] text-gray-500">
                        {task.assigneeIds.map(id => staffList.find(s => s.id === id)?.name).join(', ') || 'Chưa giao'}
                      </p>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ml-2 ${task.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {task.status === 'published' ? 'Xong' : 'Chưa'}
                    </span>
                  </div>
                );
              })}
              {todayTasks.length === 0 && <p className="text-sm text-gray-500 text-center py-2">Không có lịch đăng hôm nay.</p>}
            </div>
          </div>
        </div>

        {/* Middle Column: Heatmap / Topic Distribution */}
        <div className={`${isManagement ? 'lg:col-span-1' : 'lg:col-span-2'} bg-white p-5 rounded-xl shadow-sm border border-gray-100`}>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center"><Hash size={18} className="mr-2 text-purple-500" /> Phân bổ Chủ đề (Heatmap)</h2>
          <div className="space-y-4">
            {topics.map(topic => {
              const count = channels.filter(c => (c.topicIds || []).includes(topic.id)).length;
              const percentage = channels.length > 0 ? Math.round((count / channels.length) * 100) : 0;

              return (
                <div key={topic.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{topic.name}</span>
                    <span className="text-gray-500">{count} kênh ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%`, backgroundColor: topic.color }}
                    ></div>
                  </div>
                </div>
              );
            })}
            {topics.length === 0 && (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                Chưa có dữ liệu chủ đề
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Cashflow & Forecasting */}
        {isManagement && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center"><DollarSign size={18} className="mr-2 text-green-500" /> Dòng tiền Tháng {currentMonth.split('-')[1]}</h2>

              <div className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                  <p className="text-sm text-green-800 font-medium mb-1">Tổng Doanh Thu</p>
                  <p className="text-2xl font-bold text-green-600">{totalRevenue.toLocaleString('vi-VN')} đ</p>
                </div>

                <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                  <p className="text-sm text-red-800 font-medium mb-1">Tổng Chi Phí</p>
                  <p className="text-2xl font-bold text-red-600">{totalExpenses.toLocaleString('vi-VN')} đ</p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 relative overflow-hidden">
                  <div className="relative z-10">
                    <p className="text-sm text-blue-800 font-medium mb-1">Lợi Nhuận Ròng</p>
                    <p className="text-3xl font-bold text-blue-600">{netProfit.toLocaleString('vi-VN')} đ</p>
                  </div>
                  <TrendingUp size={80} className="absolute -bottom-4 -right-4 text-blue-100 opacity-50" />
                </div>
              </div>
            </div>

            {/* Revenue Forecasting */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <LineChart size={18} className="mr-2 text-indigo-500" /> Dự báo Doanh thu (AI)
              </h2>
              {forecastData ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                    <div>
                      <p className="text-xs text-indigo-700 font-medium uppercase">Dự báo tháng {forecastData.nextMonth}</p>
                      <p className="text-xl font-bold text-indigo-900">{forecastData.estimatedRevenue.toLocaleString('vi-VN')} đ</p>
                    </div>
                    <div className={`flex items-center ${forecastData.growthRate >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {forecastData.growthRate >= 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                      <span className="font-bold ml-1">{Math.abs(forecastData.growthRate).toFixed(1)}%</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 italic">
                    * Dự báo dựa trên xu hướng tăng trưởng của 3 tháng gần nhất. Kết quả thực tế có thể thay đổi tùy theo biến động thị trường.
                  </p>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400 text-xs italic">
                  Cần ít nhất 2 tháng dữ liệu tài chính để thực hiện dự báo.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
