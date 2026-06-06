param(
  [int]$Port = 8787
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScoreNames = @("State", "Opposition", "Reform", "Security", "Civil liberties")
$ThemeKeywords = @{
  "State" = @("state", "government", "policy", "federal", "province", "china", "diplomacy", "economy", "budget")
  "Opposition" = @("opposition", "pti", "pml", "ppp", "election", "parliament", "party", "political")
  "Reform" = @("reform", "tax", "education", "health", "governance", "water", "energy", "schools", "courts", "system")
  "Security" = @("security", "terror", "border", "iran", "afghan", "gaza", "war", "climate", "maritime", "police")
  "Civil liberties" = @("rights", "liberty", "justice", "women", "children", "minority", "freedom", "speech", "dissent")
}

[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

function Clean-Text([string]$Value) {
  if (-not $Value) { return "" }
  $decoded = [System.Net.WebUtility]::HtmlDecode($Value)
  return (($decoded -replace "<script[\s\S]*?</script>", " ") `
    -replace "<style[\s\S]*?</style>", " " `
    -replace "<[^>]+>", " " `
    -replace "\s+", " " `
    -replace "\s+([,.;:])", '$1').Trim()
}

function Sanitize-ArticleText([string]$Value) {
  return ((Clean-Text $Value) `
    -replace "^#{1,6}\s*", "" `
    -replace "^#{1,6}", "" `
    -replace "\s+#{1,6}\s+", " " `
    -replace "\s+#{1,6}", " ").Trim()
}

function Normalize-Title([string]$Value) {
  return ((Sanitize-ArticleText $Value) `
    -replace "\s*\|\s*The Express Tribune$", "" `
    -replace "\s*-\s*DAWN\.COM$", "" `
    -replace "\s*\|\s*The News.*$", "").Trim()
}

function Is-NoisyText([string]$Value) {
  $text = Sanitize-ArticleText $Value
  if (-not $text) { return $true }
  return $text -match "^(URL Source|Markdown Content|Title):|EPAPER|LIVE TV|DAWNNEWS|https?://|\[.+\]\(https?://"
}

function Date-IsoFromText([string]$Text) {
  if (-not $Text) { return "" }
  $months = @{
    jan = "01"; january = "01"; feb = "02"; february = "02"; mar = "03"; march = "03"
    apr = "04"; april = "04"; may = "05"; jun = "06"; june = "06"; jul = "07"; july = "07"
    aug = "08"; august = "08"; sep = "09"; sept = "09"; september = "09"; oct = "10"; october = "10"
    nov = "11"; november = "11"; dec = "12"; december = "12"
  }

  $clean = Clean-Text $Text
  $m = [regex]::Match($clean, "\b(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})\b")
  if ($m.Success) {
    $month = $months[$m.Groups[2].Value.ToLower()]
    if ($month) { return "{0}-{1}-{2}" -f $m.Groups[3].Value, $month, $m.Groups[1].Value.PadLeft(2, "0") }
  }

  $m = [regex]::Match($clean, "\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b")
  if ($m.Success) {
    $month = $months[$m.Groups[1].Value.ToLower()]
    if ($month) { return "{0}-{1}-{2}" -f $m.Groups[3].Value, $month, $m.Groups[2].Value.PadLeft(2, "0") }
  }

  $m = [regex]::Match($clean, "\b(\d{4})-(\d{2})-(\d{2})\b")
  if ($m.Success) { return $m.Groups[0].Value }
  return ""
}

function Format-DateDisplay([string]$DateIso) {
  $date = [datetime]::ParseExact($DateIso, "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
  return $date.ToString("dd MMMM yyyy", [Globalization.CultureInfo]::GetCultureInfo("en-GB"))
}

function Fetch-Url([string]$Url) {
  try {
    return Fetch-DirectUrl $Url
  }
  catch {
    return Fetch-DirectUrl "https://r.jina.ai/$Url"
  }
}

function Fetch-DirectUrl([string]$Url) {
  $request = [System.Net.HttpWebRequest]::Create($Url)
  $request.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PrintMediaReview/1.0"
  $request.Accept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  $request.Timeout = 8000
  $request.ReadWriteTimeout = 8000
  $response = $request.GetResponse()
  try {
    $stream = $response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    return $reader.ReadToEnd()
  }
  finally {
    $response.Close()
  }
}

function Absolute-Url([string]$Href, [string]$BaseUrl) {
  try {
    $base = [Uri]::new($BaseUrl)
    return ([Uri]::new($base, $Href)).AbsoluteUri
  }
  catch {
    return ""
  }
}

function Looks-LikeTitle([string]$Title) {
  $text = Sanitize-ArticleText $Title
  if ($text.Length -lt 8 -or $text.Length -gt 130) { return $false }
  if ($text -match "https?:|www\.|subscribe|read more|latest|home|videos|sports|business|world|front page|epaper|logo|image|news updates|top stories|today's paper") { return $false }
  if ($text -match "^(opinion|editorial|analysis|pakistan|advertise|careers|national|islamabad|balochistan|back|life & style|magazine)$") { return $false }
  return $true
}

function Extract-Links([string]$Html, [string]$BaseUrl, [string]$UrlAllow) {
  $matches = [regex]::Matches($Html, "(?is)<a\b[^>]*href\s*=\s*[""'](?<href>[^""']+)[""'][^>]*>(?<text>.*?)</a>")
  $links = New-Object System.Collections.Generic.List[object]
  $seen = @{}

  foreach ($match in $matches) {
    $title = Sanitize-ArticleText $match.Groups["text"].Value
    if (-not (Looks-LikeTitle $title)) { continue }

    $url = Absolute-Url $match.Groups["href"].Value $BaseUrl
    if (-not $url) { continue }
    if ($UrlAllow -and $url -notmatch $UrlAllow) { continue }
    if ($url -notmatch "dawn\.com|thenews\.pk|thenews\.com\.pk|tribune\.com\.pk") { continue }
    if ($url -match "/(latest|videos|sports|business|world|pakistan|advertise|jobs|events|images)(/|$)") { continue }

    $key = "$title|$url"
    if ($seen.ContainsKey($key)) { continue }
    $seen[$key] = $true
    $links.Add([pscustomobject]@{ title = $title; url = $url })
    if ($links.Count -ge 16) { break }
  }

  return $links
}

function Extract-MarkdownLinks([string]$Text, [string]$BaseUrl, [string]$UrlAllow) {
  $matches = [regex]::Matches($Text, "(?is)\[(?<text>[^\]]{3,180})\]\((?<href>https?://[^)\s]+)\)")
  $links = New-Object System.Collections.Generic.List[object]
  $seen = @{}

  foreach ($match in $matches) {
    $title = Sanitize-ArticleText $match.Groups["text"].Value
    if (-not (Looks-LikeTitle $title)) { continue }

    $url = Absolute-Url $match.Groups["href"].Value $BaseUrl
    if (-not $url) { continue }
    if ($UrlAllow -and $url -notmatch $UrlAllow) { continue }

    $key = "$title|$url"
    if ($seen.ContainsKey($key)) { continue }
    $seen[$key] = $true
    $links.Add([pscustomobject]@{ title = $title; url = $url })
    if ($links.Count -ge 16) { break }
  }

  return $links
}

function Get-MetaContent([string]$Html, [string[]]$Names) {
  foreach ($name in $Names) {
    $escaped = [regex]::Escape($name)
    $patterns = @(
      "(?is)<meta\b(?=[^>]*(?:name|property)\s*=\s*[""']$escaped[""'])(?=[^>]*content\s*=\s*""(?<content>[^""]*)"")[^>]*>",
      "(?is)<meta\b(?=[^>]*(?:name|property)\s*=\s*[""']$escaped[""'])(?=[^>]*content\s*=\s*'(?<content>[^']*)')[^>]*>"
    )
    foreach ($pattern in $patterns) {
      $match = [regex]::Match($Html, $pattern)
      if ($match.Success) {
        $value = Sanitize-ArticleText $match.Groups["content"].Value
        if ($value -and -not (Is-NoisyText $value)) { return $value }
      }
    }
  }
  return ""
}

function Classify-Theme([string]$Text) {
  $haystack = $Text.ToLower()
  $bestTheme = "State"
  $bestHits = -1
  foreach ($theme in $ThemeKeywords.Keys) {
    $hits = 0
    foreach ($word in $ThemeKeywords[$theme]) {
      if ($haystack.Contains($word)) { $hits++ }
    }
    if ($hits -gt $bestHits) {
      $bestHits = $hits
      $bestTheme = $theme
    }
  }
  return $bestTheme
}

function Theme-Prefix([string]$Theme) {
  switch ($Theme) {
    "State" { return "casts state capacity as the central question;" }
    "Opposition" { return "reads the political contest through opposition pressure;" }
    "Reform" { return "frames reform as the main test;" }
    "Security" { return "treats the issue as a security and stability risk;" }
    "Civil liberties" { return "places rights and civic protections at the centre;" }
    default { return "frames the argument as a national governance concern;" }
  }
}

function Make-Item([string]$Title, [string]$Author, [string]$Teaser, [string]$Url, [string]$DateIso) {
  $cleanTitle = Normalize-Title $Title
  $cleanTeaser = Sanitize-ArticleText $Teaser
  if (Is-NoisyText $cleanTeaser) { $cleanTeaser = "" }
  $theme = Classify-Theme "$cleanTitle $cleanTeaser"
  if ($cleanTeaser.Length -gt 24) {
    $summary = "$(Theme-Prefix $theme) $($cleanTeaser.Substring(0, [Math]::Min(210, $cleanTeaser.Length)))."
  }
  else {
    $summary = "$(Theme-Prefix $theme) tracks the argument around $($cleanTitle.ToLower()) and places it inside Pakistan's daily policy debate."
  }
  $tone = if (($theme -eq "State") -or ($summary.ToLower() -match "china|reform|resilience")) { "positive" } else { "critical" }

  return [pscustomobject]@{
    title = $cleanTitle
    author = if ($Author) { Sanitize-ArticleText $Author } else { "Editorial" }
    theme = $theme
    tone = $tone
    summary = Sanitize-ArticleText $summary
    url = $Url
    dateIso = $DateIso
  }
}

function Extract-Article([object]$Link, [string]$TargetDateIso, [bool]$AssumeUrlDate) {
  try {
    $html = Fetch-Url $Link.url
  }
  catch {
    return $null
  }

  $title = Get-MetaContent $html @("og:title", "twitter:title")
  if (-not $title) {
    $m = [regex]::Match($html, "(?is)<h1[^>]*>(?<text>.*?)</h1>")
    if ($m.Success) {
      $title = Sanitize-ArticleText $m.Groups["text"].Value
    }
    else {
      $m = [regex]::Match($html, "(?im)^Title:\s*(?<text>.+)$")
      $title = if ($m.Success) { Sanitize-ArticleText $m.Groups["text"].Value } else { $Link.title }
    }
  }

  $author = Get-MetaContent $html @("author", "article:author")
  if (-not $author) {
    $m = [regex]::Match((Clean-Text $html), "\bBy\s+([A-Z][A-Za-z.' -]{2,55})\b")
    $author = if ($m.Success) { $m.Groups[1].Value.Trim() } else { "Editorial" }
  }

  $dateIso = Date-IsoFromText $html
  if (-not $dateIso -and $AssumeUrlDate) { $dateIso = $TargetDateIso }
  if ($dateIso -ne $TargetDateIso) { return $null }

  $teaser = Get-MetaContent $html @("og:description", "description", "twitter:description")
  if (-not $teaser) {
    $m = [regex]::Match($html, "(?is)<p[^>]*>(?<text>.*?)</p>")
    if ($m.Success) {
      $teaser = Sanitize-ArticleText $m.Groups["text"].Value
    }
    else {
      $line = ($html -split "`n" | Where-Object { (Sanitize-ArticleText $_).Length -gt 60 -and -not (Is-NoisyText $_) } | Select-Object -First 1)
      if ($line) { $teaser = Sanitize-ArticleText $line }
    }
  }

  return Make-Item $title $author $teaser $Link.url $dateIso
}

function Score-Section([object[]]$Items) {
  $scores = @{}
  foreach ($name in $ScoreNames) { $scores[$name] = 2.5 }
  foreach ($item in $Items) {
    $scores[$item.theme] = [Math]::Min(5, $scores[$item.theme] + 0.55)
    $text = "$($item.title) $($item.summary)".ToLower()
    foreach ($name in $ScoreNames) {
      foreach ($word in $ThemeKeywords[$name]) {
        if ($text.Contains($word)) { $scores[$name] = [Math]::Min(5, $scores[$name] + 0.12) }
      }
    }
  }
  $result = [ordered]@{}
  foreach ($name in $ScoreNames) { $result[$name] = [Math]::Round($scores[$name] * 2) / 2 }
  return $result
}

function Empty-Scores {
  $result = [ordered]@{}
  foreach ($name in $ScoreNames) { $result[$name] = 0 }
  return $result
}

function Unavailable-Section([string]$Source, [string]$Message) {
  return [pscustomobject]@{
    source = $Source
    status = "blocked"
    error = $Message
    scores = Empty-Scores
    items = @([pscustomobject]@{
      title = "Scrape unavailable"
      author = "Target website"
      theme = "State"
      tone = "critical"
      summary = "could not scrape matching articles from the target website for the selected date."
      url = ""
      dateIso = ""
    })
  }
}

function Scrape-Source([hashtable]$Source, [string]$TargetDateIso) {
  try {
    $items = New-Object System.Collections.Generic.List[object]
    foreach ($url in $Source.urls.Invoke($TargetDateIso)) {
      $html = Fetch-Url $url
      $links = if ($html.TrimStart().StartsWith("<")) {
        Extract-Links $html $url $Source.urlAllow
      }
      else {
        Extract-MarkdownLinks $html $url $Source.urlAllow
      }
      $attempted = 0
      foreach ($link in $links) {
        if ($attempted -ge 12) { break }
        $attempted++
        $item = Extract-Article $link $TargetDateIso ([bool]$Source.assumeUrlDate)
        if ($item) {
          $items.Add($item)
          if ($items.Count -ge 7) { break }
        }
      }
      if ($items.Count -ge 7) { break }
    }

    if ($items.Count -eq 0) {
      throw "No matching articles found for $(Format-DateDisplay $TargetDateIso)"
    }

    return [pscustomobject]@{
      source = $Source.name
      status = "scraped"
      scores = Score-Section $items.ToArray()
      items = $items.ToArray()
    }
  }
  catch {
    return Unavailable-Section $Source.name $_.Exception.Message
  }
}

function Estimate-ReadTime([object[]]$Sections) {
  $words = 0
  foreach ($section in $Sections) {
    foreach ($item in $section.items) {
      $words += ("$($item.title) $($item.author) $($item.summary)" -split "\s+").Count
    }
  }
  return "Approx reading time: $([Math]::Max(2, [Math]::Ceiling($words / 220))) minutes"
}

function Build-Report([string]$DateIso) {
  $sources = @(
    @{
      name = "Dawn"
      urls = { param($d) @("https://www.dawn.com/newspaper/column", "https://www.dawn.com/newspaper/editorial") }
      urlAllow = "dawn\.com/news/\d+"
      assumeUrlDate = $false
    },
    @{
      name = "The News International"
      urls = { param($d) @("https://www.thenews.com.pk/print/category/opinion") }
      urlAllow = "thenews\.(pk|com\.pk)/print/\d+-"
      assumeUrlDate = $false
    },
    @{
      name = "The Express Tribune"
      urls = { param($d) @("https://tribune.com.pk/listing/opinion/$d") }
      urlAllow = "tribune\.com\.pk/story/\d+"
      assumeUrlDate = $true
    }
  )

  $sections = @()
  foreach ($source in $sources) {
    $sections += Scrape-Source $source $DateIso
  }

  return [pscustomobject]@{
    date = Format-DateDisplay $DateIso
    readTime = Estimate-ReadTime $sections
    fetchWindow = "Date filter: only $(Format-DateDisplay $DateIso) articles/op-eds"
    fetchedAt = "Scraped: $((Get-Date).ToString("dd MMMM yyyy, HH:mm zzz", [Globalization.CultureInfo]::GetCultureInfo("en-GB")))"
    sections = $sections
  }
}

function Send-Json($Context, $Data, [int]$StatusCode = 200) {
  $json = $Data | ConvertTo-Json -Depth 12
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $Context.Response.StatusCode = $StatusCode
  $Context.Response.ContentType = "application/json; charset=utf-8"
  $Context.Response.Headers.Add("Access-Control-Allow-Origin", "*")
  $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Send-File($Context, [string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    $Context.Response.StatusCode = 404
    return
  }
  $extension = [IO.Path]::GetExtension($Path).ToLowerInvariant()
  $types = @{
    ".html" = "text/html; charset=utf-8"
    ".css" = "text/css; charset=utf-8"
    ".js" = "application/javascript; charset=utf-8"
  }
  $bytes = [IO.File]::ReadAllBytes($Path)
  $Context.Response.ContentType = if ($types[$extension]) { $types[$extension] } else { "application/octet-stream" }
  $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Query-Value([string]$Query, [string]$Name) {
  $pairs = $Query.TrimStart("?").Split("&", [StringSplitOptions]::RemoveEmptyEntries)
  foreach ($pair in $pairs) {
    $parts = $pair.Split("=", 2)
    if ([Uri]::UnescapeDataString($parts[0]) -eq $Name) {
      return [Uri]::UnescapeDataString($parts[1])
    }
  }
  return ""
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Print Media Review server running at $prefix"
Write-Host "Press Ctrl+C to stop."

while ($listener.IsListening) {
  $context = $listener.GetContext()
  try {
    $path = $context.Request.Url.AbsolutePath
    if ($context.Request.HttpMethod -eq "OPTIONS") {
      $context.Response.Headers.Add("Access-Control-Allow-Origin", "*")
      $context.Response.Headers.Add("Access-Control-Allow-Methods", "GET, OPTIONS")
      $context.Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
      $context.Response.StatusCode = 204
    }
    elseif ($path -eq "/api/report") {
      $date = Query-Value $context.Request.Url.Query "date"
      if ($date -notmatch "^\d{4}-\d{2}-\d{2}$") {
        Send-Json $context ([pscustomobject]@{ error = "Invalid date. Use YYYY-MM-DD." }) 400
      }
      else {
        Send-Json $context (Build-Report $date)
      }
    }
    else {
      $relative = if ($path -eq "/") { "index.html" } else { $path.TrimStart("/") }
      $safePath = Join-Path $Root $relative
      Send-File $context $safePath
    }
  }
  catch {
    Send-Json $context ([pscustomobject]@{ error = $_.Exception.Message }) 500
  }
  finally {
    $context.Response.OutputStream.Close()
  }
}
