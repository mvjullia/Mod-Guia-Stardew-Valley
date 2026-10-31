(function (root) {
    'use strict';
    function seasonMatch(value, season, rules) {
        if (!value) return false;
        const text = value.toLocaleLowerCase('pt-BR');
        return /^(todas|todo o ano|qualquer estação)/.test(text) ||
            text.includes(rules.seasons.find(entry => entry.id === season)?.label.toLocaleLowerCase('pt-BR'));
    }
    function buildSeasonModel(catalog, rules, snapshot, season) {
        const items = new Map(catalog.items.map(item => [item.gameId, item]));
        const routes = rules.fishing.filter(route => route.seasons.includes(season) && items.has(route.gameId));
        function grouped(entries) {
            const result = new Map();
            for (const route of entries) {
                if (!result.has(route.gameId)) result.set(route.gameId, { item: items.get(route.gameId), routes: [] });
                result.get(route.gameId).routes.push(route);
            }
            return [...result.values()].sort((a, b) => a.item.name.localeCompare(b.item.name, 'pt-BR'));
        }
        const fish = grouped(routes.filter(route => route.method === 'rod'));
        const traps = grouped(routes.filter(route => route.method === 'trap'));
        const forage = grouped(rules.forage.filter(route => route.seasons.includes(season) && items.has(route.gameId)));
        const year = snapshot?.farm?.year || 1;
        const seeds = rules.pierreSeeds.filter(stock => stock.seasons.includes(season) && items.has(stock.gameId))
            .map(stock => ({ item: items.get(stock.gameId), ...stock, locked: stock.minYear > year }))
            .sort((a, b) => a.item.name.localeCompare(b.item.name, 'pt-BR'));
        function availability(item) {
            if (seeds.some(entry => entry.item.gameId === item.gameId && !entry.locked)) return { kind: 'purchase', routes: [] };
            const catches = routes.filter(route => route.gameId === item.gameId);
            if (catches.length) return { kind: 'fish', routes: catches };
            const gathered = forage.find(entry => entry.item.gameId === item.gameId);
            if (gathered) return { kind: 'forage', routes: gathered.routes };
            if (seasonMatch(item.growingSeasons, season, rules)) return { kind: 'crop', routes: [] };
            if (item.category !== 'Peixe' && seasonMatch(item.availabilitySeasons, season, rules)) return { kind: 'other', routes: [] };
            return null;
        }
        const bundles = [], hasInventory = Array.isArray(snapshot?.inventory);
        for (const bundle of snapshot?.visuals?.bundles || []) {
            const entries = bundle.items || [], done = entries.filter(entry => entry.completed).length;
            if (bundle.completed === true || done >= (bundle.requiredCount || entries.length)) continue;
            const pending = [];
            for (const entry of entries) {
                if (entry.completed || entry.isMoney) continue;
                const item = catalog.find(entry.item || {});
                const obtainable = item && availability(item);
                if (obtainable) {
                    const held = hasInventory ? snapshot.inventory.filter(stack =>
                        (stack.qualifiedId || stack.gameId || '(O)' + stack.id) === item.gameId && (stack.quality || 0) >= (entry.quality || 0))
                        .reduce((sum, stack) => sum + (stack.quantity || 0), 0) : null;
                    pending.push({ ...entry, item, ...obtainable, held, toCollect: held == null ? null : Math.max(0, entry.quantity - held) });
                }
            }
            if (pending.length) bundles.push({ ...bundle, pending, remaining: bundle.requiredCount ? bundle.requiredCount - done : null });
        }
        return { fish, traps, forage, seeds, bundles, hasProgress: Array.isArray(snapshot?.visuals?.bundles),
            hasInventory, available: availability,
            hasChoiceCounts: (snapshot?.visuals?.bundles || []).every(bundle => Number.isInteger(bundle.requiredCount)) };
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = { buildSeasonModel, seasonMatch };
    if (typeof document === 'undefined') return;

    const style = document.createElement('style');
    style.textContent = `
    .season-board{--season-tint:#e7f0ce;--season-accent:#668b50;display:grid;gap:24px;padding-bottom:36px}
    .season-board[data-season="summer"]{--season-tint:#fff0bb;--season-accent:#b3782c}
    .season-board[data-season="fall"]{--season-tint:#ffdec2;--season-accent:#a75e36}
    .season-board[data-season="winter"]{--season-tint:#dceef4;--season-accent:#527d9b}
    .season-hero{display:flex;align-items:center;gap:22px;padding:24px;border:5px solid #a76227;box-shadow:inset 0 0 0 3px #ffdf9a,0 4px 0 #754019;background:linear-gradient(120deg,var(--season-tint),#fff7df)}
    .season-hero-icon{font-size:52px;flex:none}.season-hero-icon img{width:58px;height:58px;image-rendering:pixelated;object-fit:contain}
    .season-hero h1{margin:0 0 6px;font-size:30px;color:#623d23}.season-hero p{margin:0;line-height:1.6}
    .season-switch{display:flex;gap:10px;flex-wrap:wrap}.season-switch button{display:flex;align-items:center;gap:8px;background:#fff4d7;border:3px solid #aa713e;padding:10px 15px;color:#62412d;font:800 14px Nunito,sans-serif;box-shadow:inset 0 0 0 2px #ffe4ad,0 3px 0 #805327}
    .season-switch button[aria-pressed="true"]{background:var(--season-tint);border-color:var(--season-accent);transform:translateY(2px);box-shadow:inset 0 0 0 2px #fff9e0}
    .season-switch img{width:26px;height:26px;image-rendering:pixelated;object-fit:contain}.season-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;align-items:start}
    .season-panel{min-width:0;background:#fff3d6;border:4px solid #a76227;box-shadow:inset 0 0 0 2px #ffdc99,0 4px 0 #754019;padding:20px}
    .season-panel h2{display:flex;align-items:center;gap:10px;margin:0 0 18px;padding-bottom:12px;border-bottom:3px double #bb8b53;font-size:21px;color:#623d23}
    .season-count{margin-left:auto;border:2px solid #bc9562;padding:3px 9px;background:#fff9e6;font-size:14px}.season-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(235px,1fr));gap:13px}
    .season-columns .season-grid{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}.season-tile{position:relative;padding:13px;border:2px solid #c9985c;background:#fff9e9;min-width:0;box-shadow:inset 0 0 0 2px #fff3d0}
    .season-tile.needs-rain{border-color:#6c9cb4;background:linear-gradient(145deg,#e0f0f7,#fff9e9 75%)}.season-tile.needs-sun{border-color:#c7a150;background:linear-gradient(145deg,#fff0b5,#fff9e9 75%)}
    .season-item-button{display:flex;align-items:center;gap:12px;background:none;border:0;padding:0;color:#5c3b25;text-align:left;font:800 15px/1.3 Nunito,sans-serif;width:100%;min-height:48px}
    .season-item-button:hover span:last-child{text-decoration:underline}.season-item-sprite{display:inline-flex;align-items:center;justify-content:center;flex:none;width:44px;height:44px;background:#f7deb1;border:2px solid #bd8a50;font-size:26px}
    .season-item-sprite img{width:32px;height:32px;image-rendering:pixelated;object-fit:contain}.season-route{margin-top:11px;padding-top:9px;border-top:1px dashed #cbb388;display:grid;gap:6px;font-size:12px;line-height:1.4}.season-route-place{color:#785b40;display:flex;gap:5px;align-items:center}
    .season-signs{display:flex;align-items:center;flex-wrap:wrap;gap:6px}.season-sign{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:32px;min-height:30px;padding:3px 6px;background:#f0e6cb;border:1px solid #bea678;border-radius:5px;font-size:15px;color:#5b462f}
    .season-sign.rainy{background:#d4eafa;border:2px solid #679ab9;font-size:25px;min-width:44px;min-height:38px}.season-sign.sunny{background:#fff0b4;border-color:#c5a24c;font-size:23px}.season-sign.time{font-size:12px;font-weight:700;background:#fff8e7}.season-sign.warning{background:#ffe0c8;border-color:#b96b42}.season-sign.quality{color:#a16c0c;background:#ffedb3}
    .season-filters{display:flex;gap:7px;margin:-4px 0 18px;flex-wrap:wrap}.season-filters button{border:2px solid #bb965e;background:#fff8e6;min-width:45px;padding:6px 12px;font-size:19px;color:#62412d}.season-filters button[aria-pressed="true"]{background:#dbe9be;border-color:#63814b}
    .season-empty{padding:18px;text-align:center;color:#806244;background:#fff8e7;border:2px dashed #cdb17f;line-height:1.6}.season-bundle{margin-top:16px}.season-bundle h3{display:flex;align-items:center;gap:10px;font-size:16px;color:#6a492b;margin:0 0 10px}.season-bundle-count{font-size:12px;font-weight:600;margin-left:auto}
    .season-price{margin-top:10px;font-weight:900;color:#92600e;display:flex;gap:7px;align-items:center}.season-planting{margin-top:8px;display:flex;gap:6px;align-items:center;font-size:12px;color:#725739}.season-planting.late{color:#a1492a}.season-locked{margin-top:15px}.season-locked summary{padding:9px;background:#eadbc0;font-weight:800;color:#765738}.season-locked .season-grid{margin-top:10px}.season-footnote{font-size:12px;line-height:1.6;color:#82684e;margin:12px 0 0}
    @media(max-width:850px){.season-columns{grid-template-columns:1fr}.season-hero{padding:18px;gap:14px}.season-hero h1{font-size:25px}.season-grid,.season-columns .season-grid{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}}
    @media(max-width:450px){.season-grid,.season-columns .season-grid{grid-template-columns:1fr}.season-panel{padding:13px}.season-switch button{padding:9px}.season-hero-icon{font-size:38px}}
    .season-stage-title{padding:10px 12px;margin:18px 0 12px;background:#e5eabf;border:2px solid #a7ad6e;font-weight:900;color:#526633}
    .season-hero h1,.season-panel h2{font-family:Pixellari,monospace}
    .seasonal-available{position:relative;border:3px solid #578946!important;box-shadow:inset 0 0 0 2px #d5edac,0 0 0 2px #a7c27866!important}
    .seasonal-available .season-available-badge{position:absolute;top:-10px;right:4px;display:flex;align-items:center;justify-content:center;width:25px!important;height:23px;min-width:0;padding:0;background:#f0f7cf;border:2px solid #578946;border-radius:4px;font-size:16px;line-height:1;z-index:1}
    `;
    document.head.append(style);
    let rules, pending, selected = null, follow = true, weatherFilter = 'all', generation = 0, lastSignature;
    const marked = new Set(); let availableCache, availabilityKey, refreshPending;
    function applyAvailability(node, catalog, model, season) {
        const record = catalog.find(node._guiaSeasonItem), available = record && model && model.available(record);
        const classes = (node.className || '').split(/\s+/).filter(cls => cls && cls !== 'seasonal-available');
        if (available) classes.push('seasonal-available'); node.className = classes.join(' ');
        if (!available) { node._seasonBadge?.remove(); node._seasonBadge = null; return; }
        if (!node._seasonBadge) { node._seasonBadge = document.createElement('span'); node._seasonBadge.className = 'season-available-badge'; node._seasonBadge.textContent = '🌿'; node.append(node._seasonBadge); }
        const label = 'Pode ser obtido em ' + season.label + '; clima, local, nível e outros requisitos podem se aplicar';
        node._seasonBadge.title = label; node._seasonBadge.setAttribute('aria-label', label); node._seasonBadge.setAttribute('role', 'img');
    }
    function refreshMarks() {
        if (!marked.size) return;
        if (refreshPending) return refreshPending;
        refreshPending = Promise.all([root.GuiaItemCatalog.load(), loadRules()]).then(([catalog, data]) => {
            const season = data.seasons.find(entry => entry.id === root.guiaData?.farm?.season);
            const key = JSON.stringify([root.guiaData?.farm?.saveId, root.guiaData?.farm?.season, root.guiaData?.farm?.year]);
            if (key !== availabilityKey) { availabilityKey = key; availableCache = season ? buildSeasonModel(catalog, data, root.guiaData, season.id) : null; }
            for (const node of marked) { if (node.isConnected === false) { marked.delete(node); continue; } applyAvailability(node, catalog, availableCache, season); }
        }).catch(() => {}).finally(() => { refreshPending = null; });
        return refreshPending;
    }
    root.GuiaSeason = { markItem(node, item) { node._guiaSeasonItem = item; marked.add(node); refreshMarks(); } };
    function loadRules() {
        if (!pending) pending = fetch('season-guide.json').then(response => {
            if (!response.ok) throw Error('Não foi possível carregar as estações.'); return response.json();
        }).then(data => {
            if (data.schemaVersion !== 1 || !Array.isArray(data.seasons) || !Array.isArray(data.fishing)) throw Error('Dados sazonais inválidos.');
            rules = data; updateNav(); return data;
        }).catch(error => { pending = null; throw error; });
        return pending;
    }
    const active = () => typeof current !== 'undefined' && current === 'season';
    function add(parent, tag, text, cls) {
        const element = document.createElement(tag); if (text != null) element.textContent = text;
        if (cls) element.className = cls; parent.append(element); return element;
    }
    function sign(parent, glyph, title, cls = '') {
        const badge = add(parent, 'span', glyph, 'season-sign ' + cls); badge.title = title;
        badge.setAttribute('role', 'img'); badge.setAttribute('aria-label', title); return badge;
    }
    function seasonIcon(parent, season) {
        const img = add(parent, 'img'); img.src = season.image; img.alt = season.label;
        img.onerror = () => { img.remove(); add(parent, 'span', season.icon); }; return img;
    }
    function updateNav() {
        const index = tabs.findIndex(tab => tab[0] === 'season'), button = document.querySelectorAll('#nav button')[index];
        if (!button) return;
        const slot = button.querySelector('i'), season = rules?.seasons.find(entry => entry.id === root.guiaData?.farm?.season);
        slot.replaceChildren(); if (season) seasonIcon(slot, season); else add(slot, 'span', '📅');
        button.setAttribute('aria-label', 'Estação' + (season ? ': ' + season.label : ''));
    }
    function picture(parent, item, snapshot, fallback) {
        const frame = add(parent, 'span', null, 'season-item-sprite');
        const live = [...(snapshot?.visuals?.bundles || []).flatMap(bundle => (bundle.items || []).map(entry => entry.item)),
            ...(snapshot?.visuals?.npcs || []).flatMap(npc => npc.gifts || [])].find(entry => entry &&
                (entry.qualifiedId === item.gameId || (!entry.qualifiedId && '(O)' + entry.id === item.gameId)));
        const img = add(frame, 'img'); img.alt = ''; img.loading = 'lazy';
        img.src = live?.icon || 'https://stardewvalleywiki.com/Special:Redirect/file/' + encodeURIComponent((item.englishName || item.name).replaceAll(' ', '_') + '.png');
        img.onerror = () => { img.remove(); add(frame, 'span', fallback); };
    }
    function tile(parent, item, snapshot, fallback = '🎒', routes = []) {
        const uniform = routes.length && routes.every(route => route.weather === routes[0].weather) ? routes[0].weather : null;
        const card = add(parent, 'article', null, 'season-tile' + (uniform === 'rainy' ? ' needs-rain' : uniform === 'sunny' ? ' needs-sun' : ''));
        const button = add(card, 'button', null, 'season-item-button'); button.type = 'button';
        picture(button, item, snapshot, fallback); add(button, 'span', item.name);
        button.onclick = () => root.openItemPage({ qualifiedId: item.gameId, name: item.name, wikiName: item.englishName, category: item.category });
        root.GuiaSeason.markItem(card, { qualifiedId: item.gameId });
        return card;
    }
    const time = value => String(Math.floor(value / 100) % 24).padStart(2, '0') + ':' + String(value % 100).padStart(2, '0');
    function routeSigns(parent, route, snapshot, season) {
        const line = add(parent, 'div', null, 'season-route');
        add(line, 'div', '📍 ' + route.locationLabel + (route.area === 'River' ? ' · rio' : route.area === 'Lake' ? ' · lago' : ''), 'season-route-place');
        const row = add(line, 'div', null, 'season-signs');
        if (route.weather) sign(row, { rainy: '🌧️', sunny: '☀️', both: '🌤️' }[route.weather] || '❔',
            { rainy: 'Chuva obrigatória', sunny: 'Tempo sem chuva', both: 'Qualquer clima' }[route.weather] || 'Clima não informado', route.weather);
        if (route.method === 'trap') sign(row, '🦞', 'Obtido com covo');
        else if (route.times) {
            const ranges = []; for (let i = 0; i < route.times.length; i += 2) ranges.push(time(route.times[i]) + '–' + time(route.times[i + 1]));
            sign(row, '◷ ' + ranges.join(' / '), 'Horários de pesca: ' + ranges.join(' e '), 'time');
            if (route.times.some((value, i) => i % 2 === 1 && value > 1800)) sign(row, '🌙', 'Também disponível após 18h');
        }
        if (route.weather === 'rainy' && season === 'winter' && !route.location.startsWith('Island')) sign(row, '🗿', 'No inverno, exige Totem de Chuva', 'warning');
        if (route.minFishingLevel) sign(row, '🎣 ' + route.minFishingLevel, 'Nível mínimo de pescaria: ' + route.minFishingLevel,
            snapshot?.player?.skills?.fishing < route.minFishingLevel ? 'warning' : '');
        const flags = { magicBait: ['🪱', 'Exige Isca Mágica'], legendary: ['👑', 'Peixe lendário: consulte a posição e o limite de captura'],
            quest: ['📜', 'Exige o pedido especial da Família Lendária'], position: ['🎯', 'Exige uma posição específica do jogador ou da boia'],
            distance: ['↗️', 'Arremesso distante da margem'], festival: ['🎪', 'Disponível durante o evento correspondente'] };
        for (const flag of route.flags || []) if (flags[flag]) sign(row, ...flags[flag]);
        if (route.days) sign(row, '📅 ' + route.days.join('–'), 'Dias ' + route.days.join(' a ') + ' da estação', 'time');
        if (route.conditional) sign(row, '🔒', 'Esta fonte tem condições adicionais');
    }
    function panel(parent, title, icon, count) {
        const section = add(parent, 'section', null, 'season-panel'), heading = add(section, 'h2');
        add(heading, 'span', icon); add(heading, 'span', title); if (count != null) add(heading, 'span', String(count), 'season-count');
        return section;
    }
    function empty(parent, message) { add(parent, 'div', message, 'season-empty'); }
    async function renderSeason() {
        const ticket = ++generation, target = document.querySelector('#content');
        target.replaceChildren(); const loading = add(target, 'div', 'Preparando a estação…', 'season-empty');
        try {
            const [catalog, data] = await Promise.all([root.GuiaItemCatalog.load(), loadRules()]);
            if (ticket !== generation || !active()) return;
            const snapshot = root.guiaData, farm = snapshot?.farm;
            if (follow && farm?.season) selected = farm.season;
            target.replaceChildren();
            const board = add(target, 'div', null, 'season-board'); board.dataset.season = selected || 'spring';
            const hero = add(board, 'header', null, 'season-hero'), art = add(hero, 'div', null, 'season-hero-icon');
            const season = data.seasons.find(entry => entry.id === selected);
            if (season) seasonIcon(art, season); else art.textContent = '📅';
            const heroText = add(hero, 'div'); add(heroText, 'h1', season?.label || 'Um plano para cada estação');
            add(heroText, 'p', !farm ? 'Escolha uma estação. Conecte sua fazenda para ver as pendências do Centro.' :
                farm.season === selected ? 'Dia ' + farm.day + ' de 28 · Ano ' + farm.year : 'Planejando outra estação · Ano ' + farm.year);
            if (farm?.weather && farm.season === selected) sign(hero, { rainy: '🌧️', snowy: '❄️', sunny: '☀️' }[farm.weather] || '🌤️', 'Clima de hoje na fazenda');
            const switches = add(board, 'nav', null, 'season-switch'); switches.setAttribute('aria-label', 'Escolher estação');
            for (const option of data.seasons) {
                const button = add(switches, 'button'); button.type = 'button'; seasonIcon(button, option); add(button, 'span', option.label);
                button.setAttribute('aria-pressed', String(option.id === selected));
                button.onclick = () => { selected = option.id; follow = option.id === farm?.season; weatherFilter = 'all'; renderSeason(); };
            }
            if (!season) return;
            const model = buildSeasonModel(catalog, data, snapshot, selected);
            const fishing = panel(board, 'Peixes da estação', '🎣', model.fish.length);
            const filters = add(fishing, 'div', null, 'season-filters'); filters.setAttribute('aria-label', 'Filtrar condições de pesca');
            for (const [key, glyph, label] of [['all', 'Todos', 'Todos os peixes'], ['rainy', '🌧️', 'Peixes que exigem chuva'], ['sunny', '☀️', 'Peixes sem chuva'], ['night', '🌙', 'Peixes noturnos']]) {
                const button = add(filters, 'button', glyph); button.type = 'button'; button.title = label; button.setAttribute('aria-label', label);
                button.setAttribute('aria-pressed', String(weatherFilter === key)); button.onclick = () => { weatherFilter = key; renderSeason(); };
            }
            const fishGrid = add(fishing, 'div', null, 'season-grid');
            const visibleFish = model.fish.filter(entry => weatherFilter === 'all' || entry.routes.some(route => weatherFilter === 'night' ?
                route.times.some((value, i) => i % 2 === 1 && value > 1800) : route.weather === weatherFilter));
            for (const entry of visibleFish) {
                const card = tile(fishGrid, entry.item, snapshot, '🐟', entry.routes);
                for (const route of entry.routes) routeSigns(card, route, snapshot, selected);
            }
            if (!visibleFish.length) empty(fishGrid, 'Nenhum peixe com esse filtro nesta estação.');
            const columns = add(board, 'div', null, 'season-columns');
            const stock = panel(columns, 'Sementes no Pierre', '🛒', model.seeds.filter(entry => !entry.locked).length);
            const seedGrid = add(stock, 'div', null, 'season-grid');
            function seedCard(parent, entry) {
                const card = tile(parent, entry.item, snapshot, '🌱');
                if (entry.price != null) add(card, 'div', '🪙 ' + new Intl.NumberFormat('pt-BR').format(entry.price) + ' ouros', 'season-price');
                if (entry.locked) sign(card, '🔒 ' + entry.minYear, 'À venda a partir do ano ' + entry.minYear, 'warning');
                if (entry.item.growthDays) sign(card, '🌱 ' + entry.item.growthDays, entry.item.growthDays + ' dias de crescimento sem bônus', 'time');
                const last = Number(entry.item.lastPlantingDay);
                if (last > 0) {
                    const late = farm?.season === selected && farm.day > last;
                    const deadline = add(card, 'div', (late ? '⌛ ' : '📅 ') + 'Plantar até dia ' + last, 'season-planting' + (late ? ' late' : ''));
                    deadline.title = 'Primeira colheita até o dia 28, sem fertilizante e com rega diária. Abra o item para ver outros prazos.';
                }
            }
            for (const entry of model.seeds.filter(entry => !entry.locked)) seedCard(seedGrid, entry);
            if (!seedGrid.children.length) empty(seedGrid, 'Sem sementes sazonais no estoque regular.');
            const locked = model.seeds.filter(entry => entry.locked);
            if (locked.length) {
                const details = add(stock, 'details', null, 'season-locked'); add(details, 'summary', '🔒 A partir do ano 2 · ' + locked.length);
                const grid = add(details, 'div', null, 'season-grid'); for (const entry of locked) seedCard(grid, entry);
            }
            add(stock, 'p', 'Estoque sazonal regular. A Lista de Estoque do Pierre pode ampliar a oferta fora da estação.', 'season-footnote');
            const center = panel(columns, 'Falta no Centro', '🌳', model.hasProgress ? model.bundles.reduce((sum, bundle) => sum + bundle.pending.length, 0) : null);
            if (!model.hasProgress) empty(center, 'Conecte sua fazenda para ver o que ainda falta entregar.');
            else if (!model.bundles.length) empty(center, '✓ Nenhuma pendência conhecida para esta estação.');
            const stages = model.hasInventory ? [
                { title: '🧺 Ainda falta coletar', include: entry => entry.toCollect > 0 },
                { title: '🎒 Já na mochila · falta entregar', include: entry => entry.toCollect === 0 }
            ] : [{ title: 'Pendências de entrega', include: () => true }];
            for (const stage of stages) {
            const groups = model.bundles.map(bundle => ({ ...bundle, pending: bundle.pending.filter(stage.include) })).filter(bundle => bundle.pending.length);
            if (groups.length) add(center, 'div', stage.title, 'season-stage-title');
            for (const bundle of groups) {
                const group = add(center, 'div', null, 'season-bundle'), title = add(group, 'h3', bundle.name || bundle.internalName);
                if (bundle.remaining != null) add(title, 'span', 'faltam ' + bundle.remaining + ' entregas', 'season-bundle-count');
                const grid = add(group, 'div', null, 'season-grid');
                for (const entry of bundle.pending) {
                    const card = tile(grid, entry.item, snapshot, '🎒', entry.routes);
                    const signs = add(card, 'div', null, 'season-signs'); sign(signs, '× ' + entry.quantity, 'Quantidade exigida: ' + entry.quantity, 'time');
                    if (entry.toCollect != null) sign(signs, entry.toCollect > 0 ? '🧺 ' + entry.toCollect : '🎒 ✓',
                        entry.toCollect > 0 ? 'Ainda precisa coletar ' + entry.toCollect + ' com a qualidade exigida' : 'Quantidade e qualidade já disponíveis na mochila', 'time');
                    if (entry.quality) sign(signs, ({ 1: '☆', 2: '★', 4: '✦' })[entry.quality] || '★',
                        'Qualidade mínima: ' + ({ 1: 'prata', 2: 'ouro', 4: 'irídio' })[entry.quality], 'quality');
                    if (entry.kind === 'crop') sign(signs, '🌱', 'Cultivo nesta estação');
                    if (entry.routes.length) routeSigns(card, entry.routes[0], snapshot, selected);
                }
            }
            }
            if (model.hasProgress && !model.hasChoiceCounts) add(center, 'p', 'Este save não informa quantos itens completam cada conjunto. Mostramos as opções não entregues.', 'season-footnote');
            const forage = panel(columns, 'Coleta da estação', '🧺', model.forage.length), forageGrid = add(forage, 'div', null, 'season-grid');
            for (const entry of model.forage) { const card = tile(forageGrid, entry.item, snapshot, '🌿'); for (const route of entry.routes) routeSigns(card, route, snapshot, selected); }
            if (!model.forage.length) empty(forageGrid, 'Sem coletas conhecidas nesta estação.');
            const traps = panel(columns, 'Nos covos', '🦞', model.traps.length), trapGrid = add(traps, 'div', null, 'season-grid');
            for (const entry of model.traps) { const card = tile(trapGrid, entry.item, snapshot, '🦞'); routeSigns(card, entry.routes[0], snapshot, selected); }
            lastSignature = signature(snapshot);
        } catch (error) {
            if (ticket !== generation || !active()) return;
            target.replaceChildren(loading);
            loading.textContent = 'Não foi possível carregar a estação.';
            const retry = add(loading, 'button', 'Tentar novamente'); retry.onclick = renderSeason;
        }
    }
    const signature = snapshot => JSON.stringify([snapshot?.farm, snapshot?.player?.skills?.fishing, snapshot?.inventory, snapshot?.visuals?.bundles?.map(bundle =>
        [bundle.id, bundle.completed, bundle.requiredCount, bundle.items?.map(entry => [entry.completed, entry.quantity, entry.quality, entry.item?.qualifiedId || entry.item?.id])])]);
    if (!tabs.some(tab => tab[0] === 'season')) tabs.splice(1, 0, ['season', '📅', 'Estação']);
    const originalNav = root.nav; root.nav = function () { originalNav(); updateNav(); };
    const originalRender = root.render; root.render = function () { if (active()) renderSeason(); else { generation++; originalRender(); } };
    root.addEventListener('guia:update', () => { updateNav(); refreshMarks(); if (active() && signature(root.guiaData) !== lastSignature) renderSeason(); });
    root.nav(); loadRules().catch(() => {});
})(globalThis);
