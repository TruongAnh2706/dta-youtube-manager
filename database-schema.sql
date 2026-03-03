-- =========================================================================
-- DTA STUDIO YOUTUBE MANAGER - CƠ SỞ DỮ LIỆU TỪ GOOGLE SHEETS LÊN SUPABASE (POSTGRESQL)
-- ⚠️ PHIÊN BẢN RESET: LỆNH NÀY SẼ XÓA SẠCH DỮ LIỆU CŨ VÀ TẠO CHUẨN MỚI 100%
-- BƯỚC 1: COPY TOÀN BỘ MÃ NÀY, DÁN VÀO [SQL EDITOR] CỦA SUPABASE 
-- BƯỚC 2: BẤM [RUN] Ở GÓC DƯỚI BÊN PHẢI ĐỂ CẬP NHẬT
-- =========================================================================

-- Lệnh xóa sạch toàn bộ CSDL cũ bị lỗi cấu trúc UUID để làm lại từ đầu
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Hướng dẫn hệ thống cấp quyền
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Kích hoạt extension (dự phòng, dù bộ khóa chính đã chuyển sang TEXT)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BẢNG NHÂN SỰ VÀ ROLE (staff_list)
CREATE TABLE IF NOT EXISTS staff_list (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'leader', 'member')),
  skills TEXT[] DEFAULT '{}',
  email TEXT NOT NULL,
  phone TEXT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  assigned_channel_ids TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('online', 'offline', 'inactive')),
  base_salary NUMERIC DEFAULT 0,
  managed_email_count INTEGER DEFAULT 0,
  kpi_targets JSONB DEFAULT '{"daily": 0, "weekly": 0, "monthly": 0}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed tài khoản Admin cho Đức Trường (DTA-CEO) nếu chưa có data
INSERT INTO staff_list (id, name, role, skills, email, phone, username, password, status, base_salary)
VALUES (
    'dta_admin_01', 'Đức Trường (CEO)', 'admin', ARRAY['scriptwriter', 'editor', 'voiceover', 'designer'],
    'ductruong.onl@gmail.com', '09662775506', 'admin', '1', 'online', 20000000
) ON CONFLICT (id) DO NOTHING;


-- 2. BẢNG TOPIC (topics)
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#4F46E5',
  tags TEXT[] DEFAULT '{}',
  hashtags TEXT[] DEFAULT '{}',
  country TEXT,
  target_audience TEXT,
  content_strategy TEXT,
  difficulty_level TEXT,
  monetization_potential TEXT,
  competition_level TEXT,
  niche TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 3. BẢNG TÀI KHOẢN KÊNH CHÍNH (channels)
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  channel_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  avatar_url TEXT,
  subscribers INTEGER DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  topic_ids TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  health_status TEXT DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'warning', 'danger')),
  health_notes TEXT,
  last_health_check TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  email TEXT,
  password TEXT,
  recovery_email TEXT,
  two_factor_code TEXT,
  proxy_id TEXT,
  posting_schedules JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 4. BẢNG KÊNH NGUỒN ĐỂ REUP / SPY (source_channels)
CREATE TABLE IF NOT EXISTS source_channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  avatar_url TEXT,
  topic_ids TEXT[] DEFAULT '{}',
  rating NUMERIC DEFAULT 1,
  upload_frequency TEXT,
  average_views BIGINT,
  subscribers BIGINT,
  total_views BIGINT,
  video_count NUMERIC DEFAULT 0,
  published_at TEXT,
  description TEXT,
  is_viral BOOLEAN DEFAULT FALSE,
  viral_video_title TEXT,
  viral_video_views NUMERIC DEFAULT 0,
  notes TEXT,
  latest_videos JSONB DEFAULT '[]'::jsonb,
  top_videos JSONB DEFAULT '[]'::jsonb,
  allowed_staff_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 5. BẢNG SPY ĐỐI THỦ (competitors)
CREATE TABLE IF NOT EXISTS competitors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  subscriber_count TEXT,
  video_count TEXT,
  last_video_title TEXT,
  last_video_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  topic_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 6. BẢNG TIẾN ĐỘ WORKFLOW / GIAO NHẬN VIỆC (video_tasks)
CREATE TABLE IF NOT EXISTS video_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('idea', 'script', 'voiceover', 'editing', 'review', 'published')),
  assignee_ids TEXT[] DEFAULT '{}',
  due_date TEXT,
  publish_time TEXT,
  video_type TEXT CHECK (video_type IN ('shorts', 'long')),
  script_link TEXT,
  thumbnail_link TEXT,
  production_cost NUMERIC DEFAULT 0,
  notes TEXT,
  script_outline TEXT,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  workflow_step INTEGER DEFAULT 1,
  best_publish_time TEXT,
  is_claimable BOOLEAN DEFAULT FALSE,
  comments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 7. QUẢN LÝ TÀI CHÍNH P&L KÊNH (financials)
