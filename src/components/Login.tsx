import React, { useState } from 'react';
import { Youtube, Lock, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onLogin: (role: 'admin' | 'manager' | 'leader' | 'member', name: string, id: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedPassword = password.trim();

    // 1. Tài khoản Master Backup (Hệ thống luôn cho phép qua mặt)
    if (trimmedUsername === 'admin' && trimmedPassword === 'admin') {
      onLogin('admin', 'Cố vấn DTA Studio', 'admin');
      return;
    }

    setIsVerifying(true);

    try {
      // Gọi lên Database Supabase tìm dòng có username và password khớp
      const { data, error: dbError } = await supabase
        .from('staff_list')
        .select('*')
        .ilike('username', trimmedUsername)
        .eq('password', trimmedPassword)
        .single();

      if (dbError || !data) {
        setError('Tài khoản hoặc mật khẩu không chính xác. Vui lòng thử lại!');
      } else {
        if (data.status === 'inactive') {
          setError('Tài khoản này đã bị khóa!');
        } else {
          // Xác minh OK -> Trả state Role và ID vào hệ thống
          onLogin(data.role, data.name, data.id);
        }
      }
    } catch (err: any) {
      setError('Lỗi kết nối máy chủ máy chủ Supabase: ' + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <img src="/Logo.png" alt="DTA Studio Logo" className="w-20 h-20 object-contain drop-shadow-[0_0_12px_rgba(255,0,0,0.4)]" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          DTA Studio
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Hệ thống Quản trị MCN / Agency YouTube
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Tên đăng nhập
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                  placeholder="Nhập tên đăng nhập"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Mật khẩu
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md border border-red-100">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isVerifying}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
              >
                {isVerifying ? 'Đang truy vấn DDB...' : 'Đăng nhập'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
