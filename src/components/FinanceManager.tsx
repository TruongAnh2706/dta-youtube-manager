import React, { useState, useMemo } from 'react';
import { FinancialRecord, Channel, VideoTask, Staff, Transaction, FinancialAccount, TransactionCategory, TransactionType } from '../types';
import {
  Plus, Edit2, Trash2, X, DollarSign, TrendingUp, TrendingDown,
  PieChart as PieChartIcon, BarChart as BarChartIcon, Calculator,
  ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Wallet, Banknote,
  CreditCard, History, LayoutGrid, FileText, ChevronRight, Search, Filter, ShieldAlert, RefreshCw, Sparkles
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';

interface FinanceManagerProps {
  financials: FinancialRecord[];
  setFinancials: React.Dispatch<React.SetStateAction<FinancialRecord[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  accounts: FinancialAccount[];
  setAccounts: React.Dispatch<React.SetStateAction<FinancialAccount[]>>;
  categories: TransactionCategory[];
  setCategories: React.Dispatch<React.SetStateAction<TransactionCategory[]>>;
  channels: Channel[];
  tasks: VideoTask[];
  staffList: Staff[];
  geminiApiKey?: string;
}

type FinanceTab = 'overview' | 'transactions' | 'accounts' | 'channels';

export function FinanceManager({
  financials, setFinancials,
  transactions, setTransactions,
  accounts, setAccounts,
  categories, setCategories,
  channels, tasks, staffList, geminiApiKey
}: FinanceManagerProps) {
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [modalType, setModalType] = useState<'record' | 'transaction' | 'account'>('record');
  const [editingId, setEditingId] = useState<string | null>(null);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [filterMonth, setFilterMonth] = useState<string>(currentMonth);

  // --- Transaction Logic ---
  const [transFormData, setTransFormData] = useState<Omit<Transaction, 'id'>>({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    type: 'expense',
    categoryId: categories[0]?.id || '',
    accountId: accounts[0]?.id || '',
    description: '',
    status: 'completed'
  });
  const [isOtherCategory, setIsOtherCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleOpenTransModal = (trans?: Transaction) => {
    setModalType('transaction');
    setIsOtherCategory(false);
    setNewCategoryName('');
    if (trans) {
      setEditingId(trans.id);
      setTransFormData({
        date: trans.date,
        amount: trans.amount,
        type: trans.type,
        categoryId: trans.categoryId,
        accountId: trans.accountId,
        toAccountId: trans.toAccountId,
        description: trans.description,
        referenceId: trans.referenceId,
        referenceType: trans.referenceType,
        status: trans.status
      });
    } else {
      setEditingId(null);
      const defaultCat = categories.find(c => c.type === 'expense')?.id || categories[0]?.id || '';
      setTransFormData({
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        type: 'expense',
        categoryId: defaultCat,
        accountId: accounts[0]?.id || '',
        description: '',
        status: 'completed'
      });
    }
    setIsModalOpen(true);
  };

  const handleTransSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let finalCategoryId = transFormData.categoryId;

    if (isOtherCategory && newCategoryName.trim()) {
      const newCat: TransactionCategory = {
        id: Date.now().toString(),
        name: newCategoryName.trim(),
        type: transFormData.type as 'income' | 'expense'
      };
      setCategories(prev => [...prev, newCat]);
      finalCategoryId = newCat.id;
    }

    const newTrans: Transaction = {
      id: editingId || Date.now().toString(),
      ...transFormData,
      categoryId: finalCategoryId
    };

    if (editingId) {
      setTransactions(prev => prev.map(t => t.id === editingId ? newTrans : t));
      showToast('Đã cập nhật giao dịch thành công!', 'success');
    } else {
      setTransactions(prev => [newTrans, ...prev]);
      showToast('Đã thêm giao dịch mới thành công!', 'success');
    }

    // Update account balances
    setAccounts(prev => prev.map(acc => {
      let newBalance = acc.balance;

      if (acc.id === transFormData.accountId) {
        if (transFormData.type === 'income') newBalance += transFormData.amount;
        if (transFormData.type === 'expense') newBalance -= transFormData.amount;
        if (transFormData.type === 'transfer') newBalance -= transFormData.amount;
      }
      if (transFormData.type === 'transfer' && acc.id === transFormData.toAccountId) {
        newBalance += transFormData.amount;
      }
      return { ...acc, balance: newBalance };
    }));

    setIsModalOpen(false);
  };

  // --- Account Logic ---
  const [accFormData, setAccFormData] = useState<Omit<FinancialAccount, 'id'>>({
    name: '',
    type: 'bank',
    balance: 0,
    currency: 'VND',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    branch: ''
  });

  const handleOpenAccModal = (acc?: FinancialAccount) => {
    setModalType('account');
    if (acc) {
      setEditingId(acc.id);
      setAccFormData({
        name: acc.name,
        type: acc.type,
        balance: acc.balance,
        currency: acc.currency,
        bankName: acc.bankName || '',
        accountNumber: acc.accountNumber || '',
        accountHolder: acc.accountHolder || '',
        branch: acc.branch || ''
      });
    } else {
      setEditingId(null);
      setAccFormData({
        name: '',
        type: 'bank',
        balance: 0,
        currency: 'VND',
        bankName: '',
        accountNumber: '',
        accountHolder: '',
        branch: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleAccSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      setAccounts(prev => prev.map(a => a.id === editingId ? { ...a, ...accFormData } : a));
      showToast('Đã cập nhật tài khoản thành công!', 'success');
    } else {
      setAccounts(prev => [...prev, { id: Date.now().toString(), ...accFormData }]);
      showToast('Đã thêm tài khoản mới thành công!', 'success');
    }
    setIsModalOpen(false);
  };

  const handleDeleteAccount = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa tài khoản này?')) {
      setAccounts(prev => prev.filter(a => a.id !== id));
    }
  };

  // --- Calculations ---
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => t.date.startsWith(filterMonth));
  }, [transactions, filterMonth]);

  const stats = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, profit: income - expense };
  }, [filteredTransactions]);

  // --- Channel Record Logic ---
  const [recordFormData, setRecordFormData] = useState<Omit<FinancialRecord, 'id'>>({
    channelId: channels[0]?.id || '',
    month: currentMonth,
    revenue: 0,
    rpm: 0,
    cpm: 0,
    expenses: 0,
    netProfit: 0,
    notes: ''
  });

  const handleOpenRecordModal = (record?: FinancialRecord) => {
    setModalType('record');
    if (record) {
      setEditingId(record.id);
      setRecordFormData({
        channelId: record.channelId,
        month: record.month,
        revenue: record.revenue,
        rpm: record.rpm,
        cpm: record.cpm,
        expenses: record.expenses,
        netProfit: record.netProfit,
        notes: record.notes
      });
    } else {
      setEditingId(null);
      setRecordFormData({
        channelId: channels[0]?.id || '',
        month: filterMonth,
        revenue: 0,
        rpm: 0,
        cpm: 0,
        expenses: 0,
        netProfit: 0,
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleRecordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const netProfit = recordFormData.revenue - recordFormData.expenses;
    const roi = recordFormData.expenses > 0 ? (netProfit / recordFormData.expenses) * 100 : 0;
    const finalData = { ...recordFormData, netProfit, roi };

    if (editingId) {
      setFinancials(prev => prev.map(f => f.id === editingId ? { ...f, ...finalData } : f));
      showToast('Đã cập nhật báo cáo kênh thành công!', 'success');
    } else {
      setFinancials(prev => [...prev, { id: Date.now().toString(), ...finalData }]);
      showToast('Đã thêm báo cáo kênh mới thành công!', 'success');
    }
    setIsModalOpen(false);
  };

  const handleAutoCalculateSalary = () => {
    // ... existing logic ...
  };

  const handleAIFinancialAdvice = async () => {
    setIsAnalyzing(true);
    try {
      if (!geminiApiKey) {
        showToast('Vui lòng cấu hình Gemini API Key.', 'error');
        return;
      }

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const model = 'gemini-2.5-flash';

      const financialData = {
        totalRevenue: stats.income,
        totalExpense: stats.expense,
        profit: stats.profit,
        channelPerformance: filteredRecords.map(r => ({
          name: channels.find(c => c.id === r.channelId)?.name,
          revenue: r.revenue,
          roi: r.roi
        }))
      };

      const prompt = `Phân tích dữ liệu tài chính của hệ thống YouTube: ${JSON.stringify(financialData)}. 
      Hãy đưa ra 3 lời khuyên chiến lược để tối ưu lợi nhuận, giảm chi phí hoặc tái đầu tư. Trả về định dạng Markdown ngắn gọn.`;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      setAiAdvice(response.text || 'Không có lời khuyên nào.');
      showToast('AI đã hoàn thành phân tích tài chính.', 'success');
    } catch (error) {
      showToast('Lỗi khi phân tích tài chính.', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filteredRecords = financials.filter(f => f.month === filterMonth);
  const totalChannelRevenue = filteredRecords.reduce((sum, r) => sum + r.revenue, 0);
  const totalChannelExpenses = filteredRecords.reduce((sum, r) => sum + r.expenses, 0);
  const totalChannelProfit = totalChannelRevenue - totalChannelExpenses;

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('vi-VN') + ' đ';
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản trị Tài chính Doanh nghiệp</h1>
          <p className="text-sm text-gray-500 mt-1">Hệ thống quản lý thu chi, dòng tiền và P&L chuyên nghiệp</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
          />
          {activeTab === 'transactions' && hasPermission('finance_edit') && (
            <button
              onClick={() => handleOpenTransModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors whitespace-nowrap"
            >
              <Plus size={16} className="mr-2" /> Thêm giao dịch
            </button>
          )}
          {activeTab === 'channels' && hasPermission('finance_edit') && (
            <div className="flex gap-2">
              <button
                onClick={() => handleOpenRecordModal()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors whitespace-nowrap"
              >
                <Plus size={16} className="mr-2" /> Thêm báo cáo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 shrink-0">
        {[
          { id: 'overview', label: 'Tổng quan', icon: LayoutGrid },
          { id: 'transactions', label: 'Sổ cái / Giao dịch', icon: History },
          { id: 'accounts', label: 'Tài khoản / Ví', icon: Wallet, permission: 'finance_view_accounts' },
          { id: 'channels', label: 'Báo cáo Kênh (P&L)', icon: BarChartIcon },
        ].filter(tab => !tab.permission || hasPermission(tab.permission as any)).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as FinanceTab)}
            className={`flex items-center px-6 py-3 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <tab.icon size={16} className="mr-2" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {activeTab === 'overview' && (
          <div className="space-y-6 pb-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-500">Tổng Thu (Tháng)</h3>
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><TrendingUp size={20} /></div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.income)}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-500">Tổng Chi (Tháng)</h3>
                  <div className="p-2 bg-red-100 text-red-600 rounded-lg"><TrendingDown size={20} /></div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.expense)}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-500">Lợi nhuận ròng</h3>
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><DollarSign size={20} /></div>
                </div>
                <p className={`text-2xl font-bold ${stats.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(stats.profit)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* AI Financial Advisor */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                    <Sparkles size={16} className="mr-2 text-indigo-500" /> AI Cố vấn Tài chính
                  </h3>
                  <button
                    onClick={handleAIFinancialAdvice}
                    disabled={isAnalyzing}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-colors"
                  >
                    {isAnalyzing ? <RefreshCw size={12} className="mr-1 animate-spin" /> : <Calculator size={12} className="mr-1" />}
                    Phân tích ngay
                  </button>
                </div>
                {aiAdvice ? (
                  <div className="prose prose-sm max-w-none text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <ReactMarkdown>{aiAdvice}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400 border-2 border-dashed border-gray-100 rounded-lg">
                    <Calculator size={32} className="mb-2 opacity-20" />
                    <p className="text-xs italic">Nhấn "Phân tích ngay" để AI đưa ra lời khuyên tài chính cho tháng này</p>
                  </div>
                )}
              </div>

              {/* Cashflow Chart */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
                  <TrendingUp size={16} className="mr-2 text-blue-500" /> Biến động dòng tiền
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredTransactions.sort((a, b) => a.date.localeCompare(b.date)).map(t => ({
                      date: format(parseISO(t.date), 'dd/MM'),
                      amount: t.type === 'income' ? t.amount : -t.amount
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Area type="monotone" dataKey="amount" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Account Balances */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
                  <Wallet size={16} className="mr-2 text-purple-500" /> Số dư tài khoản
                </h3>
                {hasPermission('finance_view_accounts') ? (
                  <div className="space-y-4">
                    {accounts.map(acc => (
                      <div key={acc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="p-2 bg-white rounded-md shadow-sm mr-3">
                            {acc.type === 'bank' ? <CreditCard size={18} className="text-blue-600" /> : <Banknote size={18} className="text-emerald-600" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{acc.name}</p>
                            <p className="text-xs text-gray-500 capitalize">{acc.type}</p>
                          </div>
                        </div>
                        <p className="font-bold text-gray-900">{formatCurrency(acc.balance)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <ShieldAlert size={32} className="mb-2 opacity-20" />
                    <p className="text-xs italic">Bạn không có quyền xem số dư tài khoản</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="p-4 font-semibold">Ngày</th>
                    <th className="p-4 font-semibold">Mô tả</th>
                    <th className="p-4 font-semibold">Danh mục</th>
                    <th className="p-4 font-semibold">Tài khoản</th>
                    <th className="p-4 font-semibold text-right">Số tiền</th>
                    <th className="p-4 font-semibold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTransactions.sort((a, b) => b.date.localeCompare(a.date)).map(t => {
                    const category = categories.find(c => c.id === t.categoryId);
                    const account = accounts.find(a => a.id === t.accountId);
                    return (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="p-4 text-sm text-gray-600">{format(parseISO(t.date), 'dd/MM/yyyy')}</td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{t.description}</span>
                            {t.referenceId && (
                              <span className="text-[10px] text-blue-600 flex items-center mt-1">
                                <FileText size={10} className="mr-1" /> Ref: {t.referenceType}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.type === 'income' ? 'bg-emerald-100 text-emerald-700' :
                            t.type === 'expense' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                            {category?.name || 'Chưa phân loại'}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-gray-600">{account?.name}</td>
                        <td className={`p-4 text-right font-bold ${t.type === 'income' ? 'text-emerald-600' :
                          t.type === 'expense' ? 'text-red-600' : 'text-blue-600'
                          }`}>
                          {t.type === 'expense' ? '-' : t.type === 'income' ? '+' : ''}
                          {formatCurrency(t.amount)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {hasPermission('finance_edit') && (
                              <button onClick={() => handleOpenTransModal(t)} className="p-1 text-gray-400 hover:text-blue-600"><Edit2 size={14} /></button>
                            )}
                            {hasPermission('finance_edit') && (
                              <button onClick={() => setTransactions(prev => prev.filter(x => x.id !== t.id))} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTransactions.length === 0 && (
                    <tr><td colSpan={6} className="p-12 text-center text-gray-500">Chưa có giao dịch nào trong tháng này.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map(acc => (
              <div key={acc.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl ${acc.type === 'bank' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {acc.type === 'bank' ? <CreditCard size={24} /> : <Banknote size={24} />}
                  </div>
                  {hasPermission('finance_edit') && (
                    <div className="flex space-x-1">
                      <button onClick={() => handleOpenAccModal(acc)} className="p-1 text-gray-400 hover:text-blue-600"><Edit2 size={16} /></button>
                      <button onClick={() => handleDeleteAccount(acc.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{acc.name}</h3>
                <p className="text-sm text-gray-500 mb-4 capitalize">{acc.type}</p>
                <div className="mt-auto pt-4 border-t border-gray-50">
                  <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider mb-1">Số dư hiện tại</p>
                  <p className="text-2xl font-black text-gray-900">{formatCurrency(acc.balance)}</p>
                </div>
              </div>
            ))}
            {hasPermission('finance_edit') && (
              <button onClick={() => handleOpenAccModal()} className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-all group min-h-[200px]">
                <div className="p-3 bg-gray-50 rounded-full mb-3 group-hover:bg-blue-50">
                  <Plus size={24} />
                </div>
                <span className="font-medium">Thêm tài khoản mới</span>
              </button>
            )}
          </div>
        )}

        {activeTab === 'channels' && (
          <div className="space-y-6">
            {/* Summary Cards for Channels */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-500">Doanh thu Kênh</h3>
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><DollarSign size={20} /></div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalChannelRevenue)}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-500">Chi phí Kênh</h3>
                  <div className="p-2 bg-red-100 text-red-600 rounded-lg"><TrendingDown size={20} /></div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalChannelExpenses)}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-500">Lợi nhuận Kênh</h3>
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><TrendingUp size={20} /></div>
                </div>
                <p className={`text-2xl font-bold ${totalChannelProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(totalChannelProfit)}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                      <th className="p-4 font-semibold">Kênh</th>
                      <th className="p-4 font-semibold">Doanh thu</th>
                      <th className="p-4 font-semibold">RPM / CPM</th>
                      <th className="p-4 font-semibold">Chi phí</th>
                      <th className="p-4 font-semibold">Lợi nhuận</th>
                      <th className="p-4 font-semibold">ROI</th>
                      <th className="p-4 font-semibold text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRecords.map(record => {
                      const channel = channels.find(c => c.id === record.channelId);
                      return (
                        <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4 font-medium text-gray-900 flex items-center">
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 mr-2 font-bold">
                              {channel?.channelCode || '??'}
                            </span>
                            {channel?.name || 'Kênh đã xóa'}
                          </td>
                          <td className="p-4 text-emerald-600 font-medium">{formatCurrency(record.revenue)}</td>
                          <td className="p-4 text-xs text-gray-600">{formatCurrency(record.rpm)} / {formatCurrency(record.cpm)}</td>
                          <td className="p-4 text-red-500">{formatCurrency(record.expenses)}</td>
                          <td className={`p-4 font-bold ${record.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(record.netProfit)}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${(record.roi || 0) >= 100 ? 'bg-green-100 text-green-700' :
                              (record.roi || 0) > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                              }`}>
                              {(record.roi || 0).toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end space-x-2">
                              {hasPermission('finance_edit') && (
                                <button onClick={() => handleOpenRecordModal(record)} className="p-1 text-gray-400 hover:text-emerald-600"><Edit2 size={16} /></button>
                              )}
                              {hasPermission('finance_edit') && (
                                <button onClick={() => setFinancials(prev => prev.filter(f => f.id !== record.id))} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredRecords.length === 0 && (
                      <tr><td colSpan={7} className="p-12 text-center text-gray-500">Chưa có dữ liệu báo cáo kênh cho tháng này.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-semibold">
                {modalType === 'transaction' ? (editingId ? 'Sửa giao dịch' : 'Thêm giao dịch mới') :
                  modalType === 'record' ? (editingId ? 'Sửa báo cáo kênh' : 'Thêm báo cáo kênh mới') : 'Tài khoản'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="overflow-y-auto p-4">
              {modalType === 'transaction' && (
                <form id="trans-form" onSubmit={handleTransSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ngày</label>
                      <input type="date" required value={transFormData.date} onChange={e => setTransFormData({ ...transFormData, date: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Loại</label>
                      <select value={transFormData.type} onChange={e => setTransFormData({ ...transFormData, type: e.target.value as TransactionType })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                        <option value="income">Thu nhập</option>
                        <option value="expense">Chi phí</option>
                        <option value="transfer">Chuyển khoản</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền (VNĐ)</label>
                    <input type="number" required value={transFormData.amount} onChange={e => setTransFormData({ ...transFormData, amount: parseFloat(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục</label>
                      <select
                        value={isOtherCategory ? 'khac' : transFormData.categoryId}
                        onChange={e => {
                          if (e.target.value === 'khac') {
                            setIsOtherCategory(true);
                          } else {
                            setIsOtherCategory(false);
                            setTransFormData({ ...transFormData, categoryId: e.target.value });
                          }
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        {categories.filter(c => c.type === (transFormData.type === 'income' ? 'income' : 'expense')).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                        <option value="khac">-- Khác (Tự điền) --</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tài khoản</label>
                      <select value={transFormData.accountId} onChange={e => setTransFormData({ ...transFormData, accountId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  </div>
                  {isOtherCategory && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tên danh mục mới</label>
                      <input
                        type="text"
                        required
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="Nhập tên danh mục..."
                      />
                    </div>
                  )}
                  {transFormData.type === 'transfer' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Đến tài khoản</label>
                      <select value={transFormData.toAccountId} onChange={e => setTransFormData({ ...transFormData, toAccountId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                        <option value="">-- Chọn tài khoản nhận --</option>
                        {accounts.filter(a => a.id !== transFormData.accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                    <textarea value={transFormData.description} onChange={e => setTransFormData({ ...transFormData, description: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Nhập nội dung giao dịch..." />
                  </div>
                </form>
              )}

              {modalType === 'account' && (
                <form id="acc-form" onSubmit={handleAccSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tên tài khoản / Ví</label>
                    <input type="text" required value={accFormData.name} onChange={e => setAccFormData({ ...accFormData, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="VD: Vietcombank Chính, Ví Momo..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Loại</label>
                      <select value={accFormData.type} onChange={e => setAccFormData({ ...accFormData, type: e.target.value as any })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                        <option value="bank">Ngân hàng</option>
                        <option value="cash">Tiền mặt</option>
                        <option value="e-wallet">Ví điện tử</option>
                        <option value="credit">Thẻ tín dụng</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Số dư khởi tạo</label>
                      <input type="number" required value={accFormData.balance} onChange={e => setAccFormData({ ...accFormData, balance: parseFloat(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  {accFormData.type === 'bank' && (
                    <div className="space-y-4 pt-2 border-t border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase">Thông tin ngân hàng</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Tên ngân hàng</label>
                          <input type="text" value={accFormData.bankName} onChange={e => setAccFormData({ ...accFormData, bankName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="VD: Vietcombank" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Số tài khoản</label>
                          <input type="text" value={accFormData.accountNumber} onChange={e => setAccFormData({ ...accFormData, accountNumber: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="123456789" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Chủ tài khoản</label>
                          <input type="text" value={accFormData.accountHolder} onChange={e => setAccFormData({ ...accFormData, accountHolder: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="NGUYEN VAN A" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Chi nhánh</label>
                          <input type="text" value={accFormData.branch} onChange={e => setAccFormData({ ...accFormData, branch: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Hà Nội" />
                        </div>
                      </div>
                    </div>
                  )}
                </form>
              )}
              {modalType === 'record' && (
                <form id="record-form" onSubmit={handleRecordSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kênh</label>
                      <select required value={recordFormData.channelId} onChange={e => setRecordFormData({ ...recordFormData, channelId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                        {channels.map(c => <option key={c.id} value={c.id}>[{c.channelCode}] {c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tháng</label>
                      <input type="month" required value={recordFormData.month} onChange={e => setRecordFormData({ ...recordFormData, month: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Doanh thu (VNĐ)</label>
                      <input type="number" required value={recordFormData.revenue} onChange={e => setRecordFormData({ ...recordFormData, revenue: parseFloat(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                        Chi phí (VNĐ)
                        <button type="button" onClick={handleAutoCalculateSalary} className="text-[10px] text-blue-600 hover:text-blue-700 flex items-center font-bold uppercase tracking-tighter">
                          <Calculator size={10} className="mr-1" /> Tính lương
                        </button>
                      </label>
                      <input type="number" required value={recordFormData.expenses} onChange={e => setRecordFormData({ ...recordFormData, expenses: parseFloat(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">RPM (VNĐ)</label>
                      <input type="number" value={recordFormData.rpm} onChange={e => setRecordFormData({ ...recordFormData, rpm: parseFloat(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CPM (VNĐ)</label>
                      <input type="number" value={recordFormData.cpm} onChange={e => setRecordFormData({ ...recordFormData, cpm: parseFloat(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                    <textarea value={recordFormData.notes} onChange={e => setRecordFormData({ ...recordFormData, notes: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2} />
                  </div>
                </form>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 shrink-0 flex justify-end space-x-3 bg-gray-50">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors">Hủy</button>
              <button
                type="submit"
                form={modalType === 'transaction' ? 'trans-form' : modalType === 'record' ? 'record-form' : 'acc-form'}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${modalType === 'transaction' ? 'bg-blue-600 hover:bg-blue-700' :
                  modalType === 'record' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-purple-600 hover:bg-purple-700'
                  }`}
              >
                Lưu dữ liệu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
