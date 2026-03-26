import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { StaffRole } from '../types';

const SESSION_TTL_DAYS = 7; // Phiên đăng nhập hết hạn sau 7 ngày

interface SessionData {
    staffId: string;
    loginAt: number; // timestamp ms
}

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
        let mounted = true;

        const loadUserFromSession = async (session: any) => {
            if (!session?.user) {
                if (mounted) {
                    setSessionUser(null);
                    setIsLoading(false);
                }
                return;
            }

            try {
                // Đọc email từ phiên đăng nhập hiện tại
                const email = session.user.email;
                
                if (email) {
                    const { data, error } = await supabase
                        .from('staff_list')
                        .select('id, role, name, status')
                        .eq('email', email)
                        .single();

                    if (error) {
                        console.error('Lỗi khi tải thông tin nhân viên:', error.message);
                        // Chỉ throw alert nếu không phải lỗi không tìm thấy user (tránh spam)
                        if (error.code !== 'PGRST116') {
                             alert(`Lỗi RLS: Bạn đã đăng nhập Auth thành công, nhưng Database từ chối quyền truy cập! Thông báo lỗi: ${error.message}\nHãy đăng nhập Supabase -> Table Editor -> staff_list -> Tắt RLS (Disable RLS).`);
                        }
                    }

                    if (data && data.status !== 'inactive' && mounted) {
                        setSessionUser({
                            id: data.id,
                            role: data.role as StaffRole,
                            name: data.name
                        });
                    } else if (mounted) {
                        setSessionUser(null);
                    }
                } else {
                    if (mounted) setSessionUser(null);
                }
            } catch (err) {
                console.error('Lỗi khi tải thông tin nhân viên:', err);
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        // Khởi tạo ban đầu
        supabase.auth.getSession().then(({ data: { session } }) => {
            loadUserFromSession(session);
        });

        // Lắng nghe sự kiện đăng nhập/đăng xuất
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            loadUserFromSession(session);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const setCurrentUser = (user: CurrentUser | null) => {
        setSessionUser(user);
    };

    const logout = async () => {
        await supabase.auth.signOut();
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
