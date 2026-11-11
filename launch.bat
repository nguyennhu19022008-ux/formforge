@echo off
title FormForge Studio - AUTO FORM
setlocal
cd /d "%~dp0"

echo [AUTO FORM] Dang kiem tra trang thai cong 3000...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$client = New-Object System.Net.Sockets.TcpClient; try { $client.Connect('127.0.0.1', 3000); $client.Close(); exit 0 } catch { exit 1 }"

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo   MAY CHU DANG CHAY TREN CONG 3000
    echo ========================================================
    echo   [1] Mo giao dien Web tren trinh duyet
    echo   [2] Tat may chu FormForge ngay lap tuc
    echo   [3] Thoat
    echo ========================================================
    set /p choice="Nhap lua chon cua ban (1/2/3): "
    if "%choice%"=="1" (
        start http://localhost:3000
    ) else if "%choice%"=="2" (
        echo Dang tat may chu...
        powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
        echo Da tat may chu thanh cong.
        ping 127.0.0.1 -n 2 >nul
    )
    exit
)

echo [AUTO FORM] May chu chua chay. Dang khoi dong tren cong 3000...
start "FormForge Server" /min cmd /c "node server.js"
ping 127.0.0.1 -n 3 >nul
start http://localhost:3000
exit
