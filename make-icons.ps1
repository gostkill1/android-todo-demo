# Renders assets/app-icon.png into the five android mipmap densities.
# Run from the project root:  powershell -ExecutionPolicy Bypass -File .\make-icons.ps1
# The default template icons (ic_launcher.webp) must not sit next to these PNGs, or aapt fails on duplicate resources.
param([string]$Source = 'assets\app-icon.png')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$background = [System.Drawing.Color]::FromArgb(255, 0x5B, 0x53, 0xF9)
$densities = [ordered]@{ mdpi = 48; hdpi = 72; xhdpi = 96; xxhdpi = 144; xxxhdpi = 192 }
$names = @('ic_launcher', 'ic_launcher_round')

$image = [System.Drawing.Image]::FromFile((Resolve-Path $Source).Path)
try {
  foreach ($density in $densities.Keys) {
    $px = $densities[$density]
    $dir = "android\app\src\main\res\mipmap-$density"
    if (-not (Test-Path $dir)) { throw "missing $dir" }
    foreach ($name in $names) {
      $bmp = New-Object System.Drawing.Bitmap($px, $px, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.Clear($background)
      $g.DrawImage($image, 0, 0, $px, $px)
      $g.Dispose()
      $bmp.Save((Join-Path (Resolve-Path $dir).Path "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
      $bmp.Dispose()
      Write-Output "wrote mipmap-$density/$name.png ($px x $px)"
    }
  }
} finally { $image.Dispose() }
