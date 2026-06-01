Set WshShell = CreateObject("WScript.Shell")
' Khoi chay server Express Node.js chay an khong hien thi terminal window
WshShell.Run "cmd.exe /c node server/server.js", 0, false
