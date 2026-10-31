"""Compact the original game exports into the versioned input for migration."""
import hashlib
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
game = Path(sys.argv[2])
read = lambda name: json.loads((source / name).read_text(encoding='utf-8-sig'))
fields = ['ItemId', 'RandomItemId', 'Season', 'Condition', 'FishAreaId', 'MinFishingLevel',
          'MinDistanceFromShore', 'IgnoreFishDataRequirements', 'RequireMagicBait', 'IsBossFish',
          'PlayerPosition', 'BobberPosition']
compact = dict(source=dict(gameVersion=read('source-info.json')['gameVersion'], files={
    f'Data/{name}.xnb': hashlib.sha256((game / f'Content/Data/{name}.xnb').read_bytes()).hexdigest()
    for name in ['Fish', 'Locations', 'Shops', 'PassiveFestivals']}), fish=read('fish.json'), festivals=read('passivefestivals.json'), locations={
        key: dict(fish=[{field: spawn.get(field) for field in fields} for spawn in value.get('Fish') or []],
                  forage=[{field: spawn.get(field) for field in ['ItemId', 'Season', 'Condition']} for spawn in value.get('Forage') or []])
        for key, value in read('locations.json').items() if value.get('Fish') or value.get('Forage')},
    pierre=[{field: stock.get(field) for field in ['ItemId', 'Condition', 'Price', 'IgnoreShopPriceModifiers']} for stock in read('shops.json')['SeedShop']['Items']])
(root / 'data/season-game-data.json').write_text(json.dumps(compact, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Fonte sazonal preparada.')
