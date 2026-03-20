import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, toCamelCase } from '../lib/supabase';
import {
    Channel, Topic, Staff, SourceChannel, VideoTask, DailyReport,
    FinancialRecord, Transaction, FinancialAccount, TransactionCategory,
    Strike, Asset, Proxy, License, Competitor, SystemSettings, ManagedEmail
} from '../types';

export function useAppData(currentUser: any) {
    const [channels, setChannels] = useState<Channel[]>([]);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [sourceChannels, setSourceChannels] = useState<SourceChannel[]>([]);
    const [tasks, setTasks] = useState<VideoTask[]>([]);
    const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
    const [financials, setFinancials] = useState<FinancialRecord[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
    const [categories, setCategories] = useState<TransactionCategory[]>([]);
    const [strikes, setStrikes] = useState<Strike[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [proxies, setProxies] = useState<Proxy[]>([]);
    const [licenses, setLicenses] = useState<License[]>([]);
    const [competitors, setCompetitors] = useState<Competitor[]>([]);
    const [managedEmails, setManagedEmails] = useState<ManagedEmail[]>([]);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [systemSettings, setSystemSettings] = useState<SystemSettings>({
        youtubeApiKeys: [],
        geminiApiKeys: [],
        activeYoutubeKeyIndex: 0,
        auditLogs: [],
        trainingDocs: [],
        emailStatuses: [
            { id: 'new', label: 'Mới lấy về', color: 'bg-gray-100 text-gray-700' },
            { id: 'aging', label: 'Đang ngâm', color: 'bg-yellow-100 text-yellow-700' },
            { id: 'creating', label: 'Đang lập kênh', color: 'bg-blue-100 text-blue-700' },
            { id: 'active', label: 'Đã lập xong kênh', color: 'bg-green-100 text-green-700' },
            { id: 'error', label: 'Lỗi/Die', color: 'bg-red-100 text-red-700' }
        ],
        taskStatuses: [
            { id: 'pending', label: 'Chờ nhận việc', color: 'bg-yellow-100 text-yellow-700' },
            { id: 'in_progress', label: 'Đang xử lý', color: 'bg-blue-100 text-blue-700' },
            { id: 'completed', label: 'Hoàn thành', color: 'bg-green-100 text-green-700' },
            { id: 'review', label: 'Chờ duyệt', color: 'bg-purple-100 text-purple-700' },
            { id: 'published', label: 'Đã hoàn tất', color: 'bg-gray-100 text-gray-700' }
        ]
    });

    // Get active YouTube API Key
    const activeYoutubeKey = useMemo(() => {
        const keys = systemSettings?.youtubeApiKeys || [];
        const activeKeys = keys.filter(k => k.status === 'active');
        if (activeKeys.length === 0) return '';
        const index = (systemSettings?.activeYoutubeKeyIndex || 0) % activeKeys.length;
        return activeKeys[index]?.key || '';
    }, [systemSettings]);

    // Get active Gemini API Key
    const activeGeminiKey = useMemo(() => {
        const keys = systemSettings?.geminiApiKeys || [];
        const activeKeys = keys.filter(k => k.status === 'active');
        if (activeKeys.length === 0) return '';
        return activeKeys[0]?.key || '';
    }, [systemSettings]);

    // Automatically seed default admin if the loaded staffList is still empty
    useEffect(() => {
        if (isDataLoaded && staffList.length === 0) {
            setStaffList([{
                id: "dta_admin_01",
                name: "Đức Trường (CEO)",
                role: "admin",
                skills: ["scriptwriter", "editor", "voiceover", "designer"],
                email: "ductruong.onl@gmail.com",
                phone: "09662775506",
                username: "admin",
                password: "1",
                assignedChannelIds: [],
                status: "online",
                baseSalary: 20000000,
                managedEmailCount: 0
            }]);
        }
    }, [staffList.length]);

    const rotateYoutubeKey = useCallback(() => {
        const keys = systemSettings?.youtubeApiKeys || [];
        const activeKeys = keys.filter(k => k.status === 'active');
        if (activeKeys.length === 0) return false;

        const currentIndex = (systemSettings?.activeYoutubeKeyIndex || 0) % activeKeys.length;
        const failedKeyId = activeKeys[currentIndex].id;

        setSystemSettings(prev => {
            const updatedKeys = prev.youtubeApiKeys.map(k =>
                k.id === failedKeyId ? { ...k, status: 'quota_exceeded' as const } : k
            );
            return {
                ...prev,
                youtubeApiKeys: updatedKeys,
                activeYoutubeKeyIndex: 0
            };
        });
        return activeKeys.length > 1;
    }, [systemSettings, setSystemSettings]);

    const handleRemoteUpdate = (tableName: string, updatedData: any) => {
        switch (tableName) {
            case 'channels': setChannels(updatedData); break;
            case 'topics': setTopics(updatedData); break;
            case 'staff_list': setStaffList(updatedData); break;
            case 'source_channels': setSourceChannels(updatedData); break;
            case 'video_tasks': setTasks(updatedData); break;
            case 'financials': setFinancials(updatedData); break;
            case 'transactions': setTransactions(updatedData); break;
            case 'financial_accounts': setAccounts(updatedData); break;
            case 'transaction_categories': setCategories(updatedData); break;
            case 'strikes': setStrikes(updatedData); break;
            case 'assets': setAssets(updatedData); break;
            case 'proxies': setProxies(updatedData); break;
            case 'licenses': setLicenses(updatedData); break;
            case 'competitors': setCompetitors(updatedData); break;
            case 'managed_emails': setManagedEmails(updatedData); break;
            case 'system_settings':
                if (updatedData.length > 0) {
                    const parsed = updatedData[0];
                    if (!parsed.emailStatuses) parsed.emailStatuses = [
                        { id: 'new', label: 'Mới lấy về', color: 'bg-gray-100 text-gray-700' },
                        { id: 'aging', label: 'Đang ngâm', color: 'bg-yellow-100 text-yellow-700' },
                        { id: 'creating', label: 'Đang lập kênh', color: 'bg-blue-100 text-blue-700' },
                        { id: 'active', label: 'Đã lập xong kênh', color: 'bg-green-100 text-green-700' },
                        { id: 'error', label: 'Lỗi/Die', color: 'bg-red-100 text-red-700' }
                    ];
                    if (!parsed.taskStatuses) parsed.taskStatuses = [
                        { id: 'pending', label: 'Chờ nhận việc', color: 'bg-yellow-100 text-yellow-700' },
                        { id: 'in_progress', label: 'Đang xử lý', color: 'bg-blue-100 text-blue-700' },
                        { id: 'completed', label: 'Hoàn thành', color: 'bg-green-100 text-green-700' },
                        { id: 'review', label: 'Chờ duyệt', color: 'bg-purple-100 text-purple-700' },
                        { id: 'published', label: 'Đã hoàn tất', color: 'bg-gray-100 text-gray-700' }
                    ];
                    setSystemSettings(parsed);
                }
                break;
        }
    };

    useEffect(() => {
        if (!currentUser) return;

        const fetchSupabaseData = async () => {
            try {
                console.log('🔄 Đang kéo dữ liệu cốt lõi (Wave 1)...');
                
                // WAVE 1: Dữ liệu quan trọng cần để build UI khung
                const [
                    settingsRes, staffRes, channelsRes, topicsRes, 
                    sourceChannelsRes, accountsRes, categoriesRes
                ] = await Promise.all([
                    supabase.from('system_settings').select('*'),
                    supabase.from('staff_list').select('*'),
                    supabase.from('channels').select('*'),
                    supabase.from('topics').select('*'),
                    supabase.from('source_channels').select('*'),
                    supabase.from('financial_accounts').select('*'),
                    supabase.from('transaction_categories').select('*')
                ]);

                if (settingsRes.data && settingsRes.data.length > 0) {
                    const parsedSettings = toCamelCase(settingsRes.data[0]) as any;
                    if (!parsedSettings.emailStatuses) parsedSettings.emailStatuses = [
                        { id: 'new', label: 'Mới lấy về', color: 'bg-gray-100 text-gray-700' },
                        { id: 'aging', label: 'Đang ngâm', color: 'bg-yellow-100 text-yellow-700' },
                        { id: 'creating', label: 'Đang lập kênh', color: 'bg-blue-100 text-blue-700' },
                        { id: 'active', label: 'Đã lập xong kênh', color: 'bg-green-100 text-green-700' },
                        { id: 'error', label: 'Lỗi/Die', color: 'bg-red-100 text-red-700' }
                    ];
                    if (!parsedSettings.taskStatuses) parsedSettings.taskStatuses = [
                        { id: 'pending', label: 'Chờ nhận việc', color: 'bg-yellow-100 text-yellow-700' },
                        { id: 'in_progress', label: 'Đang xử lý', color: 'bg-blue-100 text-blue-700' },
                        { id: 'completed', label: 'Hoàn thành', color: 'bg-green-100 text-green-700' },
                        { id: 'review', label: 'Chờ duyệt', color: 'bg-purple-100 text-purple-700' },
                        { id: 'published', label: 'Đã hoàn tất', color: 'bg-gray-100 text-gray-700' }
                    ];
                    setSystemSettings(parsedSettings);
                }
                if (staffRes.data) setStaffList(toCamelCase(staffRes.data));
                if (channelsRes.data) setChannels(toCamelCase(channelsRes.data));
                if (topicsRes.data) setTopics(toCamelCase(topicsRes.data));
                if (sourceChannelsRes.data) setSourceChannels(toCamelCase(sourceChannelsRes.data));
                if (accountsRes.data) setAccounts(toCamelCase(accountsRes.data));
                if (categoriesRes.data) setCategories(toCamelCase(categoriesRes.data));

                console.log('✅ Wave 1 Xong. Đang tải dữ liệu Tab phụ (Wave 2)...');
                
                // WAVE 2: Chạy background để không chặn UI render
                setTimeout(async () => {
                    try {
                        const [
                            tasksRes, financialsRes, transactionsRes, strikesRes, 
                            assetsRes, proxiesRes, licensesRes, competitorsRes, emailsRes
                        ] = await Promise.all([
                            supabase.from('video_tasks').select('*').limit(5000), // Phân trang đơn giản cho các bảng nặng
                            supabase.from('financials').select('*').limit(5000),
                            supabase.from('transactions').select('*').limit(5000),
                            supabase.from('strikes').select('*'),
                            supabase.from('assets').select('*').limit(5000),
                            supabase.from('proxies').select('*'),
                            supabase.from('licenses').select('*'),
                            supabase.from('competitors').select('*'),
                            supabase.from('managed_emails').select('*').limit(5000)
                        ]);

                        if (tasksRes.data) setTasks(toCamelCase(tasksRes.data));
                        if (financialsRes.data) setFinancials(toCamelCase(financialsRes.data));
                        if (transactionsRes.data) setTransactions(toCamelCase(transactionsRes.data));
                        if (strikesRes.data) setStrikes(toCamelCase(strikesRes.data));
                        if (assetsRes.data) setAssets(toCamelCase(assetsRes.data));
                        if (proxiesRes.data) setProxies(toCamelCase(proxiesRes.data));
                        if (licensesRes.data) setLicenses(toCamelCase(licensesRes.data));
                        if (competitorsRes.data) setCompetitors(toCamelCase(competitorsRes.data));
                        if (emailsRes.data) setManagedEmails(toCamelCase(emailsRes.data));
                        
                        setIsDataLoaded(true);
                        console.log('✅ Wave 2 Load Complete!');
                    } catch (err) {
                        console.error('❌ Supabase Wave 2 Error:', err);
                    }
                }, 100);

            } catch (err) {
                console.error('❌ Supabase Init Error:', err);
            }
        };

        fetchSupabaseData();
    }, [currentUser]);

    const appData = {
        channels, topics, staffList, sourceChannels, tasks, dailyReports, financials, transactions, accounts, categories, strikes, assets, proxies, licenses, competitors, managedEmails, systemSettings
    };

    return {
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
    };
}
