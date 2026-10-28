$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot '..')
$expoCli = Join-Path (Get-Location).Path 'node_modules\expo\bin\cli'
if (-not (Test-Path -LiteralPath $expoCli -PathType Leaf)) {
    Write-Error 'Thieu dependencies mobile. Chay npm --prefix mobile ci tu thu muc goc project roi thu lai.'
    exit 1
}
$nodeExecutable = (Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = 'F:\AndroidSdk' }
$sdkDirectory = (Resolve-Path -LiteralPath $env:ANDROID_HOME).Path
$env:Path = (Join-Path $sdkDirectory 'platform-tools') + ';' + (Join-Path $sdkDirectory 'emulator') + ';' + $env:Path
# Explicit user directory prevents ADB from trying to write \.android on this machine.
$env:ANDROID_USER_HOME = Join-Path $env:USERPROFILE '.android'
# Android Studio emulators reach the host through 10.0.2.2. LAN binding avoids
# Windows localhost/IPv6 differences and works on any selected Metro port.
$env:REACT_NATIVE_PACKAGER_HOSTNAME = '10.0.2.2'
# The npm npx.ps1 shim misparses '& npx ...' in Windows PowerShell.
# Run the installed CLI directly so no package lookup/download is needed.
& $nodeExecutable $expoCli start --android --lan @args
exit $LASTEXITCODE
