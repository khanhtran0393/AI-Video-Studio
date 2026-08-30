$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$images = Join-Path $root 'images'
$tts = Join-Path $root 'tts'
New-Item -ItemType Directory -Force -Path $images,$tts | Out-Null

Add-Type -AssemblyName System.Drawing
function New-SceneImage([string]$path, [string]$title, [Drawing.Color]$top, [Drawing.Color]$bottom, [int]$variant) {
  $bmp = New-Object Drawing.Bitmap 1280,720
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $rect = New-Object Drawing.Rectangle 0,0,1280,720
  $brush = New-Object Drawing.Drawing2D.LinearGradientBrush $rect,$top,$bottom,90
  $g.FillRectangle($brush,$rect)
  if ($variant -eq 1) {
    $tree = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(220,8,45,38))
    0..10 | ForEach-Object { $x = $_ * 125 - 35; $g.FillRectangle($tree,$x,270,70,450); $g.FillEllipse($tree,$x-65,110,200,260) }
    $light = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(190,255,209,102))
    $g.FillEllipse($light,535,245,210,210)
    $tree.Dispose(); $light.Dispose()
  } else {
    $wall = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(210,18,32,68))
    $gold = New-Object Drawing.Pen ([Drawing.Color]::FromArgb(230,255,209,102)),14
    $g.FillRectangle($wall,90,110,1100,610)
    $g.DrawEllipse($gold,390,160,500,500); $g.DrawEllipse($gold,470,240,340,340)
    0..7 | ForEach-Object { $a = $_ * [Math]::PI / 4; $x1=640+[Math]::Cos($a)*170; $y1=410+[Math]::Sin($a)*170; $x2=640+[Math]::Cos($a)*245; $y2=410+[Math]::Sin($a)*245; $g.DrawLine($gold,$x1,$y1,$x2,$y2) }
    $wall.Dispose(); $gold.Dispose()
  }
  $shade = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(145,0,0,0))
  $g.FillRectangle($shade,0,570,1280,150)
  $font = [Drawing.Font]::new('Arial',42,[Drawing.FontStyle]::Bold)
  $text = New-Object Drawing.SolidBrush ([Drawing.Color]::White)
  $g.DrawString($title,$font,$text,55,610)
  $text.Dispose(); $font.Dispose(); $shade.Dispose(); $brush.Dispose(); $g.Dispose()
  $bmp.Save($path,[Drawing.Imaging.ImageFormat]::Jpeg); $bmp.Dispose()
}
New-SceneImage (Join-Path $images 'background-forest.jpg') 'DAWN SIGNAL' ([Drawing.Color]::FromArgb(24,91,96)) ([Drawing.Color]::FromArgb(5,18,37)) 1
New-SceneImage (Join-Path $images 'background-observatory.jpg') 'HIDDEN OBSERVATORY' ([Drawing.Color]::FromArgb(62,42,105)) ([Drawing.Color]::FromArgb(6,12,32)) 2

$char = New-Object Drawing.Bitmap 420,640
$g = [Drawing.Graphics]::FromImage($char); $g.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias; $g.Clear([Drawing.Color]::Transparent)
$outline=New-Object Drawing.Pen ([Drawing.Color]::FromArgb(235,255,255,255)),10
$body=New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(245,42,99,146))
$skin=New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(255,244,194,157))
$hair=New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(255,40,28,34))
$g.FillEllipse($hair,85,25,250,265); $g.FillEllipse($skin,115,55,190,210); $g.FillPie($hair,95,30,230,210,180,180)
$g.FillEllipse($body,55,230,310,390); $g.DrawEllipse($outline,55,230,310,390)
$font=[Drawing.Font]::new('Arial',30,[Drawing.FontStyle]::Bold); $white=New-Object Drawing.SolidBrush ([Drawing.Color]::White)
$g.DrawString('MAYA',$font,$white,135,390)
$white.Dispose(); $font.Dispose(); $outline.Dispose(); $body.Dispose(); $skin.Dispose(); $hair.Dispose(); $g.Dispose()
$char.Save((Join-Path $images 'character-maya.png'),[Drawing.Imaging.ImageFormat]::Png); $char.Dispose()

Add-Type -AssemblyName System.Speech
$wav = Join-Path $tts 'chapter-001.wav'
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice('Microsoft Zira Desktop'); $synth.Rate = 1; $synth.Volume = 100
$synth.SetOutputToWaveFile($wav)
$synth.Speak('At dawn, Maya enters a luminous forest and follows a golden signal. Inside an old observatory, Maya opens the star map and finds her way home.')
$synth.Dispose()
$ffmpeg = node -e "console.log(require('ffmpeg-static'))"
$mp3 = Join-Path $tts 'chapter-001.mp3'
& $ffmpeg -hide_banner -loglevel error -y -i $wav -codec:a libmp3lame -b:a 160k $mp3
if ($LASTEXITCODE -ne 0) { throw 'ffmpeg audio conversion failed' }
Remove-Item -LiteralPath $wav -Force
$ffprobe = node -e "console.log(require('ffprobe-static').path)"
$duration = [double](& $ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $mp3)
$first = 'At dawn, Maya enters a luminous forest and follows a golden signal.'
$second = 'Inside an old observatory, Maya opens the star map and finds her way home.'
$split = [Math]::Round($duration * 0.48, 3)
$timestamps = @{ provider='windows-tts'; duration=[Math]::Round($duration,3); confidence=0.9; segments=@(
  @{start=0;end=$split;text=$first}, @{start=$split;end=[Math]::Round($duration,3);text=$second}
)} | ConvertTo-Json -Depth 5
[IO.File]::WriteAllText((Join-Path $tts 'chapter-001.json'),$timestamps,(New-Object Text.UTF8Encoding($false)))
Write-Output ('SAMPLE_READY duration={0:N3}s' -f $duration)
