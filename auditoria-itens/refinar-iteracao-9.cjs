const fs=require('fs');const d='auditoria-itens/';const changes={
'202':'Cozinhe 1 lula, 1 farinha de trigo e 1 óleo; Jodi envia a receita ao atingir 3 corações.',
'613':'A macieira leva 28 dias para amadurecer e produz no outono; maçãs também podem aparecer na caverna com morcegos frutíferos.',
'834':'A mangueira leva 28 dias para amadurecer; produz no verão no vale e o ano todo na Ilha Gengibre ou estufa.',
'340':'A casa de abelhas produz mel a cada 4 dias, exceto no inverno no vale; na Ilha Gengibre produz o ano todo. Flores próximas podem alterar o tipo de mel.',
'200':'Cozinhe 1 tomate e 1 beterraba; Caroline envia a receita ao atingir 7 corações.',
'605':'Cozinhe 1 alcachofra e 1 leite; aprenda a receita na Rainha do Molho em 28 de outono do ano 1.',
'194':'Cozinhe 1 ovo; a receita já é conhecida no início do jogo.',
'211':'Cozinhe 1 farinha de trigo e 1 ovo; a receita passa na Rainha do Molho em 14 de verão do ano 1 e também pode ser comprada no Saloon por 100 ouros.',
'731':'Cozinhe 1 xarope de ácer, 1 açúcar e 1 farinha de trigo; a receita passa na Rainha do Molho em 14 de verão do ano 2.'};
const p=JSON.parse(fs.readFileSync(d+'progresso-verificacao.json')),c=JSON.parse(fs.readFileSync(d+'catalogo-pesquisa-parcial.json')),rows=JSON.parse(fs.readFileSync(d+'iteracao-9-dados.json'));let js=fs.readFileSync('guia-stardew/dist/acquisition.js','utf8'),md=fs.readFileSync(d+'PROGRESSO-VERIFICACAO.md','utf8');for(const r of rows){const [id]=r;if(!changes[id])continue;const old=r[3],value=changes[id];r[3]=value;js=js.replaceAll(old,value);const i=p.itens.find(x=>x.id_exportado===id);i.achado_atual=value;const ci=c.itens.find(x=>x.id_exportado===id);for(const m of ci.metodos)if(m.descricao===old)m.descricao=value;md=md.replace(old,value);if(id==='340'){r[2]='Todas (Ilha Gengibre); primavera, verão e outono (vale)';js=js.replace('"Honey":["Primavera, verão e outono"','"Honey":["Todas (Ilha Gengibre); primavera, verão e outono (vale)"');}if(['613','834'].includes(id))ci.tempo_crescimento_dias=28;}
for(const [id,n] of [['254',12],['270',14],['258',13],['400',8],['376',7]])c.itens.find(x=>x.id_exportado===id).tempo_crescimento_dias=n;
for(const [f,x] of [['progresso-verificacao.json',p],['catalogo-pesquisa-parcial.json',c],['iteracao-9-dados.json',rows]])fs.writeFileSync(d+f,JSON.stringify(x,null,2)+'\n');fs.writeFileSync(d+'PROGRESSO-VERIFICACAO.md',md);fs.writeFileSync('guia-stardew/dist/acquisition.js',js);
