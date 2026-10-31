# Teste da build de desenvolvimento — álbuns v2

Instale o mesmo pacote nos dois PCs, com Stardew Valley e SMAPI compatíveis. Feche os jogos antes de substituir o mod. Preserve `config.json` e a pasta `albums`; faça uma cópia desta pasta antes dos testes de desconexão.

1. Entre na mesma fazenda nos dois PCs. F8 abre o álbum dentro do jogo; F9 pede uma foto compartilhada. Os comandos equivalentes são `guia_album` e `guia_foto_compartilhada` no console SMAPI.
2. Com os menus fechados e os jogos ativos, pressione F9 em um PC. Aguarde a contagem. Confira nos dois álbuns a foto com duas perspectivas e a moldura de coração; o estado deve chegar a sincronizado. Os originais são preservados.
3. Reinicie os dois jogos. Confira se a foto, a legenda e a confirmação continuam presentes. As fotos ficam em `albums/<saveId>/<multiplayerId>` na pasta do mod.
4. Tire outra foto e desconecte um jogador durante o envio. Ao reconectar, o mod deve retomar as partes pendentes e confirmar as duas cópias. Se uma captura falhar, veja o motivo no álbum e use a opção de tentar novamente.
5. Teste os momentos automáticos: pescar em mapas diferentes, pescar juntos, uma noite juntos ou separados, visitar um festival, completar um placar, acertar o topo do martelo e consumir Joja Cola. Cada registro deve corresponder a uma ação observada. Menus só podem aparecer quando forem o motivo da foto.
6. No guia do navegador, deixe chegar várias atualizações SSE. Relógio e valores devem atualizar sem apagar/recarregar os cartões, retratos ou imagens. Abra Social, Estação e Álbuns para conferir.

Inclui 22 atividades de coop, coleções de romance, noites, festivais e Cantinho da vergonha. O romance pode usar o cônjuge do jogo ou `AlbumRomanticPartnerId` no config. `ShareAlbumPhotos` e `AllowSharedPhotoRequests` controlam compartilhamento e pedidos.

Esta build passou por testes de lógica, PNG, persistência, transferência simulada, HTTP e contratos dos observadores do jogo, além da compilação sem avisos. A captura gráfica, o desempenho da transferência e a interface nativa ainda precisam de teste em dois jogos reais. A contagem não garante simultaneidade exata. Tela dividida não foi validada. O álbum é somente leitura; edição e exclusão sincronizadas não estão disponíveis. Builds anteriores com protocolo v1 não são compatíveis com as sessões v2.

Se houver falha, guarde os logs SMAPI dos dois PCs e informe o momento, o estado da sessão e se havia algum menu aberto. Não apague índices nem fotos para simular exclusões: uma cópia ausente será reparada na sincronização.
