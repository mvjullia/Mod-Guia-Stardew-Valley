# Stardew Realtime Telemetry

Mod SMAPI que hospeda o Guia Especial Stardew Valley localmente e atualiza os dados da fazenda ao carregar e jogar. O link local aparece no log do SMAPI.

## Código e build do guia

`guide-src/` contém o código-fonte versionável do site entregue com o mod. Não há dependências npm nem etapa de minificação: gerar o `dist` consiste em copiar, sem alterar os bytes, os 27 arquivos declarados em `StardewRealtimeTelemetry.csproj`. Edite os arquivos em `guide-src/`; `obj/guide-dist/` é uma saída gerada e não deve ser editado. O código do servidor opcional em `../guia-stardew/api/` não é necessário para o guia incorporado. A fonte Pixellari é servida localmente e usada nos títulos.

As modais usam `items.json` e a ordem de campos de `item-fields.json`, carregados por `item-catalog.js`. O catálogo usa `schemaVersion: 2`, com as chaves dos itens em inglês e `camelCase` (`name`, `purchasePrice`, `gameId`, por exemplo). `item-fields.json` associa cada `key` ao `label` em português usado na modal. Os dados do catálogo têm prioridade sobre o snapshot; ícones e qualidade continuam vindo do jogo. Campos sem informação ficam ocultos. Para importar ou atualizar os dados a partir do Excel em `data/`, execute `python tools/import-item-catalog.py` na raiz do repositório. Os cabeçalhos do Excel podem continuar em português. A ferramenta atualiza os JSONs de `guide-src/` e `guia-stardew/dist/`; consulte [os comandos de conferência e as regras de migração](../tools/README.md). Após atualizar os dados, recompile a DLL para renovar os recursos incorporados.

Os textos das informações também reconhecem os nomes traduzidos e em inglês dos itens do catálogo e criam referências para suas modais. A correspondência ignora maiúsculas/minúsculas, aceita espaços e quebras de linha entre palavras e prioriza o nome completo: **Sementes de Chirívia** aponta para `(O)472`, em vez de selecionar a Chirívia `(O)24`. Nomes compartilhados por itens diferentes permanecem sem link; menções ao próprio item também. O texto original e os links externos das fontes são preservados. O botão **Voltar** retorna ao item anterior da sequência. Cada referência tem um destino `?item=<ID qualificado>`, que também funciona ao abrir em outra aba ou salvar nos favoritos. A importação de novos itens atualiza automaticamente o conjunto de nomes reconhecidos, sem regras específicas para cada item.

## Menu Estação

O menu **Estação** acompanha o ícone e a estação do save conectado. O painel reúne peixes, sementes do estoque sazonal do Pierre, opções pendentes do Centro que podem ser obtidas na estação, coleta e covos. É possível escolher outra estação para planejar; isso não altera a estação do jogo. Sem save, o guia permite explorar as estações e pede conexão para consultar o progresso real do Centro.

O painel usa cores de cada estação e símbolos acessíveis: chuva obrigatória em um selo azul com nuvem e gotas, sol, horários, lua, nível mínimo de pescaria, posição especial, eventos e Isca Mágica. Os significados ficam nos tooltips e nos rótulos para leitores de tela. No inverno, peixes de chuva no vale também recebem o símbolo do Totem de Chuva. Clicar nos itens abre suas modais.

O estoque regular respeita as condições sazonais e o desbloqueio do ano 2, com preços e prazos de plantio. A Lista de Estoque do Pierre pode ampliar esse estoque; o painel identifica que apresenta a oferta sazonal regular. O Centro usa as entregas e os IDs do próprio save, incluindo pacotes remixados: `requiredCount` e `completed` evitam tratar opções de um pacote já concluído como pendências. Exigências de quantidade e qualidade são preservadas. Saves antigos sem esses campos mostram opções não entregues com a limitação indicada.

Os cartões do Centro, presentes, painel sazonal e cabeçalhos de itens recebem **borda verde e um selo de folha** quando o catálogo conhece uma forma de obter o item na estação atual da fazenda. Isso indica disponibilidade sazonal potencial: clima, localização, nível e desbloqueios ainda podem ser necessários. Consultar outra estação não muda a estação usada nessas bordas. Itens sem dados suficientes não recebem indicação inventada.

Com o inventário exportado pelo mod, o painel **Falta no Centro** separa **Ainda falta coletar** de **Já na mochila · falta entregar**. Quantidades e qualidade mínima são consideradas; três melões de ouro e dez normais ainda deixam faltando dois para uma entrega de cinco de ouro. Sem inventário no snapshot, o painel informa pendências de entrega sem presumir o que já foi coletado.

## Álbuns de lembranças

O menu **Álbuns** reúne fotografias em cartões com legenda abaixo da imagem, agrupadas pelo calendário do jogo. Clicar em uma foto a amplia. A captura registra somente o quadro renderizado pelo jogo, não a área de trabalho nem outras janelas.

As lembranças iniciais incluem chegada ao Centro com um item entregável, proximidade de uma nota Junimo da sala correspondente, entrega, conclusão de conjunto, regador usado na chuva e chegada em casa após a meia-noite. Posições das notas são lidas do mapa atual. Uma entrega só é atribuída ao jogador quando o espaço do conjunto muda para concluído e há consumo correspondente do inventário local; perder um item ou outro jogador completar um espaço não basta.

A gag **Levei o item e esqueci de deixar** verifica se o jogador entrou com quantidade e qualidade suficientes e saiu com o item ainda necessário e na mochila. Pacotes já concluídos por outra opção não geram essa gag. Se houve uma foto válida da chegada, essa imagem pode receber a legenda posterior; o álbum identifica a reutilização e mantém o horário real da imagem.

