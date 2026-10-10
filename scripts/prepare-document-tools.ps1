$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$toolsRoot = Join-Path $repoRoot '.tools'
$exportRoot = Join-Path $toolsRoot 'document-export'
$fontRoot = Join-Path $exportRoot 'fonts'
$pandocExe = Join-Path $exportRoot 'pandoc.exe'
$typstExe = Join-Path $exportRoot 'typst.exe'
$fontFile = Join-Path $fontRoot 'Roboto.ttf'
$referenceDoc = Join-Path $exportRoot 'reference.docx'
$expectedPandoc = '3.12.1'
$expectedTypst = '0.15.1'
$expectedPandocSha256 = '6ef431cb20b2c24a0371fc19200dc49d452be54b1b5c9239f3462841ef53e587'
$expectedTypstSha256 = '19ce3551153c2fe7ee9fa2f95208310c8f4d3209fedb699e0333faf8913f6736'
$expectedRobotoSha256 = 'd7598e12c5dbef095ff8272cfc55da0250bd07fbdecbac8a530b9b277872a134'
$id = [Guid]::NewGuid().ToString('N')
$stagingRoot = Join-Path $toolsRoot "document-export-stage-$id"
$downloadRoot = Join-Path $toolsRoot "document-export-download-$id"

New-Item -ItemType Directory -Path $exportRoot, $fontRoot, $stagingRoot, $downloadRoot -Force | Out-Null

