# OpenJLPT EN JSON → 한국어 뜻 정적 JS 생성
# powershell -ExecutionPolicy Bypass -File scripts\build-jlpt-ko.ps1
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$srcDir = Join-Path $root "data\jlpt-ko"
$cachePath = Join-Path $srcDir "meaning-cache.json"
$levels = @("n5", "n4", "n3", "n2", "n1")

function Esc([string]$s) {
  if ($null -eq $s) { return "" }
  $s = $s -replace '\\', '\\'
  $s = $s -replace '"', '\"'
  $s = $s -replace "`r`n", "\n"
  $s = $s -replace "`n", "\n"
  $s = $s -replace "`r", ""
  $s = $s -replace "`t", "\t"
  return $s
}

function Save-Cache($map, $path) {
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.Append("{")
  $first = $true
  foreach ($key in ($map.Keys | Sort-Object)) {
    if (-not $first) { [void]$sb.Append(",") }
    $first = $false
    [void]$sb.Append('"')
    [void]$sb.Append((Esc $key))
    [void]$sb.Append('":"')
    [void]$sb.Append((Esc ([string]$map[$key])))
    [void]$sb.Append('"')
  }
  [void]$sb.Append("}")
  [System.IO.File]::WriteAllText($path, $sb.ToString(), [System.Text.UTF8Encoding]::new($false))
}

function Load-Cache($path) {
  $map = @{}
  if (-not (Test-Path $path)) { return $map }
  try {
    $obj = Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json
    $obj.PSObject.Properties | ForEach-Object { $map[$_.Name] = [string]$_.Value }
  } catch {}
  return $map
}

function Translate-Batch([string[]]$texts) {
  $results = @{}
  if (-not $texts -or $texts.Count -eq 0) { return $results }
  $concurrency = 8
  $pool = [runspacefactory]::CreateRunspacePool(1, $concurrency)
  $pool.Open()
  $runners = @()
  foreach ($text in $texts) {
    $ps = [powershell]::Create().AddScript({
      param($t)
      try {
        $url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=" + [uri]::EscapeDataString($t)
        $wc = New-Object System.Net.WebClient
        $wc.Encoding = [Text.Encoding]::UTF8
        $json = $wc.DownloadString($url)
        $data = $json | ConvertFrom-Json
        $parts = New-Object System.Collections.Generic.List[string]
        foreach ($row in $data[0]) {
          if ($row[0]) { [void]$parts.Add([string]$row[0]) }
        }
        return @{ en = $t; ko = (($parts -join "").Trim()) }
      } catch {
        return @{ en = $t; ko = "" }
      }
    }).AddArgument($text)
    $ps.RunspacePool = $pool
    $runners += @{ ps = $ps; handle = $ps.BeginInvoke() }
  }
  foreach ($r in $runners) {
    $out = $r.ps.EndInvoke($r.handle)
    $r.ps.Dispose()
    $en = [string]$out.en
    $ko = [string]$out.ko
    if (-not $ko) { $ko = $en }
    $results[$en] = $ko
  }
  $pool.Close()
  $pool.Dispose()
  return $results
}

Write-Host "root: $root"
$cache = Load-Cache $cachePath
Write-Host "cache: $($cache.Count)"

$needList = New-Object System.Collections.Generic.List[string]
$needSet = New-Object "System.Collections.Generic.HashSet[string]"
foreach ($lv in $levels) {
  $path = Join-Path $srcDir "$lv.en.json"
  Write-Host "scan $lv"
  $data = Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($w in $data) {
    $joined = ((@($w.meanings) | ForEach-Object { "$_" }) -join "; ").Trim()
    if ($joined -and -not $cache.ContainsKey($joined) -and $needSet.Add($joined)) {
      [void]$needList.Add($joined)
    }
  }
}
Write-Host "need translate: $($needList.Count)"

$batchSize = 40
for ($i = 0; $i -lt $needList.Count; $i += $batchSize) {
  $end = [Math]::Min($i + $batchSize - 1, $needList.Count - 1)
  $batch = $needList[$i..$end]
  Write-Host ("batch {0}-{1} / {2}" -f ($i + 1), ($end + 1), $needList.Count)
  $got = Translate-Batch $batch
  foreach ($k in $got.Keys) { $cache[$k] = $got[$k] }
  Save-Cache $cache $cachePath
  Start-Sleep -Milliseconds 150
}
Write-Host "cache final: $($cache.Count)"

foreach ($lv in $levels) {
  Write-Host "emit vocab-$lv-ko.js"
  $data = Get-Content (Join-Path $srcDir "$lv.en.json") -Raw -Encoding UTF8 | ConvertFrom-Json
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine("/** JLPT $($lv.ToUpper()) 한국어 정적 단어 — OpenJLPT 기반 */")
  [void]$sb.AppendLine("(function () {")
  [void]$sb.AppendLine("  window.VOCAB_REMOTE = window.VOCAB_REMOTE || {};")
  [void]$sb.AppendLine("  window.VOCAB_REMOTE['$lv'] = [")
  foreach ($w in $data) {
    $joined = ((@($w.meanings) | ForEach-Object { "$_" }) -join "; ").Trim()
    $ko = if ($joined -and $cache.ContainsKey($joined) -and $cache[$joined]) { $cache[$joined] } else { $joined }
    $id = "oj-$lv-$($w.id)"
    $exParts = New-Object System.Collections.Generic.List[string]
    $nEx = 0
    foreach ($ex in @($w.examples)) {
      if ($nEx -ge 2) { break }
      if (-not $ex.ja) { continue }
      [void]$exParts.Add(('{{ja:"{0}",en:"{1}"}}' -f (Esc $ex.ja), (Esc ([string]$ex.en))))
      $nEx++
    }
    $line = '    {{id:"{0}",jp:"{1}",reading:"{2}",romaji:"{3}",ko:"{4}",en:"{5}",tip:"JLPT {6}",level:"{6}",source:"openjlpt-static",koMain:true,examplesOk:true,examples:[{7}]}},' -f `
      (Esc $id), (Esc ([string]$w.word)), (Esc ([string]$w.reading)), (Esc ([string]$w.romaji)), (Esc $ko), (Esc $joined), $lv.ToUpper(), ($exParts -join ",")
    [void]$sb.AppendLine($line)
  }
  [void]$sb.AppendLine("  ];")
  [void]$sb.AppendLine("})();")
  $outJs = Join-Path $root "data\vocab-$lv-ko.js"
  [System.IO.File]::WriteAllText($outJs, $sb.ToString(), [System.Text.UTF8Encoding]::new($false))
  Write-Host ("  {0} words -> {1}" -f $data.Count, $outJs)
}

Write-Host "DONE"
