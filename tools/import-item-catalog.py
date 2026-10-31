"""Migrate/update the guide's JSON catalog from an XLSX using Python 3.9+ only."""
import argparse
import json
import os
import posixpath
import re
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
from season_catalog import build_season_catalog

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / 'MEU MOD STARDEW VALLEY/guide-src'
DIST_DIR = ROOT / 'guia-stardew/dist'
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
MISSING = {'', 'não verificado', 'não se aplica'}
COLUMNS = [
    'Nome', 'Descrição', 'Categoria', 'Preço de compra', 'Preço de venda',
    'Quem vende', 'Quem compra', 'Como obter por coleta/drop', 'Como obter comprando',
    'Estação em que pode cultivar', 'Estação em que pode coletar', 'Estação em que pode obter',
    'Tempo de crescimento', 'Data limite de plantio sem fertilizante',
    'Data limite com Speed-Gro (10%)', 'Data limite com Deluxe Speed-Gro (25%)',
    'Data limite com Hyper Speed-Gro (33%)', 'Dias com Speed-Gro',
    'Dias com Deluxe Speed-Gro', 'Dias com Hyper Speed-Gro', 'Produção / fabricação',
    'Observações', 'ID do jogo', 'Nome em inglês', 'Fonte do item', 'Fonte da descrição',
    'Fonte de compra', 'Fonte de venda', 'Fonte de obtenção', 'Fonte de cultivo e crescimento',
    'Fonte de nome e ID', 'Cobertura', 'Campos com lacunas',
    'Fonte dos dias com fertilizante', 'Fonte de quem compra',
]
FIELD_KEYS = [
    'name', 'description', 'category', 'purchasePrice', 'salePrice',
    'sellers', 'buyers', 'foragingAndDropSources', 'purchaseAvailability',
    'growingSeasons', 'foragingSeasons', 'availabilitySeasons',
    'growthDays', 'lastPlantingDay', 'lastPlantingDaySpeedGro',
    'lastPlantingDayDeluxeSpeedGro', 'lastPlantingDayHyperSpeedGro',
    'growthDaysSpeedGro', 'growthDaysDeluxeSpeedGro', 'growthDaysHyperSpeedGro',
    'productionAndCrafting', 'notes', 'gameId', 'englishName',
    'itemSource', 'descriptionSource', 'purchaseSource', 'saleSource',
    'acquisitionSource', 'growthSource', 'nameAndIdSource', 'coverage',
    'missingFields', 'fertilizerGrowthSource', 'buyersSource',
]
FIELDS = [dict(key=key, label=label) for key, label in zip(FIELD_KEYS, COLUMNS)]
HEADER_KEYS = dict(zip(COLUMNS, FIELD_KEYS)) | dict(zip(FIELD_KEYS, FIELD_KEYS))


def normalize(value):
    if value is None:
        return None
    text = str(value).strip()
    return None if text.casefold() in MISSING else text


def sheet_rows(workbook, sheet_name):
    """Resolve the worksheet by name, not by sheet number or physical ZIP order."""
    with zipfile.ZipFile(workbook) as archive:
        book = ET.fromstring(archive.read('xl/workbook.xml'))
        sheets = book.findall('m:sheets/m:sheet', NS)
        sheet = next((s for s in sheets if s.get('name') == sheet_name), None)
        if sheet is None:
            raise ValueError(f'Aba {sheet_name!r} ausente. Disponíveis: ' + ', '.join(s.get('name', '') for s in sheets))
        relationships = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        relation = next((r for r in relationships if r.get('Id') == sheet.get('{' + REL_NS + '}id')), None)
        if relation is None or relation.get('TargetMode') == 'External':
            raise ValueError('Referência de aba inválida.')
        target = relation.get('Target', '')
        sheet_path = posixpath.normpath(target.lstrip('/') if target.startswith('/') else posixpath.join('xl', target))
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(t.text or '' for t in entry.findall('.//m:t', NS))
                       for entry in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        xml = ET.fromstring(archive.read(sheet_path))
        rows = []
        for row_number, row in enumerate(xml.findall('m:sheetData/m:row', NS), 1):
            values = {}
            for sequential_index, cell in enumerate(row):
                ref = re.fullmatch(r'([A-Z]+)\d+', cell.get('r', ''))
                index = sequential_index
                if ref:
                    index = 0
                    for letter in ref[1]:
                        index = index * 26 + ord(letter) - 64
                    index -= 1
                value = cell.find('m:v', NS)
                if cell.get('t') == 'e':
                    raise ValueError(f'Linha {row.get("r", row_number)}: célula com erro de Excel.')
                if cell.find('m:f', NS) is not None and (value is None or value.text is None):
                    raise ValueError(f'Linha {row.get("r", row_number)}: fórmula sem resultado salvo. Recalcule e salve no Excel.')
                if cell.get('t') == 's' and value is not None:
                    value = strings[int(value.text)]
                elif cell.get('t') == 'inlineStr':
                    value = ''.join(t.text or '' for t in cell.findall('.//m:t', NS))
                else:
                    value = value.text if value is not None else None
                values[index] = normalize(value)
            if any(value is not None for value in values.values()):
                rows.append((row.get('r', row_number), values))
        return rows


