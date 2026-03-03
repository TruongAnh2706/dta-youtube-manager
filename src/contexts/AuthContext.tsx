import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { StaffRole } from '../types';

interface CurrentUser {
    id: string;
    role: StaffRole;
    name: string;
}

interface AuthContextType {
    currentUser: CurrentUser | null;
    setCurrentUser: (user: CurrentUser | null) => void;
    isLoading: boolean;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [currentUser, setSessionUser] = useState<CurrentUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkSession = async () => {
            setIsLoading(true);
            try {
                const savedSession = localStorage.getItem('dta-session-token');
                if (savedSession) {
                    if (savedSession === 'dta_master_admin_session') {
                        setSessionUser({ id: 'admin', role: 'admin', name: 'Cố vấn DTA Studio' });
                    } else {
                        // Xác thực với database để chống hack Role trên localStorage
                        const { data, error } = await supabase
                            .from('staff_list')
                            .select('id, role, name, status, username')
                            .eq('id', savedSession)
                            .single();

                        if (data && data.status !== 'inactive') {
                            setSessionUser({
                                id: data.id,
                                role: data.role as StaffRole,
                                name: data.name
                            });
                        } else {
                            localStorage.removeItem('dta-session-token');
                            setSessionUser(null);
                        }
                    }
                }
            } catch (err) {
                console.error('Lỗi khi kiểm tra phiên đăng nhập:', err);
            } finally {
                setIsLoading(false);
            }
        };

        checkSession();
    }, []);

    const setCurrentUser = (user: CurrentUser | null) => {
        if (user) {
            // Đổi ID hardcode auth để chống đoán mã
            const safeId = user.id === 'admin' ? 'dta_master_admin_session' : user.id;
            localStorage.setItem('dta-session-token', safeId);
            setSessionUser(user);
        } else {
            localStorage.removeItem('dta-session-token');
            setSessionUser(null);
        }
    };

    const logout = () => {
        localStorage.removeItem('dta-session-token');
        // Xoá nốt cả localStorage cũ rác cũ
        localStorage.removeItem('yt-current-user');
        setSessionUser(null);
    };

    return (
        <AuthContext.Provider value={{ currentUser, setCurrentUser, isLoading, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
