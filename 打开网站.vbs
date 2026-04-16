' Launch http://localhost:3002/
Option Explicit
Dim sh, fso, folder
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
If Not fso.FileExists(fso.BuildPath(folder, "open-localhost3002.cmd")) Then
  MsgBox "open-localhost3002.cmd not found", vbCritical, "ORDI"
  WScript.Quit 1
End If
sh.CurrentDirectory = folder
sh.Run """" & fso.BuildPath(folder, "open-localhost3002.cmd") & """", 1, False
