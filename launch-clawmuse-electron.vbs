Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

appDir = fso.GetParentFolderName(WScript.ScriptFullName)
electronExe = appDir & "\node_modules\electron\dist\electron.exe"
npmCmd = "D:\develop\NodeJS\npm.cmd"
cleanupScript = appDir & "\cleanup-clawmuse-processes.ps1"
shell.CurrentDirectory = appDir

If fso.FileExists(cleanupScript) Then
  shell.Run "powershell -NoProfile -ExecutionPolicy Bypass -File """ & cleanupScript & """ -AppDir """ & appDir & """", 0, True
End If

If fso.FileExists(electronExe) Then
  shell.Run """" & electronExe & """ """ & appDir & """", 1, False
ElseIf fso.FileExists(npmCmd) Then
  shell.Run "cmd /c cd /d """ & appDir & """ && """ & npmCmd & """ run desktop", 0, False
Else
  shell.Run "cmd /k cd /d """ & appDir & """ && echo [ClawMuse] Electron or npm.cmd was not found. && pause", 1, False
End If
