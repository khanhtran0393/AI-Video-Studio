# Script xóa cache Electron và khởi động lại app
Write-Host "Đang đóng app..." -ForegroundColor Yellow
Get-Process -Name "AI Video Studio" -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Đang xóa cache..." -ForegroundColor Yellow
$appData = "$env:APPDATA\AI Video Studio Independent"
$cacheDirs = @("Cache", "Code Cache", "GPUCache", "Partitions", "Service Worker", "Session Storage", "Local Storage")
foreach ($dir in $cacheDirs) {
    $path = Join-Path $appData $dir
    if (Test-Path $path) {
        Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
        Write-Host "  Đã xóa: $dir" -ForegroundColor Green
    }
}

Write-Host "Cache đã được xóa sạch!" -ForegroundColor Green
Write-Host "Khởi động lại app..." -ForegroundColor Yellow
Start-Process -FilePath "d:\AI Video Studio\start.bat"

Write-Host "Hoàn tất! Đợi app mở và kiểm tra tab 'Tạo giọng nói'." -ForegroundColor Green