# Integração entre o mod e o Guia Especial Stardew Valley

Este é o contrato compartilhado entre `MEU MOD STARDEW VALLEY/ModEntry.cs` e `guia-stardew/dist/telemetry.js`. Ao alterar campos, atualize ambos. Não aumentar schemaVersion para acrescentar campos opcionais; aumentar para mudanças incompatíveis.

## Fluxo disponível
1. Compilar e instalar o mod. Carregar uma fazenda ou salvar o dia.
2. O mod grava `exports/<saveId>-<multiplayerId>.json` dentro da pasta em que está instalado.
3. No site local, entrar sem Steam, abrir Fazendeiro(a) e selecionar o JSON.
4. O navegador mostra nome, gênero, fazenda, data e níveis de habilidade. O arquivo fica somente na memória da página; selecionar novamente após recarregar.

Os eventos usados são SaveLoaded e Saved. As leituras do jogo ocorrem na thread principal. O HTTP é opcional e recebe somente uma string JSON já capturada. Não existe monitoramento contínuo de arquivos pelo navegador.

## Contrato v1
- `schemaVersion`: inteiro 1.
- `exportedAt`: data ISO 8601 em UTC.
- `modVersion`: versão do manifesto SMAPI.
- `farm`: saveId (string decimal), name, year, season (`spring|summer|fall|winter`), day (1–28).
- `player`: multiplayerId (string decimal), steamId (string ou null), name, isMale, skills.
- `player.skills`: farming, fishing, foraging, mining, combat (níveis informados pelo jogo, podendo incluir bônus).
- `mastery`: null enquanto não coletado.
- `communityCenter`: null enquanto não coletado.

SteamID e multiplayerId são identificadores diferentes. Nunca preencher steamId com o multiplayerId. JSON importado é dado fornecido pelo usuário, sem comprovação de identidade.

## Próximas etapas coordenadas
- Capturar experiência e maestrias reclamadas usando a API da versão real instalada do jogo.
- Capturar pacotes e espaços entregues, preservando IDs e pacotes remixados.
- Capturar um retrato/sprite do personagem; o contrato atual não inclui imagem.
- Implementar Steam OpenID no servidor e um pareamento autenticado para o mod. A coincidência de IDs declarados no JSON não autentica o remetente.
- Só depois configurar a URL real da API. `EnableHttpUpload` é false por padrão e `ApiUrl` fica vazio; o transporte atual não implementa autenticação.

## Validação e limites
JavaScript validado por sintaxe e teste de importação com fixture. Compilação C# concluída com .NET SDK 6.0.428: zero erros e zero avisos, com EnableModDeploy=false. A DLL em bin/Debug/net6.0 está atualizada. O teste dentro do jogo com SMAPI ainda está pendente.

Não há publicação confirmada: o repositório de hospedagem não teve DNS resolvido na última tentativa. As alterações desta integração estão locais.

Referências: https://stardewvalleywiki.com/Modding:Modder_Guide/APIs/Events e https://stardewvalleywiki.com/Modding:Modder_Guide/APIs/Data.


## API SSE implementada
O fluxo local em tempo real está disponível. Veja `guia-stardew/api/README.md` para configurar e iniciar a API. A referência anterior de transporte sem autenticação está substituída: o mod agora envia Bearer token, com configuração ApiToken, e o site recebe SSE com cookie de sessão HttpOnly. Steam OpenID permanece pendente. Não há endpoint online publicado; o servidor Node serve o site em localhost.
