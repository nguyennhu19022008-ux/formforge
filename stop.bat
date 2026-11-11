@echo off
title Dung May Chu FormForge Studio
echo [AUTO FORM] Dang dung may chu FormForge tren cong 3000...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo [AUTO FORM] Da tat may chu thanh cong.
ping 127.0.0.1 -n 2 >nul
exit
