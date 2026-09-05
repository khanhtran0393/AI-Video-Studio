param()

<#+
HƯỚNG DẪN KHỞI TẠO 3 MÔI TRƯỜNG (DEV / TEST / PROD)

Mẫu này không chứa secret thực tế. Dùng để tạo file .env theo từng miền.
Bạn có thể copy nội dung rồi điền giá trị thật rồi nạp vào môi trường khi chạy.

- Cho Electron app (Crash Reporter): AI_VIDEO_STUDIO_ERROR_*
- Cho cloud-crash-service: DATABASE_URL, token hash, pepper, job timing
- Cho local-worker: CRASH_SERVICE_URL, WORKER_TOKEN, worker profile
#>

Write-Host "=== Template DEV / TEST / PROD ===" -ForegroundColor Cyan
Write-Host "Đây là template biến môi trường dạng khởi tạo; không commit secret thật."

"`n----- APP (Nova) DEV (.env for desktop session) -----" 
@'
AI_VIDEO_STUDIO_ERROR_REPORTING=1
AI_VIDEO_STUDIO_ERROR_UPLOAD_URL=
AI_VIDEO_STUDIO_ERROR_UPLOAD_TOKEN=
AI_VIDEO_STUDIO_BUILD_ID=video-studio-dev-<build-id>
AI_VIDEO_STUDIO_GIT_COMMIT_SHA=
AI_VIDEO_STUDIO_ARTIFACT_SHA256=
'@

"`n----- APP (Nova) TEST -----" 
@'
AI_VIDEO_STUDIO_ERROR_REPORTING=1
AI_VIDEO_STUDIO_ERROR_UPLOAD_URL=https://<test-deployment>/v1/crashes
AI_VIDEO_STUDIO_ERROR_UPLOAD_TOKEN=<raw-uploader-token-test>
AI_VIDEO_STUDIO_BUILD_ID=video-studio-test-<build-id>
AI_VIDEO_STUDIO_GIT_COMMIT_SHA=<40_64_hex>
AI_VIDEO_STUDIO_ARTIFACT_SHA256=<64_hex>
'@

"`n----- APP (Nova) PROD -----" 
@'
AI_VIDEO_STUDIO_ERROR_REPORTING=1
AI_VIDEO_STUDIO_ERROR_UPLOAD_URL=https://<prod-deployment>/v1/crashes
AI_VIDEO_STUDIO_ERROR_UPLOAD_TOKEN=<raw-uploader-token-prod>
AI_VIDEO_STUDIO_BUILD_ID=video-studio-prod-<build-id>
AI_VIDEO_STUDIO_GIT_COMMIT_SHA=<40_64_hex>
AI_VIDEO_STUDIO_ARTIFACT_SHA256=<64_hex>
'@

"`n----- CLOUD-CRASH-SERVICE (environment for Vercel / server runtime) -----" 
@'
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
CRASH_WRITE_TOKEN_HASH=<sha256_hex_of_uploader_token>
WORKER_TOKEN_HASH=<sha256_hex_of_worker_token>
DEVICE_ID_PEPPER=<at-least-32-random-chars>
JOB_LEASE_SECONDS=120
MAX_JOB_ATTEMPTS=5
'@

"`n----- LOCAL WORKER DEV -----" 
@'
CRASH_SERVICE_URL=https://<your-vercel-deployment>.vercel.app
WORKER_TOKEN=<raw-worker-token>
WORKER_ID=developer-workstation-1
WORKER_POLL_INTERVAL_MS=10000
WORKER_HEARTBEAT_INTERVAL_MS=30000
'@

"`n----- LOCAL WORKER TEST -----" 
@'
CRASH_SERVICE_URL=https://<test-deployment>
WORKER_TOKEN=<raw-worker-token-test>
WORKER_ID=test-worker-01
WORKER_POLL_INTERVAL_MS=10000
WORKER_HEARTBEAT_INTERVAL_MS=30000
'@

"`n----- LOCAL WORKER PROD -----" 
@'
CRASH_SERVICE_URL=https://<prod-deployment>
WORKER_TOKEN=<raw-worker-token-prod>
WORKER_ID=prod-worker-01
WORKER_POLL_INTERVAL_MS=10000
WORKER_HEARTBEAT_INTERVAL_MS=30000
'@

"`n----- AUTO-FIX AI NOTES (not included in this runtime script) -----" 
@'
# Auto-Fix AI vars should remain in Auto-Fix/runtime secret manager,
# not in this crash bootstrap layer. Examples: OPENAI_API_KEY, GEMINI_API_KEY.
'@
