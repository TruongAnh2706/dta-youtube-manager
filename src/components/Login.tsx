import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, ArrowLeft } from 'lucide-react';

import { supabase } from '../lib/supabase';

interface LoginProps {
  onLogin?: (role: 'admin' | 'manager' | 'leader' | 'member', name: string, id: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    setIsVerifying(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword
      });

      if (authError) {
        let viMessage = 'Đã xảy ra lỗi hệ thống.';
        
        switch (authError.message) {
          case 'Invalid login credentials':
            viMessage = 'Tài khoản hoặc mật khẩu không chính xác.';
            break;
          case 'Email not confirmed':
            viMessage = 'Tài khoản chưa được xác minh. Vui lòng kiểm tra email và bấm vào link xác nhận.';
            break;
          case 'User not found':
            viMessage = 'Tài khoản không tồn tại trong hệ thống.';
            break;
          default:
            viMessage = `Lỗi xác thực: ${authError.message}`;
        }
        
        setError(viMessage);
      } else {
        // Đăng nhập thành công, AuthContext sẽ tự động bắt sự kiện onAuthStateChange
        // Không nhận gọi thêm hook nào ở đây
      }
    } catch (err: any) {
      setError('Lỗi kết nối máy chủ xác thực: ' + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetMessage('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Vui lòng nhập Email để khôi phục mật khẩu.');
      return;
    }

    setIsVerifying(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: window.location.origin,
      });

      if (resetError) {
        setError(`Lỗi: ${resetError.message}`);
      } else {
        setResetMessage('Đã gửi liên kết khôi phục. Vui lòng kiểm tra hộp thư email của bạn.');
      }
    } catch (err: any) {
      setError('Lỗi kết nối: ' + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070a10] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl"></div>
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(0,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }}></div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Logo with Glow */}
        <div className="flex justify-center mb-6">
          <div className="relative group">
            <div className="absolute inset-0 bg-red-500/30 rounded-full blur-xl group-hover:bg-cyan-500/30 transition-colors duration-700 animate-pulse"></div>
            <img
              src={`${import.meta.env.BASE_URL}Logo.png`}
              alt="DTA Studio Logo"
              className="w-24 h-24 object-contain relative z-10 drop-shadow-[0_0_20px_rgba(255,0,0,0.5)] group-hover:drop-shadow-[0_0_20px_rgba(0,255,255,0.5)] transition-all duration-700 group-hover:scale-110"
            />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-center text-3xl font-black tracking-wider">
          <span className="bg-gradient-to-r from-white via-cyan-300 to-cyan-500 bg-clip-text text-transparent">
            DTA MANAGER YT
          </span>
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500 tracking-wide">
          Hệ thống Quản trị MCN / Agency YouTube
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Login Card with Glassmorphism */}
        <div className="relative">
          {/* Border glow effect */}
          <div className="absolute -inset-[1px] bg-gradient-to-r from-cyan-500/20 via-transparent to-red-500/20 rounded-2xl blur-sm"></div>
          
          <div className="relative bg-[#0d1117]/90 backdrop-blur-xl py-10 px-6 sm:rounded-2xl sm:px-10 border border-[#1e232b]">
            <form className="space-y-6" onSubmit={isForgotPassword ? handleResetPassword : handleSubmit}>
              {/* Email Field */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2 tracking-wide">
                  Địa chỉ Email
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 text-sm text-white bg-[#161b22] border border-[#2a3040] rounded-xl focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-all duration-300 placeholder:text-gray-600 hover:border-[#3a4050]"
                    placeholder="name@dtastudio.vn"
                  />
                </div>
              </div>

              {/* Password Field (Only show in Login mode) */}
              {!isForgotPassword && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-300 tracking-wide">
                      Mật khẩu
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setError('');
                        setResetMessage('');
                      }}
                      className="text-xs text-cyan-500 hover:text-cyan-400 font-medium transition-colors"
                    >
                      Quên mật khẩu?
                    </button>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-11 pr-12 py-3 text-sm text-white bg-[#161b22] border border-[#2a3040] rounded-xl focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-all duration-300 placeholder:text-gray-600 hover:border-[#3a4050]"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-cyan-400 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="text-red-400 text-sm bg-red-500/10 p-3.5 rounded-xl border border-red-500/20 flex items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 mr-2.5 shrink-0 animate-pulse"></div>
                  {error}
                </div>
              )}

              {/* Success Message for Reset Password */}
              {resetMessage && (
                <div className="text-cyan-400 text-sm bg-cyan-500/10 p-3.5 rounded-xl border border-cyan-500/20 flex items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 mr-2.5 shrink-0 animate-pulse"></div>
                  {resetMessage}
                </div>
              )}

              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-bold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                  style={{
                    background: isVerifying ? '#1e232b' : 'linear-gradient(135deg, #0891b2, #06b6d4, #22d3ee)',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  <span className="relative z-10 tracking-wide">
                    {isVerifying ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Đang xử lý...
                      </span>
                    ) : (isForgotPassword ? 'GỬI LINK KHÔI PHỤC' : 'ĐĂNG NHẬP')}
                  </span>
                </button>
              </div>
              
              {/* Back to login button */}
              {isForgotPassword && (
                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setError('');
                      setResetMessage('');
                    }}
                    className="text-sm flex items-center justify-center w-full text-gray-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Quay lại đăng nhập
                  </button>
                </div>
              )}
            </form>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-[#1e232b]">
              <p className="text-center text-[11px] text-gray-600 tracking-wide">
                Phát triển bởi <span className="text-cyan-500/80 font-semibold">DTA Studio</span> — Đức Trường AI
              </p>
              <div className="flex justify-center gap-4 mt-2">
                <a href="https://www.facebook.com/phamductruong17/" target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-600 hover:text-cyan-400 transition-colors">Facebook</a>
                <a href="https://github.com/TruongAnh2706" target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-600 hover:text-cyan-400 transition-colors">GitHub</a>
                <a href="mailto:ductruong.onl@gmail.com" className="text-[10px] text-gray-600 hover:text-cyan-400 transition-colors">Liên hệ</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
