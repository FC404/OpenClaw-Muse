param(
  [string]$AppDir
)

if ([string]::IsNullOrWhiteSpace($AppDir)) {
  $AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$resolvedAppDir = [System.IO.Path]::GetFullPath($AppDir).TrimEnd('\')
$electronExe = Join-Path $resolvedAppDir 'node_modules\electron\dist\electron.exe'
$serverScript = Join-Path $resolvedAppDir 'server.js'
$npmCliPattern = 'npm-cli.js'
$desktopScriptPattern = 'run desktop'

$processes = Get-CimInstance Win32_Process | Where-Object {
  $name = ($_.Name | ForEach-Object { $_.ToLowerInvariant() })
  if ($name -notin @('electron.exe', 'node.exe')) {
    return $false
  }

  $commandLine = [string]$_.CommandLine
  $executablePath = [string]$_.ExecutablePath

  if ($name -eq 'electron.exe' -and $executablePath -and $executablePath.TrimEnd('\').ToLowerInvariant() -eq $electronExe.ToLowerInvariant()) {
    return $true
  }

  if ($name -eq 'node.exe') {
    if ($commandLine -like "*$serverScript*") {
      return $true
    }
    if ($commandLine -like "*$resolvedAppDir*" -and $commandLine -like "*$npmCliPattern*" -and $commandLine -like "*$desktopScriptPattern*") {
      return $true
    }
  }

  return $false
}

foreach ($process in $processes) {
  try {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
  } catch {
  }
}
