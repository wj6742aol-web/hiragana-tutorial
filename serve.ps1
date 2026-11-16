# 로컬 정적 서버 (API fetch용). 사용: powershell -File serve.ps1
$root = $PSScriptRoot
$port = 5500
$prefix = "http://127.0.0.1:$port/"

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".ico"  = "image/x-icon"
  ".txt"  = "text/plain; charset=utf-8"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "포트 $port 를 열 수 없습니다. 다른 프로그램이 사용 중일 수 있어요."
  Write-Host $_.Exception.Message
  exit 1
}

Write-Host "일본어 튜토리얼 서버: $prefix"
Write-Host "브라우저에서 위 주소를 여세요. 종료: Ctrl+C"
Start-Process $prefix

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $path = [Uri]::UnescapeDataString($req.Url.LocalPath.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($path)) { $path = "index.html" }
    $full = [System.IO.Path]::GetFullPath((Join-Path $root $path))
    if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
      $res.StatusCode = 403
      $buf = [Text.Encoding]::UTF8.GetBytes("Forbidden")
      $res.OutputStream.Write($buf, 0, $buf.Length)
    } elseif (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $res.StatusCode = 404
      $buf = [Text.Encoding]::UTF8.GetBytes("Not Found")
      $res.OutputStream.Write($buf, 0, $buf.Length)
    } else {
      $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
      $res.ContentType = $(if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" })
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
  } catch {
    $res.StatusCode = 500
  } finally {
    $res.OutputStream.Close()
  }
}
