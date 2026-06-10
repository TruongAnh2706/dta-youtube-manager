# Nhật ký Cập nhật (Changelog)

Tất cả các thay đổi đáng chú ý đối với dự án DTA YouTube Manager sẽ được ghi lại trong file này. 

Dự án tuân theo [Semantic Versioning](https://semver.org/).

## [1.2.11] - 10/06/2026
### 🚀 Tính năng mới & Vá lỗi (Features & Fixes)
- **Tối ưu hóa gọi API Edge Function bằng Fetch:** Chuyển đổi cơ chế gọi Supabase Edge Function từ SDK Client (`supabase.functions.invoke`) sang sử dụng `fetch` chuẩn. Cải tiến này giúp đọc trực tiếp và hiển thị đầy đủ thông báo lỗi JSON gốc trả về từ Deno Server (chẳng hạn như cảnh báo bị YouTube chặn cào/Rate Limit) thay vì bị che đậy bởi các mã lỗi wrapper generic của thư viện.

## [1.2.10] - 10/06/2026
### 🚀 Tính năng mới & Vá lỗi (Features & Fixes)
- **Hiển thị lỗi Cloud Edge Function chi tiết:** Cập nhật logic xử lý lỗi ở Frontend (`SourceChannels.tsx` và `MonetizationReport.tsx`). Thay vì âm thầm bỏ qua lỗi Cloud và chỉ hiển thị lỗi dự phòng (localhost:3001) chung chung, hệ thống hiện tại sẽ hiển thị Toast thông báo chi tiết lỗi thực tế nhận được từ Cloud Edge Function. Điều này giúp dễ dàng xác định và khắc phục các vấn đề liên quan đến mạng hay phân quyền.

## [1.2.9] - 10/06/2026
### 🚀 Tính năng mới & Vá lỗi (Features & Fixes)
- **Cấu hình Edge Function không cần xác thực JWT:** Thêm cờ `--no-verify-jwt` vào câu lệnh deploy trong file `deploy-supabase-fn.bat`. Cải tiến này giúp loại bỏ hoàn toàn lỗi xác thực `401 Unauthorized` từ Gateway của Supabase khi người dùng gọi API check BKT công cộng, giúp Web App hoạt động độc lập không phụ thuộc vào trạng thái session của tài khoản đang đăng nhập.

## [1.2.8] - 10/06/2026
### 🚀 Tính năng mới (Features)
- **Hiển thị Mã Kênh / Mã Mail High-tech nổi bật:** Thêm khối hiển thị "Mã Kênh / Mã Mail" (channelCode) to rõ ràng với thiết kế High-tech (nền tối, chữ màu Neon Blue `#00FFFF` phát sáng) ở vị trí cao nhất của Modal Chi tiết tài khoản. Hỗ trợ nút sao chép nhanh, tăng tốc độ làm việc của quản trị viên và nhân viên.
- **Tối ưu hóa file script deploy.bat:** Sửa đổi file deploy batch script để hoạt động độc lập và ổn định trên Windows.

## [1.2.7] - 2026-06-09
### 🚀 Tính năng mới (Features)
- **Kiểm tra Kiếm tiền qua Cloud (Supabase Edge Function):** Di chuyển logic check BKT YouTube từ server local Express sang chạy trực tuyến 24/7 trên Cloud của Supabase qua Edge Function `check-monetization`. Giúp admin và nhân viên mở Web App ra là có thể quét BKT ngay lập tức mà không cần bật server local ở máy cá nhân.
- **Cơ chế Fallback local tự động:** Triển khai cơ chế dự phòng thông minh ở Frontend (React). Nếu gọi Cloud Function thất bại, hệ thống tự động gọi về server local cổng 3001, đảm bảo tính liên tục của hệ thống.
- **Công cụ Deploy Supabase Edge Function tự động:** Cung cấp tệp `deploy-supabase-fn.bat` tự động hóa cài đặt Supabase CLI cục bộ và deploy lên Cloud của dự án.
- **Sửa lỗi biên dịch (Compile Fix):** Khắc phục lỗi thiếu import `SystemSettings` trong `FinanceManager.tsx` làm gián đoạn quá trình deploy tự động lên GitHub Pages.

## [1.2.6] - 2026-06-09
### 🚀 Tính năng mới (Features)
- **Hỗ trợ Tài khoản AI & Content:** Bổ sung loại tài sản mới (ChatGPT, ElevenLabs, Grok, Canva,...) trực tiếp vào Kho tài nguyên với giao diện màu Neon Blue và Neon Red đặc trưng của DTA Studio. Hỗ trợ nút copy nhanh và ẩn/hiện mật khẩu bảo mật.
- **Đồng bộ trực tiếp Supabase:** Chuyển đổi cơ chế lưu của tab Quản lý Email (tạo/sửa email lẻ, đổi trạng thái/gán hàng loạt, dán import) và Kho tài nguyên để lưu trực tiếp lên cơ sở dữ liệu Supabase, khắc phục triệt để lỗi mất dữ liệu khi F5 hoặc chuyển trang nhanh.

### 📄 Database Migration
- Tạo tệp `migration-add-ai-content-accounts.sql` bổ sung cột `username`, `password` và cập nhật ràng buộc kiểu tài sản (`type CHECK constraint`) trong bảng `assets`.

## [1.2.5] - 2026-05-24
### 🚀 Tính năng mới (Features)
- **Dịch Lỗi Kết nối Hệ thống (Failed to Fetch):** Nâng cấp bộ bắt lỗi trong chức năng quét trạng thái kiếm tiền của kênh đối thủ (`SourceChannels`). Tự động phát hiện lỗi ngắt kết nối mạng/chưa bật backend `Failed to fetch` và hiển thị thông báo tiếng Việt trực quan, hướng dẫn cụ thể cách khởi động Server Node.js (cổng 3001) để quản trị viên dễ dàng tự xử lý.

## [1.2.4] - 2026-05-24
### 🚀 Tính năng mới (Features)
- **Đồng bộ Sắp xếp Excel:** Cập nhật đồng bộ thuật toán Sắp xếp tự nhiên Mã kênh tăng dần vào cả chức năng Xuất Excel đã chọn và Xuất Excel tất cả, đảm bảo file Excel tải xuống khớp thứ tự 100% so với giao diện quản trị.

## [1.2.3] - 2026-05-24
### 🚀 Tính năng mới (Features)
- **Sắp xếp Mã Kênh Tự nhiên (Natural Sort):** Sắp xếp danh sách tài khoản email thô tăng dần theo Mã Kênh một cách trực quan và khoa học (ví dụ: `TC01` ➔ `TC38` ➔ `TC49` ➔ `TC80` ➔ `TC86` ➔ `TC96` ➔ `TC106` ➔ `TC116`...). Các email chưa được cấp Mã kênh sẽ tự động được đẩy xuống cuối danh sách để nhường vị trí ưu tiên cho các kênh đã định danh.

## [1.2.2] - 2026-05-24
### 🚀 Tính năng mới (Features)
- **Xuất Excel Đầy đủ Thông tin Email:** Cải tiến tính năng Xuất Excel trong danh sách Quản lý Email (tài khoản thô).
  - Đối với xuất danh sách mail đã chọn (`handleBulkExport`) và xuất toàn bộ danh sách lọc được (`handleExportAll`), dữ liệu xuất ra giờ đây sẽ có đầy đủ thông tin nhất bao gồm: **Mã Kênh, Email, Mật khẩu, Email Khôi Phục, 2FA, SĐT Xác minh, Kênh liên kết, Nhân sự, Trạng thái, Ghi chú, Chủ đề dự kiến** (Đầy đủ 11 cột quan trọng để quản lý tiện lợi nhất).
  - Khôi phục tính năng xuất bảo mật Mật khẩu và 2FA cho quản trị viên/chủ sở hữu (Đức Trường) phục vụ cho nhu cầu lưu trữ và phục hồi tài khoản khi cần thiết.

## [1.2.1] - 2026-05-23
### 🚀 Tính năng mới (Features)
- **Cấu hình Tỷ giá Quy đổi USD/VND động:** Bổ sung ô nhập **"Tỷ giá quy đổi (USD/VND)"** trong phần Cài đặt Tài chính (Admin Settings). Admin có thể chủ động cập nhật tỷ giá sát thực tế thay vì fix cứng `25.400 đ/USD` trong code. Tỷ giá mới được áp dụng toàn hệ thống cho tháng hiện tại (số liệu hàng ngày không thay đổi, chỉ tổng kênh và báo cáo tài chính P&L).
- **🧮 Máy tính Tỷ giá thực tế từ YouTube Studio:** Tích hợp widget "Máy tính tỷ giá" cho phép Admin nhập một cặp số liệu USD & VND bất kỳ của một ngày trên YouTube Studio, hệ thống tự động tính toán `VND ÷ USD` để ra tỷ giá chuẩn xác nhất của tháng đó. Chỉ cần bấm **"⚡ Áp dụng tỷ giá này"** là tỷ giá mới được lưu tự động lên Supabase và áp dụng toàn bộ Báo cáo BKT.
- **Đồng bộ tỷ giá sang Báo cáo BKT:** Component `MonetizationReport` giờ đây nhận tỷ giá động từ `systemSettings.exchangeRate` thay vì giá trị cố định, đảm bảo số tiền VND quy đổi tạm tính khớp sát nhất với YouTube Studio thực tế.

### 📄 Database Migration
- Tạo tệp `migration-add-exchange-rate.sql` để bổ sung cột `exchange_rate` vào bảng `system_settings` trong Supabase.

## [1.2.0] - 2026-05-23
### 🚀 Tính năng mới (Features)
- **Đồng bộ Báo cáo BKT sang Báo cáo Tài chính (P&L):**
  - Tích hợp nút **"🔄 Đồng bộ từ BKT"** cho phép tự động gộp doanh thu thực tế (được cào hàng ngày) của tất cả các kênh BKT trong tháng sang hạch toán P&L chỉ với 1-click. Hệ thống tự động tính toán chi phí lương của nhân viên quản lý phân bổ và thưởng KPI 5% doanh thu cực kỳ chính xác.
  - Tự động hiển thị các kênh có doanh thu BKT nhưng **chưa hạch toán P&L** kèm nhãn nổi bật `"⚠️ Chưa hạch toán P&L"` và nút **"⚡ Đồng bộ nhanh"** trực tiếp tại dòng kênh đó để thao tác tiện lợi nhất.
  - Đối soát doanh thu thông minh: Tự động bôi cảnh báo màu cam kèm dòng chữ `"⚠️ Lệch BKT: [Doanh thu BKT]"` nếu nhân viên tự ý sửa đổi/hạch toán lệch doanh thu P&L so với dữ liệu thực tế cào từ YouTube.
  - Bổ sung banner cảnh báo thông minh ở đầu bảng P&L, tự động thông báo số tiền doanh thu BKT chưa hạch toán để quản lý (Đức Trường) luôn nắm bắt vấn đề và đưa ra hành động tức thời.

### 🐛 Sửa lỗi & Tối ưu hóa (Bug Fixes & Optimizations)
- **Sửa lỗi Xóa báo cáo P&L:** Sửa lỗi hệ thống khi bấm xóa báo cáo tài chính kênh do gọi sai tên bảng (`financial_records` thay vì `financials` của database Supabase).

## [1.1.1] - 2026-05-23
### 🐛 Sửa lỗi & Tối ưu hóa (Bug Fixes & Optimizations)
- **Vá lỗi Lưu Kênh Nguồn Liên Kết:** Khắc phục triệt để lỗi `"Could not find the 'views' column of 'source_channels' in the schema cache"` khi cào và liên kết kênh nguồn mới vào kênh trong mạng lưới. Đồng bộ hóa toàn bộ tên cột gửi lên CSDL từ `views` sang `total_views` chuẩn theo cấu trúc của Supabase. Bản vá đã được tối ưu hóa và kiểm thử build hoàn chỉnh để anh Đức Trường test vận hành thực tế.

## [1.1.0] - 2026-05-22
### 🚀 Tính năng mới (Features)
- **Tìm kiếm & Đồng bộ A-Z Chủ đề:** Tích hợp bộ chọn chủ đề hỗ trợ tìm kiếm được sắp xếp theo bảng chữ cái từ A-Z ở tab Kênh Nguồn và Mạng lưới Kênh. Loại bỏ ô "Tất cả nhóm CĐ" dư thừa và cải thiện kích thước hiển thị đồng bộ, to rộng cân đối với các ô còn lại.
- **Quản lý Mẫu Kháng Nghị:** Thêm tab "Mẫu Kháng Nghị" mới trong mục Hệ thống, hỗ trợ lưu trữ mẫu đơn kháng và tích hợp nút AI Spin (sử dụng Gemini) để sinh văn bản kháng nghị độc bản Plain Text siêu sạch, định dạng chuẩn và không chứa ký tự thừa, sẵn sàng copy.

### 🐛 Sửa lỗi & Tối ưu hóa (Bug Fixes & Optimizations)
- **Vá lỗi và Lưu trữ API Keys:** Khắc phục lỗi crash ứng dụng và lỗi thông báo đỏ ở góc trên màn hình khi bấm lưu nội dung bằng cách tối ưu hóa Database schema và cấu hình phân quyền bảo mật RLS cho bảng `system_settings` trong Supabase.
- **Tích hợp Gemini API Keys:** Tự động import và lưu trữ vĩnh viễn danh sách Gemini Keys của Đức Trường vào hệ thống cài đặt, bảo toàn 100% YouTube API Key cũ mà không bị mất khi reload trang (F5).

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
