$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$toolsRoot = Join-Path $repoRoot '.tools'
$toolchainRoot = Join-Path $toolsRoot 'mingw64'
$compilerPath = Join-Path $toolchainRoot 'bin\g++.exe'
$expectedGccVersion = '16.1.0'

if (Test-Path -LiteralPath $compilerPath -PathType Leaf) {
    $currentVersion = (& $compilerPath --version 2>$null | Select-Object -First 1) -join ''
    if ($currentVersion -match [regex]::Escape($expectedGccVersion)) {
        Write-Output "MinGW-w64 $expectedGccVersion is ready: $compilerPath"
        exit 0
    }
}

$downloadUrl = 'https://github.com/brechtsanders/winlibs_mingw/releases/download/16.1.0posix-14.0.0-ucrt-r2/winlibs-x86_64-posix-seh-gcc-16.1.0-mingw-w64ucrt-14.0.0-r2.zip'
$downloadName = 'winlibs-x86_64-posix-seh-gcc-16.1.0-mingw-w64ucrt-14.0.0-r2.zip'
$expectedSha256 = '78eff1e2e804b6a6320c713f084b8f820c662104a24cea6a3bfcab82032bdd60'
$id = [Guid]::NewGuid().ToString('N')
$archivePath = Join-Path $toolsRoot "mingw-$id.zip"
$stagingRoot = Join-Path $toolsRoot "mingw-stage-$id"
$backupRoot = Join-Path $toolsRoot "mingw-previous-$id"

New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null

try {
    $cachedDownload = if ($env:CP_STUDIO_DOWNLOADS) { Join-Path $env:CP_STUDIO_DOWNLOADS $downloadName } else { $null }
    if ($cachedDownload -and (Test-Path -LiteralPath $cachedDownload -PathType Leaf)) {
        Write-Output "Using cached MinGW-w64 archive: $cachedDownload"
        Copy-Item -LiteralPath $cachedDownload -Destination $archivePath -Force
    }
    else {
        Write-Output 'Downloading the MinGW-w64 compiler (about 274 MB)...'
        $curl = Get-Command 'curl.exe' -ErrorAction SilentlyContinue
        if ($curl) {
            & $curl.Source --fail --location --retry 3 --retry-delay 2 --output $archivePath $downloadUrl
            if ($LASTEXITCODE -ne 0) {
                throw "MinGW-w64 download failed with curl exit code $LASTEXITCODE."
            }
        }
        else {
            Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath
        }
    }

    $actualSha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualSha256 -ne $expectedSha256) {
        throw "MinGW-w64 download checksum mismatch. Expected $expectedSha256, received $actualSha256."
    }

    Write-Output 'Download verified. Extracting MinGW-w64...'
    New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null
    Expand-Archive -LiteralPath $archivePath -DestinationPath $stagingRoot -Force

    $stagedToolchain = Join-Path $stagingRoot 'mingw64'
    $stagedCompiler = Join-Path $stagedToolchain 'bin\g++.exe'
    if (-not (Test-Path -LiteralPath $stagedCompiler -PathType Leaf)) {
        throw 'The MinGW-w64 archive did not contain mingw64\bin\g++.exe.'
    }

    $stagedVersionOutput = & $stagedCompiler --version 2>&1
    $stagedVersionExitCode = $LASTEXITCODE
    $stagedVersion = ($stagedVersionOutput -join "`n")
    if ($stagedVersionExitCode -ne 0 -or $stagedVersion -notmatch [regex]::Escape($expectedGccVersion)) {
        throw "The downloaded MinGW-w64 compiler is not GCC $expectedGccVersion."
    }

    try {
        if (Test-Path -LiteralPath $toolchainRoot) {
            Move-Item -LiteralPath $toolchainRoot -Destination $backupRoot
        }
        Move-Item -LiteralPath $stagedToolchain -Destination $toolchainRoot

        if (-not (Test-Path -LiteralPath $compilerPath -PathType Leaf)) {
            throw 'MinGW-w64 extraction completed, but g++.exe is missing.'
        }
        $installedVersionOutput = & $compilerPath --version 2>&1
        $installedVersionExitCode = $LASTEXITCODE
        $installedVersion = ($installedVersionOutput -join "`n")
        if ($installedVersionExitCode -ne 0 -or $installedVersion -notmatch [regex]::Escape($expectedGccVersion)) {
            throw "Installed MinGW-w64 compiler is not GCC $expectedGccVersion."
        }
        if (Test-Path -LiteralPath $backupRoot) {
            Remove-Item -LiteralPath $backupRoot -Recurse -Force
        }
    }
    catch {
        if (Test-Path -LiteralPath $toolchainRoot) {
            Remove-Item -LiteralPath $toolchainRoot -Recurse -Force
        }
        if (Test-Path -LiteralPath $backupRoot) {
            Move-Item -LiteralPath $backupRoot -Destination $toolchainRoot
        }
        throw
    }
    Write-Output "MinGW-w64 $expectedGccVersion is ready: $compilerPath"
}
finally {
    $toolsPrefix = [IO.Path]::GetFullPath($toolsRoot).TrimEnd('\') + '\'
    foreach ($temporaryPath in @($archivePath, $stagingRoot)) {
        if (Test-Path -LiteralPath $temporaryPath) {
            $resolvedTemporaryPath = [IO.Path]::GetFullPath($temporaryPath)
            if (-not $resolvedTemporaryPath.StartsWith($toolsPrefix, [StringComparison]::OrdinalIgnoreCase)) {
                throw "Refusing to clean a temporary path outside .tools: $resolvedTemporaryPath"
            }
            Remove-Item -LiteralPath $resolvedTemporaryPath -Recurse -Force
        }
    }
}
