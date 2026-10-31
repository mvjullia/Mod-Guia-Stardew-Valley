"""Build structured seasonal rules from the installed game's exported data."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEASONS = ['spring', 'summer', 'fall', 'winter']
LABELS = ['Primavera', 'Verão', 'Outono', 'Inverno']
LOCATIONS = {
    'Town': 'Rio da vila', 'Beach': 'Oceano', 'Mountain': 'Lago da montanha',
    'Forest': 'Floresta Cinzaseiva', 'Sewer': 'Esgotos', 'BugLand': 'Covil dos Insetos Mutantes',
    'Desert': 'Deserto', 'Woods': 'Bosque Secreto', 'WitchSwamp': 'Pântano da Bruxa',
    'Backwoods': 'Lago da trilha', 'Submarine': 'Submarino do Mercado Noturno',
    'IslandSouth': 'Ilha Gengibre · praia', 'IslandSouthEast': 'Ilha Gengibre · enseada',
    'IslandSouthEastCave': 'Caverna do Pirata', 'IslandWest': 'Ilha Gengibre · oeste',
    'IslandNorth': 'Ilha Gengibre · norte', 'Caldera': 'Caldeira do Vulcão',
    'UndergroundMine': 'Minas', 'BeachNightMarket': 'Oceano · Mercado Noturno',
    'BusStop': 'Ponto de ônibus', 'Railroad': 'Ferrovia', 'Tunnel': 'Túnel',
}


def seasons_for(condition, season=None):
    if season is not None:
        return [SEASONS[season]]
    found = re.search(r'(?:LOCATION_SEASON Here|SEASON) ((?:spring|summer|fall|winter)(?: (?:spring|summer|fall|winter))*)', condition or '')
    return found[1].split() if found else SEASONS.copy()


def build_season_catalog(items):
    source = json.loads((ROOT / 'data/season-game-data.json').read_text(encoding='utf-8'))
    by_id = {item['gameId']: item for item in items}
    fishing, forage = [], []
    for location, data in source['locations'].items():
        if location not in LOCATIONS:
            continue
        for spawn in data['fish']:
            for item_id in [spawn.get('ItemId')] if spawn.get('ItemId') else spawn.get('RandomItemId') or []:
                fish = source['fish'].get(item_id.removeprefix('(O)'))
                if item_id not in by_id or not fish or fish.split('/')[1] == 'trap':
                    continue
                fields = fish.split('/')
                ignore = spawn['IgnoreFishDataRequirements']
                times = [600, 2600] if ignore else [int(time) for time in fields[5].split()]
                weather = 'both' if ignore else fields[7]
                condition = spawn.get('Condition') or ''
                if 'WEATHER Here Rain' in condition:
                    weather = 'rainy'
                seasons = seasons_for(condition, spawn['Season'])
                flags = []
                days = None
                if spawn.get('RequireMagicBait'): flags.append('magicBait')
                if spawn.get('IsBossFish'): flags.append('legendary')
                if 'PLAYER_SPECIAL_ORDER_RULE_ACTIVE Current LEGENDARY_FAMILY' in condition and not condition.startswith('!'):
                    flags.append('quest')
                if spawn.get('PlayerPosition') or spawn.get('BobberPosition'): flags.append('position')
                if spawn.get('MinDistanceFromShore', 0) > 0: flags.append('distance')
                festival = re.search(r'IS_PASSIVE_FESTIVAL_OPEN (\w+)', condition)
                festival_id = festival[1] if festival else {'Submarine': 'NightMarket', 'BeachNightMarket': 'NightMarket'}.get(location)
                if festival_id and festival_id in source['festivals']:
                    event = source['festivals'][festival_id]
                    seasons = [SEASONS[event['Season']]]
                    days = [event['StartDay'], event['EndDay']]
                    times = [max(event['StartTime'], times[0]), times[-1]]
                    flags.append('festival')
                hours = re.search(r'\bTIME (\d+) (\d+)', condition)
                if hours: times = [int(hours[1]), int(hours[2])]
                if 'FESTIVAL' in condition and 'festival' not in flags: flags.append('festival')
                level = max(spawn.get('MinFishingLevel', 0), 0 if ignore else int(fields[12]))
                route = dict(gameId=item_id, location=location, locationLabel=LOCATIONS[location],
                             area=spawn.get('FishAreaId'), seasons=seasons, weather=weather, times=times,
                             minFishingLevel=level, flags=flags, days=days, method='rod')
                if route not in fishing: fishing.append(route)
        for spawn in data['forage']:
            item_id = spawn.get('ItemId')
            if item_id in by_id:
                route = dict(gameId=item_id, location=location, locationLabel=LOCATIONS[location],
                             seasons=seasons_for(spawn.get('Condition'), spawn.get('Season')),
                             conditional=bool(spawn.get('Condition')))
                if route not in forage: forage.append(route)
    seeds = []
    for stock in source['pierre']:
        item = by_id.get(stock.get('ItemId'))
        if not item or item.get('category') != 'Semente': continue
        year = re.search(r'YEAR (\d+)', stock.get('Condition') or '')
        match = re.search(r'(?:Armazém do )?Pierre:\s*([\d .]+)\s*ouros', item.get('purchasePrice') or '')
        price = int(re.sub(r'\D', '', match[1])) if match else stock['Price']
        if not match and price >= 0 and not stock.get('IgnoreShopPriceModifiers'): price *= 2
        if price < 0: price = None
        seeds.append(dict(gameId=item['gameId'], seasons=seasons_for(stock.get('Condition')),
                          minYear=int(year[1]) if year else 1, price=price))
    for key, value in source['fish'].items():
        fields = value.split('/')
        if fields[1] == 'trap' and '(O)' + key in by_id:
            fishing.append(dict(gameId='(O)' + key, method='trap', location=fields[4],
                                locationLabel='Oceano' if fields[4] == 'ocean' else 'Água doce',
                                seasons=SEASONS.copy(), weather='both', times=[600, 2600],
                                minFishingLevel=0, flags=[], days=None))
    return dict(schemaVersion=1, source=source['source'], seasons=[dict(id=key, label=label,
                icon=['🌸', '☀️', '🍂', '❄️'][i], image=f'https://stardewvalleywiki.com/Special:Redirect/file/{key.capitalize()}.png')
                for i, (key, label) in enumerate(zip(SEASONS, LABELS))], fishing=fishing, pierreSeeds=seeds, forage=forage)
