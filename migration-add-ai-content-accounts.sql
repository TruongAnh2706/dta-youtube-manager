-- =========================================================================
-- DTA STUDIO - MIGRATION: BỔ SUNG TÀI KHOẢN AI & CONTENT VÀO KHO TÀI NGUYÊN
-- ⚠️ AN TOÀN TUYỆT ĐỐI: KHÔNG LÀM MẤT DỮ LIỆU CŨ
-- 
-- Hướng dẫn chạy:
-- BƯỚC 1: Copy toàn bộ mã SQL dưới đây.
-- BƯỚC 2: Truy cập vào Supabase Dashboard -> Chọn dự án -> Chọn SQL Editor.
-- BƯỚC 3: Tạo một query mới, dán mã vào và bấm nút RUN.
-- =========================================================================

-- 1. Xóa check constraint cũ của cột type trên bảng assets (nếu có)
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_type_check;

-- 2. Thêm check constraint mới, hỗ trợ thêm 2 loại: 'ai_account' và 'content_account'
ALTER TABLE assets ADD CONSTRAINT assets_type_check CHECK (
  type IN ('drive', 'stock_video', 'audio', 'template', 'font', 'footage', 'license', 'ai_account', 'content_account')
);

-- 3. Thêm cột 'username' và 'password' dạng TEXT (nullable - cho phép để trống)
-- Cột nullable đảm bảo không ảnh hưởng hay lỗi đối với bất kỳ hàng dữ liệu nào hiện có.
ALTER TABLE assets ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS password TEXT;

-- 4. Reload schema cache cho PostgREST của Supabase ăn khớp ngay lập tức
NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- Phát triển bởi DTA Studio - Chủ quản: Đức Trường
-- Hotline: 0962.775.506 (Zalo)
-- Website: https://dta-studio.vercel.app/
-- =========================================================================
