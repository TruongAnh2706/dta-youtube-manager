@echo off
chcp 65001 > nul
echo =========================================================================
echo  🛠️ DTA STUDIO - CẤU HÌNH MÁY CHỦ BẬT KIẾM TIỀN CHẠY NGẦM (ALWAYS ON)
echo =========================================================================
echo.
echo Đang thiết lập khởi động cùng Windows cho DTA YouTube Backend...
echo.

set "SCRIPT_PATH=%~dp0start-backend.vbs"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_DIR%\DTA-Youtube-Backend.lnk"

:: Chay PowerShell de tao Shortcut chinh xac
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%SHORTCUT_PATH%'); $Shortcut.TargetPath = '%SCRIPT_PATH%'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.Save()"

if %errorlevel% neq 0 (
    echo [ERROR] Không thể đăng ký khởi động cùng Windows.
    pause
    exit /b %errorlevel%
)

echo [SUCCESS] Đăng ký khởi động cùng Windows thành công!
echo Đường dẫn shortcut: %SHORTCUT_PATH%
echo.
echo Đang kích hoạt chạy ngầm máy chủ Express ngay bây giờ...

:: Tắt các tiến trình node cũ đang chạy (nếu có) để tránh xung đột cổng 3001
taskkill /f /im node.exe >nul 2>&1

:: Khởi chạy máy chủ chạy ẩn
wscript.exe "%SCRIPT_PATH%"

echo.
echo [SUCCESS] Máy chủ DTA YouTube Backend đã khởi động ngầm thành công trên cổng 3001!
echo Từ nay, mỗi khi khởi động máy tính, server quét BKT sẽ tự động chạy ẩn dưới nền.
echo Bạn có thể truy cập website và sử dụng chức năng Quét BKT ngay lập tức.
echo.
echo Cảm ơn bạn đã tin dùng dịch vụ của DTA Studio!
echo Liên hệ hỗ trợ: Đức Trường - 0962.775.506 (Zalo)
echo =========================================================================
pause
