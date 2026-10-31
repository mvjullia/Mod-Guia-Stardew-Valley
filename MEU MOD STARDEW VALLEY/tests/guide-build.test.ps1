$ErrorActionPreference = 'Stop'
$projectDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$project = Join-Path $projectDir 'StardewRealtimeTelemetry.csproj'
$objRoot = Join-Path $projectDir 'obj'
New-Item -ItemType Directory -Force -Path $objRoot | Out-Null
$testDir = Join-Path $objRoot ('guide-test-' + [Guid]::NewGuid().ToString('N'))
$sourceDir = Join-Path $projectDir 'guide-src'

try {
    & dotnet msbuild $project -target:PrepareGuideAssets "-p:GuideAssetsDir=$testDir"
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível gerar o guia no caminho alternativo.' }
    $files = @('index.html','telemetry.js','realtime.js','embedded.js','visual.js','knowledge.js','polish.js','acquisition.js','profile.js','time-format.js','Pixellari.ttf','community-center.png')
    foreach ($file in $files) {
        $source = (Get-FileHash -LiteralPath (Join-Path $sourceDir $file)).Hash
        $generated = (Get-FileHash -LiteralPath (Join-Path $testDir $file)).Hash
        if ($source -ne $generated) { throw "Arquivo gerado diverge da fonte: $file" }
    }

    $missing = Join-Path $testDir 'nao-existe'
    $output = (& dotnet msbuild $project -target:PrepareGuideAssets '-p:GenerateGuideAssets=false' "-p:GuideAssetsDir=$missing" 2>&1 | Out-String)
    if ($LASTEXITCODE -eq 0 -or $output -notmatch 'Arquivo do guia ausente:.*index.html') { throw "Validação de arquivos ausentes falhou: $output" }
    $output = (& dotnet msbuild $project -target:PrepareGuideAssets "-p:GuideSourceDir=$missing" "-p:GuideAssetsDir=$testDir" 2>&1 | Out-String)
    if ($LASTEXITCODE -eq 0 -or $output -notmatch 'Arquivo-fonte do guia ausente:.*index.html') { throw "Validação de fonte ausente falhou: $output" }
    Write-Host 'OK: geração reproduzível, caminho configurável e erros de arquivos ausentes.'
} finally {
    if (Test-Path -LiteralPath $testDir) {
        $resolvedObj = (Resolve-Path -LiteralPath $objRoot).Path.TrimEnd('\') + '\'
        $resolvedTest = (Resolve-Path -LiteralPath $testDir).Path
        if (-not $resolvedTest.StartsWith($resolvedObj, [StringComparison]::OrdinalIgnoreCase)) { throw 'Diretório de teste fora de obj; limpeza cancelada.' }
        Remove-Item -LiteralPath $resolvedTest -Recurse -Force
    }
}
