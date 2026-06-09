@echo off
chcp 65001 > nul
echo =========================================================================
echo  🛠️ DTA STUDIO - CÔNG CỤ TỰ ĐỘNG DEPLOY SUPABASE EDGE FUNCTION
echo =========================================================================
echo.
echo Đang kiểm tra cấu hình dự án...

set "PROJECT_REF=rjtjmxggtklafaprlmqb"

echo Ký hiệu dự án Supabase (Project Ref): %PROJECT_REF%
echo.

:: Bước 1: Kiểm tra xem npm có hoạt động cục bộ không
echo [1/3] Đang kiểm tra Supabase CLI trong node_modules...
if exist "node_modules\.bin\supabase.cmd" (
    echo CLI đã được cài đặt cục bộ.
    goto deploy
)

echo CLI chưa được cài đặt. Đang tiến hành cài đặt Supabase CLI cục bộ bằng npm...
call npm install supabase --save-dev

if %errorlevel% neq 0 (
    echo.
    echo ❌ [LỖI] Không thể cài đặt Supabase CLI qua npm.
    echo Vui lòng đảm bảo máy tính của bạn đã cài đặt Node.js và npm.
    echo Bạn có thể tự chạy lệnh sau trong cmd để cài đặt thủ công:
    echo    npm install -g supabase
    echo.
    pause
    exit /b %errorlevel%
)

:deploy
echo.
echo [2/3] Đang chuẩn bị deploy Edge Function lên Supabase Cloud...
echo ⚠️  LƯU Ý: Nếu đây là lần đầu tiên deploy, trình duyệt sẽ mở ra trang web Supabase.
echo Hãy nhấn "Authorize" để cấp quyền đăng nhập cho CLI, sau đó quay lại cửa sổ này.
echo.

call npx supabase login

echo.
echo [3/3] Đang tiến hành deploy Edge Function 'check-monetization'...
call npx supabase functions deploy check-monetization --project-ref %PROJECT_REF%

if %errorlevel% neq 0 (
    echo.
    echo ❌ [LỖI] Deploy Edge Function thất bại.
    echo Vui lòng kiểm tra lại kết nối mạng hoặc phiên đăng nhập Supabase.
    echo.
    pause
    exit /b %errorlevel%
)

echo.
echo =========================================================================
echo  🎉 [THÀNH CÔNG] ĐÃ DEPLOY EDGE FUNCTION CHECK-MONETIZATION LÊN CLOUD!
echo =========================================================================
echo Bây giờ tính năng check kiếm tiền sẽ chạy trực tiếp trên Cloud 24/7.
echo Bạn có thể tắt Server Node.js local (cổng 3001) và sử dụng ngay trên Web App.
echo.
echo Cảm ơn bạn đã sử dụng dịch vụ của DTA Studio!
echo =========================================================================
pause
