import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Rocket, Bug } from 'lucide-react';

// You can fetch this from an API or just hardcode the latest release notes here
const LATEST_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';
const RELEASE_NOTES = [
  {
    type: 'feature',
    icon: <Rocket size={16} className="text-blue-500" />,
    title: 'Hệ thống Quản lý Phiên bản',
    description: 'Bổ sung thông tin version ở góc màn hình và popup cập nhật tính năng mới giúp team dễ dàng theo dõi tiến độ.'
  },
  {
    type: 'feature',
    icon: <CheckCircle2 size={16} className="text-green-500" />,
    title: 'Giao diện Chào mừng',
    description: 'Thêm màn hình hướng dẫn thân thiện cho nhân sự mới khi chưa được phân công công việc.'
  },
  {
    type: 'bug',
    icon: <Bug size={16} className="text-red-500" />,
    title: 'Bảo mật Cập nhật Nhân sự',
    description: 'Chuyển toàn bộ thao tác sửa/xóa nhân sự qua Backend API để đảm bảo an toàn tuyệt đối, vượt qua hạn chế của Supabase RLS.'
  }
];

export function ChangelogModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if the user has seen this version's release notes
    const lastSeenVersion = localStorage.getItem('dta_last_seen_version');
    if (lastSeenVersion !== LATEST_VERSION) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('dta_last_seen_version', LATEST_VERSION);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative">
          <button 
            onClick={handleClose}
            className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
          <div className="inline-block bg-white/20 px-2 py-1 rounded text-xs font-bold mb-3">
            v{LATEST_VERSION}
          </div>
          <h2 className="text-2xl font-bold">Có gì mới trong phiên bản này?</h2>
          <p className="text-blue-100 mt-1 text-sm">
            Hệ thống vừa được nâng cấp với các tính năng và bản vá lỗi mới nhất.
          </p>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            {RELEASE_NOTES.map((note, idx) => (
              <div key={idx} className="flex gap-3">
                <div className="mt-0.5 shrink-0">
                  {note.icon}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">{note.title}</h4>
                  <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">
                    {note.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={handleClose}
            className="w-full mt-8 bg-gray-900 hover:bg-black text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
          >
            Tuyệt vời, tôi đã hiểu!
          </button>
        </div>
      </div>
    </div>
  );
}