function Get-VerifiedFile([string]$url, [string]$filePath, [string]$expectedHash) {
    if (Test-Path -LiteralPath $filePath -PathType Leaf) {
        $currentHash = (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($currentHash -eq $expectedHash) { return }
    }
    $cachedDownload = if ($env:CP_STUDIO_DOWNLOADS) { Join-Path $env:CP_STUDIO_DOWNLOADS ([IO.Path]::GetFileName($filePath)) } else { $null }
    if ($cachedDownload -and (Test-Path -LiteralPath $cachedDownload -PathType Leaf)) {
        Copy-Item -LiteralPath $cachedDownload -Destination $filePath -Force
    }
    else {
        $curl = Get-Command 'curl.exe' -ErrorAction SilentlyContinue
        if ($curl) {
            & $curl.Source --fail --location --retry 3 --retry-delay 2 --output $filePath $url
            if ($LASTEXITCODE -ne 0) { throw "Download failed with curl exit code ${LASTEXITCODE}: $url" }
        }
        else {
            Invoke-WebRequest -Uri $url -OutFile $filePath
        }
    }
    $actualHash = (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $expectedHash) { throw "SHA256 mismatch for $url. Expected $expectedHash, received $actualHash." }
}

function Set-RobotoInReferenceDoc([string]$filePath) {
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::Open($filePath, [System.IO.Compression.ZipArchiveMode]::Update)
    try {
        $entry = $archive.GetEntry('word/styles.xml')
        if (-not $entry) { throw 'Pandoc reference document is missing word/styles.xml.' }
        $xml = [System.Xml.XmlDocument]::new()
        $xml.PreserveWhitespace = $true
        $inputStream = $entry.Open()
        try { $xml.Load($inputStream) } finally { $inputStream.Dispose() }
        $entry.Delete()

        $namespaceUri = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
        $namespaces = [System.Xml.XmlNamespaceManager]::new($xml.NameTable)
        $namespaces.AddNamespace('w', $namespaceUri)
        $runProperties = $xml.SelectNodes('//w:rPr', $namespaces)
        foreach ($runProperty in $runProperties) {
            $fonts = $runProperty.SelectSingleNode('w:rFonts', $namespaces)
            if (-not $fonts) {
                $fonts = $xml.CreateElement('w', 'rFonts', $namespaceUri)
                if ($runProperty.FirstChild) { [void]$runProperty.InsertBefore($fonts, $runProperty.FirstChild) }
                else { [void]$runProperty.AppendChild($fonts) }
            }
            foreach ($fontKind in @('ascii', 'hAnsi', 'eastAsia', 'cs')) {
                if ($fonts.HasAttribute($fontKind)) { $fonts.RemoveAttribute($fontKind) }
                [void]$fonts.SetAttribute($fontKind, $namespaceUri, 'Roboto')
            }
            foreach ($themeAttribute in @('asciiTheme', 'hAnsiTheme', 'eastAsiaTheme', 'cstheme')) {
                if ($fonts.HasAttribute($themeAttribute, $namespaceUri)) { $fonts.RemoveAttribute($themeAttribute, $namespaceUri) }
            }
        }

        $outputEntry = $archive.CreateEntry('word/styles.xml', [System.IO.Compression.CompressionLevel]::Optimal)
        $outputStream = $outputEntry.Open()
        try {
            $settings = [System.Xml.XmlWriterSettings]::new()
            $settings.Encoding = [System.Text.UTF8Encoding]::new($false)
            $settings.Indent = $false
            $writer = [System.Xml.XmlWriter]::Create($outputStream, $settings)
            try { $xml.Save($writer) } finally { $writer.Dispose() }
        }
        finally { $outputStream.Dispose() }
    }
    finally { $archive.Dispose() }
}

try {
    $pandocReady = $false
    if (Test-Path -LiteralPath $pandocExe -PathType Leaf) {
        $versionOutput = & $pandocExe --version
        $version = (($versionOutput -join "`n").Trim() -split "`r?`n")[0]
        $pandocReady = $version -match [regex]::Escape($expectedPandoc)
    }
    if (-not $pandocReady) {
        $archivePath = Join-Path $downloadRoot 'pandoc.zip'
        Get-VerifiedFile 'https://github.com/jgm/pandoc/releases/download/3.12.1/pandoc-3.12.1-windows-x86_64.zip' $archivePath $expectedPandocSha256
        $extractPath = Join-Path $stagingRoot 'pandoc'
        Expand-Archive -LiteralPath $archivePath -DestinationPath $extractPath -Force
        $foundPandoc = Get-ChildItem -LiteralPath $extractPath -Filter 'pandoc.exe' -File -Recurse | Select-Object -First 1
        if (-not $foundPandoc) { throw 'The Pandoc release archive did not contain pandoc.exe.' }
        Copy-Item -LiteralPath $foundPandoc.FullName -Destination $pandocExe -Force
    }

    $typstReady = $false
    if (Test-Path -LiteralPath $typstExe -PathType Leaf) {
        $versionOutput = & $typstExe --version
        $version = (($versionOutput -join "`n").Trim() -split "`r?`n")[0]
        $typstReady = $version -match [regex]::Escape($expectedTypst)
    }
    if (-not $typstReady) {
        $archivePath = Join-Path $downloadRoot 'typst.zip'
        Get-VerifiedFile 'https://github.com/typst/typst/releases/download/v0.15.1/typst-x86_64-pc-windows-msvc.zip' $archivePath $expectedTypstSha256
        $extractPath = Join-Path $stagingRoot 'typst'
        Expand-Archive -LiteralPath $archivePath -DestinationPath $extractPath -Force
        $foundTypst = Get-ChildItem -LiteralPath $extractPath -Filter 'typst.exe' -File -Recurse | Select-Object -First 1
        if (-not $foundTypst) { throw 'The Typst release archive did not contain typst.exe.' }
        Copy-Item -LiteralPath $foundTypst.FullName -Destination $typstExe -Force
    }

    if (-not (Test-Path -LiteralPath $fontFile -PathType Leaf) -or (Get-FileHash -LiteralPath $fontFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedRobotoSha256) {
        Get-VerifiedFile 'https://raw.githubusercontent.com/google/fonts/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/roboto/Roboto%5Bwdth%2Cwght%5D.ttf' $fontFile $expectedRobotoSha256
    }
    Get-VerifiedFile 'https://raw.githubusercontent.com/google/fonts/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/roboto/OFL.txt' (Join-Path $exportRoot 'ROBOTO-OFL.txt') '061402327a96aadb0bfb694a960ed289ecd38d383e396243831ab81feb109c41'
    Get-VerifiedFile 'https://raw.githubusercontent.com/jgm/pandoc/3.12.1/COPYING.md' (Join-Path $exportRoot 'PANDOC-COPYING.md') '3ebfbf9235b049d384cdba5a66a1a3434bb544391e720b76faa8e1b3ee61a4e5'
    Get-VerifiedFile 'https://raw.githubusercontent.com/typst/typst/v0.15.1/LICENSE' (Join-Path $exportRoot 'TYPST-LICENSE.txt') '62c7a1e35f56406896d7aa7ca52d0cc0d272ac022b5d2796e7d6905db8a3636a'
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'pandoc-normalize.lua') -Destination (Join-Path $exportRoot 'pandoc-normalize.lua') -Force
    @(
        'CP Test Studio third-party components'
        ''
        'Pandoc 3.12.1 — GNU General Public License v2 or later.'
        'Source: https://github.com/jgm/pandoc/tree/3.12.1'
        'License text: PANDOC-COPYING.md'
        ''
        'Typst 0.15.1 — Apache License 2.0.'
        'Source: https://github.com/typst/typst/tree/v0.15.1'
        'License text: TYPST-LICENSE.txt'
        ''
        'Roboto variable font — SIL Open Font License 1.1.'
        'Source: https://github.com/google/fonts/tree/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/roboto'
        'License text: ROBOTO-OFL.txt'
    ) | Set-Content -LiteralPath (Join-Path $exportRoot 'THIRD-PARTY-NOTICES.txt') -Encoding utf8

    if (-not (Test-Path -LiteralPath $referenceDoc -PathType Leaf)) {
        $pandocOutput = & $pandocExe --version
        $pandocExitCode = $LASTEXITCODE
        $pandocVersion = (($pandocOutput -join "`n").Trim() -split "`r?`n")[0]
        if ($pandocExitCode -ne 0 -or $pandocVersion -notmatch [regex]::Escape($expectedPandoc)) { throw 'Bundled Pandoc did not start successfully.' }
        $generatedReference = Join-Path $stagingRoot 'reference.docx'
        & $pandocExe '-o' $generatedReference '--print-default-data-file=reference.docx'
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $generatedReference -PathType Leaf)) { throw 'Pandoc could not generate its default DOCX reference template.' }
        Move-Item -LiteralPath $generatedReference -Destination $referenceDoc -Force
    }
    Set-RobotoInReferenceDoc $referenceDoc

    $typstOutput = & $typstExe --version
    $typstExitCode = $LASTEXITCODE
    $typstVersion = (($typstOutput -join "`n").Trim() -split "`r?`n")[0]
    if ($typstExitCode -ne 0 -or $typstVersion -notmatch [regex]::Escape($expectedTypst)) { throw 'Bundled Typst did not start successfully.' }
    Write-Output "Document export tools are ready: Pandoc $expectedPandoc + Typst $expectedTypst + Roboto."
}
finally {
    $toolsPrefix = [IO.Path]::GetFullPath($toolsRoot).TrimEnd('\') + '\'
    foreach ($temporaryPath in @($stagingRoot, $downloadRoot)) {
        if (Test-Path -LiteralPath $temporaryPath) {
            $resolvedTemporaryPath = [IO.Path]::GetFullPath($temporaryPath)
            if (-not $resolvedTemporaryPath.StartsWith($toolsPrefix, [StringComparison]::OrdinalIgnoreCase)) {
                throw "Refusing to clean a temporary path outside .tools: $resolvedTemporaryPath"
            }
            Remove-Item -LiteralPath $resolvedTemporaryPath -Recurse -Force
        }
    }
}
