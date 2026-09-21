$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

Copy-Item "$PSScriptRoot\package.local.json" "$Root\package.json" -Force
if (-not (Test-Path "$Root\.dev.vars.example")) {
  Copy-Item "$PSScriptRoot\dev-vars.example" "$Root\.dev.vars.example"
}
if (-not (Test-Path "$Root\.dev.vars")) {
  Copy-Item "$PSScriptRoot\dev-vars.example" "$Root\.dev.vars"
}

$ignoreLines = Get-Content "$PSScriptRoot\gitignore.local"
$existing = @()
if (Test-Path "$Root\.gitignore") { $existing = Get-Content "$Root\.gitignore" }
$merged = @($existing + $ignoreLines) | Where-Object { $_ -ne $null } | Select-Object -Unique
[System.IO.File]::WriteAllLines("$Root\.gitignore", $merged, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "[local] package.json / .dev.vars / .dev.vars.example / .gitignore 준비 완료"
Write-Host "[local] 실제 Secret은 .dev.vars에만 넣으세요."
Write-Host "[local] Wrangler 설치 중..."
npm install
Write-Host "[local] 완료. 다음부터 npm run dev 로 실행하세요."
