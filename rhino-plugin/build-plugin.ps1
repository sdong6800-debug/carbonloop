param([switch]$SkipCompile)

$ErrorActionPreference = 'Stop'
$pluginRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $pluginRoot
$dotnet = Join-Path $projectRoot '.tools\dotnet\dotnet.exe'
$yak = 'C:\Program Files\Rhino 8\System\yak.exe'
$project = Join-Path $pluginRoot 'CarbonLoop.Rhino\CarbonLoop.Rhino.csproj'
$binaryRoot = Join-Path $pluginRoot 'CarbonLoop.Rhino\bin\Release'
$staging = Join-Path $pluginRoot ('.build\' + [guid]::NewGuid().ToString('N'))
$dist = Join-Path $pluginRoot 'dist'
$version = '0.2.0'

if (-not (Test-Path -LiteralPath $dotnet)) { throw '没有找到项目本地 .NET SDK。' }
if (-not (Test-Path -LiteralPath $yak)) { throw '没有找到 Rhino 8 Yak 打包工具。' }

$env:DOTNET_CLI_HOME = Join-Path $projectRoot '.tools'
$env:APPDATA = Join-Path $projectRoot '.tools'
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = '1'
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'

if (-not $SkipCompile) {
  & $dotnet build $project -c Release --configfile (Join-Path $pluginRoot 'NuGet.Config')
  if ($LASTEXITCODE -ne 0) { throw '插件编译失败。' }
}

if (Test-Path -LiteralPath $dist) { Remove-Item -LiteralPath $dist -Recurse -Force }
New-Item -ItemType Directory -Path $staging | Out-Null
New-Item -ItemType Directory -Path $dist | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging 'web') | Out-Null

Copy-Item -LiteralPath (Join-Path $pluginRoot 'package\manifest.yml') -Destination $staging
Copy-Item -LiteralPath (Join-Path $binaryRoot 'CarbonLoop.Rhino.rhp') -Destination $staging
Copy-Item -LiteralPath (Join-Path $projectRoot 'integration\rhino\rhino-semantic-profile.json') -Destination $staging
Copy-Item -LiteralPath (Join-Path $pluginRoot 'README.md') -Destination $staging
Copy-Item -LiteralPath (Join-Path $pluginRoot '安装说明.md') -Destination $staging
$webSource = Join-Path $projectRoot 'reference-demo'
Get-ChildItem -LiteralPath $webSource | Where-Object {
  $_.Name -notin @('.test-exports', 'downloads')
} | Copy-Item -Destination (Join-Path $staging 'web') -Recurse -Force

# The installed product only needs runtime assets. Development checks, screenshots,
# previous connector downloads and generated test exports stay in the source tree.
$runtimeWeb = Join-Path $staging 'web'
Get-ChildItem -LiteralPath $runtimeWeb -File | Where-Object {
  $_.Name -like 'check-*.cjs' -or
  $_.Name -eq 'check.cjs' -or
  $_.Name -like 'test-*.cjs' -or
  $_.Name -eq 'timber-original.html' -or
  $_.Extension -in @('.py', '.png') -or
  $_.Name -eq 'README.md'
} | Remove-Item -Force
foreach ($developmentFolder in @('.test-exports', 'downloads')) {
  $target = Join-Path $runtimeWeb $developmentFolder
  if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
}

Push-Location $staging
try {
  & $yak build --platform win
  if ($LASTEXITCODE -ne 0) { throw 'Yak 安装包生成失败。' }
  $yakPackages = Get-ChildItem -Filter '*.yak'
  $yakPackages | Copy-Item -Destination $dist
  $yakPackages | Remove-Item -Force
} finally {
  Pop-Location
}

Copy-Item -LiteralPath (Join-Path $pluginRoot '安装说明.md') -Destination $dist
$rhiZip = Join-Path $dist "CarbonLoop-Rhino-$version.zip"
$rhi = Join-Path $dist "CarbonLoop-Rhino-$version.rhi"
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $rhiZip -CompressionLevel Optimal
Move-Item -LiteralPath $rhiZip -Destination $rhi
$aiStaging = Join-Path $pluginRoot ('.build\ai-' + [guid]::NewGuid().ToString('N'))
$aiServiceTarget = Join-Path $aiStaging 'ai-service'
$aiReferenceTarget = Join-Path $aiStaging 'reference-demo'
New-Item -ItemType Directory -Path $aiServiceTarget | Out-Null
New-Item -ItemType Directory -Path $aiReferenceTarget | Out-Null
Get-ChildItem -LiteralPath (Join-Path $projectRoot 'ai-service') | Where-Object {
  $_.Name -notin @('.venv-structural', 'server.log', 'server-error.log') -and
  $_.Name -notlike 'check-*.cjs'
} | Copy-Item -Destination $aiServiceTarget -Recurse -Force
foreach ($runtimeFile in @('material-estimate.js','model-core.js','ai-core.js','solution-core.js','structural-rulebook.js','structural-screening-core.js','structural-review-core.js')) {
  Copy-Item -LiteralPath (Join-Path $projectRoot "reference-demo\$runtimeFile") -Destination $aiReferenceTarget
}
Copy-Item -LiteralPath (Join-Path $pluginRoot '安装说明.md') -Destination $aiStaging
Compress-Archive -Path (Join-Path $aiStaging '*') -DestinationPath (Join-Path $dist "CarbonLoop-AI-Connector-$version.zip") -CompressionLevel Optimal
Write-Host "CarbonLoop 安装包已生成：$dist"
