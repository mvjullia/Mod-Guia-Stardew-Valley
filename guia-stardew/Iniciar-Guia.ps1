param([switch]$ConfigurarSomente)
$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot
$runtimeConfig = Join-Path $projectDir 'api\.runtime\config.json'
$modDir = Join-Path ${env:ProgramFiles(x86)} 'Steam\steamapps\common\Stardew Valley\Mods\StardewRealtimeTelemetry'
$modConfig = Join-Path $modDir 'config.json'
if ($ConfigurarSomente) {
    if (-not (Test-Path -LiteralPath (Join-Path $modDir 'manifest.json'))) { throw 'Mod não encontrado na pasta padrão da Steam.' }
    $source = Get-Content -Raw -LiteralPath $runtimeConfig | ConvertFrom-Json
    $target = if (Test-Path -LiteralPath $modConfig) { Get-Content -Raw -LiteralPath $modConfig | ConvertFrom-Json } else { [pscustomobject]@{} }
    foreach ($property in @('EnableHttpUpload','ApiUrl','ApiToken','UploadIntervalSeconds')) { $target | Add-Member -NotePropertyName $property -NotePropertyValue $source.$property -Force }
    $target | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $modConfig -Encoding utf8
    exit 0
}
Set-Location -LiteralPath $projectDir
& node 'api/setup.cjs'
if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar configuração.' }
try { & $PSCommandPath -ConfigurarSomente } catch {
    Write-Host 'O Windows solicitará permissão para configurar a pasta do mod.'
    $elevated = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"'),'-ConfigurarSomente') -Verb RunAs -WindowStyle Hidden -Wait -PassThru
    if ($elevated.ExitCode -ne 0) { throw 'Não foi possível configurar o mod. Verifique se ele está instalado na pasta padrão.' }
}
try { $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8787/api/health' -TimeoutSec 2 } catch { $health = $null }
if (-not $health.ok) {
    Start-Process -FilePath 'node.exe' -ArgumentList @('api/server.cjs') -WorkingDirectory $projectDir -WindowStyle Hidden
}
Start-Process 'http://127.0.0.1:8787/'
Write-Host 'Guia iniciado. Conecte usando o token em api\.runtime\token.txt. Reinicie o jogo se já estiver aberto.'
