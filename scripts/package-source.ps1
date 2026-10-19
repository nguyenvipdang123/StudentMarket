param([string]$Destination)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
if (-not $Destination) {
    $Destination = Join-Path (Split-Path $projectRoot -Parent) 'StudentMarket-source.zip'
}
$archivePath = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $archivePath) {
    throw "ZIP already exists: $archivePath. Choose another -Destination or move the old ZIP first."
}

$omitDirectories = @('node_modules', '.next', '.next-e2e', '.next-render', '.venv', '.backups', '.data', '.git', 'bin', 'obj', '__pycache__', '.npm-cache', '.vscode')
function Get-SourceFiles([string]$Directory) {
    foreach ($item in Get-ChildItem -LiteralPath $Directory -Force) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Cannot package a symbolic link: $($item.FullName)"
        }
        if ($item.PSIsContainer) {
            if ($omitDirectories -notcontains $item.Name) { Get-SourceFiles $item.FullName }
        } elseif (
            ($item.Name -notlike '.env*' -or $item.Name -eq '.env.example') -and
            $item.Name -notmatch '^appsettings\.(Development|Local)\.json$' -and
            $item.Name -notmatch '\.(tsbuildinfo|log|sqlite[^.]*|db|dump|zip|pyc)$' -and
            $item.Name -ne '.codex-tool-check.txt'
        ) {
            $item
        }
    }
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$files = @(Get-SourceFiles $projectRoot)
$expectedHashes = @{}
$archive = [IO.Compression.ZipFile]::Open($archivePath, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
        $entryName = 'StudentMarket/' + $relative
        $bytes = [IO.File]::ReadAllBytes($file.FullName)
        if ($relative -eq 'backend/StudentMarket.API/appsettings.json') {
            $config = [Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
            if ($config.ConnectionStrings) {
                foreach ($property in $config.ConnectionStrings.PSObject.Properties) {
                    $property.Value = 'Host=localhost;Port=5432;Database=student_market;Username=postgres;Password=CHANGE_ME'
                }
            }
            $bytes = [Text.Encoding]::UTF8.GetBytes(($config | ConvertTo-Json -Depth 20))
        }
        $entry = $archive.CreateEntry($entryName, [IO.Compression.CompressionLevel]::Optimal)
        $stream = $entry.Open()
        try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
        $sha = [Security.Cryptography.SHA256]::Create()
        try { $expectedHashes[$entryName] = [Convert]::ToBase64String($sha.ComputeHash($bytes)) } finally { $sha.Dispose() }
    }
} finally { $archive.Dispose() }

# Read every entry back and verify its content before reporting success.
$archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    if ($archive.Entries.Count -ne $expectedHashes.Count) { throw 'ZIP entry count mismatch.' }
    foreach ($entry in $archive.Entries) {
        $stream = $entry.Open()
        $sha = [Security.Cryptography.SHA256]::Create()
        try { $actual = [Convert]::ToBase64String($sha.ComputeHash($stream)) } finally { $sha.Dispose(); $stream.Dispose() }
        if ($actual -ne $expectedHashes[$entry.FullName]) { throw "ZIP content mismatch: $($entry.FullName)" }
    }
} finally { $archive.Dispose() }

$result = Get-Item -LiteralPath $archivePath
Write-Output "Verified ZIP: $($result.FullName)"
Write-Output "Files: $($files.Count); size: $([Math]::Round($result.Length / 1MB, 2)) MB"
