-- ============================================================
-- DTA MANAGER YT - VÁ CỘT THIẾU TRONG DATABASE
-- Ngày: 15/05/2026
-- Mô tả: Bổ sung các cột mà frontend đang sử dụng
--         nhưng chưa có trong schema ban đầu
-- ============================================================

-- 1. Bảng source_channels: Thêm cột status
ALTER TABLE source_channels ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 2. Bảng managed_emails: Thêm cột status và target_topic_ids
ALTER TABLE managed_emails ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';
ALTER TABLE managed_emails ADD COLUMN IF NOT EXISTS target_topic_ids TEXT[] DEFAULT '{}';

-- 3. Bảng topics: Đảm bảo có cột country và niche (dùng cho cascade filter)
ALTER TABLE topics ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Vietnam';
ALTER TABLE topics ADD COLUMN IF NOT EXISTS niche TEXT DEFAULT 'Khác';

-- ============================================================
-- HƯỚNG DẪN: Chạy file này trên Supabase SQL Editor 1 lần duy nhất.
-- Sau khi chạy xong, hãy chạy tiếp file rls-policies.sql để đảm bảo
-- bảo mật RLS được thiết lập đúng.
-- ============================================================
