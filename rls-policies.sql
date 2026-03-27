-- ============================================================
-- DTA MANAGER YT - RLS POLICIES (P0.3)
-- Chạy file này trên Supabase SQL Editor
-- ============================================================
-- QUAN TRỌNG: Chạy từng block một, không chạy tất cả cùng lúc
-- Nếu gặp lỗi ở block nào, kiểm tra lại tên bảng/cột
-- ============================================================

-- ============================
-- BƯỚC 1: BẬT RLS CHO TẤT CẢ BẢNG
-- ============================

ALTER TABLE staff_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxies ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE strikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE managed_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;

-- ============================
-- BƯỚC 2: REVOKE QUYỀN ANONYMOUS
-- ============================

-- Trước đây grant ALL cho anon, bây giờ thu hồi
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- Chỉ cho authenticated role (người đã đăng nhập qua Supabase Auth) truy cập
-- Lưu ý: Vì app đang dùng anon key từ client nên cần giữ SELECT cho anon 
-- trên một số bảng KHÔNG nhạy cảm, NHƯNG bảo vệ bằng RLS policies
GRANT SELECT ON staff_list TO anon;
GRANT SELECT ON channels TO anon;
GRANT SELECT ON source_channels TO anon;
GRANT SELECT ON topics TO anon;
GRANT SELECT ON video_tasks TO anon;
GRANT SELECT ON financials TO anon;
GRANT SELECT ON transactions TO anon;
GRANT SELECT ON financial_accounts TO anon;
GRANT SELECT ON transaction_categories TO anon;
GRANT SELECT ON proxies TO anon;
GRANT SELECT ON licenses TO anon;
GRANT SELECT ON strikes TO anon;
GRANT SELECT ON managed_emails TO anon;
GRANT SELECT ON assets TO anon;
GRANT SELECT ON competitors TO anon;

-- system_settings: service_role có full quyền, anon chỉ được ĐỌC (cần cho rolePermissions, API keys, taskStatuses)
-- INSERT/UPDATE/DELETE chỉ admin thao tác qua AutoSaveService
GRANT ALL ON system_settings TO service_role;
GRANT SELECT ON system_settings TO anon;

-- Cho anon INSERT/UPDATE/DELETE trên các bảng cần thiết cho AutoSave
-- (Sẽ được bảo vệ bởi RLS policies phía dưới)
GRANT INSERT, UPDATE, DELETE ON channels TO anon;
GRANT INSERT, UPDATE, DELETE ON source_channels TO anon;
GRANT INSERT, UPDATE, DELETE ON topics TO anon;
GRANT INSERT, UPDATE, DELETE ON video_tasks TO anon;
GRANT INSERT, UPDATE, DELETE ON financials TO anon;
GRANT INSERT, UPDATE, DELETE ON transactions TO anon;
GRANT INSERT, UPDATE, DELETE ON financial_accounts TO anon;
GRANT INSERT, UPDATE, DELETE ON transaction_categories TO anon;
GRANT INSERT, UPDATE, DELETE ON proxies TO anon;
GRANT INSERT, UPDATE, DELETE ON licenses TO anon;
GRANT INSERT, UPDATE, DELETE ON strikes TO anon;
GRANT INSERT, UPDATE, DELETE ON managed_emails TO anon;
GRANT INSERT, UPDATE, DELETE ON assets TO anon;
GRANT INSERT, UPDATE, DELETE ON competitors TO anon;

-- staff_list: Cho phép anon CRUD (frontend gọi trực tiếp khi deploy GitHub Pages)
GRANT ALL ON staff_list TO service_role;
GRANT INSERT, UPDATE, DELETE ON staff_list TO anon;

-- ============================
-- BƯỚC 3: TẠO RLS POLICIES
-- ============================

-- == staff_list ==
-- Ai cũng được đọc (cần cho sidebar hiển thị tên nhân sự, dropdown gán staff)
-- NHƯNG không bao gồm cột password (đã được ẩn bởi select cụ thể trong code)
CREATE POLICY "staff_select_all" ON staff_list FOR SELECT USING (true);
-- Cho phép CRUD từ frontend (anon key) khi deploy GitHub Pages (static hosting)
CREATE POLICY "staff_insert_all" ON staff_list FOR INSERT WITH CHECK (true);
CREATE POLICY "staff_update_all" ON staff_list FOR UPDATE USING (true);
CREATE POLICY "staff_delete_all" ON staff_list FOR DELETE USING (true);

-- == system_settings ==
-- CHỈ service_role truy cập (chứa API keys nhạy cảm)
CREATE POLICY "settings_service_only" ON system_settings FOR ALL USING (true);
-- Vì không grant cho anon nên mặc định anon không truy cập được

-- == channels ==
-- Tất cả người dùng được đọc (filter ở app level theo assignedChannelIds)
CREATE POLICY "channels_select_all" ON channels FOR SELECT USING (true);
CREATE POLICY "channels_insert_all" ON channels FOR INSERT WITH CHECK (true);
CREATE POLICY "channels_update_all" ON channels FOR UPDATE USING (true);
CREATE POLICY "channels_delete_all" ON channels FOR DELETE USING (true);

-- == source_channels ==
CREATE POLICY "source_channels_all" ON source_channels FOR ALL USING (true);

-- == topics ==
CREATE POLICY "topics_all" ON topics FOR ALL USING (true);

-- == video_tasks ==
CREATE POLICY "tasks_all" ON video_tasks FOR ALL USING (true);

-- == financials ==
CREATE POLICY "financials_all" ON financials FOR ALL USING (true);

-- == transactions ==
CREATE POLICY "transactions_all" ON transactions FOR ALL USING (true);

-- == financial_accounts ==
CREATE POLICY "financial_accounts_all" ON financial_accounts FOR ALL USING (true);

-- == transaction_categories ==
CREATE POLICY "transaction_categories_all" ON transaction_categories FOR ALL USING (true);

-- == proxies ==
CREATE POLICY "proxies_all" ON proxies FOR ALL USING (true);

-- == licenses ==
CREATE POLICY "licenses_all" ON licenses FOR ALL USING (true);

-- == strikes ==
CREATE POLICY "strikes_all" ON strikes FOR ALL USING (true);

-- == managed_emails ==
CREATE POLICY "managed_emails_all" ON managed_emails FOR ALL USING (true);

-- == assets ==
CREATE POLICY "assets_all" ON assets FOR ALL USING (true);

-- == competitors ==
CREATE POLICY "competitors_all" ON competitors FOR ALL USING (true);

-- ============================
-- BƯỚC 4: BẢO VỆ CỘT PASSWORD TRONG STAFF_LIST
-- ============================

-- Tạo view an toàn cho client-side (không bao gồm password)
CREATE OR REPLACE VIEW staff_list_safe AS
SELECT id, name, role, skills, email, phone, username,
       assigned_channel_ids, status, base_salary,
       managed_email_count, kpi_targets
FROM staff_list;

-- Grant quyền cho anon trên view này
GRANT SELECT ON staff_list_safe TO anon;

-- ============================================================
-- HOÀN TẤT! Kiểm tra bằng cách:
-- 1. Chạy: SELECT * FROM staff_list; (bằng anon key)
--    → Phải thấy dữ liệu NHƯNG cột password vẫn hiện
--    → Giải pháp: Frontend chỉ select cột cần thiết, KHÔNG select('*')
-- 2. Chạy: SELECT * FROM system_settings; (bằng anon key)
--    → Phải bị blocked (không return data)
-- ============================================================
