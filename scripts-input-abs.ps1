param([int]$x, [int]$y)
# Move via the real input queue (mouse_event ABSOLUTE, primary-monitor
# normalized) instead of SetCursorPos, so Chromium receives a genuine
# injected input event. Primary physical size: 2560x1600.
Add-Type -MemberDefinition '
[DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, int e);
[DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
public struct POINT { public int X; public int Y; }
' -Name U -Namespace W
$pw = 2560; $ph = 1600
$p = New-Object W.POINT
[W.U]::GetCursorPos([ref]$p) | Out-Null
for ($i = 1; $i -le 24; $i++) {
  $cx = $p.X + ($x - $p.X) * $i / 24
  $cy = $p.Y + ($y - $p.Y) * $i / 24
  $nx = [uint32]([Math]::Round($cx * 65535 / $pw))
  $ny = [uint32]([Math]::Round($cy * 65535 / $ph))
  [W.U]::mouse_event(0x8001, $nx, $ny, 0, 0)  # MOVE|ABSOLUTE
  Start-Sleep -Milliseconds 12
}
exit 0
