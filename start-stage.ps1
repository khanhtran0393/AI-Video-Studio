<#+
MỤC ĐÍCH
  File khởi động môi trường làm việc nhanh cho 3 stage DEV / TEST / PROD.

CHỨC NĂNG
  - Chuẩn hoá biến môi trường theo 1 lệnh:
      - APP: Crash Reporter (AI_VIDEO_STUDIO_ERROR_* + release identity)
      - WORKER: local-worker (CRASH_SERVICE_URL + WORKER_TOKEN + ...)
      - CLOUD VARS: crash service credential hashes (nhóm riêng, optional)
  - Hỗ trợ chạy trực tiếp app hoặc worker:
      - Target=app    : thiết lập env rồi npm start (Nova)
      - Target=worker : thiết lập env rồi npm start trong auto-fix/local-worker
      - Target=env    : chỉ in/báo cấu hình, không chạy gì

SỬ DỤNG
  .\start-stage.ps1 -Stage dev -Target app -NoLaunch
  .\start-stage.ps1 -Stage test -Target app -AppUploadUrl 'https://test.example.com/v1/crashes' -AppUploadToken '<raw token>'
  .\start-stage.ps1 -Stage prod -Target worker -CrashServiceUrl 'https://api.example.com' -WorkerToken '<raw token>'

LƯU Ý NHANH
  - Với TEST/PROD, nên truyền đầy đủ secrets qua tham số hoặc biến môi trường
    có hậu tố stage (ví dụ: AI_VIDEO_STUDIO_ERROR_UPLOAD_TOKEN_TEST), không hard-code
    trong file.
  - Worker có thể chạy song song với app bằng cách mở 2 cửa sổ shell riêng.
  - M1 Auto-Fix AI hiện tại vẫn observe-only theo quy chuẩn hiện tại.
#>

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('dev', 'test', 'prod', 'DEV', 'TEST', 'PROD')]
  [string] $Stage,

  [ValidateSet('app', 'worker', 'env')]
  [string] $Target = 'app',

  # ----- App / Crash reporter env (prefix AI_VIDEO_STUDIO_) -----
  [string] $AppUploadUrl,
  [string] $AppUploadToken,
  [string] $BuildId,
  [string] $GitCommitSha,
  [string] $ArtifactSha256,

  # ----- Local worker env -----
  [string] $CrashServiceUrl,
  [string] $WorkerToken,
  [string] $WorkerId,
  [string] $WorkerPollIntervalMs = '10000',
  [string] $WorkerHeartbeatIntervalMs = '30000',

  # ----- Cloud crash service env (không bắt buộc cho local app/worker chạy thử) -----
  [string] $DatabaseUrl,
  [string] $CrashWriteTokenHash,
  [string] $WorkerTokenHash,
  [string] $DevicePepper,

  [switch] $Force,
  [switch] $NoLaunch,

  # ----- Auto-Fix AI credentials are intentionally not managed here -----
  [string] $AutoFixNotes = 'Separate by deployment (ví dụ OPENAI_API_KEY / Gemini key...).'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$stage = $Stage.ToLowerInvariant()
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Resolve-StageValue {
  param(
    [string] $Name,
    [string] $Stage,
    [string] $Explicit,
    [string] $Fallback = ''
  )

  if (-not [string]::IsNullOrWhiteSpace($Explicit)) {
    return $Explicit
  }

  $upper = $Stage.ToUpperInvariant()
  $byStage = [Environment]::GetEnvironmentVariable("${Name}_${upper}")
  if (-not [string]::IsNullOrWhiteSpace($byStage)) {
    return $byStage
  }

  $global = [Environment]::GetEnvironmentVariable($Name)
  if (-not [string]::IsNullOrWhiteSpace($global)) {
    return $global
  }

  return $Fallback
}

function Set-StageEnvironment {
  param([hashtable] $Vars)
  foreach ($name in $Vars.Keys) {
    $value = $Vars[$name]
    if ($null -eq $value) { continue }
    [Environment]::SetEnvironmentVariable($name, [string]$value, 'Process') | Out-Null
  }
}

function Mask {
  param([string] $Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return '(empty)' }
  if ($Value.Length -le 8) { return ('*' * $Value.Length) }
  return "$($Value.Substring(0, 4))...$($Value.Substring($Value.Length - 4))"
}

