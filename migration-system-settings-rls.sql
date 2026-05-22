-- Migration: Sửa lỗi không lưu được API Key (Gemini, YouTube) trên DTA YouTube Manager
-- Hướng dẫn: Copy toàn bộ mã này, dán vào [SQL Editor] của Supabase rồi bấm [RUN] ở góc dưới bên phải.

-- 1. Vô hiệu hóa bảo mật RLS trên bảng system_settings
-- Vì hệ thống sử dụng cơ chế đăng nhập custom và phân quyền ở Frontend,
-- bảng system_settings cần được tắt RLS để client có thể lưu/đọc cấu hình trực tiếp.
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

-- 2. Cấp toàn quyền thao tác (Đọc, Ghi, Xóa) cho tất cả các đối tượng kết nối
GRANT ALL PRIVILEGES ON TABLE system_settings TO authenticated;
GRANT ALL PRIVILEGES ON TABLE system_settings TO service_role;
GRANT ALL PRIVILEGES ON TABLE system_settings TO anon;

-- 3. Xóa chính sách RLS cũ nếu có để tránh xung đột
DROP POLICY IF EXISTS "Chỉ người đã đăng nhập mới được thao tác system_settings" ON system_settings;
DROP POLICY IF EXISTS "settings_service_only" ON system_settings;

-- 4. Thông báo hoàn tất
SELECT 'Đã cấu hình lại quyền hạn bảng system_settings thành công! Hãy F5 lại trang và kiểm tra lưu API Key.' as status;
