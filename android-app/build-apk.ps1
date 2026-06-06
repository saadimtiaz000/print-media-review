$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$SdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$BuildTools = Join-Path $SdkRoot "build-tools\37.0.0"
$Platform = Join-Path $SdkRoot "platforms\android-36.1"
$JavaHome = "C:\Program Files\Android\Android Studio\jbr"
$env:JAVA_HOME = $JavaHome
$env:Path = (Join-Path $JavaHome "bin") + ";" + $env:Path

$Aapt2 = Join-Path $BuildTools "aapt2.exe"
$Aapt = Join-Path $BuildTools "aapt.exe"
$D8 = Join-Path $BuildTools "d8.bat"
$ZipAlign = Join-Path $BuildTools "zipalign.exe"
$ApkSigner = Join-Path $BuildTools "apksigner.bat"
$AndroidJar = Join-Path $Platform "android.jar"
$Javac = Join-Path $JavaHome "bin\javac.exe"
$Keytool = Join-Path $JavaHome "bin\keytool.exe"

$AppDir = Join-Path $ProjectRoot "app\src\main"
$Manifest = Join-Path $AppDir "AndroidManifest.xml"
$ResDir = Join-Path $AppDir "res"
$AssetDir = Join-Path $AppDir "assets"
$SrcDir = Join-Path $AppDir "java"
$BuildDir = Join-Path $ProjectRoot "build"
$CompiledRes = Join-Path $BuildDir "compiled.zip"
$GenDir = Join-Path $BuildDir "gen"
$ClassesDir = Join-Path $BuildDir "classes"
$DexDir = Join-Path $BuildDir "dex"
$UnsignedApk = Join-Path $BuildDir "unsigned.apk"
$UnalignedApk = Join-Path $BuildDir "unaligned.apk"
$AlignedApk = Join-Path $BuildDir "aligned.apk"
$FinalApk = Join-Path $ProjectRoot "..\PrintMediaReview.apk"
$Keystore = Join-Path $ProjectRoot "debug.keystore"

function Invoke-Tool {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code $LASTEXITCODE`: $FilePath $($Arguments -join ' ')"
  }
}

Remove-Item $BuildDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $BuildDir, $GenDir, $ClassesDir, $DexDir | Out-Null

if (!(Test-Path $AssetDir)) {
  throw "Assets directory not found: $AssetDir"
}
$assetFiles = Get-ChildItem -Path $AssetDir -Recurse -File
if ($assetFiles.Count -eq 0) {
  throw "No asset files were found in $AssetDir. Place report JSON files under assets/archive/<date>/report.json."
}

Invoke-Tool $Aapt2 @("compile", "--dir", $ResDir, "-o", $CompiledRes)
Invoke-Tool $Aapt2 @("link", "-o", $UnsignedApk, "-I", $AndroidJar, "--manifest", $Manifest, "-A", $AssetDir, "-R", $CompiledRes, "--java", $GenDir, "--auto-add-overlay")

$JavaFiles = @()
$JavaFiles += Get-ChildItem -Path $SrcDir -Recurse -Filter *.java | ForEach-Object { $_.FullName }
$JavaFiles += Get-ChildItem -Path $GenDir -Recurse -Filter *.java | ForEach-Object { $_.FullName }
Invoke-Tool $Javac (@("-encoding", "UTF-8", "-source", "8", "-target", "8", "-classpath", $AndroidJar, "-d", $ClassesDir) + $JavaFiles)

$ClassFiles = Get-ChildItem -Path $ClassesDir -Recurse -Filter *.class | ForEach-Object { $_.FullName }
Invoke-Tool $D8 (@("--lib", $AndroidJar, "--output", $DexDir) + $ClassFiles)

Copy-Item $UnsignedApk $UnalignedApk -Force
Push-Location $DexDir
try {
  Invoke-Tool $Aapt @("add", $UnalignedApk, "classes.dex")
} finally {
  Pop-Location
}

Invoke-Tool $ZipAlign @("-f", "-p", "4", $UnalignedApk, $AlignedApk)

if (!(Test-Path $Keystore)) {
  Invoke-Tool $Keytool @("-genkeypair", "-v", "-keystore", $Keystore, "-storepass", "android", "-alias", "androiddebugkey", "-keypass", "android", "-dname", "CN=Android Debug,O=Android,C=US", "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000")
}

Invoke-Tool $ApkSigner @("sign", "--ks", $Keystore, "--ks-pass", "pass:android", "--key-pass", "pass:android", "--out", $FinalApk, $AlignedApk)
Invoke-Tool $ApkSigner @("verify", $FinalApk)

Get-Item $FinalApk | Select-Object FullName, Length, LastWriteTime