function ValueOrEmpty {
  param([string] $Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { '(empty)' } else { $Value }
}

function Section {
  param([string]$Title)
  Write-Host "`n===== $Title =====" -ForegroundColor Cyan
}

$defaults = @{
  dev  = @{ BuildId = 'video-studio-dev' }
  test = @{ BuildId = 'video-studio-test' }
  prod = @{ BuildId = 'video-studio-prod' }
}

# ----- Resolve values (CLI -> stage env -> global env -> fallback) -----
$resolvedAppUploadUrl = Resolve-StageValue 'AI_VIDEO_STUDIO_ERROR_UPLOAD_URL' $stage $AppUploadUrl ''
$resolvedAppUploadToken = Resolve-StageValue 'AI_VIDEO_STUDIO_ERROR_UPLOAD_TOKEN' $stage $AppUploadToken ''
$resolvedBuildId = Resolve-StageValue 'AI_VIDEO_STUDIO_BUILD_ID' $stage $BuildId $defaults[$stage].BuildId
$resolvedGitCommitSha = Resolve-StageValue 'AI_VIDEO_STUDIO_GIT_COMMIT_SHA' $stage $GitCommitSha ''
$resolvedArtifactSha256 = Resolve-StageValue 'AI_VIDEO_STUDIO_ARTIFACT_SHA256' $stage $ArtifactSha256 ''

$resolvedCrashServiceUrl = Resolve-StageValue 'CRASH_SERVICE_URL' $stage $CrashServiceUrl ''
$resolvedWorkerToken = Resolve-StageValue 'WORKER_TOKEN' $stage $WorkerToken ''
$resolvedWorkerId = if ([string]::IsNullOrWhiteSpace($WorkerId)) { "${env:COMPUTERNAME}-${stage}-worker" } else { $WorkerId }
$resolvedDatabaseUrl = Resolve-StageValue 'DATABASE_URL' $stage $DatabaseUrl ''
$resolvedCrashWriteTokenHash = Resolve-StageValue 'CRASH_WRITE_TOKEN_HASH' $stage $CrashWriteTokenHash ''
$resolvedWorkerTokenHash = Resolve-StageValue 'WORKER_TOKEN_HASH' $stage $WorkerTokenHash ''
$resolvedDevicePepper = Resolve-StageValue 'DEVICE_ID_PEPPER' $stage $DevicePepper ''

$appVars = @{
  AI_VIDEO_STUDIO_ERROR_REPORTING     = '1'
  AI_VIDEO_STUDIO_ERROR_UPLOAD_URL    = $resolvedAppUploadUrl
  AI_VIDEO_STUDIO_ERROR_UPLOAD_TOKEN  = $resolvedAppUploadToken
  AI_VIDEO_STUDIO_BUILD_ID           = $resolvedBuildId
  AI_VIDEO_STUDIO_GIT_COMMIT_SHA      = $resolvedGitCommitSha
  AI_VIDEO_STUDIO_ARTIFACT_SHA256     = $resolvedArtifactSha256
}

$workerVars = @{
  CRASH_SERVICE_URL          = $resolvedCrashServiceUrl
  WORKER_TOKEN               = $resolvedWorkerToken
  WORKER_ID                  = $resolvedWorkerId
  WORKER_POLL_INTERVAL_MS    = $WorkerPollIntervalMs
  WORKER_HEARTBEAT_INTERVAL_MS = $WorkerHeartbeatIntervalMs
}

$cloudVars = @{
  DATABASE_URL          = $resolvedDatabaseUrl
  CRASH_WRITE_TOKEN_HASH = $resolvedCrashWriteTokenHash
  WORKER_TOKEN_HASH      = $resolvedWorkerTokenHash
  DEVICE_ID_PEPPER       = $resolvedDevicePepper
  JOB_LEASE_SECONDS      = '120'
  MAX_JOB_ATTEMPTS       = '5'
}

Section "MÔI TRƯỜNG CHẠY: $($stage.ToUpper())"
Write-Host "Stage       : $stage"
Write-Host "Target      : $Target"
Write-Host "Root        : $root"

Section "TÓM TẮT KHIẾU VAI ENVs"
Write-Host "App Reporter:"
Write-Host "  AI_VIDEO_STUDIO_ERROR_REPORTING      = 1"
Write-Host "  AI_VIDEO_STUDIO_ERROR_UPLOAD_URL     = $(ValueOrEmpty $resolvedAppUploadUrl)"
Write-Host "  AI_VIDEO_STUDIO_ERROR_UPLOAD_TOKEN   = $(Mask $resolvedAppUploadToken)"
Write-Host "  AI_VIDEO_STUDIO_BUILD_ID             = $resolvedBuildId"
Write-Host "  AI_VIDEO_STUDIO_GIT_COMMIT_SHA       = $(ValueOrEmpty $resolvedGitCommitSha)"
Write-Host "  AI_VIDEO_STUDIO_ARTIFACT_SHA256      = $(ValueOrEmpty $resolvedArtifactSha256)"

Write-Host "Worker:"
Write-Host "  CRASH_SERVICE_URL      = $(ValueOrEmpty $resolvedCrashServiceUrl)"
Write-Host "  WORKER_TOKEN           = $(Mask $resolvedWorkerToken)"
Write-Host "  WORKER_ID              = $resolvedWorkerId"
Write-Host "  WORKER_POLL_INTERVAL_MS= $WorkerPollIntervalMs"
Write-Host "  WORKER_HEARTBEAT_INTERVAL_MS = $WorkerHeartbeatIntervalMs"

Write-Host "Cloud crash-service vars (không áp buộc cho local-only app start):"
Write-Host "  DATABASE_URL           = $(if ([string]::IsNullOrWhiteSpace($resolvedDatabaseUrl)) { '(empty)' } else { '(configured)' })"
Write-Host "  CRASH_WRITE_TOKEN_HASH  = $(Mask $resolvedCrashWriteTokenHash)"
Write-Host "  WORKER_TOKEN_HASH      = $(Mask $resolvedWorkerTokenHash)"
Write-Host "  DEVICE_ID_PEPPER       = $(if ([string]::IsNullOrWhiteSpace($resolvedDevicePepper)) { '(empty)' } else { '(configured)' })"

Section "CHECK NHANH"
$hasError = $false
if ($Target -eq 'app' -and $stage -in @('test', 'prod')) {
  if ([string]::IsNullOrWhiteSpace($resolvedAppUploadUrl)) {
    Write-Host "[WARN] Thiếu AI_VIDEO_STUDIO_ERROR_UPLOAD_URL_$($stage.ToUpper()) hoặc AI_VIDEO_STUDIO_ERROR_UPLOAD_URL." -ForegroundColor Yellow
    $hasError = $true
  }
  if ([string]::IsNullOrWhiteSpace($resolvedAppUploadToken)) {
    Write-Host "[WARN] Thiếu AI_VIDEO_STUDIO_ERROR_UPLOAD_TOKEN_$($stage.ToUpper()) hoặc AI_VIDEO_STUDIO_ERROR_UPLOAD_TOKEN." -ForegroundColor Yellow
    $hasError = $true
  }
}

if ($Target -eq 'worker') {
  if ([string]::IsNullOrWhiteSpace($resolvedCrashServiceUrl)) {
    Write-Host "[WARN] Thiếu CRASH_SERVICE_URL_$($stage.ToUpper()) hoặc CRASH_SERVICE_URL." -ForegroundColor Yellow
    $hasError = $true
  }
  if ([string]::IsNullOrWhiteSpace($resolvedWorkerToken)) {
    Write-Host "[WARN] Thiếu WORKER_TOKEN_$($stage.ToUpper()) hoặc WORKER_TOKEN." -ForegroundColor Yellow
    $hasError = $true
  }
}

if ($hasError -and -not $Force) {
  Write-Host "[INFO] Run tiếp với -Force hoặc cấp đủ biến trước khi start." -ForegroundColor Yellow
}

if ($Target -eq 'env') {
  Write-Host "[INFO] Target=env. Đã dừng trước khi chạy ứng dụng/worker." -ForegroundColor Green
  return
}

if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'Không tìm thấy node/npm trong PATH. Hãy kiểm tra môi trường Node.js.'
}

if ($Target -eq 'app') {
  Set-StageEnvironment $appVars
} else {
  Set-StageEnvironment $workerVars
}

if ($Target -eq 'app' -or $Target -eq 'worker') {
  Set-StageEnvironment $cloudVars
}

if ($NoLaunch) {
  Write-Host "[OK] Đã export xong env cho target '$Target'. Đặt -NoLaunch để chỉ setup, không chạy process." -ForegroundColor Green
  return
}

if ($Target -eq 'app') {
  Write-Host "[RUN] starting: npm start (Nova Electron)" -ForegroundColor Green
  Set-Location $root
  & npm start
}

if ($Target -eq 'worker') {
  Write-Host "[RUN] starting: local-worker (observe-only worker)" -ForegroundColor Green
  Set-Location (Join-Path $root 'auto-fix\local-worker')
  & npm start
}