As fotos são aguardadas em uma fila e capturadas no evento `Rendered`, com o jogo ativo e o personagem caminhando. Menus, diálogos, eventos, minijogos, pausas e captura de mapa bloqueiam a foto; a elegibilidade é verificada novamente no instante da captura. Uma cena pode ser descartada se não houver um quadro válido antes de expirar a fila. Entregas aparecem em uma foto de caminhada depois da ação, sem forçar uma captura do menu.

As imagens e o `index.json` ficam em `albums/<saveId>/<multiplayerId>/` dentro da pasta do mod instalado. As rotas `/api/albums` e `/api/albums/photos/<imageId>.png` exigem a sessão local e só consultam o álbum selecionado. Fotos antigas não são apagadas automaticamente. Um índice corrompido é preservado e o erro é registrado no log, em vez de substituir o álbum.

As opções do `config.json` são `EnableAlbums` (padrão `true`), `AlbumDailyLimit` (12 registros por dia) e `AlbumMinSecondsBetweenPhotos` (10 segundos; mínimo efetivo de 3). Desativar a captura mantém as fotos anteriores disponíveis. Títulos e descrições estão em `guide-src/album-moments.json`, com os campos `{player}`, `{item}` e `{room}` substituídos pelo evento. Uma legenda nova precisa de uma regra de evento correspondente em `AlbumRecorder.cs`.

Validação automatizada cobre política de captura, entregas, gags, persistência, isolamento e as rotas HTTP. A leitura gráfica do frame e o momento exato das fotos ainda precisam de aceitação dentro do jogo com SMAPI; compilação e testes fora do jogo não substituem essa etapa.

`season-guide.json` é gerado pela mesma migração do Excel, combinando o catálogo com `data/season-game-data.json`. A fonte sazonal foi extraída de `Data/Fish`, `Data/Locations`, `Data/Shops` e `Data/PassiveFestivals` da instalação do jogo, com versão e hashes registrados. Assim, estações são associadas ao local de pesca; o campo legado de estação em `Data/Fish` não é usado. Veja [como atualizar a fonte sazonal](../tools/README.md).

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

Com geração ativa, um arquivo ausente em `GuideSourceDir` interrompe a build com o caminho faltante. Com geração desativada, a build verifica cada arquivo em `GuideAssetsDir` e falha com mensagem equivalente. Os 27 recursos são incorporados com o prefixo `Guide.`: `index.html`, `telemetry.js`, `realtime.js`, `embedded.js`, `visual.js`, `knowledge.js`, `polish.js`, `acquisition.js`, `profile.js`, `time-format.js`, `item-catalog.js`, `item-fields.json`, `items.json`, `game-ui.js`, `game-cursor.png`, `menu-hover.wav`, `menu-select.wav`, `menu-open.wav`, `menu-close.wav`, `game-ui-sources.json`, `season.js`, `season-guide.json`, `albums.js`, `album-moments.json`, `Pixellari.ttf` e `community-center.png` e `community-center-mask.png`. Esses nomes são usados pelo servidor do mod. O mesmo processo deve ser executado na CI antes da compilação: a própria chamada de `dotnet build` executa o alvo de preparação.

## Aparência e sons do jogo

As modais mostram o nome traduzido do catálogo e os `label` em português, com espaços. O tipo de informação usa negrito; seu valor usa peso normal. As chaves técnicas em inglês são internas ao catálogo.

`game-ui.js` aplica o cursor original e os sons de navegação, seleção, abertura e fechamento. O áudio só começa após uma interação com a página, com volume de 30%. O botão **Sons do menu** permite silenciar; a preferência fica no navegador. Campos de texto preservam o cursor de edição. Os arquivos PNG/WAV são servidos localmente, tanto pelo mod quanto pela API Node.

Os recursos foram extraídos da instalação local do Stardew Valley 1.6.15. `game-ui-sources.json` registra os arquivos originais, hashes, recorte do cursor e os índices de áudio. Para repetir a extração com .NET SDK 8 ou superior, na raiz do repositório:

```powershell
dotnet run --project tools/export-game-ui/ExportGameUi.csproj -- "C:/Program Files (x86)/Steam/steamapps/common/Stardew Valley" "MEU MOD STARDEW VALLEY/guide-src"
```

Depois, execute `PrepareGuideAssets` e recompile o mod para atualizar a distribuição e a DLL. Os arquivos do jogo são apenas lidos. Os recursos visuais e sonoros pertencem à ConcernedApe. Os formatos de extração foram conferidos com o código do [MonoGame](https://github.com/MonoGame/MonoGame/blob/develop/MonoGame.Framework/Content/LzxDecoder.cs) e do [DirectXTK](https://github.com/microsoft/DirectXTK/blob/main/Audio/WaveBankReader.cpp); os nomes dos efeitos estão na [referência de áudio do jogo](https://wiki.stardewvalley.net/Modding%3AAudio).

Para testar a geração em um caminho alternativo, a igualdade dos arquivos e os erros de arquivos ausentes, execute `./tests/guide-build.test.ps1` no PowerShell, a partir da pasta do mod. O teste de integração do servidor incorporado pode ser executado com `dotnet run --project tests/embedded/Test.csproj`.

## Testar no jogo

Instale a DLL compilada e o `manifest.json` na pasta do mod da instalação SMAPI, abra o jogo e carregue uma fazenda. Abra o link registrado no console do SMAPI. O guia é servido pelo próprio mod; a autenticação local e a sincronização utilizam a sessão do navegador e SSE. Não compartilhe tokens locais.

O progresso e os dados da auditoria de itens são mantidos separadamente em `../auditoria-itens/`. A primeira passada cobre o snapshot auditado, não o inventário completo do jogo.
