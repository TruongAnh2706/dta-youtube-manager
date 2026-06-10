@echo off
rem Set code page to UTF-8
chcp 65001 > nul

echo =========================================================================
echo  DTA STUDIO - CONG CU TU DONG DEPLOY SUPABASE EDGE FUNCTION
echo =========================================================================
echo.
echo Dang kiem tra cau hinh du an...
echo.

set "PROJECT_REF=rjtjmxggtklafaprlmqb"
set "CLI_PATH=%~dp0scratch\bin\supabase.exe"

echo Ky hieu du an Supabase (Project Ref): %PROJECT_REF%
echo Duong dan CLI: %CLI_PATH%
echo.

rem Buoc 1: Kiem tra file supabase.exe co ton tai khong
echo [1/3] Kiem tra Supabase CLI...
if exist "%CLI_PATH%" (
    echo CLI da san sang tai %CLI_PATH%
    goto login
)

echo [LOI] Khong tim thay file %CLI_PATH%
echo Vui long chac chan ban da tai tron bo source code ve.
pause
exit /b 1

:login
echo.
echo [2/3] Dang chuan bi dang nhap Supabase Cloud...
echo LUU Y: Neu day la lan dau tien deploy, trinh duyet se mo ra trang web Supabase.
echo Hay nhan Enter de bat dau qua trinh dang nhap. Sau do trinh duyet se mo ra,
echo ban hay nhap Access Token hoac nhan "Authorize" de cap quyen.
echo.
pause

"%CLI_PATH%" login

echo.
echo [3/3] Dang tien hanh deploy Edge Function 'check-monetization'...
"%CLI_PATH%" functions deploy check-monetization --project-ref %PROJECT_REF% --no-verify-jwt

if %errorlevel% neq 0 (
    echo.
    echo [LOI] Deploy Edge Function that bai.
    echo Vui long kiem tra lai ket noi mang hoac phien dang nhap Supabase.
    echo.
    pause
    exit /b %errorlevel%
)

echo.
echo =========================================================================
echo  [THANH CONG] DA DEPLOY EDGE FUNCTION CHECK-MONETIZATION LEN CLOUD!
echo =========================================================================
echo Bay gio tinh nang check kiem tien se chay truc tiep tren Cloud 24/7.
echo Ban co the tat Server Node.js local (cong 3001) va su dung ngay tren Web App.
echo.
echo Phat trien boi DTA Studio - Chu quan: Duc Truong
echo Lien he Zalo: 0962.775.506 | Web: https://dta-studio.vercel.app/
echo =========================================================================
pause
