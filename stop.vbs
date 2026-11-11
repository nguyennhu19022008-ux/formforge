Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell -NoProfile -ExecutionPolicy Bypass -Command ""Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }""", 0, True
WshShell.Popup "Đã tắt máy chủ FormForge Studio thành công!", 2, "AUTO FORM - Dừng hệ thống", 64
