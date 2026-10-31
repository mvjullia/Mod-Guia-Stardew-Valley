# API de telemetria com Server-Sent Events

Implementação local para um jogador, sem dependências npm. Requer Node.js 18+.

## Iniciar
Na pasta `guia-stardew`, execute:

    node api/setup.cjs
    node api/server.cjs

Abra http://127.0.0.1:8787 no navegador. A API também serve o próprio site para manter a conexão na mesma origem.

1. Instale a DLL atualizada do mod em sua pasta Mods/StardewRealtimeTelemetry.
2. Copie `api/.runtime/config.json` para a pasta instalada do mod como `config.json`. Preserve o token em sigilo; a pasta .runtime é ignorada pelo Git.
3. Reinicie o mod/jogo para ler a configuração e carregue a fazenda.
4. No site, use “Conectar ao mod” e cole o conteúdo de `api/.runtime/token.txt`. Abra Fazendeiro(a) para acompanhar os dados.

O mod envia um snapshot a cada dois segundos (configurável de 1 a 60) e ao carregar/salvar. As exportações em disco continuam restritas a carregar/salvar. Apenas o envio HTTP é feito fora da thread principal.

## API
- POST /api/snapshots: JSON v1; Authorization: Bearer TOKEN.
- POST /api/session: {"token":"TOKEN"}; cria cookie HttpOnly, SameSite=Strict por 12 horas.
- GET /api/events: cookie de sessão; text/event-stream; evento snapshot, ID crescente, retry de 3s e heartbeat a cada 15s.
- GET /api/health: estado do processo sem dados do jogador.

A reconexão recebe o snapshot mais recente, sem histórico intermediário. O estado fica em memória e é descartado quando o processo reinicia. Navegador atualiza a tela e o horário da última recepção. SSE não faz o caminho de envio do mod: esse caminho usa HTTP POST.

O servidor escuta somente 127.0.0.1. Aceita uma conta local, até 20 streams e corpo máximo de 64 KB. Token inválido, origem inesperada, snapshot inválido e dados anteriores ao último snapshot da mesma fazenda/jogador são rejeitados. O token não comprova identidade Steam.

## Hospedagem
Esta API Node não é executada pelo hospedador estático atual do Site. Para uso pela internet, precisa de processo Node persistente atrás de proxy HTTPS, mesma origem do site e buffering desativado para /api/events. PUBLIC_ORIGIN configura a origem externa e ativa cookie Secure quando HTTPS. PORT configura a porta local; API_TOKEN pode substituir o token local. Não exponha o processo diretamente sem HTTPS. Para vários usuários, implementar contas, tokens e isolamento de streams por usuário antes de disponibilizar.

## Verificação

    node --test tests/api.test.cjs
    node tests/telemetry.test.cjs

Teste HTTP real cobre autenticação, origem, validação, transmissão SSE, recuperação do último snapshot, rejeição de snapshot antigo e entrega do site. Mod compilado com zero erros e zero avisos; teste dentro do jogo e revisão visual no navegador ainda pendentes.

Referência do protocolo: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events

## Inicialização simplificada
Execute `Iniciar-Guia.cmd` (ou `powershell -ExecutionPolicy Bypass -File .\Iniciar-Guia.ps1`) na pasta guia-stardew. O inicializador prepara o token e a configuração, aplica-a ao mod na instalação padrão da Steam, inicia a API se necessário e abre o navegador. O Windows pode pedir permissão de administrador. Instale o mod primeiro e reinicie o jogo após configurar.

A conexão inicial no site ainda pede o token de `api/.runtime/token.txt`. Após conectar, os botões “Configurar mod” e “Mostrar token” ficam disponíveis. Esses botões exigem sessão autenticada; não envie o token a outras pessoas. Se a API já estava em execução antes desta atualização, pare-a e inicie novamente para carregar as alterações. O servidor executado pelo inicializador fica em segundo plano; se já estiver ativo, o inicializador o reutiliza.
