# Atualizar os dados dos itens

Requer **Python 3.9 ou superior**, sem instalar bibliotecas nem ter o Excel aberto. Execute os comandos na raiz do repositório. O arquivo Excel não é alterado.

```powershell
python tools/import-item-catalog.py
```

O comando localiza o único `.xlsx` de `data/` (ignora os arquivos temporários `~$` do Excel), lê a aba **Catálogo** e atualiza:

- `MEU MOD STARDEW VALLEY/guide-src/items.json`: registros completos, com ID qualificado do jogo. O catálogo usa `schemaVersion: 2` e as propriedades `sourceWorkbook`, `attribution` e `items`.
- `MEU MOD STARDEW VALLEY/guide-src/item-fields.json`: os 35 campos na ordem de exibição, cada um com `key` (nome técnico em inglês) e `label` (rótulo em português).
- As cópias desses dois arquivos em `guia-stardew/dist/`, utilizadas pelo servidor Node.
- `season-guide.json` em ambos os destinos: regras de pesca, coleta e estoque sazonal, combinando os IDs do Excel com os dados originais em `data/season-game-data.json`.

Para escolher uma planilha, uma aba ou um destino de teste:

```powershell
python tools/import-item-catalog.py "data/Catalogo_Stardew_Valley_1.6.15_PT-BR.xlsx"
python tools/import-item-catalog.py "data/outro.xlsx" --sheet "Catálogo" --output-dir "tmp/catalogo"
```

`--output-dir` substitui ambos os destinos padrão. Caminhos fornecidos na linha de comando são relativos ao diretório atual. A descoberta em `data/` e os destinos padrão funcionam independentemente do diretório atual.

## Conferir antes de atualizar

```powershell
python tools/import-item-catalog.py --dry-run
python tools/import-item-catalog.py --check
```

Ambos mostram quantos itens serão adicionados, alterados e removidos, sem gravar arquivos. `--check` retorna **0** quando os JSONs já estão sincronizados, **1** quando há diferenças e **2** quando a entrada é inválida. É adequado para CI. `--dry-run` retorna 0 mesmo quando há diferenças; erros continuam retornando 2.

## Regras de migração

- A planilha é o retrato completo do catálogo: itens removidos dela também são removidos dos JSONs. Edições manuais nos JSONs são substituídas na próxima importação; faça alterações permanentes no Excel.
- As 35 colunas são obrigatórias e podem ser reordenadas na planilha. Os cabeçalhos podem usar os rótulos em português ou as chaves em inglês. Não é necessário renomear os cabeçalhos do Excel existente: a ferramenta faz o mapeamento explícito. Colunas faltantes, extras, duplicadas (inclusive dois nomes para o mesmo campo) ou dados sem cabeçalho interrompem a importação.
- Todo item precisa de Nome e ID qualificado único, por exemplo `(O)24`. `(O)24` e `(TR)24` são itens diferentes.
- Campos vazios, `Não verificado` e `Não se aplica` viram `null`. Preço zero, acentos, quebras de linha e fontes são preservados. Valores preenchidos são armazenados como texto, inclusive números, conforme o contrato de exibição do catálogo.
- Fórmulas precisam ter resultado salvo no Excel; a ferramenta não calcula fórmulas. Erros de célula ou fórmulas sem resultado interrompem a importação.
- Toda a entrada é validada antes da gravação. Cada arquivo é substituído atomicamente; arquivos sem diferenças não são regravados. O conjunto de arquivos não é uma transação única: após uma falha de disco, execute novamente.
- Uma segunda execução com o mesmo Excel não modifica os arquivos.
- Catálogos antigos com chaves em português (`schemaVersion: 1`) são convertidos para a versão 2 na atualização. A comparação de itens usa `gameId` para manter o resumo de inclusões, alterações e remoções correto durante a migração.

Os nomes técnicos usam `camelCase`, sem espaços nem acentos. Por exemplo:

| Cabeçalho do Excel / rótulo na modal | Chave JSON |
| --- | --- |
| Nome | `name` |
| Descrição | `description` |
| Categoria | `category` |
| Preço de compra | `purchasePrice` |
| Preço de venda | `salePrice` |
| Quem vende | `sellers` |
| Quem compra | `buyers` |
| Tempo de crescimento | `growthDays` |
| Dias com Speed-Gro | `growthDaysSpeedGro` |
| ID do jogo | `gameId` |
| Nome em inglês | `englishName` |
| Fonte de quem compra | `buyersSource` |

O mapeamento completo está em `item-fields.json`, gerado a partir de `COLUMNS` e `FIELD_KEYS` na ferramenta. Os valores continuam em português; apenas os nomes das propriedades mudaram.

O JavaScript carrega os JSONs uma vez por página e mostra apenas campos preenchidos. Recarregue a página após a atualização. Para o guia incorporado na DLL, recompile o mod: os JSONs são recursos da compilação, não arquivos lidos diretamente de `data/` em tempo de execução.

## Atualizar a fonte sazonal do jogo

A migração normal usa o JSON já versionado em `data/`; não exige o jogo instalado. Para atualizar as regras a partir de outra instalação, use .NET SDK 8 ou superior e execute na raiz:

```powershell
dotnet run --project tools/export-season-data/ExportSeasonData.csproj -- "C:/Program Files (x86)/Steam/steamapps/common/Stardew Valley" "tools/export-season-data/obj/source"
python tools/prepare-season-source.py "tools/export-season-data/obj/source" "C:/Program Files (x86)/Steam/steamapps/common/Stardew Valley"
python tools/import-item-catalog.py
```

O extrator apenas lê os arquivos do jogo. Para uma instalação em outro caminho, passe também `-p:GamePath="C:/outro/caminho"` ao `dotnet run`, antes de `--`, e ajuste os dois caminhos de instalação nos comandos. Os arquivos intermediários ficam em `obj/`; o JSON compacto em `data/` é a entrada versionável. `season_catalog.py` normaliza clima, horários, estações por local e calendário de festivais, preservando os requisitos especiais como sinais visuais. Após atualizar a fonte, confira as diferenças e rode os testes sazonais:

```powershell
python tools/import-item-catalog.py --check
node --test guia-stardew/tests/season.test.cjs
```

```powershell
dotnet build "MEU MOD STARDEW VALLEY/StardewRealtimeTelemetry.csproj"
```

## Testar a ferramenta

```powershell
python -B -m unittest discover -s tools/tests -p "test_*.py"
node --test guia-stardew/tests/item-catalog.test.cjs
```
