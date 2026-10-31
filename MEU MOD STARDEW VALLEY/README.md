# Stardew Realtime Telemetry

Exporta dados locais da fazenda para o Guia Especial Stardew Valley ao carregar um save e após salvar. Veja o contrato compartilhado em `../INTEGRACAO-MOD-SITE.md`.

## Uso
1. Compile com .NET 6 SDK e Stardew Valley/SMAPI instalados: `dotnet build`. O build também exige os arquivos da distribuição do guia em `../guia-stardew/dist`. Se estiverem em outro local, use `dotnet build -p:GuideDistDir="C:/caminho/para/dist"`.
2. Carregue uma fazenda e procure `exports/<saveId>-<multiplayerId>.json` na pasta instalada do mod.
3. Importe esse JSON na página Fazendeiro(a) do site.

A configuração gerada pela SMAPI contém `EnableHttpUpload: false` e `ApiUrl: ""`. Mantenha o envio desativado até existir um endpoint autenticado. A exportação local funciona sem API. Nunca use UniqueMultiplayerID como SteamID.

Dados exportados: nome, gênero, IDs separados, fazenda, data e níveis de habilidade. Maestrias, Centro Comunitário e imagem do personagem ainda não são coletados.

Este repositório não contém a distribuição do guia. É necessário obtê-la separadamente; o build incorpora o HTML e os scripts à DLL. Sem esses arquivos não é possível compilar o guia integrado. O teste dentro do jogo com SMAPI ainda está pendente.

