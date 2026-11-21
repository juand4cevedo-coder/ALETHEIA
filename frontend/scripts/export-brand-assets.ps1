param([string]$OutputDirectory = (Join-Path $PSScriptRoot "..\public"))

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function New-BrandBitmap {
    param([int]$Size, [switch]$OpaqueBackground)

    $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $bitmap.SetResolution(144, 144)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear($(if ($OpaqueBackground) { [System.Drawing.ColorTranslator]::FromHtml("#f4f1ea") } else { [System.Drawing.Color]::Transparent }))

    $scale = $Size / 240.0
    $paper = [System.Drawing.ColorTranslator]::FromHtml("#f4f1ea")
    $line = [System.Drawing.ColorTranslator]::FromHtml("#707c82")
    $eye = [System.Drawing.ColorTranslator]::FromHtml("#414b50")
    $iris = [System.Drawing.ColorTranslator]::FromHtml("#cbd1d3")
    $paperBrush = [System.Drawing.SolidBrush]::new($paper)
    $eyeBrush = [System.Drawing.SolidBrush]::new($eye)
    $irisBrush = [System.Drawing.SolidBrush]::new($iris)
    $linePen = [System.Drawing.Pen]::new($line, [Math]::Max(1.0, 5.5 * $scale))
    $outlinePen = [System.Drawing.Pen]::new($line, [Math]::Max(1.0, 3 * $scale))
    $eyePen = [System.Drawing.Pen]::new($eye, [Math]::Max(1.0, 4 * $scale))
    foreach ($pen in @($linePen, $outlinePen, $eyePen)) {
        $pen.StartCap = $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    }

    $graphics.FillEllipse($paperBrush, 16*$scale, 16*$scale, 208*$scale, 208*$scale)
    $graphics.DrawEllipse($outlinePen, 16*$scale, 16*$scale, 208*$scale, 208*$scale)
    $clip = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $clip.AddEllipse(17*$scale, 17*$scale, 206*$scale, 206*$scale)
    $graphics.SetClip($clip)

    function Draw-Line([double[]]$Points) {
        for ($index = 0; $index -lt $Points.Length - 3; $index += 2) {
            $graphics.DrawLine($linePen, $Points[$index]*$scale, $Points[$index+1]*$scale, $Points[$index+2]*$scale, $Points[$index+3]*$scale)
        }
    }

    Draw-Line @(120,30,135,30,135,30,149,44,149,44,166,53,166,53,183,58,183,58,212,63)
    Draw-Line @(99,83,99,47); Draw-Line @(119,83,119,51)
    Draw-Line @(48,72,75,72,75,72,85,82,85,82,96,82); Draw-Line @(145,73,211,73)
    Draw-Line @(45,96,73,96,73,96,81,88,81,88,96,88); Draw-Line @(195,96,177,96,177,96,169,104,169,104,155,104)
    Draw-Line @(44,120,68,120); Draw-Line @(196,120,172,120)
    Draw-Line @(45,145,67,145,67,145,75,137,75,137,93,137); Draw-Line @(195,145,179,145,179,145,171,153,171,153,156,153)
    Draw-Line @(48,169,77,169,77,169,87,159,87,159,97,159); Draw-Line @(143,162,155,162,155,162,165,172,165,172,212,172)
    Draw-Line @(99,160,99,195); Draw-Line @(119,160,119,214); Draw-Line @(143,162,143,218)

    foreach ($dot in @(@(84,72),@(119,51),@(145,73),@(81,96),@(169,96),@(68,120),@(172,120),@(75,145),@(171,145),@(87,169),@(119,195),@(143,162))) {
        $graphics.FillEllipse($paperBrush, ($dot[0]-6)*$scale, ($dot[1]-6)*$scale, 12*$scale, 12*$scale)
        $graphics.DrawEllipse($linePen, ($dot[0]-6)*$scale, ($dot[1]-6)*$scale, 12*$scale, 12*$scale)
    }

    $eyeShape = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $eyeShape.StartFigure()
    $eyeShape.AddBezier(61*$scale,119*$scale,78*$scale,100*$scale,96*$scale,91*$scale,120*$scale,91*$scale)
    $eyeShape.AddBezier(120*$scale,91*$scale,144*$scale,91*$scale,162*$scale,100*$scale,179*$scale,119*$scale)
    $eyeShape.AddBezier(179*$scale,119*$scale,162*$scale,139*$scale,144*$scale,148*$scale,120*$scale,148*$scale)
    $eyeShape.AddBezier(120*$scale,148*$scale,96*$scale,148*$scale,78*$scale,139*$scale,61*$scale,119*$scale)
    $eyeShape.CloseFigure()
    $graphics.FillPath($eyeBrush, $eyeShape)
    $graphics.FillEllipse($irisBrush, 91*$scale, 90*$scale, 58*$scale, 58*$scale)
    $graphics.DrawEllipse($eyePen, 91*$scale, 90*$scale, 58*$scale, 58*$scale)
    $graphics.FillEllipse($eyeBrush, 112*$scale, 101*$scale, 16*$scale, 16*$scale)

    $graphics.ResetClip()
    $eyeShape.Dispose(); $clip.Dispose(); $linePen.Dispose(); $outlinePen.Dispose(); $eyePen.Dispose()
    $paperBrush.Dispose(); $eyeBrush.Dispose(); $irisBrush.Dispose(); $graphics.Dispose()
    return $bitmap
}

