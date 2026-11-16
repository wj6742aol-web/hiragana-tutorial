# Retry leftover empty/English meanings; rebuild ko.js
# Script is ASCII-only; Korean/Japanese overrides live in data/jlpt-ko/manual-ko.json
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$srcDir = Join-Path $root "data\jlpt-ko"
$cachePath = Join-Path $srcDir "meaning-cache.json"
$manualPath = Join-Path $srcDir "manual-ko.json"
$utf8 = New-Object System.Text.UTF8Encoding $false
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

function Looks-Ko([string]$s) {
  if ([string]::IsNullOrWhiteSpace($s)) { return $false }
  return [bool][regex]::IsMatch($s, "[\uAC00-\uD7A3]")
}

function Load-Cache($path) {
  $map = @{}
  if (-not (Test-Path $path)) { return $map }
  $obj = Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json
  $obj.PSObject.Properties | ForEach-Object { $map[$_.Name] = [string]$_.Value }
  return $map
}

function Save-Cache($map, $path) {
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine("{")
  $keys = @($map.Keys | Sort-Object)
  for ($i = 0; $i -lt $keys.Count; $i++) {
    $k = $keys[$i]
    $comma = if ($i -lt $keys.Count - 1) { "," } else { "" }
    [void]$sb.AppendLine(('  "{0}": "{1}"{2}' -f (Esc $k), (Esc ([string]$map[$k])), $comma))
  }
  [void]$sb.Append("}")
  [System.IO.File]::WriteAllText($path, $sb.ToString(), $utf8)
}

function Http-Get([string]$url) {
  $req = [System.Net.HttpWebRequest]::Create($url)
  $req.Method = "GET"
  $req.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  $req.Timeout = 20000
  $resp = $req.GetResponse()
  try {
    $sr = New-Object System.IO.StreamReader($resp.GetResponseStream(), [Text.Encoding]::UTF8)
    $raw = $sr.ReadToEnd()
    $sr.Close()
    return $raw
  } finally { $resp.Close() }
}

function Translate([string]$text, [string]$sl) {
  if ([string]::IsNullOrWhiteSpace($text)) { return $null }
  for ($attempt = 1; $attempt -le 5; $attempt++) {
    try {
      $url = "https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=$sl&tl=ko&q=" + [uri]::EscapeDataString($text)
      $raw = Http-Get $url
      $data = $raw | ConvertFrom-Json
      $ko = $null
      if ($data -is [string]) { $ko = $data }
      elseif ($data -is [System.Array] -or $data.Count) {
        if ($data[0] -is [string]) { $ko = [string]$data[0] }
        elseif ($data[0] -is [System.Array] -and $data[0][0]) { $ko = [string]$data[0][0] }
        else { $ko = [string]$data[0] }
      } else { $ko = [string]$data }
      $ko = ([string]$ko).Trim()
      if (Looks-Ko $ko) { return $ko }
      return $null
    } catch {
      if ([string]$_.Exception.Message -match "429|503") {
        Start-Sleep -Seconds (3 * $attempt)
        continue
      }
      Write-Host ("  err: " + $_.Exception.Message)
      return $null
    }
  }
  return $null
}

$manual = Load-Cache $manualPath
$cache = Load-Cache $cachePath
Write-Host ("cache $($cache.Count) manual $($manual.Count)")

$fixed = 0
$still = 0
foreach ($lv in $levels) {
  $data = Get-Content (Join-Path $srcDir "$lv.en.json") -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($w in $data) {
    $joined = ((@($w.meanings) | ForEach-Object { "$_" }) -join "; ").Trim()
    $word = [string]$w.word
    $cacheKey = if ($joined) { $joined } else { "ja:" + $word }

    $have = $null
    if ($joined -and $cache.ContainsKey($joined)) { $have = $cache[$joined] }
    elseif ($cache.ContainsKey($cacheKey)) { $have = $cache[$cacheKey] }
    if (Looks-Ko $have) { continue }

    $ko = $null
    if ($manual.ContainsKey($word)) {
      $ko = $manual[$word]
    } elseif ($joined) {
      $ko = Translate $joined "en"
    } else {
      $ko = Translate $word "ja"
    }

    if (Looks-Ko $ko) {
      $cache[$cacheKey] = $ko
      if ($joined) { $cache[$joined] = $ko }
      $fixed++
      Write-Host ("OK $lv $word => $ko")
    } else {
      $still++
      Write-Host ("FAIL $lv $word meanings=[$joined]")
    }
    Start-Sleep -Milliseconds 120
  }
}
Save-Cache $cache $cachePath
Write-Host "fixed=$fixed still=$still"

