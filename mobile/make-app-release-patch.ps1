param(
  [string]$Message = "새 버전의 셩냥책을 사용할 수 있어요.",
  [ValidateSet("debug","release")]
  [string]$BuildType = "debug"
)

$ErrorActionPreference = "Stop"

$MobileRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $MobileRoot
$GradlePath = Join-Path $MobileRoot "android\app\build.gradle"

if (-not (Test-Path $GradlePath)) {
  throw "android\app\build.gradle을 찾지 못했습니다."
}

$Gradle = Get-Content $GradlePath -Raw

$VersionMatch = [regex]::Match($Gradle, 'versionName\s+"([^"]+)"')
$BuildMatch = [regex]::Match($Gradle, 'versionCode\s+(\d+)')

if (-not $VersionMatch.Success -or -not $BuildMatch.Success) {
  throw "build.gradle에서 versionName/versionCode를 읽지 못했습니다."
}

$Version = $VersionMatch.Groups[1].Value
$Build = [int]$BuildMatch.Groups[1].Value

if ($BuildType -eq "release") {
  $ApkPath = Join-Path $MobileRoot "android\app\build\outputs\apk\release\app-release.apk"
} else {
  $ApkPath = Join-Path $MobileRoot "android\app\build\outputs\apk\debug\app-debug.apk"
}

if (-not (Test-Path $ApkPath)) {
  throw "APK를 찾지 못했습니다: $ApkPath`nAndroid Studio에서 먼저 APK를 생성해 주세요."
}

$ApkName = "syungbook-v$Version.apk"
$DownloadUrl = "https://rjs-cj6.pages.dev/downloads/$ApkName"

$ReleaseDir = Join-Path $MobileRoot "releases"
$StageDir = Join-Path $env:TEMP "syungbook-admin-release-$Version-$Build"
$ZipPath = Join-Path $ReleaseDir "syungbook-v$Version-admin-deploy.zip"

if (Test-Path $StageDir) {
  Remove-Item $StageDir -Recurse -Force
}
New-Item -ItemType Directory -Path (Join-Path $StageDir "public\downloads") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $StageDir "functions\api") -Force | Out-Null
New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null

Copy-Item $ApkPath (Join-Path $StageDir "public\downloads\$ApkName") -Force

$Payload = [ordered]@{
  enabled = $true
  version = $Version
  build = $Build
  message = $Message
  downloadUrl = $DownloadUrl
}
$PayloadJson = $Payload | ConvertTo-Json -Compress

$VersionJs = @"
import { jsonResponse } from "../_shared.js";

export async function onRequestGet() {
  return jsonResponse(
    $PayloadJson,
    200,
    {
      "cache-control": "no-store"
    }
  );
}
"@

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText(
  (Join-Path $StageDir "functions\api\mobile-version.js"),
  $VersionJs,
  $Utf8NoBom
)

if (Test-Path $ZipPath) {
  Remove-Item $ZipPath -Force
}

Compress-Archive -Path (Join-Path $StageDir "*") -DestinationPath $ZipPath -CompressionLevel Optimal

$ApkMb = [math]::Round((Get-Item $ApkPath).Length / 1MB, 2)

Write-Host ""
Write-Host "셩냥책 앱 배포 ZIP 생성 완료" -ForegroundColor Green
Write-Host "버전        : v$Version (build $Build)"
Write-Host "빌드 종류   : $BuildType"
Write-Host "APK 용량    : $ApkMb MB"
Write-Host "다운로드 URL: $DownloadUrl"
Write-Host "배포 ZIP     : $ZipPath"
Write-Host ""
Write-Host "이 ZIP을 기존 관리자 > 배포 탭에 그대로 넣으면 됩니다." -ForegroundColor Cyan
Write-Host "ZIP 내용:"
Write-Host "  public/downloads/$ApkName"
Write-Host "  functions/api/mobile-version.js"
