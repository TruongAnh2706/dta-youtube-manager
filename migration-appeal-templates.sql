-- Migration: Thêm bảng mẫu kháng nghị (appeal_templates) cho DTA YouTube Manager
-- Phát triển bởi DTA Studio - Chủ quản: Đức Trường (Zalo: 0962.775.506)

-- 1. Tạo bảng appeal_templates (bảng trống để Admin tự thêm mẫu qua giao diện)
CREATE TABLE IF NOT EXISTS appeal_templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Khác',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tắt cơ chế Row-Level Security (RLS) để cho phép các thao tác INSERT/UPDATE/DELETE hoạt động trơn tru
-- LƯU Ý: Đây là app nội bộ của DTA Studio, phân quyền ghi đã được kiểm soát chặt chẽ ở giao diện (Frontend).
ALTER TABLE appeal_templates DISABLE ROW LEVEL SECURITY;

-- 3. Cấp đầy đủ quyền truy cập bảng cho các vai trò Supabase
GRANT ALL PRIVILEGES ON TABLE appeal_templates TO authenticated;
GRANT ALL PRIVILEGES ON TABLE appeal_templates TO service_role;
GRANT ALL PRIVILEGES ON TABLE appeal_templates TO anon;