foreach ($lv in $levels) {
  Write-Host "rebuild $lv"
  $data = Get-Content (Join-Path $srcDir "$lv.en.json") -Raw -Encoding UTF8 | ConvertFrom-Json
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine("/** JLPT $($lv.ToUpper()) expanded KO static vocab */")
  [void]$sb.AppendLine("(function () {")
  [void]$sb.AppendLine("  window.VOCAB_REMOTE_EXCLUSIVE = window.VOCAB_REMOTE_EXCLUSIVE || {};")
  [void]$sb.AppendLine("  window.VOCAB_REMOTE_EXCLUSIVE['$lv'] = [")
  $ok = 0; $bad = 0
  foreach ($w in $data) {
    $joined = ((@($w.meanings) | ForEach-Object { "$_" }) -join "; ").Trim()
    $word = [string]$w.word
    $cacheKey = if ($joined) { $joined } else { "ja:" + $word }
    $ko = $null
    if ($joined -and $cache.ContainsKey($joined) -and (Looks-Ko $cache[$joined])) { $ko = $cache[$joined] }
    elseif ($cache.ContainsKey($cacheKey) -and (Looks-Ko $cache[$cacheKey])) { $ko = $cache[$cacheKey] }
    elseif ($manual.ContainsKey($word)) { $ko = $manual[$word] }
    else { $ko = $joined }
    if (Looks-Ko $ko) { $ok++ } else { $bad++ }
    $id = "oj-$lv-$($w.id)"
    $exParts = New-Object System.Collections.Generic.List[string]
    $nEx = 0
    foreach ($ex in @($w.examples)) {
      if ($nEx -ge 2) { break }
      if (-not $ex.ja) { continue }
      [void]$exParts.Add(('{{ja:"{0}",en:"{1}"}}' -f (Esc ([string]$ex.ja)), (Esc ([string]$ex.en))))
      $nEx++
    }
    $line = '    {{id:"{0}",jp:"{1}",reading:"{2}",romaji:"{3}",ko:"{4}",en:"{5}",tip:"JLPT {6}",level:"{6}",source:"openjlpt-static",koMain:true,examplesOk:true,examples:[{7}]}},' -f `
      (Esc $id), (Esc $word), (Esc ([string]$w.reading)), (Esc ([string]$w.romaji)), (Esc $ko), (Esc $joined), $lv.ToUpper(), ($exParts -join ",")
    [void]$sb.AppendLine($line)
  }
  [void]$sb.AppendLine("  ];")
  [void]$sb.AppendLine("})();")
  [System.IO.File]::WriteAllText((Join-Path $root "data\vocab-$lv-ko.js"), $sb.ToString(), $utf8)
  Write-Host ("  words={0} ko={1} enLeft={2}" -f $data.Count, $ok, $bad)
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("/** Cumulative JLPT sets */")
[void]$sb.AppendLine("(function () {")
[void]$sb.AppendLine("  const ex = window.VOCAB_REMOTE_EXCLUSIVE || {};")
[void]$sb.AppendLine("  window.VOCAB_REMOTE = window.VOCAB_REMOTE || {};")
[void]$sb.AppendLine("  const order = ['n5','n4','n3','n2','n1'];")
[void]$sb.AppendLine("  function cum(level) {")
[void]$sb.AppendLine("    const idx = order.indexOf(level);")
[void]$sb.AppendLine("    if (idx < 0) return [];")
[void]$sb.AppendLine("    const out = [];")
[void]$sb.AppendLine("    for (let i = 0; i <= idx; i++) {")
[void]$sb.AppendLine("      const arr = ex[order[i]] || [];")
[void]$sb.AppendLine("      for (const w of arr) out.push(w);")
[void]$sb.AppendLine("    }")
[void]$sb.AppendLine("    return out;")
[void]$sb.AppendLine("  }")
[void]$sb.AppendLine("  window.VOCAB_REMOTE.n5 = cum('n5');")
[void]$sb.AppendLine("  window.VOCAB_REMOTE.n4 = cum('n4');")
[void]$sb.AppendLine("  window.VOCAB_REMOTE.n3 = cum('n3');")
[void]$sb.AppendLine("  window.VOCAB_REMOTE.n2 = cum('n2');")
[void]$sb.AppendLine("  window.VOCAB_REMOTE.n1 = cum('n1');")
[void]$sb.AppendLine("  window.VOCAB_REMOTE_META = {")
foreach ($lv in $levels) {
  $n = (Get-Content (Join-Path $srcDir "$lv.en.json") -Raw -Encoding UTF8 | ConvertFrom-Json).Count
  [void]$sb.AppendLine("    ${lv}: $n,")
}
[void]$sb.AppendLine("  };")
[void]$sb.AppendLine("})();")
[System.IO.File]::WriteAllText((Join-Path $root "data\vocab-cumulative-ko.js"), $sb.ToString(), $utf8)
Write-Host "DONE"
