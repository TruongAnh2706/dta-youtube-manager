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
    const [systemSettings, setSystemSettings] = useState<SystemSettings>({
        youtubeApiKeys: [],
        geminiApiKeys: [],
        activeYoutubeKeyIndex: 0,
        auditLogs: [],
        trainingDocs: []
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
        if (staffList.length === 0) {
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
                if (updatedData.length > 0) setSystemSettings(updatedData[0]);
                break;
        }
    };

    useEffect(() => {
        if (!currentUser) return;

        const fetchSupabaseData = async () => {
            try {
                console.log('🔄 Đang kéo dữ liệu từ Supabase...');
                const [
                    channelsRes, topicsRes, staffRes, sourceChannelsRes,
                    tasksRes, financialsRes, transactionsRes, accountsRes,
                    categoriesRes, strikesRes, assetsRes, proxiesRes,
                    licensesRes, competitorsRes, emailsRes, settingsRes
                ] = await Promise.all([
                    supabase.from('channels').select('*'),
                    supabase.from('topics').select('*'),
                    supabase.from('staff_list').select('*'),
                    supabase.from('source_channels').select('*'),
                    supabase.from('video_tasks').select('*'),
                    supabase.from('financials').select('*'),
                    supabase.from('transactions').select('*'),
                    supabase.from('financial_accounts').select('*'),
                    supabase.from('transaction_categories').select('*'),
                    supabase.from('strikes').select('*'),
                    supabase.from('assets').select('*'),
                    supabase.from('proxies').select('*'),
                    supabase.from('licenses').select('*'),
                    supabase.from('competitors').select('*'),
                    supabase.from('managed_emails').select('*'),
                    supabase.from('system_settings').select('*')
                ]);

                if (channelsRes.data) setChannels(toCamelCase(channelsRes.data));
                if (topicsRes.data) setTopics(toCamelCase(topicsRes.data));
                if (staffRes.data) setStaffList(toCamelCase(staffRes.data));
                if (sourceChannelsRes.data) setSourceChannels(toCamelCase(sourceChannelsRes.data));
                if (tasksRes.data) setTasks(toCamelCase(tasksRes.data));
                if (financialsRes.data) setFinancials(toCamelCase(financialsRes.data));
                if (transactionsRes.data) setTransactions(toCamelCase(transactionsRes.data));
                if (accountsRes.data) setAccounts(toCamelCase(accountsRes.data));
                if (categoriesRes.data) setCategories(toCamelCase(categoriesRes.data));
                if (strikesRes.data) setStrikes(toCamelCase(strikesRes.data));
                if (assetsRes.data) setAssets(toCamelCase(assetsRes.data));
                if (proxiesRes.data) setProxies(toCamelCase(proxiesRes.data));
                if (licensesRes.data) setLicenses(toCamelCase(licensesRes.data));
                if (competitorsRes.data) setCompetitors(toCamelCase(competitorsRes.data));
                if (emailsRes.data) setManagedEmails(toCamelCase(emailsRes.data));

                if (settingsRes.data && settingsRes.data.length > 0) {
                    setSystemSettings(toCamelCase(settingsRes.data[0]) as any);
                }

                console.log('✅ Supabase Load Complete!');
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