def convert(workbook, sheet_name='Catálogo'):
    rows = sheet_rows(workbook, sheet_name)
    if not rows:
        raise ValueError('A aba de catálogo está vazia.')
    header = rows[0][1]
    labels = [label for label in header.values() if label is not None]
    keys = [HEADER_KEYS.get(label) for label in labels]
    missing = set(FIELD_KEYS) - set(keys)
    extra = set(labels) - set(HEADER_KEYS)
    if missing or extra or len(keys) != len(FIELD_KEYS) or len(set(keys)) != len(keys):
        raise ValueError(f'Cabeçalho inválido. Ausentes: {sorted(missing)}; extras: {sorted(extra)}. São exigidas 35 colunas únicas.')
    positions = {HEADER_KEYS[label]: index for index, label in header.items() if label is not None}
    items, ids = [], set()
    for row_number, row in rows[1:]:
        item = {key: row.get(positions[key]) for key in FIELD_KEYS}
        if any(value is not None for index, value in row.items() if header.get(index) is None):
            raise ValueError(f'Linha {row_number}: dados em coluna sem cabeçalho.')
        item_id = item['gameId']
        if not item['name'] or not item_id or not re.fullmatch(r'\([A-Za-z]+\).+', item_id):
            raise ValueError(f'Linha {row_number}: Nome e ID qualificado (ex.: (O)24) são obrigatórios.')
        if item_id in ids:
            raise ValueError(f'Linha {row_number}: ID duplicado {item_id}.')
        ids.add(item_id)
        items.append(item)
    if not items:
        raise ValueError('Importação recusada: nenhum item encontrado.')
    data = {
        'schemaVersion': 2,
        'sourceWorkbook': Path(workbook).name,
        'attribution': 'Stardew Valley Wiki — CC BY-NC-SA; fontes individuais nos registros.',
        'items': items,
    }
    return {'item-fields.json': FIELDS, 'items.json': data, 'season-guide.json': build_season_catalog(items)}


def discover_workbook():
    files = sorted(p for p in (ROOT / 'data').glob('*.xlsx') if not p.name.startswith('~$'))
    if len(files) != 1:
        raise ValueError('Informe o caminho do Excel: data/ deve conter exatamente um .xlsx (arquivos ~$ são ignorados).')
    return files[0]


def serialize(data):
    return (json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8')


def update(payloads, destinations, check=False, dry_run=False):
    changes = []
    for directory in destinations:
        for name, data in payloads.items():
            target = directory / name
            contents = serialize(data)
            previous = target.read_bytes() if target.exists() else None
            if previous == contents:
                print(f'Sem alterações: {target}')
                continue
            changes.append((target, contents))
            if name == 'items.json':
                before = {}
                if previous is not None:
                    old = json.loads(previous.decode('utf-8-sig'))
                    if old.get('schemaVersion') == 1:
                        # Compare v1 records using v2 keys when upgrading existing JSONs.
                        previous_items = [{key: item.get(label) for key, label in zip(FIELD_KEYS, COLUMNS)} for item in old['itens']]
                    elif old.get('schemaVersion') == 2:
                        previous_items = old['items']
                    else:
                        raise ValueError(f'Versão de catálogo desconhecida: {target}')
                    before = {item['gameId']: item for item in previous_items}
                after = {item['gameId']: item for item in data['items']}
                added, removed = len(after.keys() - before.keys()), len(before.keys() - after.keys())
                modified = sum(before[key] != after[key] for key in before.keys() & after.keys())
                print(f'{target}: {added} novos, {modified} alterados, {removed} removidos; total {len(after)}.')
            else:
                print(f'Atualizar campos: {target}')
    if check or dry_run:
        return bool(changes)
    # Validate/serialize everything before writing; replace each file atomically.
    staged = []
    try:
        for target, contents in changes:
            target.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=target.parent, prefix='.' + target.name + '.', suffix='.tmp', delete=False) as temp:
                staged.append((Path(temp.name), target))
                temp.write(contents)
                temp.flush()
                os.fsync(temp.fileno())
        for temporary, target in staged:
            os.replace(temporary, target)
    finally:
        for temporary, _ in staged:
            temporary.unlink(missing_ok=True)
    return bool(changes)


def main(argv=None):
    parser = argparse.ArgumentParser(description='Migra/atualiza o catálogo Excel para os JSONs do guia, sem dependências externas.')
    parser.add_argument('workbook', nargs='?', type=Path, help='Excel .xlsx; padrão: único arquivo em data/.')
    parser.add_argument('--sheet', default='Catálogo', help='Nome da aba (padrão: Catálogo).')
    parser.add_argument('--output-dir', type=Path, help='Destino alternativo; substitui guide-src e dist.')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check', action='store_true', help='Não grava; sai com código 1 quando os JSONs precisam de atualização.')
    mode.add_argument('--dry-run', action='store_true', help='Exibe o resumo sem gravar arquivos.')
    args = parser.parse_args(argv)
    try:
        workbook = args.workbook or discover_workbook()
        payloads = convert(workbook, args.sheet)
        destinations = [args.output_dir] if args.output_dir else [SOURCE_DIR, DIST_DIR]
        changed = update(payloads, destinations, args.check, args.dry_run)
        print(f'{len(payloads["items.json"]["items"])} itens validados; 35 campos.')
        return 1 if args.check and changed else 0
    except (OSError, ValueError, KeyError, IndexError, TypeError, ET.ParseError, zipfile.BadZipFile) as error:
        print(f'Erro: {error}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
