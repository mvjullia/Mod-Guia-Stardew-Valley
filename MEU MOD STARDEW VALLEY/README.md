# Stardew Realtime Telemetry

Mod SMAPI que hospeda o Guia Especial Stardew Valley localmente e atualiza os dados da fazenda ao carregar e jogar. O link local aparece no log do SMAPI.

## Código e build do guia

`guide-src/` contém o código-fonte versionável do site entregue com o mod. Não há dependências npm nem etapa de minificação: gerar o `dist` consiste em copiar, sem alterar os bytes, os dez arquivos declarados em `StardewRealtimeTelemetry.csproj`. Edite os arquivos em `guide-src/`; `obj/guide-dist/` é uma saída gerada e não deve ser editado. O código do servidor opcional em `../guia-stardew/api/` não é necessário para o guia incorporado.

Para compilar, são necessários .NET SDK 6, Stardew Valley e SMAPI instalados, além de restaurar o pacote NuGet do projeto. Na pasta do mod:

```powershell
dotnet restore
dotnet build --no-restore -p:EnableModDeploy=false
```

Antes da compilação, o alvo MSBuild `PrepareGuideAssets` gera automaticamente `obj/guide-dist/`, confere todos os arquivos obrigatórios e os incorpora à DLL. O pacote de build do SMAPI pode implantar o mod automaticamente se `EnableModDeploy` não for desativado; o comando acima apenas compila. Para gerar o diretório sem compilar a DLL:

```powershell
dotnet msbuild -target:PrepareGuideAssets
```

Para gerar o `dist` independente usado pelo servidor opcional, escolha seu diretório de saída explicitamente:

```powershell
dotnet msbuild -target:PrepareGuideAssets "-p:GuideAssetsDir=../guia-stardew/dist"
```

Os caminhos relativos passados por propriedades são relativos à pasta do projeto. `GuideSourceDir` permite apontar para outro código-fonte compatível. `GuideAssetsDir` permite mudar a pasta dos arquivos preparados. Por padrão, a build gera os arquivos nesse destino; por isso, o destino deve ser uma pasta de saída que possa ser sobrescrita. Para usar arquivos já preparados sem sobrescrevê-los, forneça o caminho e desative a geração:

```powershell
dotnet build --no-restore -p:EnableModDeploy=false "-p:GuideAssetsDir=C:/caminho/para/dist" -p:GenerateGuideAssets=false
```

O parâmetro legado `GuideDistDir` continua aceito para usar uma distribuição já preparada, sem sobrescrevê-la: `dotnet build --no-restore -p:EnableModDeploy=false "-p:GuideDistDir=C:/caminho/para/dist"`. Prefira `GuideAssetsDir` e `GenerateGuideAssets` para novas configurações.

Com geração ativa, um arquivo ausente em `GuideSourceDir` interrompe a build com o caminho faltante. Com geração desativada, a build verifica cada arquivo em `GuideAssetsDir` e falha com mensagem equivalente. Os dez recursos continuam incorporados como `Guide.index.html`, `Guide.telemetry.js`, `Guide.realtime.js`, `Guide.embedded.js`, `Guide.visual.js`, `Guide.knowledge.js`, `Guide.polish.js`, `Guide.acquisition.js`, `Guide.profile.js` e `Guide.time-format.js`, nomes usados pelo servidor do mod. O mesmo processo deve ser executado na CI antes da compilação: a própria chamada de `dotnet build` executa o alvo de preparação.

Para testar a geração em um caminho alternativo, a igualdade dos arquivos e os erros de arquivos ausentes, execute `./tests/guide-build.test.ps1` no PowerShell, a partir da pasta do mod. O teste de integração do servidor incorporado pode ser executado com `dotnet run --project tests/embedded/Test.csproj`.

## Testar no jogo

Instale a DLL compilada e o `manifest.json` na pasta do mod da instalação SMAPI, abra o jogo e carregue uma fazenda. Abra o link registrado no console do SMAPI. O guia é servido pelo próprio mod; a autenticação local e a sincronização utilizam a sessão do navegador e SSE. Não compartilhe tokens locais.

O progresso e os dados da auditoria de itens são mantidos separadamente em `../auditoria-itens/`. A primeira passada cobre o snapshot auditado, não o inventário completo do jogo.
