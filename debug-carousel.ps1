$filePath = "c:\Users\Administrator\Karga\frontend\src\components\HeroCarousel.jsx"
$content = Get-Content $filePath -Raw

# Use regex with flexible whitespace
$pattern = @"
\{\s*{/\* Icon \+ Headline row \*/}[\s\S]*?{/\* Subtext \*/}[\s\S]*?{sub}[\s\S]*?</p>
"@

# More targeted: find from "Icon + Headline row" comment to end of subtext <p> tag
$pattern = @"
\{/\* Icon \+ Headline row \*/\}[\s\S]*?\{sub\}\s*</p>
"@

Write-Host "Searching for pattern..."
if ($content -match $pattern) {
  Write-Host "Found matching pattern!"
} else {
  Write-Host "Pattern not found. Trying simpler search..."
  
  # Try finding just the opening comment
  if ($content -match "{/\* Icon \+ Headline row \*/}") {
    Write-Host "Found Icon + Headline comment!"
    
    # Find the index
    $startIdx = $content.IndexOf("{/* Icon + Headline row */}")
    Write-Host "Start index: $startIdx"
    
    # Find the end (Pill badges section)
    $endIdx = $content.IndexOf("{/* Pill badges */}", $startIdx)
    Write-Host "End index: $endIdx"
    
    if ($startIdx -gt 0 -and $endIdx -gt $startIdx) {
      $section = $content.Substring($startIdx, $endIdx - $startIdx)
      Write-Host "Section length: $($section.Length)"
      Write-Host "First 200 chars:"
      Write-Host ($section.Substring(0, 200))
    }
  } else {
    Write-Host "Could not find Icon + Headline comment"
  }
}
