param([string]$Destination)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
if (-not $Destination) { $Destination = Join-Path (Split-Path -Parent $projectRoot) ('StudentMarket-render-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.zip') }
$archivePath = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $archivePath) { throw "Archive already exists: $archivePath" }
$skipDirectories = @('node_modules','.next','.next-e2e','.next-render','.venv','.backups','.data','.git','.npm-cache','__pycache__','bin','obj','coverage','test-results','playwright-report','.vscode','.pytest_cache','design-reference')
function Get-DeploySource([string]$Directory) {
    foreach ($item in Get-ChildItem -LiteralPath $Directory -Force) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Cannot package link: $($item.FullName)" }
        if ($item.PSIsContainer) {
            if ($skipDirectories -notcontains $item.Name) { Get-DeploySource $item.FullName }
        } elseif (($item.Name -notlike '.env*' -or $item.Name -eq '.env.example') -and
            $item.Name -notmatch '\.(tsbuildinfo|log|sqlite[^.]*|db|dump|zip|pyc|pem|key)$' -and
            $item.Name -ne '.codex-tool-check.txt') { $item }
    }
}
# Deliberate top-level allowlist: no .NET runtime, local data, backup or sibling PDF project.
$files = @()
foreach ($directory in @('frontend','fastapi_chat','scripts')) { $files += @(Get-DeploySource (Join-Path $projectRoot $directory)) }
foreach ($name in @('package.json','render.yaml','.gitignore','.dockerignore','.node-version','README.md','DEPLOY-RENDER.md','HUONG-DAN-GIAI-NEN.md')) {
    $file = Join-Path $projectRoot $name
    if (Test-Path -LiteralPath $file) { $files += Get-Item -LiteralPath $file }
}
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::Open($archivePath,[IO.Compression.ZipArchiveMode]::Create)
$expected = @{}
try {
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($projectRoot.Length+1).Replace('\','/')
        $entryName = 'StudentMarket-render/' + $relative
        $bytes = [IO.File]::ReadAllBytes($file.FullName)
        $entry = $archive.CreateEntry($entryName,[IO.Compression.CompressionLevel]::Optimal)
        $stream = $entry.Open()
        try { $stream.Write($bytes,0,$bytes.Length) } finally { $stream.Dispose() }
        $hash = [Security.Cryptography.SHA256]::Create()
        try { $expected[$entryName]=[Convert]::ToBase64String($hash.ComputeHash($bytes)) } finally { $hash.Dispose() }
    }
} finally { $archive.Dispose() }
$archive=[IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    if ($archive.Entries.Count -ne $expected.Count) { throw 'Archive entry count mismatch.' }
    foreach ($entry in $archive.Entries) {
        $stream=$entry.Open(); $hash=[Security.Cryptography.SHA256]::Create()
        try { $actual=[Convert]::ToBase64String($hash.ComputeHash($stream)) } finally { $hash.Dispose(); $stream.Dispose() }
        if ($actual -ne $expected[$entry.FullName]) { throw "Archive checksum mismatch: $($entry.FullName)" }
    }
} finally { $archive.Dispose() }
$result=Get-Item -LiteralPath $archivePath
Write-Output "Verified Render source ZIP: $($result.FullName)"
Write-Output "Files: $($files.Count); size: $([math]::Round($result.Length/1MB,2)) MB"
