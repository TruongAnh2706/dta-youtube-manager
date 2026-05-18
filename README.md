# DTA YouTube Manager 🚀

Hệ thống Quản trị MCN / Agency YouTube nội bộ của **DTA Studio**, được thiết kế để quản lý hàng trăm kênh YouTube, tự động hóa quy trình làm việc (Task Management), phân tích đối thủ (Spy), theo dõi KPI nhân sự, và cảnh báo bản quyền.

---

## 🏗️ Cấu trúc & Công nghệ

### Frontend
- **Framework:** React 18 + Vite (TypeScript)
- **Styling:** Tailwind CSS + Lucide Icons
- **State Management:** Context API & Custom Hooks (`useAppData.ts`)
- **Realtime Sync:** Component `AutoSaveService.tsx` đồng bộ Realtime state của ứng dụng lên Supabase.

### Backend
- **Framework:** Node.js + Express
- **API Security:** JWT Authorization (`verifyAuth`)
- **Database & Auth:** Supabase (PostgreSQL)

---

## 🛠️ Hướng dẫn Cài đặt & Chạy Local

### 1. Yêu cầu hệ thống
- **Node.js** phiên bản v18.0.0 trở lên.
- Quản lý gói: `npm` hoặc `yarn`.

### 2. Cài đặt Dependencies
Bạn cần cài đặt thư viện cho cả thư mục gốc (Frontend) và thư mục `server` (Backend).
```bash
# Ở thư mục gốc (Frontend)
npm install

# Ở thư mục server (Backend)
cd server
npm install
cd ..
```

### 3. Cấu hình Biến Môi Trường (.env)
Dự án có **2 file .env** tách biệt:

#### 3.1. Frontend (`/.env`)
```env
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_API_URL=http://localhost:3001
VITE_APP_VERSION=1.0.0
```

#### 3.2. Backend (`/server/.env`)
```env
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> # QUAN TRỌNG: Không bao giờ để lộ key này
JWT_SECRET=<your-jwt-secret-from-supabase>
PORT=3001
```

### 4. Khởi động dự án
Sử dụng lệnh sau ở thư mục gốc để chạy song song cả **Vite Frontend (Port 3000)** và **Express Backend (Port 3001)**:

```bash
npm run dev
```

---

## 📦 Quy trình Cập nhật & Fix Bug (Workflow)

Để đảm bảo code không bị ghi đè hoặc nhầm lẫn phiên bản, bạn vui lòng làm theo quy trình sau:

1. **Sửa code:** Sửa lỗi hoặc viết tính năng mới trên máy Local.
2. **Kiểm tra tính năng:** Chạy `npm run dev` để đảm bảo code hoạt động hoàn hảo.
3. **Cập nhật Phiên bản:** 
   - Mở file `package.json` và tăng số version (ví dụ: `"version": "1.0.2"`).
   - Mở file `CHANGELOG.md` và ghi log chi tiết xem bạn vừa làm gì ở version này (Phần nào là tính năng, phần nào là fix bug).
4. **Push lên Github / Deploy:** Commit và push code của bạn lên server.
5. **Xác nhận UI:** Mở app, xem góc dưới thanh menu có đổi thành số version mới chưa. Nếu rồi thì hoàn thành 100%.

---

## 🔐 Lưu ý Bảo mật (Security)
- RLS (Row Level Security) được bật trên tất cả các bảng Supabase để ngăn client xóa/sửa dữ liệu nhân sự trái phép. 
- Mọi thao tác quản lý nhân sự nhạy cảm phải gọi qua `/api/staff/...` ở Backend (`server.js`) chứ không gọi qua SDK Client (nhằm bypass RLS bằng service_role).
- Tuyệt đối giữ file `server/.env` ở local và luôn đưa vào `.gitignore`.

© 2026 Phát triển bởi DTA Studio - Chủ quản: Đức Trường AI.
