<#
GUI launcher for start-stage.ps1.

Features:
- Select Stage: dev / test / prod
- Select Target: app / worker / env
- Quick input for common env vars
- Optional NoLaunch / Force
- Run and Copy command actions
#>

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runner = Join-Path $scriptRoot 'start-stage.ps1'

if (-not (Test-Path $runner)) {
  [System.Windows.Forms.MessageBox]::Show("Could not find start-stage.ps1 at: $runner", 'Error', 'OK', 'Error')
  exit 1
}

function New-TextField {
  param(
    [string]$Name,
    [string]$Text,
    [int]$Y,
    [int]$Width = 400
  )

  $tb = New-Object System.Windows.Forms.TextBox
  $tb.Name = $Name
  $tb.Location = New-Object System.Drawing.Point(190, $Y)
  $tb.Size = New-Object System.Drawing.Size($Width, 23)
  $tb.Text = $Text
  return $tb
}

function QuoteCmdArg {
  param([string]$Value)

  if ($null -eq $Value -or $Value.Length -eq 0) {
    return '""'
  }

  if ($Value -match '[\s"`r`n]') {
    return ('"' + ($Value.Replace('"', '\"')) + '"')
  }

  return $Value
}

function Build-Args {
  $args = @()

  $stage = $cbStage.SelectedItem
  $target = $cbTarget.SelectedItem

  if ([string]::IsNullOrWhiteSpace($stage) -or [string]::IsNullOrWhiteSpace($target)) {
    [System.Windows.Forms.MessageBox]::Show('Please choose Stage and Target.', 'Missing info', 'OK', 'Warning')
    return @()
  }

  $args += '-Stage'
  $args += $stage.ToString().ToLowerInvariant()
  $args += '-Target'
  $args += $target.ToString().ToLowerInvariant()

  if (-not [string]::IsNullOrWhiteSpace($txtAppUploadUrl.Text)) {
    $args += '-AppUploadUrl'
    $args += $txtAppUploadUrl.Text.Trim()
  }

  if (-not [string]::IsNullOrWhiteSpace($txtAppUploadToken.Text)) {
    $args += '-AppUploadToken'
    $args += $txtAppUploadToken.Text.Trim()
  }

  if (-not [string]::IsNullOrWhiteSpace($txtBuildId.Text)) {
    $args += '-BuildId'
    $args += $txtBuildId.Text.Trim()
  }

  if (-not [string]::IsNullOrWhiteSpace($txtCrashServiceUrl.Text)) {
    $args += '-CrashServiceUrl'
    $args += $txtCrashServiceUrl.Text.Trim()
  }

  if (-not [string]::IsNullOrWhiteSpace($txtWorkerToken.Text)) {
    $args += '-WorkerToken'
    $args += $txtWorkerToken.Text.Trim()
  }

  if (-not [string]::IsNullOrWhiteSpace($txtWorkerId.Text)) {
    $args += '-WorkerId'
    $args += $txtWorkerId.Text.Trim()
  }

  if ($chkNoLaunch.Checked) {
    $args += '-NoLaunch'
  }

  if ($chkForce.Checked) {
    $args += '-Force'
  }

  return $args
}

