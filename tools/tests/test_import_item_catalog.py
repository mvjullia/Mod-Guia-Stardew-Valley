import contextlib
import importlib.util
import io
import json
import tempfile
import unittest
import zipfile
import sys
from pathlib import Path
from unittest.mock import patch
from xml.etree import ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
SPEC = importlib.util.spec_from_file_location('migration', Path(__file__).resolve().parents[1] / 'import-item-catalog.py')
migration = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(migration)
NS = migration.NS['m']


def xlsx(path, items, columns=None, shared=False, formula=False):
    columns = migration.COLUMNS if columns is None else columns
    strings = []
    sheet = ET.Element('worksheet', xmlns=NS)
    data = ET.SubElement(sheet, 'sheetData')
    for number, values in enumerate([columns] + [[item.get(c) for c in columns] for item in items], 1):
        row = ET.SubElement(data, 'row', r=str(number))
        for index, value in enumerate(values):
            if value is None:
                continue
            col, n = '', index + 1
            while n:
                n, remainder = divmod(n - 1, 26)
                col = chr(65 + remainder) + col
            cell = ET.SubElement(row, 'c', r=f'{col}{number}', t='s' if shared else 'inlineStr')
            if formula and number > 1 and index == 0:
                ET.SubElement(cell, 'f').text = '1+1'
            elif shared:
                strings.append(str(value))
                ET.SubElement(cell, 'v').text = str(len(strings) - 1)
            else:
                ET.SubElement(ET.SubElement(cell, 'is'), 't').text = str(value)
    book = f'<workbook xmlns="{NS}" xmlns:r="{migration.REL_NS}"><sheets><sheet name="Catálogo" sheetId="7" r:id="catalog"/></sheets></workbook>'
    rels = '<Relationships><Relationship Id="catalog" Target="worksheets/catalog.xml"/></Relationships>'
    with zipfile.ZipFile(path, 'w') as archive:
        archive.writestr('xl/workbook.xml', book)
        archive.writestr('xl/_rels/workbook.xml.rels', rels)
        archive.writestr('xl/worksheets/catalog.xml', ET.tostring(sheet))
        if shared:
            sst = ET.Element('sst', xmlns=NS)
            for text in strings:
                ET.SubElement(ET.SubElement(sst, 'si'), 't').text = text
            archive.writestr('xl/sharedStrings.xml', ET.tostring(sst))


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.book = self.root / 'catalog.xlsx'
        self.output = self.root / 'json'
        self.item = {'Nome': 'Chirívia', 'ID do jogo': '(O)24', 'Preço de venda': 0,
                     'Descrição': ' Não verificado ', 'Fonte de compra': 'Não se aplica'}

    def run_cli(self, *args):
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            return migration.main([str(self.book), '--output-dir', str(self.output), *args])

    def test_shared_and_inline_strings_sparse_rows_and_reordered_headers(self):
        for shared in (True, False):
            xlsx(self.book, [self.item], list(reversed(migration.COLUMNS)), shared=shared)
            payloads = migration.convert(self.book)
            record = payloads['items.json']['items'][0]
            self.assertEqual(list(record), migration.FIELD_KEYS)
            self.assertEqual(record['name'], 'Chirívia')
            self.assertEqual(record['salePrice'], '0')
            self.assertIsNone(record['description'])
            self.assertIsNone(record['purchaseSource'])
            self.assertIsNone(record['growthDays'])
            self.assertEqual(payloads['item-fields.json'], migration.FIELDS)

    def test_update_removes_old_items_and_is_idempotent(self):
        xlsx(self.book, [self.item, {'Nome': 'Outro', 'ID do jogo': '(TR)24'}])
        self.assertEqual(self.run_cli(), 0)
        xlsx(self.book, [{**self.item, 'Descrição': 'Nova descrição'}])
        self.assertEqual(self.run_cli('--check'), 1)
        self.assertEqual(self.run_cli('--dry-run'), 0)
        target = self.output / 'items.json'
        self.assertEqual(len(json.loads(target.read_text(encoding='utf-8'))['items']), 2)
        self.assertEqual(self.run_cli(), 0)
        data = json.loads(target.read_text(encoding='utf-8'))
        self.assertEqual(len(data['items']), 1)
        self.assertEqual(data['items'][0]['description'], 'Nova descrição')
        modified = target.stat().st_mtime_ns
        self.assertEqual(self.run_cli(), 0)
        self.assertEqual(self.run_cli('--check'), 0)
        self.assertEqual(target.stat().st_mtime_ns, modified)

    def test_invalid_input_preserves_previous_json(self):
        xlsx(self.book, [self.item])
        self.assertEqual(self.run_cli(), 0)
        before = (self.output / 'items.json').read_bytes()
        invalid = [
            ([self.item, self.item], migration.COLUMNS, False),
            ([self.item], migration.COLUMNS[:-1], False),
            ([{**self.item, 'ID do jogo': '24'}], migration.COLUMNS, False),
            ([{**self.item, 'Nome': None}], migration.COLUMNS, False),
            ([], migration.COLUMNS, False),
            ([self.item], migration.COLUMNS, True),
        ]
        for items, columns, formula in invalid:
            xlsx(self.book, items, columns, formula=formula)
            self.assertEqual(self.run_cli(), 2)
            self.assertEqual((self.output / 'items.json').read_bytes(), before)

    def test_default_source_requires_one_workbook_ignores_excel_lock_file(self):
        data = self.root / 'data'
        data.mkdir()
        with patch.object(migration, 'ROOT', self.root):
            with self.assertRaises(ValueError):
                migration.discover_workbook()
            (data / '~$catalog.xlsx').touch()
            (data / 'one.xlsx').touch()
            self.assertEqual(migration.discover_workbook().name, 'one.xlsx')
            (data / 'two.xlsx').touch()
            with self.assertRaises(ValueError):
                migration.discover_workbook()

    def test_dry_run_does_not_create_output(self):
        xlsx(self.book, [self.item])
        self.assertEqual(self.run_cli('--dry-run'), 0)
        self.assertFalse(self.output.exists())

    def test_english_headers_are_supported_and_alias_duplicates_rejected(self):
        english = {migration.HEADER_KEYS[label]: value for label, value in self.item.items()}
        xlsx(self.book, [english], migration.FIELD_KEYS)
        record = migration.convert(self.book)['items.json']['items'][0]
        self.assertEqual(record['gameId'], '(O)24')
        self.assertEqual(record['name'], 'Chirívia')
        duplicate = [*migration.COLUMNS[:-1], 'name']
        xlsx(self.book, [self.item], duplicate)
        with self.assertRaises(ValueError):
            migration.convert(self.book)

    def test_existing_v1_catalog_is_migrated_to_english_keys(self):
        self.output.mkdir()
        legacy = dict(zip(migration.COLUMNS, [None] * 35))
        legacy.update(self.item)
        target = self.output / 'items.json'
        target.write_text(json.dumps({'schemaVersion': 1, 'itens': [legacy]}), encoding='utf-8')
        xlsx(self.book, [self.item])
        self.assertEqual(self.run_cli('--check'), 1)
        self.assertEqual(self.run_cli(), 0)
        data = json.loads(target.read_text(encoding='utf-8'))
        self.assertEqual(data['schemaVersion'], 2)
        self.assertEqual(data['items'][0]['gameId'], '(O)24')
        self.assertTrue(all(key.isascii() and ' ' not in key for key in data['items'][0]))
        self.assertNotIn('itens', data)
        self.assertEqual(self.run_cli('--check'), 0)


if __name__ == '__main__':
    unittest.main()
