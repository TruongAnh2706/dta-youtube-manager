-- =========================================================================
-- DTA STUDIO YOUTUBE MANAGER - MIGRATION SCRIPT
-- ⚠️ AN TOÀN TUYỆT ĐỐI: LỆNH NÀY CHỈ THÊM CỘT MỚI, KHÔNG XÓA HOẶC LÀM MẤT DỮ LIỆU CŨ!
-- BƯỚC 1: COPY TOÀN BỘ MÃ NÀY
-- BƯỚC 2: DÁN VÀO [SQL EDITOR] CỦA SUPABASE VÀ BẤM [RUN] ĐỂ THỰC THI
-- =========================================================================

-- Thêm cột lưu trạng thái kiếm tiền cho bảng kênh nguồn nếu chưa tồn tại
ALTER TABLE source_channels ADD COLUMN IF NOT EXISTS is_monetized BOOLEAN DEFAULT NULL;

-- Cấp quyền tương tác đầy đủ cho các role của Supabase
GRANT ALL PRIVILEGES ON TABLE source_channels TO authenticated;
GRANT ALL PRIVILEGES ON TABLE source_channels TO service_role;

-- Gợi ý kiểm tra: Chạy lệnh SELECT * FROM source_channels LIMIT 1; để kiểm tra xem cột is_monetized đã xuất hiện chưa.
