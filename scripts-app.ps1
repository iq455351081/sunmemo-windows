param(
  [Parameter(Position = 0)][string]$Action = 'restart',
  [string]$Args = ''
)
$ErrorActionPreference = 'SilentlyContinue'

function Stop-All {
  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline) {
    $p = Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -like 'E:\Agentic*' }
    if (-not $p) { break }
    $p | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
  }
  Write-Output ("[app] remaining after stop: " + @(Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -like 'E:\Agentic*' }).Count)
}

switch ($Action) {
  'stop' { Stop-All }
  'start' {
    Start-Process -FilePath 'E:\Agentic_Engineering\ZCode\sunidea\node_modules\electron\dist\electron.exe' `
      -ArgumentList ('E:\Agentic_Engineering\ZCode\sunidea ' + $Args) `
      -WorkingDirectory 'E:\Agentic_Engineering\ZCode\sunidea' `
      -WindowStyle Hidden
    Start-Sleep -Seconds 2
    Write-Output ("[app] started with args: " + $Args)
  }
  'restart' {
    Stop-All
    Start-Sleep -Milliseconds 800
    Start-Process -FilePath 'E:\Agentic_Engineering\ZCode\sunidea\node_modules\electron\dist\electron.exe' `
      -ArgumentList ('E:\Agentic_Engineering\ZCode\sunidea ' + $Args) `
      -WorkingDirectory 'E:\Agentic_Engineering\ZCode\sunidea' `
      -WindowStyle Hidden
    Start-Sleep -Seconds 2
    Write-Output ("[app] restarted with args: " + $Args)
  }
}
