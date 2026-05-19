# Nhật ký Cập nhật (Changelog)

Tất cả các thay đổi đáng chú ý đối với dự án DTA YouTube Manager sẽ được ghi lại trong file này. 

Dự án tuân theo [Semantic Versioning](https://semver.org/).

## [1.0.4] - 2026-05-19
### 🐛 Sửa lỗi & Tối ưu hóa (Bug Fixes & Optimizations)
- **Sửa lỗi TypeScript và Build Dự án:** Khắc phục triệt để các lỗi TypeScript ngăn cản dự án build thành công:
  - Import đầy đủ kiểu dữ liệu `ChannelMetric` trong file `src/components/Channels.tsx`.
  - Khai báo các trường bổ sung cho kiểu dữ liệu `VideoTask` (`description`, `creatorId`, `createdAt`, `updatedAt`, `tags`, `projectType`) trong `src/types.ts`.
  - Loại bỏ thuộc tính `title` không hợp lệ trên icon Lucide `AlertCircle` trong `src/components/TaskManager.tsx` bằng cách bọc ngoài với thẻ `span`.
- **Hoàn tất Build Production:** Đảm bảo dự án build thành công 100% không còn lỗi biên dịch (Exit code 0).

## [1.0.3] - 2026-05-19
### 🚀 Tính năng mới (Features)
- **Báo cáo Kênh Bật Kiếm Tiền (Monetization Report):** Thêm tính năng quản lý View và Doanh thu hàng ngày (Realtime quy đổi USD sang VNĐ). Hỗ trợ đánh dấu/bỏ đánh dấu kênh bật kiếm tiền, tự động khóa nhập liệu theo độ trễ của YouTube (Views trễ 1 ngày, Doanh thu trễ 2 ngày), cảnh báo bôi đỏ khi nhân viên quên báo cáo.
- **Ghi chú Lỗi Tích hợp (Bug Reporter):** Bổ sung nút floating "Ghi chú Lỗi" ở góc dưới màn hình. Tự động nhận diện tab đang thao tác, lưu trữ ghi chú offline vào localStorage, hỗ trợ nút "Copy gửi AI" giúp biên soạn nhanh danh sách công việc cần sửa.

### 🐛 Sửa lỗi & Tối ưu hóa (Bug Fixes & Optimizations)
- **Theo dõi Đăng nhập HRM:** Bổ sung trường `last_login_at` vào cơ sở dữ liệu và tự động cập nhật thời gian đăng nhập gần nhất của nhân sự.
- **Tối ưu hóa Giao diện và Cấu trúc Dữ liệu:** Đồng bộ hóa lại việc hiển thị phân quyền kênh và chủ đề, hạn chế tối đa xung đột khi nhân viên thao tác đồng thời. Bổ sung bảng `channel_metrics` để lưu trữ dữ liệu báo cáo BKT an toàn trên Supabase.

## [1.0.2] - 2026-05-18
### 🐛 Sửa lỗi (Bug Fixes)
- **Kênh Nguồn (Source Channels):** Sửa lỗi mất dữ liệu phân quyền nhân sự khi reload trang (F5). Bổ sung schema `status` và `last_health_check` cho bảng `source_channels` để khắc phục lỗi Crash lúc AutoSave đẩy dữ liệu lên Supabase.
- **Kênh Nguồn - Thao tác hàng loạt (Bulk Actions):** Khắc phục lỗi dữ liệu không được lưu lên Database đối với các tính năng *Gắn Chủ đề, Phân Quyền Xem, Thu hồi Quyền, Đổi Trạng thái*. Chuyển đổi từ việc lưu state ảo sang đồng bộ trực tiếp lên Supabase.
- **Kênh Nguồn - Giao Task:** Hoàn thiện tính năng Giao Task hàng loạt cho các kênh nguồn. Công việc mới tạo sẽ được chuyển chuẩn format và lưu thẳng vào bảng `video_tasks` trong Database.

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
