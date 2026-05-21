# 🛠️ DTA STUDIO - HƯỚNG DẪN TÍCH HỢP HỆ THỐNG THÔNG BÁO ZALO BOT PREMIUM

Tài liệu này hướng dẫn chi tiết cách thiết lập hệ thống gửi thông báo tự động song song qua **Zalo** và **Telegram** cho ứng dụng **DTA YouTube Manager** thuộc sở hữu của **DTA Studio - Chủ quản: Đức Trường (SĐT/Zalo: 0962.775.506)**.

Hệ thống hỗ trợ cơ chế **Hybrid** (Đa năng song song), cho phép anh Đức Trường lựa chọn giữa 2 phương án tích hợp Zalo tối ưu nhất tùy theo nhu cầu vận hành:

---

## 📋 MỤC LỤC
1. [PHƯƠNG ÁN 1: Sử dụng Zalo Webhook bên thứ 3 (Khuyên Dùng cho Nhóm Chat Nội Bộ)](#-phuong-an-1-su-dung-zalo-webhook-ben-thu-3-khuyen-dung-cho-nhom-chat-noi-bo)
2. [PHƯƠNG ÁN 2: Sử dụng Zalo Official Account (OA) Chat API Chính Thống (Cá Nhân Miễn Phí)](#-phuong-an-2-su-dung-zalo-official-account-oa-chat-api-chinh-thong-ca-nhan-mien-phi)
3. [HƯỚNG DẪN CẤU HÌNH TRÊN GIAO DIỆN DTA YOUTUBE MANAGER](#-huong-dan-cau-hinh-tren-giao-dien-dta-youtube-manager)
4. [CÁC KỊCH BẢN THÔNG BÁO BÁO ĐỘNG TỰ ĐỘNG](#-cac-kich-ban-thong-bao-bao-dong-tu-dong)

---

## ⚡ PHƯƠNG ÁN 1: Sử dụng Zalo Webhook bên thứ 3 (Khuyên Dùng cho Nhóm Chat Nội Bộ)

Đây là **phương án tối ưu nhất** cho DTA Studio để bắn các cảnh báo lỗi Proxy, Gậy bản quyền trực tiếp vào **Nhóm Chat Zalo của Studio** mà không cần giấy phép đăng ký kinh doanh doanh nghiệp.

### 🔹 Cách hoạt động:
Sử dụng một dịch vụ kết nối trung gian (ví dụ: *ZaloSolution*, *fchat.vn*, *LarkSuite Zalo Bot*, hoặc các dịch vụ webhook API Zalo tự chế giá rẻ/miễn phí) để nhận dữ liệu JSON gửi từ hệ thống và tự động chuyển tiếp vào Nhóm Zalo thông qua tài khoản Zalo cá nhân đại diện.

### 🔹 Các bước thiết lập:
1. Đăng ký tài khoản trên một dịch vụ Zalo Webhook Gateway trung gian (ví dụ: **ZaloSolution** hoặc các nền tảng tương đương).
2. Tạo một **Zalo Bot gửi tin** trên bảng điều khiển của họ:
   - Quét mã QR Zalo cá nhân của một nick phụ (Clone) dùng làm Bot gửi tin.
   - Thêm nick phụ này vào nhóm chat Zalo của DTA Studio.
3. Lấy đường dẫn **Webhook URL** được cấp riêng cho nhóm chat của anh (dạng: `https://api.zalosolution.com/v1/send-message?token=XYZ...` hoặc tương tự).
4. Lưu URL này lại để dán vào phần cài đặt.

---

## 🌟 PHƯƠNG ÁN 2: Sử dụng Zalo Official Account (OA) Chat API Chính Thống (Cá Nhân Miễn Phí)

Phương án này sử dụng Zalo OA (Zalo Official Account) chính thức từ Zalo Developers. Rất thích hợp để gửi tin nhắn thông báo bảo mật, KPI hoặc công việc riêng tư đến từng nhân sự cá nhân của DTA Studio hoàn toàn miễn phí.

### ⚠️ Lưu ý quan trọng:
* Zalo OA dạng thường không cần GPKD vẫn có thể tạo được để gửi tin nhắn Chat API cá nhân.
* Người nhận tin nhắn (anh Đức Trường hoặc nhân viên) **phải nhấn quan tâm Zalo OA** của DTA Studio trước thì API mới được quyền bắn tin nhắn miễn phí.

### 🔹 Các bước lấy Access Token & Recipient ID:

#### Bước 1: Tạo tài khoản Zalo Official Account (Zalo OA)
1. Truy cập trang [https://oa.zalo.me](https://oa.zalo.me) và đăng nhập bằng nick Zalo của anh.
2. Chọn **Tạo Official Account mới** -> Chọn loại tài khoản **Doanh Nghiệp** hoặc **Nội Dung** (khuyên chọn Doanh Nghiệp để có đầy đủ quyền Chat API).
3. Nhập đầy đủ thông tin đại diện cho **DTA Studio**. Nhấn **Tạo tài khoản**.

#### Bước 2: Tạo Ứng Dụng Zalo trên Zalo Developers
1. Truy cập [https://developers.zalo.me](https://developers.zalo.me) và đăng nhập.
2. Chọn mục **Ứng dụng của tôi** -> **Thêm ứng dụng mới**.
3. Điền tên ứng dụng (Ví dụ: `DTA Auto Manager Service`), chọn danh mục phù hợp.

#### Bước 3: Liên kết ứng dụng với Zalo OA
1. Trong bảng điều khiển Ứng dụng Zalo Developers, vào mục **Sản phẩm** -> Chọn **Official Account (OA)**.
2. Chọn tài khoản Zalo OA của **DTA Studio** vừa tạo để liên kết với ứng dụng.

#### Bước 4: Xin quyền Chat API & Lấy Access Token
1. Đi tới mục **Xét duyệt quyền** -> Chọn kích hoạt các quyền: `oa.chats` (Gửi tin nhắn chat) và `oa.members` (Xem danh sách người quan tâm).
2. Truy cập công cụ **Zalo API Explorer** trên thanh menu của Zalo Developers.
3. Chọn ứng dụng của anh, cấp quyền và nhấn **Get Access Token**.
4. Copy chuỗi **Access Token** cực dài hiện ra. *(Lưu ý: Zalo Access Token chính thống có hạn dùng 25 tiếng. Nếu muốn tự động làm mới, hệ thống sẽ sử dụng Refresh Token để lấy Access Token mới tự động, hoặc anh có thể nhập thủ công Access Token dài hạn)*.

#### Bước 5: Lấy ID người nhận (Recipient User ID Zalo)
1. Người nhận (ví dụ nick Zalo cá nhân của anh Đức Trường) dùng điện thoại quét QR quan tâm Zalo OA của Studio.
2. Vào Zalo Developers -> API Explorer -> Gọi API lấy danh sách người quan tâm (`/v3.0/oa/members`) hoặc xem trong mục quản lý hội thoại của OA để lấy mã ID Zalo của anh (chuỗi kí tự đặc biệt dạng: `827364812398471928`).
3. Lưu ID này lại làm **Mã Người Nhận/Nhóm (Zalo Recipient ID)**.

---

## 🔌 HƯỚNG DẪN CẤU HÌNH TRÊN GIAO DIỆN DTA YOUTUBE MANAGER

Anh Đức Trường hãy làm theo các bước trực quan dưới đây để kích hoạt Zalo Bot:

1. Đăng nhập hệ thống bằng tài khoản **Admin (Đức Trường)**.
2. Điều hướng tới tab **Cài Đặt Hệ Thống** (Admin Settings).
3. Tìm đến khối **CẤU HÌNH HỆ THỐNG THÔNG BÁO (BOT ALERT)**.
4. Tại tab **Zalo Bot Cảnh Báo**, điền thông số như sau:
   
   * **Nếu dùng Phương án 1 (Webhook bên thứ 3 - khuyên dùng):**
     * **Trạng thái Zalo Alert:** Bật (Toggle chuyển sang màu Xanh Neon).
     * **Zalo Webhook URL:** Dán link Webhook nhận được từ Gateway trung gian.
     * **Zalo Recipient ID:** *(Để trống hoặc nhập ID phòng chat của anh nếu webhook yêu cầu)*.
     * **Zalo Access Token:** *(Để trống)*.

   * **Nếu dùng Phương án 2 (Zalo OA API chính thống):**
     * **Trạng thái Zalo Alert:** Bật.
     * **Zalo Webhook URL:** *(Để trống)*.
     * **Zalo Access Token:** Dán mã Access Token lấy được từ Zalo Developers.
     * **Zalo Recipient ID:** Dán ID Zalo cá nhân của anh hoặc nhân sự cần nhận thông báo.

5. Nhấn nút **⚡ Gửi Tin Nhắn Test Zalo** để kiểm tra ngay lập tức. Nếu cấu hình đúng, điện thoại của anh sẽ nhận được tin nhắn test có nội dung chào mừng từ DTA Studio!
6. Nhấn nút **Lưu cài đặt** ở dưới cùng để hệ thống chính thức áp dụng.

---

## 🚨 CÁC KỊCH BẢN THÔNG BÁO BÁO ĐỘNG TỰ ĐỘNG

Khi Zalo Alert được kích hoạt, hệ thống sẽ tự động gửi tin nhắn báo động khẩn cấp song song qua cả **Zalo** và **Telegram** trong 3 trường hợp nghiêm trọng sau:

### 1. Sự Cố Proxy / VPS Bị Die (DEAD!)
* **Nguyên nhân:** Khi Admin hoặc nhân viên nhấn nút *Kiểm Tra Proxy* trong tab *Tài nguyên* và phát hiện Proxy bị mất kết nối mạng.
* **Nội dung tin nhắn:** Báo cáo chi tiết địa chỉ IP:Port bị lỗi và ghi chú kênh đang liên kết để xử lý cấp tốc, tránh làm gián đoạn upload video.

### 2. Phát Hiện Kênh Nhận Gậy Bản Quyền/Cộng Đồng Mới
* **Nguyên nhân:** Khi Admin hoặc Nhân sự quản lý thêm mới một gậy bản quyền vào hệ thống quản trị của một kênh.
* **Nội dung tin nhắn:** Tên kênh vi phạm, loại gậy (bản quyền hay nguyên tắc cộng đồng), chi tiết vi phạm, ngày hết hạn và đề xuất sử dụng công cụ AI kháng cáo chuẩn Hoa Kỳ của DTA Studio.

### 3. Video Bị Trễ Lịch Đăng Quá 15 Phút
* **Nguyên nhân:** Hệ thống tự động quét mỗi 60 giây. Nếu phát hiện có video đến giờ đăng theo kế hoạch nhưng chưa được xuất bản thành công quá 15 phút.
* **Nội dung tin nhắn:** Tiêu đề video trễ lịch, tên kênh tương ứng, lịch dự kiến ban đầu và yêu cầu nhân viên phụ trách kiểm tra ngay lập tức để tránh mất tương tác giờ vàng.

---
> 📞 **HỖ TRỢ KỸ THUẬT DTA STUDIO:**
> Nếu anh Đức Trường gặp khó khăn trong quá trình cấu hình Zalo API hoặc lấy Token, vui lòng liên hệ trực tiếp:
> * **Chủ quản:** Đức Trường AI
> * **Hotline/Zalo:** 0962.775.506
> * **Email:** ductruong.onl@gmail.com
> * **Website:** https://dta-studio.vercel.app/
