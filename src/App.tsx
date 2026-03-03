import React, { useState } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { supabase, toCamelCase } from './lib/supabase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useAppData } from './hooks/useAppData';
import { TaskManager } from './components/TaskManager';
import { Topic, Channel, SourceChannel, Staff, VideoTask, FinancialRecord, Strike, Asset, Proxy, License, Competitor, Transaction, FinancialAccount, TransactionCategory, TransactionType, SystemSettings, DailyReport } from './types';
import { Dashboard } from './components/Dashboard';
import { Topics } from './components/Topics';
import { Channels } from './components/Channels';
import { StaffManager } from './components/Staff';
import { SpyManager } from './components/SpyManager';
import { NicheExplorer } from './components/NicheExplorer';
import { Analysis } from './components/Analysis';
import { VideoCalendar } from './components/VideoCalendar';
import { FinanceManager } from './components/FinanceManager';
import { CopyrightManager } from './components/CopyrightManager';
import { AssetManager } from './components/AssetManager';
import { ToolManager } from './components/ToolManager';
import { SeoAi } from './components/SeoAi';
import { AutoSaveService } from './components/AutoSaveService';
import { AdminSettings } from './components/AdminSettings';
import { PermissionSettings } from './components/PermissionSettings';
import { Login } from './components/Login';
import { LayoutDashboard, Youtube, Hash, Menu, Link as LinkIcon, Users, LineChart, Calendar as CalendarIcon, DollarSign, ShieldAlert, HardDrive, Wrench, Sparkles, Eye, EyeOff, Bell, Crosshair, LogOut, Database, Settings, ShieldCheck, Briefcase, ChevronDown, ChevronRight, FolderOpen, Search, Compass } from 'lucide-react';
import { RolePermissions, PermissionKey, StaffRole } from './types';

const DEFAULT_PERMISSIONS: RolePermissions = {
  admin: [
    'dashboard_view', 'topics_view', 'topics_edit', 'sources_view', 'sources_edit', 'sources_analyze',
    'channels_view', 'channels_edit', 'channels_view_sensitive', 'channels_manage_proxy',
    'staff_view', 'staff_edit', 'staff_view_salary', 'calendar_view', 'calendar_edit', 'calendar_view_all', 'calendar_delete',
    'finance_view', 'finance_edit', 'finance_view_accounts', 'copyright_view', 'copyright_edit',
    'assets_view', 'assets_edit', 'tasks_view', 'tasks_edit', 'tasks_claim',
    'settings_view', 'settings_edit_keys', 'settings_edit_permissions'
  ],
  manager: [
    'dashboard_view', 'topics_view', 'topics_edit', 'sources_view', 'sources_edit', 'sources_analyze',
    'channels_view', 'channels_edit', 'staff_view', 'calendar_view', 'calendar_edit', 'calendar_view_all',
    'finance_view', 'finance_edit', 'copyright_view', 'assets_view', 'assets_edit', 'tasks_view', 'tasks_edit', 'tasks_claim', 'settings_view'
  ],
  leader: [
    'dashboard_view', 'topics_view', 'sources_view', 'channels_view', 'calendar_view', 'calendar_edit',
    'calendar_view_all', 'copyright_view', 'assets_view', 'tasks_view', 'tasks_edit', 'tasks_claim'
  ],
  member: [
    'dashboard_view', 'calendar_view', 'calendar_edit', 'assets_view', 'tasks_view', 'tasks_claim'
  ]
};

