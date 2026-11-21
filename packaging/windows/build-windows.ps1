#Requires -Version 5.1
<#
.SYNOPSIS
    Builds TataCAD for Windows x64 and packages it as a .zip and (optionally)
    an Inno Setup installer.

.DESCRIPTION
    Runs on a Windows x64 machine with Visual Studio 2022 (C++ workload), Git,
    CMake, Ninja and Python. Steps:
      1. import the MSVC x64 build environment (vswhere + vcvars64.bat)
      2. install Qt with aqtinstall if it is not there yet
      3. fetch the pinned qtjsapi / qcadjsapi repositories (JavaScript engine plugin)
      4. build TataCAD, qtjsapi and qcadjsapi (Release, Ninja)
      5. stage dist\TataCAD with windeployqt and the MSVC runtime DLLs
      6. zip it and, if Inno Setup 6 is installed, build the installer

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File packaging\windows\build-windows.ps1

.EXAMPLE
    .\packaging\windows\build-windows.ps1 -QtVersion 6.9.0 -QtRoot D:\Qt -SkipInstaller
#>
[CmdletBinding()]
param(
    [string]$QtVersion = "6.9.0",
    [string]$QtRoot = "C:\Qt",
    [string]$QtArch = "win64_msvc2022_64",
    [string]$OutDir = "",
    # Release builds pass e.g. 27.0.7.42; default is the version from RVersion.h.
    [string]$Version = "",
    [int]$Jobs = [Environment]::ProcessorCount,
    [switch]$SkipInstaller,
    [switch]$Clean
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if (-not $OutDir) {
    $OutDir = Join-Path $RepoRoot "dist"
}

# Pinned so a package is reproducible; the commits the macOS build was verified with.
$JsApiRepos = @(
    @{ Name = "qtjsapi";   Url = "https://github.com/qcad/qtjsapi.git";   Commit = "bc46cc865d595160b5f447782260d42ce567abf7" },
    @{ Name = "qcadjsapi"; Url = "https://github.com/qcad/qcadjsapi.git"; Commit = "afd25cfe1e1358535be47d024342319c847cd7af" }
)

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Native {
    param([string]$FilePath, [string[]]$ArgumentList)
    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        throw "'$FilePath $($ArgumentList -join ' ')' failed with exit code $LASTEXITCODE"
    }
}

function Assert-Tool([string]$Name, [string]$Hint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "'$Name' not found on PATH. $Hint"
    }
}