CREATE TABLE IF NOT EXISTS financials (
  id TEXT PRIMARY KEY,
  channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- Format 'YYYY-MM'
  revenue NUMERIC DEFAULT 0,
  rpm NUMERIC DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  expenses NUMERIC DEFAULT 0,
  net_profit NUMERIC DEFAULT 0,
  roi NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(channel_id, month) -- Mỗi kênh chỉ có 1 report duy nhất cho mỗi tháng
);


-- 8. KHO ASSET / KHO TÀI NGUYÊN (assets)
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('drive', 'stock_video', 'audio', 'template', 'font', 'footage', 'license')),
  url TEXT NOT NULL,
  notes TEXT,
  expiration_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 9. HỆ THỐNG PROXY (proxies)
CREATE TABLE IF NOT EXISTS proxies (
  id TEXT PRIMARY KEY,
  ip TEXT NOT NULL,
  port TEXT NOT NULL,
  username TEXT,
  password TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'dead')),
  last_check TIMESTAMP WITH TIME ZONE,
  latency NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 10. GẬY BẢN QUYỀN (strikes)
CREATE TABLE IF NOT EXISTS strikes (
  id TEXT PRIMARY KEY,
  channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('copyright', 'community')),
  date_received TIMESTAMP WITH TIME ZONE NOT NULL,
  expiration_date TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'appealed', 'expired', 'resolved')),
  details TEXT,
  appeal_history TEXT[] DEFAULT '{}',
  error_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 11. THÀNH PHẦN KẾ TOÁN (Danh mục, Tài khoản, Giao dịch)
CREATE TABLE IF NOT EXISTS transaction_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  icon TEXT,
  color TEXT
);

CREATE TABLE IF NOT EXISTS financial_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bank', 'cash', 'e-wallet', 'credit')),
  balance NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'VND',
  bank_name TEXT,
  account_number TEXT,
  account_holder TEXT,
  branch TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  amount NUMERIC DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  category_id TEXT REFERENCES transaction_categories(id) ON DELETE SET NULL,
  account_id TEXT REFERENCES financial_accounts(id) ON DELETE CASCADE,
  to_account_id TEXT REFERENCES financial_accounts(id) ON DELETE SET NULL,
  description TEXT,
  reference_id TEXT,
  reference_type TEXT CHECK (reference_type IN ('channel', 'staff', 'task', 'other')),
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 12. PHẦN MỀM GIA HẠN / LICENSE (licenses)
CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  software_name TEXT NOT NULL,
  account_email TEXT NOT NULL,
  password TEXT,
  license_key TEXT,
  expiration_date TIMESTAMP WITH TIME ZONE NOT NULL,
  cost NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  devices TEXT[] DEFAULT '{}',
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 13. QUẢN LÝ EMAIL (managed_emails)
CREATE TABLE IF NOT EXISTS managed_emails (
  id TEXT PRIMARY KEY,
  channel_code TEXT,
  email TEXT NOT NULL UNIQUE,
  password TEXT,
  recovery_email TEXT,
  two_factor_auth TEXT,
  verification_phone TEXT,
  assigned_to TEXT REFERENCES staff_list(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 14. CÀI ĐẶT HỆ THỐNG / API KEYS (system_settings)
-- (Sử dụng jsonb để gói toàn bộ struct)
CREATE TABLE IF NOT EXISTS system_settings (
  id TEXT PRIMARY KEY DEFAULT 'SYSTEM_DEFAULT_ID',
  youtube_api_keys JSONB DEFAULT '[]'::jsonb,
  gemini_api_keys JSONB DEFAULT '[]'::jsonb,
  active_youtube_key_index INTEGER DEFAULT 0,
  audit_logs JSONB DEFAULT '[]'::jsonb,
  training_docs JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed System Settings
INSERT INTO system_settings (id) VALUES ('SYSTEM_DEFAULT_ID') ON CONFLICT (id) DO NOTHING;


-- =========================================================================
--  CHIA SẺ QUYỀN TRUY CẬP FULL APP (TẮT RLS) ĐỂ API CALL TỪ DTA CLIENT ĐƯỢC CHẤP NHẬN
-- =========================================================================
ALTER TABLE staff_list DISABLE ROW LEVEL SECURITY;
ALTER TABLE topics DISABLE ROW LEVEL SECURITY;
ALTER TABLE channels DISABLE ROW LEVEL SECURITY;
ALTER TABLE source_channels DISABLE ROW LEVEL SECURITY;
ALTER TABLE competitors DISABLE ROW LEVEL SECURITY;
ALTER TABLE video_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE financials DISABLE ROW LEVEL SECURITY;
ALTER TABLE assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE proxies DISABLE ROW LEVEL SECURITY;
ALTER TABLE strikes DISABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE financial_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE licenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

-- =========================================================================
--  BƯỚC QUAN TRỌNG NHẤT: CẤP QUYỀN (GRANT) CHO API (TRÁNH LỖI PERMISSION DENIED)
-- =========================================================================
-- Cho phép API từ Web (ẩn danh hoặc đăng nhập chung) được quyền Đọc/Ghi full Table
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;

-- Cấp quyền tương tự cho các sequence nếu sau này có dùng (dù hiện tại xài TEXT)
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
