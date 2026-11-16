# OpenJLPT + Anki + elzup 병합 → 확장 en.json → (기존 캐시로) ko.js 재생성
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$srcDir = Join-Path $root "data\jlpt-ko"
$expandDir = Join-Path $srcDir "expand"
$cachePath = Join-Path $srcDir "meaning-cache.json"
$levels = @("n5", "n4", "n3", "n2", "n1")
$levelRank = @{ n5 = 5; n4 = 4; n3 = 3; n2 = 2; n1 = 1 }

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

function Get-LevelFromTags([string]$tags) {
  if ($tags -match 'JLPT_N5|JLPT_5') { return "n5" }
  if ($tags -match 'JLPT_N4|JLPT_4') { return "n4" }
  if ($tags -match 'JLPT_N3|JLPT_3') { return "n3" }
  if ($tags -match 'JLPT_N2|JLPT_2') { return "n2" }
  if ($tags -match 'JLPT_N1|JLPT_1') { return "n1" }
  return $null
}

function Add-Word($map, $level, $word, $reading, $meaning, $romaji, $examples) {
  if (-not $word -and -not $reading) { return }
  $w = ([string]$word).Trim()
  $r = ([string]$reading).Trim()
  if (-not $w) { $w = $r }
  $key = ($w + "|" + $r).ToLowerInvariant()
  $m = ([string]$meaning).Trim()
  if (-not $map.ContainsKey($key)) {
    $map[$key] = [ordered]@{
      word     = $w
      reading  = $r
      romaji   = ([string]$romaji).Trim()
      meaning  = $m
      level    = $level
      examples = @()
      id       = [Guid]::NewGuid().ToString("N").Substring(0, 10)
    }
    if ($examples) { $map[$key].examples = @($examples) }
    return
  }
  $cur = $map[$key]
  # 더 쉬운(숫자 큰) 레벨로 승격
  if ($levelRank[$level] -gt $levelRank[$cur.level]) {
    $cur.level = $level
  }
  if ((-not $cur.meaning) -and $m) { $cur.meaning = $m }
  elseif ($m -and $cur.meaning.Length -lt $m.Length) { $cur.meaning = $m }
  if ((-not $cur.romaji) -and $romaji) { $cur.romaji = ([string]$romaji).Trim() }
  if ((-not $cur.examples -or $cur.examples.Count -eq 0) -and $examples) {
    $cur.examples = @($examples)
  }
}

Write-Host "Merge sources..."
$map = @{}

# 1) OpenJLPT
foreach ($lv in $levels) {
  $path = Join-Path $srcDir "$lv.en.json"
  $data = Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($w in $data) {
    $meaning = ((@($w.meanings) | ForEach-Object { "$_" }) -join "; ").Trim()
    Add-Word $map $lv $w.word $w.reading $meaning $w.romaji $w.examples
  }
  Write-Host "  openjlpt $lv"
}

# 2) Anki decks
foreach ($lv in $levels) {
  $path = Join-Path $expandDir "anki-$lv.csv"
  if (-not (Test-Path $path)) { continue }
  $rows = Import-Csv $path
  foreach ($row in $rows) {
    Add-Word $map $lv $row.expression $row.reading $row.meaning "" $null
  }
  Write-Host "  anki $lv ($($rows.Count))"
}

# 3) elzup all
$elPath = Join-Path $expandDir "elzup-all.csv"
if (Test-Path $elPath) {
  $rows = Import-Csv $elPath
  foreach ($row in $rows) {
    $lv = Get-LevelFromTags ([string]$row.tags)
    if (-not $lv) { continue }
    Add-Word $map $lv $row.expression $row.reading $row.meaning "" $null
  }
  Write-Host "  elzup $($rows.Count)"
}

# 4) API (all endpoint)
foreach ($n in 1..5) {
  $lv = "n$n"
  if ($n -eq 1) { $lv = "n1" }
  elseif ($n -eq 2) { $lv = "n2" }
  elseif ($n -eq 3) { $lv = "n3" }
  elseif ($n -eq 4) { $lv = "n4" }
  else { $lv = "n5" }
  try {
    $words = Invoke-RestMethod "https://jlpt-vocab-api.vercel.app/api/words/all?level=$n"
    foreach ($w in $words) {
      Add-Word $map $lv $w.word $w.furigana $w.meaning $w.romaji $null
    }
    Write-Host "  api $lv ($($words.Count))"
  } catch {
    Write-Host "  api $lv skip"
  }
}

# split by exclusive level
$byLevel = @{ n5 = @(); n4 = @(); n3 = @(); n2 = @(); n1 = @() }
foreach ($key in $map.Keys) {
  $item = $map[$key]
  $lv = $item.level
  $entry = [ordered]@{
    id       = $item.id
    word     = $item.word
    reading  = $item.reading
    romaji   = $item.romaji
    meanings = @($(if ($item.meaning) { $item.meaning } else { "" }))
    level    = $lv.ToUpper()
    examples = @($item.examples | Select-Object -First 2)
  }
  $byLevel[$lv] += $entry
}

