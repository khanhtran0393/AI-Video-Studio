# Cleanup junk produced by the app / builds / old rebrands.
# Groups:
#   1) Orphaned Electron userData folders from old app names (keeps "AI Video Studio
#      Independent" — the ACTIVE userData, see nova/main/identity.js)
#      + stale .tmp-vb-*.log voice-backend logs
#   2) Leftover tmp-patch*.js / tmp-wt-rebuild.js in nova\
#   3) Old build/test/backup output: smoke-results, build-wt, build-project.old, rebrand-backup
# Keeps: dist, artifacts, .kilo, build, and the active "AI Video Studio Independent" userData.
[CmdletBinding()]
param(
  [switch]$WhatIfOnly
)

$ErrorActionPreference = 'SilentlyContinue'
$root = 'D:\AI Video Studio'

# --- Nhom 1: userData mo coi cua cac ten app cu ---
# LUU Y: 'AI Video Studio Independent' la userData DANG DUNG (nova/main/identity.js)
# — tuyet doi khong dua vao danh sach nay!
$orphanUserData = @(
  'AI Video Studio',
  'Nova Studio',
  'Nova Studio Independent',
  'nova-studio-independent',
  'VideoGen',
  'VideoEditor',
  'video-translator',
  '.video-translator',
  'AlexTransVideo'
) | ForEach-Object { Join-Path $env:APPDATA $_ }

# --- Nhom 1b: log voice-backend tam ---
$tmpLogs = @(
  (Join-Path $root '.tmp-vb-err.log'),
  (Join-Path $root '.tmp-vb-out.log'),
  (Join-Path $root 'nova\.tmp-vb-err.log'),
  (Join-Path $root 'nova\.tmp-vb-out.log')
)

# --- Nhom 2: file patch tam trong nova\ ---
$tmpScripts = @(
  'tmp-patch4.js', 'tmp-patch5.js', 'tmp-patch6.js', 'tmp-wt-rebuild.js'
) | ForEach-Object { Join-Path $root "nova\$_" }

# --- Nhom 3: build/test/backup cu ---
$junkDirs = @(
  'smoke-results',
  'build-wt',
  'build-project.old',
  'rebrand-backup'
) | ForEach-Object { Join-Path $root $_ }

function Get-DirSize([string]$p) {
  if (-not (Test-Path $p)) { return 0 }
  (Get-ChildItem $p -Recurse -Force -ErrorAction SilentlyContinue |
    Measure-Object Length -Sum).Sum
}

$targets = @()
$targets += $orphanUserData | Where-Object { Test-Path $_ } | ForEach-Object { @{ Path = $_; Kind = 'userData mo coi (nhom 1)' } }
$targets += $tmpLogs | Where-Object { Test-Path $_ } | ForEach-Object { @{ Path = $_; Kind = 'log tam (nhom 1)' } }
$targets += $tmpScripts | Where-Object { Test-Path $_ } | ForEach-Object { @{ Path = $_; Kind = 'script patch tam (nhom 2)' } }
$targets += $junkDirs | Where-Object { Test-Path $_ } | ForEach-Object { @{ Path = $_; Kind = 'build/backup cu (nhom 3)' } }

$totalBefore = 0
foreach ($t in $targets) {
  $size = if (Test-Path $t.Path -PathType Container) { Get-DirSize $t.Path } else { (Get-Item $t.Path).Length }
  $totalBefore += $size
  Write-Output ("[XOA] {0}  ({1:N1} MB)  {2}" -f $t.Path, ($size / 1MB), $t.Kind)
}
Write-Output ("Tong dung luong se giai phong: {0:N1} MB" -f ($totalBefore / 1MB))

if ($WhatIfOnly) { Write-Output '(che do -WhatIfOnly: chi liet ke, khong xoa)'; return }

foreach ($t in $targets) {
  if ($t.Path.EndsWith('.log') -or $t.Path -match 'tmp-patch|tmp-wt-rebuild') {
    Remove-Item -LiteralPath $t.Path -Force -ErrorAction Continue
  } else {
    Remove-Item -LiteralPath $t.Path -Recurse -Force -ErrorAction Continue
  }
}

# Kiem tra lai
$left = $targets | Where-Object { Test-Path $_.Path }
if ($left) {
  Write-Output 'CANH BAO - con sot (dang bi khoa hoac loi):'
  $left | ForEach-Object { Write-Output ("  " + $_.Path) }
} else {
  Write-Output 'OK: da xoa sach tat ca muc tieu.'
}
