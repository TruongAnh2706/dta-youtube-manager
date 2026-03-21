import React, { useEffect, useRef } from 'react';
import { supabase, toSnakeCase, toCamelCase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';

interface AutoSaveServiceProps {
    dataToSync: any;
    onRemoteUpdate: (tableName: string, updatedData: any) => void;
}

export function AutoSaveService({ dataToSync, onRemoteUpdate }: AutoSaveServiceProps) {
    const { showToast } = useToast();
    const prevDataRef = useRef<any>(null);
    const isInitialMount = useRef(true);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const tablesMap = [
        { key: 'channels', table: 'channels' },
        { key: 'topics', table: 'topics' },
        { key: 'staffList', table: 'staff_list' },
        { key: 'sourceChannels', table: 'source_channels' },
        { key: 'tasks', table: 'video_tasks' },
        { key: 'financials', table: 'financials' },
        { key: 'transactions', table: 'transactions' },
        { key: 'accounts', table: 'financial_accounts' },
        { key: 'categories', table: 'transaction_categories' },
        { key: 'strikes', table: 'strikes' },
        { key: 'assets', table: 'assets' },
        { key: 'proxies', table: 'proxies' },
        { key: 'licenses', table: 'licenses' },
        { key: 'competitors', table: 'competitors' },
        { key: 'managedEmails', table: 'managed_emails' }
    ];

    // 1. NGHIỆP VỤ AUTO-SAVE (Đẩy lên DB)
    useEffect(() => {
        if (isInitialMount.current) {
            prevDataRef.current = JSON.parse(JSON.stringify(dataToSync));
            isInitialMount.current = false;
            return;
        }

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            const prev = prevDataRef.current;
            const current = dataToSync;

            for (const { key, table } of tablesMap) {
                const prevData = prev[key];
                const currentData = current[key];

                // Bỏ qua nếu dữ liệu không phải array
                if (!Array.isArray(currentData)) continue;

                // Chỉ lưu nếu thực sự có thay đổi từ phía Client
                const hasChanged = JSON.stringify(prevData) !== JSON.stringify(currentData);

                // Ngoại lệ: Nếu lần đầu load trang (prevData=[], currentData=[]) => bỏ qua
                if (!hasChanged) continue;

                try {
                    const currentMap = new Map();
                    const formattedCurrent = toSnakeCase(currentData);
                    formattedCurrent.forEach((item: any) => currentMap.set(item.id, item));
                    
                    const prevMap = new Map();
                    if (prevData && Array.isArray(prevData)) {
                        const formattedPrev = toSnakeCase(prevData);
                        formattedPrev.forEach((item: any) => prevMap.set(item.id, item));
                    }
                    
                    const itemsToUpsert: any[] = [];
                    const itemsToDelete: string[] = [];
                    
                    formattedCurrent.forEach((item: any) => {
                        const prevItem = prevMap.get(item.id);
                        if (!prevItem || JSON.stringify(prevItem) !== JSON.stringify(item)) {
                            itemsToUpsert.push(item);
                        }
                    });
                    
                    if (prevData && Array.isArray(prevData)) {
                         const formattedPrev = toSnakeCase(prevData);
                         formattedPrev.forEach((item: any) => {
                             if (!currentMap.has(item.id)) {
                                 itemsToDelete.push(item.id);
                             }
                         });
                    }

                    if (itemsToUpsert.length > 0) {
                        const { error } = await supabase.from(table).upsert(itemsToUpsert, { onConflict: 'id' });
                        if (error) {
                            if (error.message.includes('violates unique constraint') && error.message.includes('channel_code_key')) {
                                showToast('Lỗi: Kênh này đã tồn tại trong hệ thống (Trùng ID Kênh). Vui lòng kiểm tra lại.', 'error');
                            } else {
                                showToast(`Lỗi AutoSave Upsert [${table}]: ${error.message}`, 'error');
                            }
                            console.error(`❌ Lỗi Supabase Sync ${table}:`, error);
                        } else {
                            console.log(`✅ [AutoSave] Đã cập nhật ${itemsToUpsert.length} records lên ${table}`);
                        }
                    }

                    if (itemsToDelete.length > 0) {
                        const { error } = await supabase.from(table).delete().in('id', itemsToDelete);
                        if (error) {
                            showToast(`Lỗi AutoSave Delete [${table}]: ${error.message}`, 'error');
                            console.error(`❌ Lỗi Supabase Delete ${table}:`, error);
                        } else {
                            console.log(`🗑️ [AutoSave] Đã xóa ${itemsToDelete.length} records ở ${table}`);
                        }
                    }
                } catch (err) {
                    console.error(`❌ Lỗi Auto-Save bảng ${table}:`, err);
                }
            }

            // Xử lý riêng biệt cho systemSettings
            if (JSON.stringify(prev.systemSettings) !== JSON.stringify(current.systemSettings)) {
                try {
                    const currentSettingsDb = await supabase.from('system_settings').select('id').limit(1);
                    const settingUpdatePayload = toSnakeCase({ ...current.systemSettings });

                    // Đảm bảo ép chuẩn JSONB List tránh bị lưu dạng String Array
                    if (settingUpdatePayload.youtube_api_keys) {
                        settingUpdatePayload.youtube_api_keys = JSON.parse(JSON.stringify(settingUpdatePayload.youtube_api_keys));
                    }
                    if (settingUpdatePayload.gemini_api_keys) {
                        settingUpdatePayload.gemini_api_keys = JSON.parse(JSON.stringify(settingUpdatePayload.gemini_api_keys));
                    }

                    if (currentSettingsDb.data && currentSettingsDb.data.length > 0) {
                        settingUpdatePayload.id = currentSettingsDb.data[0].id;
                        const { error } = await supabase.from('system_settings').update(settingUpdatePayload).eq('id', settingUpdatePayload.id);
                        if (error) {
                            showToast(`Lỗi Cài Đặt (Update): ${error.message}`, 'error');
                        } else {
                            console.log("✅ [AutoSave] Đã update System Settings (API Keys)");
                        }
                    } else {
                        // Trường hợp DB chưa từng có seed data
                        const { error } = await supabase.from('system_settings').insert([settingUpdatePayload]);
                        if (error) {
                            showToast(`Lỗi Cài Đặt (Insert): ${error.message}`, 'error');
                        } else {
                            console.log("✅ [AutoSave] Đã khỏi tạo System Settings (API Keys)");
                        }
                    }
                } catch (err: any) {
                    showToast(`Lỗi System API: ${err.message}`, 'error');
                    console.error("❌ Lỗi lưu System Settings:", err);
                }
            }

            // Cập nhật lại cache cũ để so sánh lần sau
            prevDataRef.current = JSON.parse(JSON.stringify(current));
        }, 3000); // Lưu mỗi 3s chống SPAM API

        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, [dataToSync]);

    // 2. NGHIỆP VỤ REALTIME (Kéo từ DB về khi có máy khác cập nhật)
    useEffect(() => {
        const channel = supabase.channel('public-db-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public' },
                async (payload) => {
                    // Bỏ qua nếu sự kiện không xác định
                    if (!payload.table) return;

                    const tableName = payload.table;

                    // Khi nhận sự kiện, ta fetch lại cả bảng đó cho an toàn thay vì ghép data cục bộ
                    try {
                        const { data, error } = await supabase.from(tableName).select('*');
                        if (data && !error) {
                            const camelData = toCamelCase(data);

                            // CHỐNG INFINITE LOOP: Cập nhật prevDataRef để nó không tưởng user vừa sửa data state
                            const mappedKey = tablesMap.find(t => t.table === tableName)?.key;
                            if (mappedKey && prevDataRef.current) {
                                prevDataRef.current[mappedKey] = JSON.parse(JSON.stringify(camelData));
                            } else if (tableName === 'system_settings' && prevDataRef.current) {
                                if (camelData.length > 0) prevDataRef.current.systemSettings = JSON.parse(JSON.stringify(camelData[0]));
                            }

                            // Gửi tín hiệu báo cho App.tsx cập nhật state
                            onRemoteUpdate(tableName, camelData);
                        }
                    } catch (err) {
                        console.error(`Lỗi cập nhật bảng ${tableName} sau khi nhận Data Realtime`, err);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [onRemoteUpdate]);

    return null; // Tàng hình trên UI
}