$cum = 0
foreach ($lv in $levels) {
  $arr = @($byLevel[$lv] | Sort-Object word, reading)
  $byLevel[$lv] = $arr
  $path = Join-Path $srcDir "$lv.en.json"
  ($arr | ConvertTo-Json -Depth 8 -Compress) | Set-Content $path -Encoding UTF8
  $cum += $arr.Count
  Write-Host ("exclusive {0}={1} cumulative={2}" -f $lv, $arr.Count, $cum)
}

# translate missing
$cache = Load-Cache $cachePath
Write-Host "cache $($cache.Count)"
$need = New-Object System.Collections.Generic.List[string]
$set = New-Object "System.Collections.Generic.HashSet[string]"
foreach ($lv in $levels) {
  foreach ($w in $byLevel[$lv]) {
    $joined = ((@($w.meanings) | ForEach-Object { "$_" }) -join "; ").Trim()
    if ($joined -and -not $cache.ContainsKey($joined) -and $set.Add($joined)) {
      [void]$need.Add($joined)
    }
  }
}
Write-Host "need translate $($need.Count)"
$batchSize = 40
for ($i = 0; $i -lt $need.Count; $i += $batchSize) {
  $end = [Math]::Min($i + $batchSize - 1, $need.Count - 1)
  $batch = $need[$i..$end]
  Write-Host ("batch {0}-{1} / {2}" -f ($i + 1), ($end + 1), $need.Count)
  $got = Translate-Batch $batch
  foreach ($k in $got.Keys) { $cache[$k] = $got[$k] }
  Save-Cache $cache $cachePath
  Start-Sleep -Milliseconds 120
}

# emit ko js + cumulative helpers stored on window
foreach ($lv in $levels) {
  Write-Host "emit vocab-$lv-ko.js"
  $data = $byLevel[$lv]
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine("/** JLPT $($lv.ToUpper()) 확장 한국어 정적 단어 */")
  [void]$sb.AppendLine("(function () {")
  [void]$sb.AppendLine("  window.VOCAB_REMOTE = window.VOCAB_REMOTE || {};")
  [void]$sb.AppendLine("  window.VOCAB_REMOTE_EXCLUSIVE = window.VOCAB_REMOTE_EXCLUSIVE || {};")
  [void]$sb.AppendLine("  window.VOCAB_REMOTE_EXCLUSIVE['$lv'] = [")
  foreach ($w in $data) {
    $joined = ((@($w.meanings) | ForEach-Object { "$_" }) -join "; ").Trim()
    $ko = if ($joined -and $cache.ContainsKey($joined) -and $cache[$joined]) { $cache[$joined] } else { $joined }
    $id = "oj-$lv-$($w.id)"
    $exParts = New-Object System.Collections.Generic.List[string]
    $nEx = 0
    foreach ($ex in @($w.examples)) {
      if ($nEx -ge 2) { break }
      $ja = $ex.ja; if (-not $ja) { continue }
      [void]$exParts.Add(('{{ja:"{0}",en:"{1}"}}' -f (Esc ([string]$ja)), (Esc ([string]$ex.en))))
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
  Write-Host ("  {0} words" -f $data.Count)
}

# cumulative bundle file
Write-Host "emit vocab-cumulative-ko.js"
$order = @("n5", "n4", "n3", "n2", "n1")
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("/** 누적 JLPT 세트: N4=N5+N4 … N1=전체 */")
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
[void]$sb.AppendLine("  // 학습용: N5는 전용, N4~N1은 누적(시중 목표 개수에 맞춤)")
[void]$sb.AppendLine("  window.VOCAB_REMOTE.n5 = cum('n5');")
[void]$sb.AppendLine("  window.VOCAB_REMOTE.n4 = cum('n4');")
[void]$sb.AppendLine("  window.VOCAB_REMOTE.n3 = cum('n3');")
[void]$sb.AppendLine("  window.VOCAB_REMOTE.n2 = cum('n2');")
[void]$sb.AppendLine("  window.VOCAB_REMOTE.n1 = cum('n1');")
[void]$sb.AppendLine("  window.VOCAB_REMOTE_META = {")
foreach ($lv in $order) {
  $excl = $byLevel[$lv].Count
  [void]$sb.AppendLine("    ${lv}: { exclusive: $excl },")
}
[void]$sb.AppendLine("  };")
[void]$sb.AppendLine("})();")
[System.IO.File]::WriteAllText((Join-Path $root "data\vocab-cumulative-ko.js"), $sb.ToString(), [System.Text.UTF8Encoding]::new($false))

Write-Host "DONE"
