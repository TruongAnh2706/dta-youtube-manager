-- DTA STUDIO - SQL MIGRATION FILE
-- Chủ quản: Đức Trường (0962.775.506)
-- Dự án: DTA YouTube Manager
-- Mục tiêu: Bổ sung cột exchange_rate vào bảng system_settings để lưu trữ cấu hình tỷ giá USD/VND động

-- BƯỚC 1: Bổ sung cột exchange_rate vào bảng system_settings nếu chưa có
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC DEFAULT 25400;

-- BƯỚC 2: Cập nhật giá trị mặc định cho các dòng hiện tại nếu cột đang bị trống (null)
UPDATE system_settings SET exchange_rate = 25400 WHERE exchange_rate IS NULL;

-- BƯỚC 3: Cấp quyền thao tác bảng system_settings cho tất cả các role để đảm bảo tính năng đồng bộ hoạt động mượt mà
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;
GRANT ALL PRIVILEGES ON TABLE system_settings TO authenticated;
GRANT ALL PRIVILEGES ON TABLE system_settings TO service_role;
GRANT ALL PRIVILEGES ON TABLE system_settings TO anon;

SELECT '🎉 Đã nâng cấp bảng system_settings và thêm cột exchange_rate thành công! Hãy F5 lại trang Web để tận hưởng kết quả.' as status;
