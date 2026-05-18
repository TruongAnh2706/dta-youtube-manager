-- MIGRATION SCRIPT CHO P1 (BUG-05,06,07,08,09)
-- CHẠY MÃ NÀY TRONG SUPABASE SQL EDITOR

-- 1. Sửa BUG-05: Thêm status 'dead' cho bảng channels
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_status_check;
ALTER TABLE channels ADD CONSTRAINT channels_status_check CHECK (status IN ('active', 'inactive', 'suspended', 'dead'));

-- 2. Sửa BUG-06: Xóa CHECK cứng của bảng video_tasks
ALTER TABLE video_tasks DROP CONSTRAINT IF EXISTS video_tasks_status_check;

-- 3. Sửa BUG-07: Thêm cột cho managed_emails
ALTER TABLE managed_emails ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE managed_emails ADD COLUMN IF NOT EXISTS target_topic_ids TEXT[] DEFAULT '{}';

-- 4. Sửa BUG-08: Thêm cột assignees cho topics
ALTER TABLE topics ADD COLUMN IF NOT EXISTS assignees TEXT[] DEFAULT '{}';

-- 5. Sửa BUG-09: Thêm cột allowed_staff_ids cho competitors
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS allowed_staff_ids TEXT[] DEFAULT '{}';

-- 6. Sửa lỗi mất dữ liệu phân quyền nhân sự trên Kênh Nguồn: Thêm cột status và last_health_check cho source_channels
ALTER TABLE source_channels ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE source_channels ADD COLUMN IF NOT EXISTS last_health_check TEXT;

-- Xóa cache để đảm bảo Typescript và DB schema ăn khớp
NOTIFY pgrst, 'reload schema';
