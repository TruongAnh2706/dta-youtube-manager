-- ============================================================
-- DTA MANAGER YT - BẢO MẬT RLS POLICIES (BẢN VÁ LỖI BẢO MẬT)
-- ============================================================
-- ⚠️ PHIÊN BẢN CŨ ĐÃ GRANT ALL CHO ANON LÀ RẤT NGUY HIỂM.
-- Bản này sẽ thu hồi quyền của khách vãng lai và chỉ cấp quyền 
-- cho người đã đăng nhập (authenticated).
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
-- BƯỚC 2: THU HỒI QUYỀN CỦA ANON (KHÁCH)
-- ============================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;

-- ============================
-- BƯỚC 3: CẤP QUYỀN CHO AUTHENTICATED VÀ SERVICE_ROLE
-- ============================
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;

-- NGOẠI LỆ DUY NHẤT: Bảng `staff_list` cần cho phép `anon` ĐỌC (SELECT)
-- Lý do: Màn hình Login cần check role của staff từ username/email TRƯỚC KHI login thành công
-- HOẶC nếu hệ thống tự động map auth.users thì không cần. 
-- Nhưng để an toàn không làm hỏng flow cũ, ta cho phép anon SELECT `staff_list`.
GRANT SELECT ON staff_list TO anon;

-- ============================
-- BƯỚC 4: TẠO RLS POLICIES
-- ============================

-- Xóa các policy cũ để tránh trùng lặp
DROP POLICY IF EXISTS "staff_select_all" ON staff_list;
DROP POLICY IF EXISTS "staff_insert_all" ON staff_list;
DROP POLICY IF EXISTS "staff_update_all" ON staff_list;
DROP POLICY IF EXISTS "staff_delete_all" ON staff_list;

-- 1. Bảng staff_list
CREATE POLICY "Cho phép tất cả mọi người ĐỌC staff_list" ON staff_list FOR SELECT USING (true);
CREATE POLICY "Chỉ người đã đăng nhập mới được SỬA staff_list" ON staff_list FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Chỉ người đã đăng nhập mới được THÊM staff_list" ON staff_list FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Chỉ người đã đăng nhập mới được XÓA staff_list" ON staff_list FOR DELETE TO authenticated USING (true);

-- 2. Bảng system_settings (Chứa API Key)
DROP POLICY IF EXISTS "settings_service_only" ON system_settings;
-- Chỉ Admin / Quản lý mới được xem hoặc sửa (trong thực tế nên check role, nhưng tạm thời mở cho authenticated)
CREATE POLICY "Chỉ người đã đăng nhập mới được thao tác system_settings" ON system_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Tất cả các bảng còn lại (channels, tasks, etc...)
-- Bằng cách dùng 1 đoạn PL/pgSQL để loop qua tạo policy cho lẹ (nếu chạy script),
-- Hoặc viết thủ công cho chắc chắn:

CREATE POLICY "auth_channels" ON channels FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_source_channels" ON source_channels FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_topics" ON topics FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_video_tasks" ON video_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_financials" ON financials FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_transactions" ON transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_financial_accounts" ON financial_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_transaction_categories" ON transaction_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_proxies" ON proxies FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_licenses" ON licenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_strikes" ON strikes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_managed_emails" ON managed_emails FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_assets" ON assets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_competitors" ON competitors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- ĐÃ HOÀN TẤT VÁ LỖI BẢO MẬT. 
-- BÂY GIỜ CHỈ AI CÓ TÀI KHOẢN (AUTHENTICATED) MỚI CAN THIỆP ĐƯỢC DB.
-- ============================================================