function Save-Png {
    param([int]$Size, [string]$Name, [switch]$OpaqueBackground)
    $bitmap = New-BrandBitmap $Size -OpaqueBackground:$OpaqueBackground
    try { $bitmap.Save((Join-Path $OutputDirectory $Name), [System.Drawing.Imaging.ImageFormat]::Png) }
    finally { $bitmap.Dispose() }
}

Save-Png 32 "favicon.png"
Save-Png 180 "apple-touch-icon.png" -OpaqueBackground
Save-Png 192 "icon-192.png" -OpaqueBackground
Save-Png 512 "icon-512.png" -OpaqueBackground

$emailDirectory = Join-Path $OutputDirectory "email"
if (-not (Test-Path $emailDirectory)) { [System.IO.Directory]::CreateDirectory($emailDirectory) | Out-Null }
$emailLogo = New-BrandBitmap 128
try { $emailLogo.Save((Join-Path $emailDirectory "logo-claro.png"), [System.Drawing.Imaging.ImageFormat]::Png) }
finally { $emailLogo.Dispose() }

$social = [System.Drawing.Bitmap]::new(1200, 630, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$socialGraphics = [System.Drawing.Graphics]::FromImage($social)
$socialGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$socialGraphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$socialGraphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#f4f1ea"))
$socialInk = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#071423"))
$socialMuted = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#56616a"))
$socialRule = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml("#d7d3ca"), 2)
$socialMark = New-BrandBitmap 330
$brandFont = [System.Drawing.Font]::new("Segoe UI Light", 92, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$taglineFont = [System.Drawing.Font]::new("Segoe UI", 31, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
try {
    $socialGraphics.DrawImage($socialMark, 95, 150, 330, 330)
    $socialGraphics.DrawString("Aletheia", $brandFont, $socialInk, 485, 205)
    $socialGraphics.DrawLine($socialRule, 490, 328, 1080, 328)
    $socialGraphics.DrawString("Su trabajo. Con claridad.", $taglineFont, $socialMuted, 490, 360)
    $social.Save((Join-Path $OutputDirectory "og-image.png"), [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    $brandFont.Dispose(); $taglineFont.Dispose(); $socialMark.Dispose(); $socialRule.Dispose()
    $socialInk.Dispose(); $socialMuted.Dispose(); $socialGraphics.Dispose(); $social.Dispose()
}

$iconSizes = @(16, 32, 48)
$payloads = foreach ($size in $iconSizes) {
    $bitmap = New-BrandBitmap $size
    $stream = [System.IO.MemoryStream]::new()
    try { $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png); ,$stream.ToArray() }
    finally { $stream.Dispose(); $bitmap.Dispose() }
}
$output = [System.IO.MemoryStream]::new()
$writer = [System.IO.BinaryWriter]::new($output)
try {
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$iconSizes.Count)
    $offset = 6 + (16 * $iconSizes.Count)
    for ($index = 0; $index -lt $iconSizes.Count; $index++) {
        $size = $iconSizes[$index]
        $writer.Write([byte]$size); $writer.Write([byte]$size); $writer.Write([byte]0); $writer.Write([byte]0)
        $writer.Write([uint16]1); $writer.Write([uint16]32)
        $writer.Write([uint32]$payloads[$index].Length); $writer.Write([uint32]$offset)
        $offset += $payloads[$index].Length
    }
    foreach ($payload in $payloads) { $writer.Write($payload) }
    $writer.Flush()
    [System.IO.File]::WriteAllBytes((Join-Path $OutputDirectory "favicon.ico"), $output.ToArray())
} finally { $writer.Dispose(); $output.Dispose() }
