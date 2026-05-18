# Nhật ký Cập nhật (Changelog)

Tất cả các thay đổi đáng chú ý đối với dự án DTA YouTube Manager sẽ được ghi lại trong file này. 

Dự án tuân theo [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-05-18
### 🚀 Tính năng mới (Features)
- **Hệ thống Quản lý Phiên bản (Versioning):** Thêm phiên bản `v1.0.0` và ngày cập nhật (Build Date) trực tiếp vào góc dưới cùng bên trái thanh menu để nhận diện bản build mới dễ dàng.
- **Popup "Có gì mới?":** Hiển thị màn hình thông báo các tính năng mới nhất mỗi khi version tăng lên.
- **Màn hình Onboarding (Chào mừng):** Tự động hiển thị lời chào và hướng dẫn công việc nếu nhân viên mới (Member) chưa được phân công.
- **Thông báo Realtime (Toast):** Gửi thông báo ngay góc màn hình khi nhân sự được cập nhật thông tin cá nhân, thay đổi phân quyền, hoặc được phân công task mới.

### 🐛 Sửa lỗi (Bug Fixes)
- **Bảo mật Quản lý Nhân sự (P0):** Chuyển việc `Thêm mới/Cập nhật/Xóa` nhân sự từ việc gọi trực tiếp Client Supabase (dễ bị chặn bởi RLS) sang gọi Backend API (`/api/staff/update`) sử dụng `service_role_key`. Fix triệt để lỗi không lưu được dữ liệu nhân viên.
- **Chỉnh sửa Database Schema:**
  - Bổ sung `status = 'dead'` cho Kênh.
  - Xóa bỏ ràng buộc `status IN ('assigned', 'completed')` trong `video_tasks` để có thể nhận trạng thái linh hoạt.
  - Thêm các cột cho `managed_emails`, `topics` và `competitors` để chống lỗi Crash AutoSave.
- **API NicheExplorer:** Bổ sung `Authorization` token header để các API phân tích trend hoạt động ổn định khi RLS đang bật.

### 🔒 Bảo mật & Tối ưu hóa (Security)
- Kiểm tra tính bảo mật của `server/.env`. Đảm bảo key `SUPABASE_SERVICE_ROLE_KEY` không bị commit nhầm lên Git.
- Reset Password: Admin có thể hỗ trợ cấp lại mật khẩu cho nhân viên.
