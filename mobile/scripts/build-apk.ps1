param([switch]$SignOnly)
$ErrorActionPreference = 'Stop'
# A nested Windows PowerShell can inherit PowerShell 7's module search path.
# Load its matching security module explicitly for DPAPI and SecureString.
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -Force
$projectDirectory = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $projectDirectory
$nodeExecutable = (Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$expoCli = Join-Path $projectDirectory 'node_modules\expo\bin\cli'
if (-not (Test-Path -LiteralPath $expoCli)) { throw 'Run npm --prefix mobile ci from the repository root first.' }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = 'F:\AndroidSdk' }
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'F:\AndroiStudio\jbr' }
$sdkDirectory = (Resolve-Path -LiteralPath $env:ANDROID_HOME).Path
$javaExecutable = Join-Path $env:JAVA_HOME 'bin\java.exe'
$keytoolExecutable = Join-Path $env:JAVA_HOME 'bin\keytool.exe'
if (-not (Test-Path -LiteralPath $keytoolExecutable)) { throw 'Set JAVA_HOME to a compatible JDK, then retry.' }
$env:Path = (Join-Path $env:JAVA_HOME 'bin') + ';' + (Join-Path $env:SystemRoot 'System32') + ';' + $env:Path
$env:ANDROID_USER_HOME = Join-Path $env:USERPROFILE '.android'
if (-not $env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME = Join-Path ([IO.Path]::GetPathRoot($projectDirectory)) 'st-gradle' }
if (-not $env:SANGTAY_CXX_DIR) { $env:SANGTAY_CXX_DIR = Join-Path ([IO.Path]::GetPathRoot($projectDirectory)) 'st-cxx' }
$env:EXPO_PUBLIC_API_URL = 'https://sangtay.shop'
$env:CI = '1'

if (-not $SignOnly) {
    # CNG owns android/. Preserve the project's Expo Go launch scripts after prebuild.
    $packagePath = Join-Path $projectDirectory 'package.json'
    $packageSource = [IO.File]::ReadAllText($packagePath)
    try {
        & $nodeExecutable $expoCli prebuild --platform android --no-clean --no-install --skip-dependency-update 'react,react-native'
        if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild failed.' }
    } finally { [IO.File]::WriteAllText($packagePath, $packageSource, (New-Object Text.UTF8Encoding($false))) }
    & (Join-Path $projectDirectory 'android\gradlew.bat') -p (Join-Path $projectDirectory 'android') --init-script (Join-Path $PSScriptRoot 'windows-native-paths.gradle') :app:assembleRelease --no-daemon --max-workers=2 '-PreactNativeArchitectures=arm64-v8a,x86_64'
    if ($LASTEXITCODE -ne 0) { throw 'Android release build failed.' }
}

$inputApk = Join-Path $projectDirectory 'android\app\build\outputs\apk\release\app-release.apk'
if (-not (Test-Path -LiteralPath $inputApk)) { throw 'Release APK not found. Run the build without -SignOnly first.' }
$tools = Get-ChildItem -LiteralPath (Join-Path $sdkDirectory 'build-tools') -Directory |
    Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' -and (Test-Path -LiteralPath (Join-Path $_.FullName 'lib\apksigner.jar')) } |
    Sort-Object { [Version]$_.Name } -Descending | Select-Object -First 1
if (-not $tools) { throw 'Android build-tools with apksigner are required.' }
$signer = Join-Path $tools.FullName 'lib\apksigner.jar'
$zipalign = Join-Path $tools.FullName 'zipalign.exe'
$credentialDirectory = Join-Path $projectDirectory '.credentials'
[IO.Directory]::CreateDirectory($credentialDirectory) | Out-Null
$keystore = Join-Path $credentialDirectory 'sangtay-release.keystore'
$passwordFile = Join-Path $credentialDirectory 'sangtay-password.dpapi'
if ((Test-Path -LiteralPath $keystore) -and -not (Test-Path -LiteralPath $passwordFile)) {
    throw 'Signing key exists but its encrypted password is missing. Restore the password file; do not replace the key.'
}
try {
    if (-not (Test-Path -LiteralPath $passwordFile)) {
        $random = [Security.Cryptography.RandomNumberGenerator]::Create()
        $bytes = New-Object byte[] 48
        try { $random.GetBytes($bytes) } finally { $random.Dispose() }
        $securePassword = ConvertTo-SecureString ([Convert]::ToBase64String($bytes)) -AsPlainText -Force
        $protectedPassword = ConvertFrom-SecureString $securePassword
        [IO.File]::WriteAllText($passwordFile, $protectedPassword, (New-Object Text.UTF8Encoding($false)))
    } else { $securePassword = ConvertTo-SecureString ([IO.File]::ReadAllText($passwordFile).Trim()) }
    $credential = New-Object Management.Automation.PSCredential('sangtay', $securePassword)
    $env:SANGTAY_APK_KEY_PASSWORD = $credential.GetNetworkCredential().Password
    if (-not (Test-Path -LiteralPath $keystore)) {
        & $keytoolExecutable -genkeypair -keystore $keystore -alias sangtay-release -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=SangTay Mobile,O=SangTay,C=VN' -storetype PKCS12 -storepass:env SANGTAY_APK_KEY_PASSWORD -keypass:env SANGTAY_APK_KEY_PASSWORD
        if ($LASTEXITCODE -ne 0) { throw 'Could not generate the signing key.' }
    }
    $appConfig = (Get-Content -LiteralPath (Join-Path $projectDirectory 'app.json') -Raw | ConvertFrom-Json).expo
    $releaseDirectory = Join-Path $projectDirectory 'releases'
    [IO.Directory]::CreateDirectory($releaseDirectory) | Out-Null
    $outputApk = Join-Path $releaseDirectory ("SangTay-v{0}-{1}.apk" -f $appConfig.version, $appConfig.android.versionCode)
    # Gradle's CNG template signs with its test key; replace that signature here.
    & $javaExecutable --enable-native-access=ALL-UNNAMED -jar $signer sign --ks $keystore --ks-key-alias sangtay-release --ks-pass env:SANGTAY_APK_KEY_PASSWORD --key-pass env:SANGTAY_APK_KEY_PASSWORD --alignment-preserved true --out $outputApk $inputApk
    if ($LASTEXITCODE -ne 0) { throw 'APK signing failed.' }
    & $javaExecutable --enable-native-access=ALL-UNNAMED -jar $signer verify --verbose --print-certs $outputApk
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
    & $zipalign -c -P 16 4 $outputApk
    if ($LASTEXITCODE -ne 0) { throw 'APK zip alignment verification failed.' }
    $hash = (Get-FileHash -LiteralPath $outputApk -Algorithm SHA256).Hash
    [IO.File]::WriteAllText($outputApk + '.sha256', $hash + '  ' + [IO.Path]::GetFileName($outputApk) + [Environment]::NewLine)
    Write-Host "APK ready: $outputApk"
    Write-Host "SHA256: $hash"
    Write-Host 'Keep mobile/.credentials safe: future APK updates must use this same signing key.'
} finally {
    Remove-Item Env:SANGTAY_APK_KEY_PASSWORD -ErrorAction SilentlyContinue
}
