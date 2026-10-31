const fs=require('fs');
const W='https://stardewvalleywiki.com/';
const rows=[
['202','Fried Calamari','Todas','Prepare na cozinha com a receita de Lula Frita desbloqueada.','Fried_Calamari'],
['613','Apple','Outono','Colha de macieiras maduras no outono; também pode aparecer na caverna com morcegos frutíferos.','Apple'],
['388','Wood','Todas','Corte árvores, galhos e troncos; Robin também vende madeira.','Wood'],
['709','Hardwood','Todas','Corte tocos grandes, troncos grandes ou árvores de mogno com machado adequado.','Hardwood'],
['734','Woodskip','Todas','Pesque no Bosque Secreto ou na Fazenda na Floresta, em qualquer horário e clima.','Woodskip'],
['807','Dinosaur Mayonnaise','Todas','Processe um ovo de dinossauro na máquina de maionese.','Dinosaur_Mayonnaise'],
['308','Void Mayonnaise','Todas','Processe um ovo nulo na máquina de maionese.','Void_Mayonnaise'],
['834','Mango','Verão','Colha de uma mangueira madura no verão; na Ilha Gengibre a árvore produz durante todo o ano.','Mango'],
['340','Honey','Primavera, verão e outono','Colete de uma casa de abelhas; flores próximas podem alterar o tipo de mel.','Honey'],
['254','Melon','Verão','Cultive sementes de melão: crescimento base de 12 dias.','Melon'],
['200','Vegetable Medley','Todas','Prepare na cozinha com a receita de Mexido de Legumes desbloqueada.','Vegetable_Medley'],
['719','Mussel','Todas','Colete na praia ou use covo no oceano.','Mussel'],
['270','Corn','Verão e outono','Cultive sementes de milho: 14 dias até a primeira colheita e novas colheitas a cada 4 dias.','Corn'],
['258','Blueberry','Verão','Cultive sementes de mirtilo: 13 dias até a primeira colheita e novas colheitas a cada 4 dias.','Blueberry'],
['605','Artichoke Dip','Todas','Prepare na cozinha com a receita de Molho de Alcachofra desbloqueada.','Artichoke_Dip'],
['400','Strawberry','Primavera','Cultive sementes de morango: 8 dias até a primeira colheita e novas colheitas a cada 4 dias; compre sementes no Festival do Ovo.','Strawberry'],
['257','Morel','Primavera','Colete na primavera no Bosque Secreto ou na Fazenda na Floresta; também pode aparecer na caverna com cogumelos e em tronco de cogumelos.','Morel'],
['18','Daffodil','Primavera','Colete no vale durante a primavera.','Daffodil'],
['Book_Trash','The Alleyway Buffet','Todas','Procure na lixeira dourada escondida a leste da cidade; o livreiro pode vendê-lo por 20.000 ouros a partir do ano 3.','The_Alleyway_Buffet'],
['Book_Woodcutting',"Woody's Secret",'Todas','Derrube árvores: pode cair depois de mais de 20 árvores cortadas; o livreiro pode vendê-lo por 20.000 ouros a partir do ano 3.','Woody%27s_Secret'],
['575','Obsidian','Todas','Leve um omnigeodo ou geodo de magma ao ferreiro para abri-lo.','Obsidian'],
['432','Truffle Oil','Todas','Coloque uma trufa na máquina de óleo.','Truffle_Oil'],
['562','Tigerseye','Todas','Leve um geodo de magma ou omnigeodo ao ferreiro para abri-lo.','Tigerseye'],
['749','Omni Geode','Todas','Encontre em rochas e em outras fontes durante a exploração; leve ao ferreiro para abri-lo.','Omni_Geode'],
['723','Oyster','Todas','Colete na praia ou use covo no oceano.','Oyster'],
['397','Sea Urchin','Todas','Colete na praia, especialmente na área leste acessível após reparar a ponte.','Sea_Urchin'],
['289','Ostrich Egg','Todas','Obtenha de avestruzes, em baús raros do Vulcão ou escavando o local indicado pelo fragmento de diário 10 na Ilha Gengibre.','Ostrich_Egg'],
['ParrotEgg','ParrotEgg','Todas','Após conquistar a Maestria de Combate, encontre este acessório em monstros, caixas ou barris nas minas, ou em salas de tesouro da Caverna da Caveira.','Parrot_Egg'],
['442','Duck Egg','Todas','Patos adultos no galinheiro produzem ovos de pata.','Duck_Egg'],
['FrogEgg','FrogEgg','Todas','Após conquistar a Maestria de Combate, encontre este acessório em monstros, caixas ou barris nas minas, ou em salas de tesouro da Caverna da Caveira.','Frog_Egg'],
['194','Fried Egg','Todas','Prepare um ovo frito na cozinha com a receita desbloqueada.','Fried_Egg'],
['182','Large Egg','Todas','Galinhas felizes podem produzir ovos grandes; há variantes de casca branca e marrom.','Large_Egg'],
['174','Large Egg','Todas','Galinhas felizes podem produzir ovos grandes; há variantes de casca branca e marrom.','Large_Egg'],
['305','Void Egg','Todas','Galinhas nulas produzem ovos nulos; um ovo inicial pode ser obtido pelo evento da bruxa ou comprado de Krobus.','Void_Egg'],
['303','Pale Ale','Todas','Coloque lúpulo em um barril para produzir pale ale.','Pale_Ale'],
['211','Pancakes','Todas','Prepare na cozinha com a receita de Panquecas desbloqueada.','Pancakes'],
['731','Maple Bar','Todas','Prepare na cozinha com a receita de Pão de Ácer desbloqueada.','Maple_Bar'],
['376','Poppy','Verão','Cultive sementes de papoula: crescimento base de 7 dias.','Poppy'],
['Raisins','Raisins','Todas','Coloque cinco uvas no desidratador; ficam prontas na manhã seguinte.','Raisins'],
['446',"Rabbit's Foot",'Todas','Coelhos podem produzir um pé de coelho; serpentes da Caverna da Caveira também podem deixá-lo.','Rabbit%27s_Foot']
];
if(rows.length!==40)throw Error('total '+rows.length);
const dir='auditoria-itens/';const p=JSON.parse(fs.readFileSync(dir+'progresso-verificacao.json'));const c=JSON.parse(fs.readFileSync(dir+'catalogo-pesquisa-parcial.json'));if(p.proxima_posicao.ordem!==118)throw Error('progresso mudou');
const entries=[];for(let i=0;i<rows.length;i++){const [id,name,season,desc,page]=rows[i], it=p.itens[117+i];if(it.id_exportado!==id)throw Error(`ordem ${i} ${it.id_exportado} ${id}`);const url=W+page;it.status='parcial';it.achado_atual=desc;it.fontes=[...new Set([...(it.fontes||[]),url])];it.ultima_verificacao='2026-10-31';it.dados_necessarios['obtenção']=true;it.observacao='Levantamento inicial: conferir identidade qualificada, versão instalada, métodos alternativos, compra, fabricação, crescimento quando aplicável e funcionamento no jogo.';const item=c.itens.find(x=>x.id_exportado===id);if(!item)throw Error('catálogo '+id);item.metodos=item.metodos||[];if(!item.metodos.some(m=>m.descricao===desc))item.metodos.push({tipo:'geral',descricao:desc,fonte:url});item.status='revisado_parcial';item.observacao='Campos vazios não significam inexistência; conferir métodos alternativos, compra, fabricação, versão e resultado no jogo.';entries.push({id,nome:it.nome,status:'parcial',fontes:[url]});}
p.iteracoes.push({numero:9,data_local:'2026-10-31',itens:entries,concluidos:[],limitacoes:'Levantamento inicial de 40 posições; faltam métodos alternativos, campos aplicáveis, identidade qualificada, comparação e teste no jogo. Dois acessórios foram diferenciados de ovos de animais.'});p.proxima_posicao={ordem:p.itens[157].ordem,id_exportado:p.itens[157].id_exportado,nome:p.itens[157].nome};p.totais={itens:p.itens.length,concluidos:p.itens.filter(x=>x.status==='concluido').length,parciais:p.itens.filter(x=>x.status==='parcial').length,pendentes:p.itens.filter(x=>x.status==='pendente').length};p.atualizado_em_local='2026-10-31';c.geradoEm=new Date().toISOString();
const file='guia-stardew/dist/acquisition.js';let js=fs.readFileSync(file,'utf8');const needle=' const original=window.openItemPage;';const pos=js.indexOf(needle);if(pos<0)throw Error('inserção não encontrada');const data={},sources={};for(const [id,name,season,desc,page] of rows){data[name]=[season,desc];sources[name]=W+page;}js=js.slice(0,pos)+' Object.assign(data,'+JSON.stringify(data)+');\n Object.assign(researchedSources,'+JSON.stringify(sources)+');\n'+js.slice(pos);
const pretty=x=>JSON.stringify(x,null,2)+'\n';fs.writeFileSync(dir+'iteracao-9-dados.json',pretty(rows.map(([a,b,d,e,f])=>[a,b,d,e,W+f])));fs.writeFileSync(dir+'progresso-verificacao.json',pretty(p));fs.writeFileSync(dir+'catalogo-pesquisa-parcial.json',pretty(c));fs.writeFileSync(file,js);
let md=fs.readFileSync(dir+'PROGRESSO-VERIFICACAO.md','utf8');md=md.replace(/\*\*Situação atual:\*\*[^\r\n]*/,`**Situação atual:** ${p.totais.itens} itens identificados em um save; ${p.totais.concluidos} concluídos, ${p.totais.parciais} parcialmente verificados e ${p.totais.pendentes} pendentes. O inventário ainda **não abrange todos os itens do jogo**.`).replace(/\*\*Momento atual:\*\*[^\r\n]*/,`**Momento atual:** item ${p.proxima_posicao.ordem}, ${p.proxima_posicao.nome} (ID exportado ${p.proxima_posicao.id_exportado}). Arquivo de controle: [progresso-verificacao.json](progresso-verificacao.json).`);for(const it of p.itens.slice(117,157)){const re=new RegExp('^'+it.ordem+'\\. .*$', 'm');md=md.replace(re,`${it.ordem}. **${it.nome}** — parcial · ID exportado \`${it.id_exportado}\` · ${it.achado_atual}`);}md+='\n\n## Iteração 9 — 31/10/2026\n\n40 posições analisadas parcialmente, de Lula Frita a Pé de Coelho. Guias de obtenção atualizados; fontes individuais e ressalvas no JSON. Ovos de sapo e papagaio são acessórios de combate. Ainda faltam conferir métodos alternativos, identidade qualificada, versão e resultado no jogo.\n';fs.writeFileSync(dir+'PROGRESSO-VERIFICACAO.md',md);
fs.appendFileSync(dir+'inconsistencias.txt','\nIteração 9 (31/10/2026): ovos de sapo e papagaio são acessórios de combate, não ovos de animais; conferir tipo qualificado e apresentação no mod. Informações de obtenção dos 40 itens foram atualizadas parcialmente; faltam métodos alternativos e validação em jogo. Fontes individuais: iteracao-9-dados.json.\n');console.log(JSON.stringify({totais:p.totais,proxima:p.proxima_posicao}));
