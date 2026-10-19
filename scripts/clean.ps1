[CmdletBinding(SupportsShouldProcess = $true)]
param([switch]$Dependencies)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
# Stop development/build processes before cleaning their generated files.
$targets = @('frontend/.next', 'frontend/.next-e2e', 'frontend/.next-render', 'frontend/tsconfig.tsbuildinfo', 'fastapi_chat/__pycache__', 'backend/StudentMarket.API/bin', 'backend/StudentMarket.API/obj')
if ($Dependencies) { $targets += 'frontend/node_modules' }

foreach ($relative in $targets) {
    $targetPath = [IO.Path]::GetFullPath((Join-Path $projectRoot $relative))
    if (-not $targetPath.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Cleanup target is outside the project: $targetPath"
    }
    if (-not (Test-Path -LiteralPath $targetPath)) { continue }
    $resolvedTarget = (Resolve-Path -LiteralPath $targetPath).Path
    if (-not $resolvedTarget.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Resolved cleanup target is outside the project: $resolvedTarget"
    }
    if ((Get-Item -LiteralPath $resolvedTarget -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw "Cleanup target is a symbolic link: $resolvedTarget"
    }
    if ($PSCmdlet.ShouldProcess($resolvedTarget, 'Remove generated files')) {
        Remove-Item -LiteralPath $resolvedTarget -Recurse -Force
        Write-Output "Removed: $relative"
    }
}

if ($Dependencies) { Write-Output 'Before running again: npm --prefix frontend ci' }
