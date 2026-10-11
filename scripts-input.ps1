param([int]$x, [int]$y, [switch]$moveonly)
Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetCursorPos(int a, int b); [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, int e);' -Name U -Namespace W
[W.U]::SetCursorPos($x, $y) | Out-Null
if ($moveonly) { exit 0 }
Start-Sleep -Milliseconds 140
[W.U]::mouse_event(2, 0, 0, 0, 0)
Start-Sleep -Milliseconds 70
[W.U]::mouse_event(4, 0, 0, 0, 0)
exit 0