function AppContent() {
  const { currentUser, setCurrentUser, isLoading, logout } = useAuth();
  const [rolePermissions, setRolePermissions] = useLocalStorage<RolePermissions>('yt-role-permissions', DEFAULT_PERMISSIONS);

  // Migration: Ensure new permissions are added to existing rolePermissions
  React.useEffect(() => {
    let updated = false;
    const newPermissions = { ...rolePermissions };

    (Object.keys(DEFAULT_PERMISSIONS) as StaffRole[]).forEach(role => {
      const defaultRolePerms = DEFAULT_PERMISSIONS[role];
      const currentRolePerms = newPermissions[role] || [];

      const missingPerms = defaultRolePerms.filter(p => !currentRolePerms.includes(p));
      if (missingPerms.length > 0) {
        newPermissions[role] = [...currentRolePerms, ...missingPerms];
        updated = true;
      }
    });

    if (updated) {
      setRolePermissions(newPermissions);
    }
  }, []);

  const {
    channels, setChannels, topics, setTopics, staffList, setStaffList,
    sourceChannels, setSourceChannels, tasks, setTasks,
    dailyReports, setDailyReports, financials, setFinancials,
    transactions, setTransactions, accounts, setAccounts,
    categories, setCategories, strikes, setStrikes,
    assets, setAssets, proxies, setProxies,
    licenses, setLicenses, competitors, setCompetitors,
    managedEmails, setManagedEmails,
    systemSettings, setSystemSettings,
    activeYoutubeKey, activeGeminiKey, rotateYoutubeKey,
    handleRemoteUpdate, appData
  } = useAppData(currentUser);

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(true); // Default to true for safety
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['dashboard', 'channels']); // Expanded by default

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4"></div>
        <p className="text-gray-600 font-medium">Đang xác thực bảo mật...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <Login
        onLogin={(role, name, id) => setCurrentUser({ role, name, id })}
      />
    );
  }

  // Định nghĩa các nhóm menu chính
  const menuGroups = [
    {
      id: 'dashboard',
      label: 'Bảng Điều Khiển',
      icon: LayoutDashboard,
      items: [
        { id: 'dashboard', label: 'Tổng quan (Heatmap)', icon: LayoutDashboard, permission: 'dashboard_view' },
        { id: 'analysis', label: 'Phân tích Data', icon: LineChart, permission: 'sources_view' },
      ]
    },
    {
      id: 'channels',
      label: 'Kênh & Nội Dung',
      icon: Youtube,
      items: [
        { id: 'channels', label: 'Mạng lưới Kênh', icon: Youtube, permission: 'channels_view' },
        { id: 'topics', label: 'Quản lý Chủ đề', icon: Hash, permission: 'topics_view' },
      ]
    },
    {
      id: 'pipeline',
      label: 'Sản Xuất (Pipeline)',
      icon: Briefcase,
      items: [
        { id: 'kanban', label: 'Lịch Đăng & KPI', icon: CalendarIcon, permission: 'calendar_view' },
        { id: 'tasks', label: 'Giao & Nhận Việc', icon: Briefcase, permission: 'tasks_view' },
        { id: 'assets', label: 'Kho Tài nguyên (Ads)', icon: HardDrive, permission: 'assets_view' },
        { id: 'seo', label: 'SEO & Hashtag AI', icon: Sparkles, permission: 'dashboard_view' },
      ]
    },
    {
      id: 'market',
      label: 'Khám Phá Thị Trường',
      icon: Crosshair,
      items: [
        { id: 'spy', label: 'Kênh & Đối thủ', icon: Search, permission: 'sources_view' },
        { id: 'niche', label: 'La Bàn Ngách', icon: Compass, permission: 'sources_view' },
      ]
    },
    {
      id: 'operation',
      label: 'Kế Toán & Nhân Sự',
      icon: DollarSign,
      items: [
        { id: 'finance', label: 'Tài chính (P&L)', icon: DollarSign, permission: 'finance_view' },
        { id: 'staff', label: 'Nhân sự (HRM)', icon: Users, permission: 'staff_view' },
      ]
    },
    {
      id: 'admin',
      label: 'Hệ Thống',
      icon: Settings,
      items: [
        { id: 'copyright', label: 'Bản quyền (Strikes)', icon: ShieldAlert, permission: 'copyright_view' },
        { id: 'tools', label: 'License & Proxy', icon: Wrench, permission: 'settings_view' },
        { id: 'permissions', label: 'Phân quyền Role', icon: ShieldCheck, permission: 'settings_edit_permissions' },
        { id: 'settings', label: 'Cài đặt API', icon: Settings, permission: 'settings_view' },
      ]
    }
  ];

  const hasPermission = (permission: string) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    const permissions = rolePermissions[currentUser.role] || [];
    return permissions.includes(permission as PermissionKey);
  };

  const handleExportPayroll = (amount: number) => {
    const today = new Date();
    const newTransaction = {
      id: Date.now().toString(),
      date: today.toISOString(),
      amount: amount,
      type: 'expense' as const,
      categoryId: categories.find(c => c.type === 'expense')?.id || '',
      accountId: accounts[0]?.id || '',
      description: `Chi phí lương nhân sự tháng ${today.getMonth() + 1}/${today.getFullYear()}`,
      referenceType: 'staff' as const,
      status: 'completed' as const
    };

    setTransactions(prev => [...prev, newTransaction]);
  };

  // Calculate alerts
  const activeStrikesCount = strikes.filter(s => s.status === 'active').length;
  const expiringLicensesCount = licenses.filter(l => {
    const daysLeft = (new Date(l.expirationDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
    return daysLeft <= 7 && daysLeft > 0;
  }).length;
  const totalAlerts = activeStrikesCount + expiringLicensesCount;

  // Dữ liệu appData đã được đóng gói và trả về từ useAppData hook

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile sidebar overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-64 bg-[#1a1c23] text-gray-300 border-r border-gray-800
        transform transition-transform duration-200 ease-in-out flex flex-col
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-16 flex items-center px-6 border-b border-gray-800 shrink-0 bg-[#12141a]">
          <Youtube className="text-red-500 mr-2" size={28} />
          <span className="text-lg font-bold text-white tracking-tight">DTA Studio</span>
        </div>

        <nav className="p-4 space-y-2 flex-1 overflow-y-auto custom-scrollbar">
          {menuGroups.map((group) => {
            const visibleItems = group.items.filter(item => hasPermission(item.permission));

            // Ẩn nhóm nếu không có item nào được phép xem
            if (visibleItems.length === 0) return null;

            const isExpanded = expandedGroups.includes(group.id);
            const isGroupActive = visibleItems.some(item => item.id === activeTab);
            const GroupIcon = group.icon;

            return (
              <div key={group.id} className="space-y-1">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors
                    ${isGroupActive && !isExpanded
                      ? 'bg-blue-600/10 text-blue-400'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }
                  `}
                >
                  <div className="flex items-center">
                    <GroupIcon size={18} className={`mr-3 ${isGroupActive ? 'text-blue-400' : 'text-gray-500'}`} />
                    <span className="uppercase tracking-wider text-xs">{group.label}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {isExpanded && (
                  <div className="pl-9 space-y-1 pb-1">
                    {visibleItems.map((item) => {
                      const ItemIcon = item.icon;
                      const isActive = activeTab === item.id;

                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id);
                            setIsMobileMenuOpen(false);
                          }}
                          className={`
                            w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors
                            ${isActive
                              ? 'bg-blue-600/20 text-blue-400'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                            }
                          `}
                        >
                          <ItemIcon size={16} className={`mr-3 ${isActive ? 'text-blue-400' : 'text-gray-500'}`} />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold text-white mr-2">
                {(currentUser.name || '?').charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{currentUser.name}</p>
                <p className="text-xs text-gray-500 capitalize">{currentUser.role}</p>
              </div>
            </div>
            <button onClick={logout} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center lg:hidden">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg mr-2">
              <Menu size={24} />
            </button>
            <span className="font-bold text-gray-900">DTA Studio</span>
          </div>

          <div className="hidden lg:flex items-center text-sm font-medium text-gray-500">
            Hệ thống Quản trị MCN / Agency YouTube
          </div>

          <div className="flex items-center space-x-4">
            {/* Alerts */}
            <div className="relative cursor-pointer hover:bg-gray-100 p-2 rounded-full transition-colors">
              <Bell size={20} className="text-gray-600" />
              {totalAlerts > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </div>

            {/* Privacy Mode Toggle */}
            <button
              onClick={() => setPrivacyMode(!privacyMode)}
              className={`flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${privacyMode ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {privacyMode ? <EyeOff size={16} className="mr-1.5" /> : <Eye size={16} className="mr-1.5" />}
              {privacyMode ? 'Privacy: ON' : 'Privacy: OFF'}
            </button>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 bg-[#f4f5f7]">
          <div className="max-w-7xl mx-auto h-full">
            {/* AutoSaveService chạy ngầm, theo dõi dataToSync và Sync với Supabase realtime */}
            <AutoSaveService
              dataToSync={appData}
              onRemoteUpdate={handleRemoteUpdate}
            />

            {activeTab === 'dashboard' && (
              <Dashboard channels={channels} topics={topics} staffList={staffList} financials={financials} tasks={tasks} geminiApiKey={activeGeminiKey} />
            )}
            {activeTab === 'channels' && (
              <Channels
                channels={channels}
                setChannels={setChannels}
                topics={topics}
                setTopics={setTopics}
                proxies={proxies}
                privacyMode={privacyMode}
                sourceChannels={sourceChannels}
                youtubeApiKey={activeYoutubeKey}
                geminiApiKey={activeGeminiKey}
                rotateYoutubeKey={rotateYoutubeKey}
                tasks={tasks}
                staffList={staffList}
                financials={financials}
                strikes={strikes}
              />
            )}
            {activeTab === 'topics' && (
              <Topics topics={topics} setTopics={setTopics} />
            )}
            {activeTab === 'spy' && (
              <SpyManager
                sourceChannels={sourceChannels}
                setSourceChannels={setSourceChannels}
                competitors={competitors}
                setCompetitors={setCompetitors}
                topics={topics}
                setTopics={setTopics}
                channels={channels}
                youtubeApiKey={activeYoutubeKey || ''}
                geminiApiKey={activeGeminiKey}
                rotateYoutubeKey={rotateYoutubeKey}
                staffList={staffList}
                currentUser={currentUser}
              />
            )}
            {activeTab === 'niche' && (
              <NicheExplorer
                youtubeApiKey={activeYoutubeKey || ''}
                geminiApiKey={activeGeminiKey}
              />
            )}
            {activeTab === 'staff' && (
              <StaffManager
                staffList={staffList}
                setStaffList={setStaffList}
                channels={channels}
                tasks={tasks}
                geminiApiKey={activeGeminiKey}
                onExportPayroll={handleExportPayroll}
              />
            )}
            {activeTab === 'analysis' && (
              <Analysis
                channels={channels}
                sourceChannels={sourceChannels}
                topics={topics}
                geminiApiKey={activeGeminiKey}
              />
            )}
            {activeTab === 'kanban' && (
              <VideoCalendar
                tasks={tasks}
                setTasks={setTasks}
                channels={channels}
                staffList={staffList}
                assets={assets}
                currentUser={currentUser}
                geminiApiKey={activeGeminiKey}
              />
            )}
            {activeTab === 'tasks' && (
              <TaskManager
                tasks={tasks}
                setTasks={setTasks}
                staffList={staffList}
                channels={channels}
                assets={assets}
                currentUser={currentUser}
                dailyReports={dailyReports}
                setDailyReports={setDailyReports}
              />
            )}
            {activeTab === 'finance' && (
              <FinanceManager
                financials={financials}
                setFinancials={setFinancials}
                transactions={transactions}
                setTransactions={setTransactions}
                accounts={accounts}
                setAccounts={setAccounts}
                categories={categories}
                setCategories={setCategories}
                channels={channels}
                tasks={tasks}
                staffList={staffList}
                geminiApiKey={activeGeminiKey}
              />
            )}
            {activeTab === 'copyright' && (
              <CopyrightManager strikes={strikes} setStrikes={setStrikes} channels={channels} geminiApiKey={activeGeminiKey} />
            )}
            {activeTab === 'assets' && (
              <AssetManager assets={assets} setAssets={setAssets} proxies={proxies} setProxies={setProxies} topics={topics} geminiApiKey={activeGeminiKey} managedEmails={managedEmails} setManagedEmails={setManagedEmails} staffList={staffList} />
            )}
            {activeTab === 'tools' && (
              <ToolManager licenses={licenses} setLicenses={setLicenses} privacyMode={privacyMode} topics={topics} geminiApiKey={activeGeminiKey} />
            )}
            {activeTab === 'seo' && (
              <SeoAi geminiApiKey={activeGeminiKey} />
            )}
            {activeTab === 'permissions' && (
              <PermissionSettings
                rolePermissions={rolePermissions}
                setRolePermissions={setRolePermissions}
              />
            )}
            {activeTab === 'settings' && (
              <AdminSettings settings={systemSettings} setSettings={setSystemSettings} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
