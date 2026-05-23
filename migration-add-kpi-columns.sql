-- BƯỚC 1: Bổ sung 2 cột kpi_bonus_percent và management_commission_percent vào bảng system_settings nếu chưa có
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS kpi_bonus_percent NUMERIC DEFAULT 5;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS management_commission_percent NUMERIC DEFAULT 0;

-- BƯỚC 2: Cấp quyền thao tác cho anon để có thể cập nhật cấu hình trực tiếp từ Client
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;
GRANT ALL PRIVILEGES ON TABLE system_settings TO authenticated;
GRANT ALL PRIVILEGES ON TABLE system_settings TO service_role;
GRANT ALL PRIVILEGES ON TABLE system_settings TO anon;

-- BƯỚC 3: Cập nhật mặc định cho hàng dữ liệu mặc định hiện tại
UPDATE system_settings 
SET kpi_bonus_percent = COALESCE(kpi_bonus_percent, 5),
    management_commission_percent = COALESCE(management_commission_percent, 0)
WHERE id = 'SYSTEM_DEFAULT_ID';

SELECT 'Đã sửa đổi bảng system_settings thành công! Hãy F5 lại trang và kiểm tra phần Cấu hình tài chính.' as status;