function Import-MsvcEnvironment {
    if ($env:VCINSTALLDIR -and (Get-Command cl.exe -ErrorAction SilentlyContinue)) {
        Write-Host "MSVC environment already active ($env:VCINSTALLDIR)"
        return
    }
    $vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
    if (-not (Test-Path $vswhere)) {
        throw "vswhere.exe not found. Install Visual Studio 2022 or Build Tools 2022 with the 'Desktop development with C++' workload."
    }
    $vsPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if (-not $vsPath) {
        throw "No Visual Studio installation with the x64 C++ tools found."
    }
    $vcvars = Join-Path $vsPath "VC\Auxiliary\Build\vcvars64.bat"
    Write-Host "Using $vcvars"
    $envDump = & cmd.exe /c "`"$vcvars`" >nul && set"
    if ($LASTEXITCODE -ne 0) {
        throw "vcvars64.bat failed"
    }
    foreach ($line in $envDump) {
        if ($line -match "^([^=]+)=(.*)$") {
            Set-Item -Path "env:$($Matches[1])" -Value $Matches[2]
        }
    }
}

function Get-QtDir {
    # aqt arch "win64_msvc2022_64" installs into "<root>\<version>\msvc2022_64"
    $archDir = $QtArch -replace "^win64_", ""
    $qtDir = Join-Path $QtRoot (Join-Path $QtVersion $archDir)
    $compatConfig = Join-Path $qtDir "lib\cmake\Qt6Core5Compat\Qt6Core5CompatConfig.cmake"
    if (-not (Test-Path $compatConfig)) {
        Write-Host "Qt $QtVersion ($QtArch) with Qt5Compat not found in $qtDir, installing with aqtinstall"
        Invoke-Native python @("-m", "pip", "install", "--upgrade", "aqtinstall")
        Invoke-Native python @("-m", "aqt", "install-qt", "windows", "desktop", $QtVersion, $QtArch,
                               "-m", "qt5compat", "--outputdir", $QtRoot)
    }
    if (-not (Test-Path $compatConfig)) {
        throw "Qt installation incomplete: $compatConfig missing"
    }
    return $qtDir
}

function Get-AppVersion {
    $header = Get-Content (Join-Path $RepoRoot "src\core\RVersion.h") -Raw
    $parts = foreach ($key in "MAJOR", "MINOR", "REV", "BUILD") {
        if ($header -notmatch "#define\s+R_QCAD_VERSION_$key\s+(\d+)") {
            throw "R_QCAD_VERSION_$key not found in RVersion.h"
        }
        $Matches[1]
    }
    return ($parts -join ".")
}

function Add-GitExclude([string[]]$Patterns) {
    $exclude = Join-Path $RepoRoot ".git\info\exclude"
    if (-not (Test-Path $exclude)) {
        return
    }
    $existing = Get-Content $exclude
    foreach ($p in $Patterns) {
        if ($existing -notcontains $p) {
            Add-Content -Path $exclude -Value $p
        }
    }
}

function Sync-JsApiRepos([string]$JsDir) {
    New-Item -ItemType Directory -Force -Path $JsDir | Out-Null
    foreach ($repo in $JsApiRepos) {
        $dir = Join-Path $JsDir $repo.Name
        if (-not (Test-Path (Join-Path $dir ".git"))) {
            Write-Host "Fetching $($repo.Name) @ $($repo.Commit)"
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
            Invoke-Native git @("-C", $dir, "init", "-q")
            Invoke-Native git @("-C", $dir, "remote", "add", "origin", $repo.Url)
        }
        # A freshly initialised repo has no HEAD; git's stderr must not abort the script.
        $head = $null
        $previous = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            $head = (& git -C $dir rev-parse HEAD 2>$null)
        }
        finally {
            $ErrorActionPreference = $previous
        }
        if ($head -ne $repo.Commit) {
            Invoke-Native git @("-C", $dir, "fetch", "-q", "--depth", "1", "origin", $repo.Commit)
            Invoke-Native git @("-C", $dir, "checkout", "-q", "--detach", "FETCH_HEAD")
        }
        Write-Host "$($repo.Name): $($repo.Commit)"
    }

    # The jsapi CMake projects expect the QCAD sources in a sibling folder "qcad".
    $link = Join-Path $JsDir "qcad"
    if (-not (Test-Path $link)) {
        New-Item -ItemType Junction -Path $link -Target $RepoRoot | Out-Null
    }
}

function Build-CMakeProject([string]$SourceDir, [string]$BuildDir, [string]$QtDir) {
    Invoke-Native cmake @("-S", $SourceDir, "-B", $BuildDir, "-G", "Ninja",
                          "-DBUILD_QT6=ON", "-DCMAKE_BUILD_TYPE=Release",
                          "-DCMAKE_PREFIX_PATH=$QtDir")
    Invoke-Native cmake @("--build", $BuildDir, "--parallel", "$Jobs")
}

function Copy-Tree([string]$Source, [string]$Destination, [string[]]$ExcludeDirs = @()) {
    if (-not (Test-Path $Source)) {
        Write-Warning "Skipping missing folder $Source"
        return
    }
    Copy-Item -Path $Source -Destination $Destination -Recurse -Force
    foreach ($name in $ExcludeDirs) {
        Get-ChildItem -Path $Destination -Directory -Recurse -Filter $name -ErrorAction SilentlyContinue |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Copy-MsvcRuntime([string]$Stage) {
    # App-local CRT so the .zip also runs on machines without the VC++ redistributable.
    if (-not $env:VCToolsRedistDir) {
        Write-Warning "VCToolsRedistDir not set; MSVC runtime DLLs not bundled (users need the VC++ 2015-2022 x64 redistributable)."
        return
    }
    $crt = Get-ChildItem -Path (Join-Path $env:VCToolsRedistDir "x64") -Directory -Filter "Microsoft.VC*.CRT" |
        Sort-Object Name -Descending | Select-Object -First 1
    if (-not $crt) {
        Write-Warning "No Microsoft.VC*.CRT folder in $env:VCToolsRedistDir\x64; MSVC runtime not bundled."
        return
    }
    Copy-Item -Path (Join-Path $crt.FullName "*.dll") -Destination $Stage -Force
    Write-Host "Bundled MSVC runtime from $($crt.FullName)"
}

function Find-InnoSetup {
    $cmd = Get-Command iscc.exe -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }
    foreach ($base in @(${env:ProgramFiles(x86)}, $env:ProgramFiles, (Join-Path $env:LOCALAPPDATA "Programs"))) {
        if (-not $base) { continue }
        $candidate = Join-Path $base "Inno Setup 6\ISCC.exe"
        if (Test-Path $candidate) {
            return $candidate
        }
    }
    return $null
}

# ---------------------------------------------------------------------------

if (-not [Environment]::Is64BitOperatingSystem) {
    throw "A 64-bit Windows is required to build the x64 package."
}

Write-Step "Checking tools"
Assert-Tool git "Install Git for Windows: https://git-scm.com/download/win"
Assert-Tool cmake "Install CMake 3.16+ (also included with Visual Studio's C++ CMake tools)."
Assert-Tool ninja "Install Ninja (winget install Ninja-build.Ninja) or use the one bundled with Visual Studio."
Assert-Tool python "Install Python 3 (needed for aqtinstall to download Qt)."

Write-Step "Setting up MSVC x64 environment"
Import-MsvcEnvironment
Assert-Tool cl.exe "The MSVC environment could not be loaded."

Write-Step "Qt $QtVersion ($QtArch)"
$QtDir = Get-QtDir
Write-Host "Qt: $QtDir"
$windeployqt = Join-Path $QtDir "bin\windeployqt.exe"
if (-not (Test-Path $windeployqt)) {
    throw "windeployqt.exe not found in $QtDir\bin"
}

if (-not $Version) {
    $Version = Get-AppVersion
}
Write-Host "TataCAD version: $Version"

$JsDir = Join-Path $RepoRoot "jsapi"
$BuildDirs = @(
    (Join-Path $RepoRoot "build-win"),
    (Join-Path $JsDir "qtjsapi\build-win"),
    (Join-Path $JsDir "qcadjsapi\build-win")
)
Add-GitExclude @("/jsapi/", "/build-win/", "/dist/", "/release/", "/debug/", "/plugins/")

if ($Clean) {
    Write-Step "Cleaning previous build output"
    foreach ($d in $BuildDirs + @((Join-Path $RepoRoot "release"), (Join-Path $RepoRoot "plugins"), $OutDir)) {
        if (Test-Path $d) {
            Remove-Item -Recurse -Force $d
        }
    }
}

Write-Step "Fetching JavaScript API repositories"
Sync-JsApiRepos $JsDir

Write-Step "Building TataCAD"
Build-CMakeProject $RepoRoot $BuildDirs[0] $QtDir

Write-Step "Building qtjsapi"
Build-CMakeProject (Join-Path $JsDir "qtjsapi") $BuildDirs[1] $QtDir

Write-Step "Building qcadjsapi"
Build-CMakeProject (Join-Path $JsDir "qcadjsapi") $BuildDirs[2] $QtDir

Write-Step "Staging package"
$ReleaseDir = Join-Path $RepoRoot "release"
$PluginDir = Join-Path $RepoRoot "plugins"
$exe = Join-Path $ReleaseDir "qcad.exe"
if (-not (Test-Path $exe)) {
    throw "Build output $exe not found"
}
foreach ($required in "qcadjsapi.dll", "qcadscripts.dll") {
    if (-not (Test-Path (Join-Path $PluginDir $required))) {
        throw "Plugin $required missing in $PluginDir; without it the application starts with no menus or tools."
    }
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$Stage = Join-Path $OutDir "TataCAD"
if (Test-Path $Stage) {
    Remove-Item -Recurse -Force $Stage
}
New-Item -ItemType Directory -Force -Path (Join-Path $Stage "plugins") | Out-Null

Get-ChildItem -Path $ReleaseDir -File |
    Where-Object { $_.Extension -in ".exe", ".com", ".dll" } |
    Copy-Item -Destination $Stage
Get-ChildItem -Path $PluginDir -File -Filter *.dll | Copy-Item -Destination (Join-Path $Stage "plugins")
# Custom widgets (RCommandLine, RMathLineEdit, ...) used by the .ui files;
# without them the main window fails to load:
New-Item -ItemType Directory -Force -Path (Join-Path $Stage "plugins\designer") | Out-Null
Get-ChildItem -Path (Join-Path $PluginDir "designer") -File -Filter *.dll |
    Copy-Item -Destination (Join-Path $Stage "plugins\designer")
Copy-Item (Join-Path $RepoRoot "qt.conf") $Stage

foreach ($dir in "fonts", "patterns", "linetypes", "themes", "libraries", "examples") {
    Copy-Tree (Join-Path $RepoRoot $dir) (Join-Path $Stage $dir)
}
# Scripts are also compiled into plugins\qcadscripts.dll; shipping them on disk
# matches the layout the macOS build was tested with (files on disk win).
Copy-Tree (Join-Path $RepoRoot "scripts") (Join-Path $Stage "scripts") @("Tests", "TestsClaude", "doc")

New-Item -ItemType Directory -Force -Path (Join-Path $Stage "ts") | Out-Null
Get-ChildItem -Path (Join-Path $RepoRoot "ts") -File -Filter *.qm |
    Where-Object { $_.Name -notmatch "^(assistant|designer|linguist)_" } |
    Copy-Item -Destination (Join-Path $Stage "ts")

foreach ($doc in "LICENSE.txt", "gpl-3.0.txt", "gpl-3.0-exceptions.txt", "lgpl.txt", "cc-by-3.0.txt", "readme.txt") {
    $p = Join-Path $RepoRoot $doc
    if (Test-Path $p) {
        Copy-Item $p $Stage
    }
}
$sourceNote = @"
TataCAD $Version is based on QCAD (https://github.com/qcad/qcad) and is
distributed under the GNU General Public License v3 (see gpl-3.0.txt).

The complete corresponding source code must be made available together with
these binaries, including the JavaScript API plugin sources:
  https://github.com/qcad/qtjsapi   @ $($JsApiRepos[0].Commit)
  https://github.com/qcad/qcadjsapi @ $($JsApiRepos[1].Commit)
"@
Set-Content -Path (Join-Path $Stage "SOURCE.txt") -Value $sourceNote -Encoding UTF8

Write-Step "Deploying Qt (windeployqt)"
$deployTargets = @($exe) +
    (Get-ChildItem -Path $Stage -File -Filter *.dll | ForEach-Object FullName) +
    (Get-ChildItem -Path (Join-Path $Stage "plugins") -File -Filter *.dll | ForEach-Object FullName) +
    (Get-ChildItem -Path (Join-Path $Stage "plugins\designer") -File -Filter *.dll | ForEach-Object FullName)
Invoke-Native $windeployqt (@("--release", "--no-translations", "--no-compiler-runtime",
                              "--dir", $Stage, "--plugindir", (Join-Path $Stage "plugins")) + $deployTargets)
Copy-MsvcRuntime $Stage

Write-Step "Creating zip"
$zip = Join-Path $OutDir "TataCAD-$Version-win-x64.zip"
if (Test-Path $zip) {
    Remove-Item -Force $zip
}
Compress-Archive -Path $Stage -DestinationPath $zip
Write-Host "Created $zip"

if ($SkipInstaller) {
    Write-Host "Installer skipped (-SkipInstaller)."
}
else {
    $iscc = Find-InnoSetup
    if (-not $iscc) {
        Write-Warning "Inno Setup 6 (ISCC.exe) not found; only the zip was created. Install it with: winget install JRSoftware.InnoSetup"
    }
    else {
        Write-Step "Building installer (Inno Setup)"
        Invoke-Native $iscc @("/Q", "/DAppVersion=$Version", "/DSourceDir=$Stage", "/DOutputDir=$OutDir",
                              (Join-Path $PSScriptRoot "tatacad.iss"))
        Write-Host "Created $(Join-Path $OutDir "TataCAD-$Version-win-x64-setup.exe")"
    }
}

Write-Step "Done"
