Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Kiem tra may chu dang chay tren cong 3000 hay khong
Set oExec = WshShell.Exec("powershell -NoProfile -ExecutionPolicy Bypass -Command ""$tcp = New-Object System.Net.Sockets.TcpClient; try { $tcp.Connect('127.0.0.1', 3000); $tcp.Close(); exit 0 } catch { exit 1 }""")
Do While oExec.Status = 0
    WScript.Sleep 50
Loop

If oExec.ExitCode = 0 Then
    ' May chu DANG CHAY -> Hoi nguoi dung muon Mo trinh duyet hay Tat may chu
    res = MsgBox("Hệ thống FormForge Studio đang hoạt động trên cổng 3000." & vbCrLf & vbCrLf & _
                 "• Nhấn [YES] để MỞ giao diện Web" & vbCrLf & _
                 "• Nhấn [NO] để TẮT máy chủ hoàn toàn" & vbCrLf & _
                 "• Nhấn [Cancel] để Hủy", _
                 3 + 32 + 256, "AUTO FORM - Quản Lý Hệ Thống")

    If res = 6 Then ' YES
        WshShell.Run "http://localhost:3000"
    ElseIf res = 7 Then ' NO
        WshShell.Run "powershell -NoProfile -ExecutionPolicy Bypass -Command ""Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }""", 0, True
        WshShell.Popup "Đã tắt máy chủ FormForge Studio thành công!", 2, "AUTO FORM - Đã tắt", 64
    End If
Else
    ' May chu CHUA CHAY -> Tu dong khoi dong va mo trinh duyet
    WshShell.CurrentDirectory = scriptDir
    WshShell.Run "cmd /c node server.js", 0, False
    WScript.Sleep 1500
    WshShell.Run "http://localhost:3000"
End If