function Get-RunnerArgsString {
  param([string[]]$ArgList)

  $cmdParts = @(
    'powershell'
    '-NoProfile'
    '-ExecutionPolicy'
    'Bypass'
    '-File'
    $runner
  )

  foreach ($a in $ArgList) {
    $cmdParts += $a
  }

  $quotedParts = @($cmdParts | ForEach-Object { QuoteCmdArg $_ })
  return [string]::Join(' ', $quotedParts)
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'AI Video Studio - Crash Launcher'
$form.Size = New-Object System.Drawing.Size(640, 430)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
$form.MaximizeBox = $false

$leftLabel = 18
$top = 15

$lblStage = New-Object System.Windows.Forms.Label
$lblStage.Text = 'Stage:'
$lblStage.Location = New-Object System.Drawing.Point($leftLabel, $top)
$lblStage.Size = New-Object System.Drawing.Size(150, 20)
$form.Controls.Add($lblStage)

$cbStage = New-Object System.Windows.Forms.ComboBox
$cbStage.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
$cbStage.Items.AddRange(@('dev', 'test', 'prod'))
$cbStage.SelectedIndex = 0
$cbStage.Location = New-Object System.Drawing.Point(190, $top)
$cbStage.Size = New-Object System.Drawing.Size(160, 23)
$form.Controls.Add($cbStage)

$top += 35
$lblTarget = New-Object System.Windows.Forms.Label
$lblTarget.Text = 'Target:'
$lblTarget.Location = New-Object System.Drawing.Point($leftLabel, $top)
$lblTarget.Size = New-Object System.Drawing.Size(150, 20)
$form.Controls.Add($lblTarget)

$cbTarget = New-Object System.Windows.Forms.ComboBox
$cbTarget.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
$cbTarget.Items.AddRange(@('app', 'worker', 'env'))
$cbTarget.SelectedIndex = 0
$cbTarget.Location = New-Object System.Drawing.Point(190, $top)
$cbTarget.Size = New-Object System.Drawing.Size(160, 23)
$form.Controls.Add($cbTarget)

$top += 35
$lblAppUploadUrl = New-Object System.Windows.Forms.Label
$lblAppUploadUrl.Text = 'AI_VIDEO_STUDIO_ERROR_UPLOAD_URL:'
$lblAppUploadUrl.Location = New-Object System.Drawing.Point($leftLabel, $top)
$lblAppUploadUrl.Size = New-Object System.Drawing.Size(170, 20)
$form.Controls.Add($lblAppUploadUrl)
$txtAppUploadUrl = New-TextField 'txtAppUploadUrl' '' $top
$form.Controls.Add($txtAppUploadUrl)

$top += 35
$lblAppUploadToken = New-Object System.Windows.Forms.Label
$lblAppUploadToken.Text = 'AI_VIDEO_STUDIO_ERROR_UPLOAD_TOKEN:'
$lblAppUploadToken.Location = New-Object System.Drawing.Point($leftLabel, $top)
$lblAppUploadToken.Size = New-Object System.Drawing.Size(170, 20)
$form.Controls.Add($lblAppUploadToken)
$txtAppUploadToken = New-TextField 'txtAppUploadToken' '' $top
$form.Controls.Add($txtAppUploadToken)

$top += 35
$lblBuildId = New-Object System.Windows.Forms.Label
$lblBuildId.Text = 'AI_VIDEO_STUDIO_BUILD_ID:'
$lblBuildId.Location = New-Object System.Drawing.Point($leftLabel, $top)
$lblBuildId.Size = New-Object System.Drawing.Size(170, 20)
$form.Controls.Add($lblBuildId)
$txtBuildId = New-TextField 'txtBuildId' '' $top 180
$form.Controls.Add($txtBuildId)

$top += 35
$lblCrashServiceUrl = New-Object System.Windows.Forms.Label
$lblCrashServiceUrl.Text = 'CRASH_SERVICE_URL:'
$lblCrashServiceUrl.Location = New-Object System.Drawing.Point($leftLabel, $top)
$lblCrashServiceUrl.Size = New-Object System.Drawing.Size(170, 20)
$form.Controls.Add($lblCrashServiceUrl)
$txtCrashServiceUrl = New-TextField 'txtCrashServiceUrl' '' $top
$form.Controls.Add($txtCrashServiceUrl)

$top += 35
$lblWorkerToken = New-Object System.Windows.Forms.Label
$lblWorkerToken.Text = 'WORKER_TOKEN:'
$lblWorkerToken.Location = New-Object System.Drawing.Point($leftLabel, $top)
$lblWorkerToken.Size = New-Object System.Drawing.Size(170, 20)
$form.Controls.Add($lblWorkerToken)
$txtWorkerToken = New-TextField 'txtWorkerToken' '' $top
$form.Controls.Add($txtWorkerToken)

$top += 35
$lblWorkerId = New-Object System.Windows.Forms.Label
$lblWorkerId.Text = 'WORKER_ID:'
$lblWorkerId.Location = New-Object System.Drawing.Point($leftLabel, $top)
$lblWorkerId.Size = New-Object System.Drawing.Size(170, 20)
$form.Controls.Add($lblWorkerId)
$txtWorkerId = New-TextField 'txtWorkerId' '' $top 180
$form.Controls.Add($txtWorkerId)

$top += 35
$chkNoLaunch = New-Object System.Windows.Forms.CheckBox
$chkNoLaunch.Text = 'NoLaunch (only set environment vars)'
$chkNoLaunch.Location = New-Object System.Drawing.Point(190, $top)
$chkNoLaunch.Size = New-Object System.Drawing.Size(300, 20)
$form.Controls.Add($chkNoLaunch)

$top += 28
$chkForce = New-Object System.Windows.Forms.CheckBox
$chkForce.Text = 'Force (ignore missing-var warnings)'
$chkForce.Location = New-Object System.Drawing.Point(190, $top)
$chkForce.Size = New-Object System.Drawing.Size(300, 20)
$form.Controls.Add($chkForce)

$top += 40
$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.Text = 'Ready: select Stage + Target, fill optional fields, then click Run.'
$lblStatus.Location = New-Object System.Drawing.Point($leftLabel, $top)
$lblStatus.Size = New-Object System.Drawing.Size(590, 30)
$lblStatus.ForeColor = [System.Drawing.Color]::DarkSlateGray
$form.Controls.Add($lblStatus)

$btnRun = New-Object System.Windows.Forms.Button
$btnRun.Text = 'Run'
$btnRun.Location = New-Object System.Drawing.Point(240, 365)
$btnRun.Size = New-Object System.Drawing.Size(90, 30)
$btnRun.Add_Click({
  $argList = Build-Args
  if ($argList.Count -eq 0) {
    return
  }

  if ($chkNoLaunch.Checked -or $cbTarget.SelectedItem.ToString().ToLowerInvariant() -eq 'env') {
    $lblStatus.Text = 'Running in-place (NoLaunch/Env)...'
    try {
      & powershell -NoProfile -ExecutionPolicy Bypass -File $runner @argList
      $lblStatus.Text = 'Done: command finished in current shell. Use copy for re-run if needed.'
    } catch {
      $message = "Error: $($_.Exception.Message)"
      $lblStatus.Text = $message
      [System.Windows.Forms.MessageBox]::Show($message, 'Error', 'OK', 'Error')
    }
    return
  }

  $lblStatus.Text = 'Starting new PowerShell window...'
  $procArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $runner) + $argList
  Start-Process -FilePath 'powershell.exe' -ArgumentList $procArgs -WindowStyle Normal
  $lblStatus.Text = 'Started. GUI remains open.'
})
$form.Controls.Add($btnRun)

$btnCopy = New-Object System.Windows.Forms.Button
$btnCopy.Text = 'Copy command'
$btnCopy.Location = New-Object System.Drawing.Point(340, 365)
$btnCopy.Size = New-Object System.Drawing.Size(110, 30)
$btnCopy.Add_Click({
  $argList = Build-Args
  if ($argList.Count -eq 0) {
    return
  }

  $cmd = Get-RunnerArgsString -ArgList $argList
  Set-Clipboard -Value $cmd
  $lblStatus.Text = 'Command copied to clipboard.'
})
$form.Controls.Add($btnCopy)

$btnExit = New-Object System.Windows.Forms.Button
$btnExit.Text = 'Exit'
$btnExit.Location = New-Object System.Drawing.Point(465, 365)
$btnExit.Size = New-Object System.Drawing.Size(90, 30)
$btnExit.Add_Click({ $form.Close() })
$form.Controls.Add($btnExit)

[void]$form.ShowDialog()
