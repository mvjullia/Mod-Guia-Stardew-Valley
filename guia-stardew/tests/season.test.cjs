const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = path.resolve(__dirname, '../../MEU MOD STARDEW VALLEY/guide-src');
const { createCatalog } = require(path.join(src, 'item-catalog.js'));
const { buildSeasonModel } = require(path.join(src, 'season.js'));
const rules = JSON.parse(fs.readFileSync(path.join(src, 'season-guide.json'), 'utf8'));
const catalog = createCatalog(JSON.parse(fs.readFileSync(path.join(src, 'item-fields.json'), 'utf8')),
    JSON.parse(fs.readFileSync(path.join(src, 'items.json'), 'utf8')));
const entry = (id, completed = false, quality = 0) => ({ item: { qualifiedId: id, id: id.replace('(O)', '') }, quantity: quality ? 5 : 1, quality, completed, isMoney: false });
const snapshot = () => ({ farm: { saveId: '1', season: 'summer', day: 18, year: 1, weather: 'rainy' }, player: { skills: { fishing: 4 } },
    visuals: { bundles: [
        { id: 1, name: 'Peixes do Oceano', requiredCount: 3, items: [entry('(O)150'), entry('(O)130', true), entry('(O)701')] },
        { id: 2, name: 'Plantações de qualidade', requiredCount: 3, items: [entry('(O)254', false, 2), entry('(O)276')] },
        { id: 3, name: 'Opções concluídas', requiredCount: 2, items: [entry('(O)150', true), entry('(O)130', true), entry('(O)701')] }
    ], npcs: [] } });

test('peixes usam estação por local e clima/horário originais do jogo', () => {
    const summer = buildSeasonModel(catalog, rules, snapshot(), 'summer');
    const catfish = summer.fish.find(entry => entry.item.gameId === '(O)143');
    assert.ok(catfish.routes.some(route => route.location === 'Woods'));
    assert.ok(!catfish.routes.some(route => route.location === 'Town'));
    assert.ok(catfish.routes.every(route => route.weather === 'rainy'));
    const snapper = summer.fish.find(entry => entry.item.gameId === '(O)150');
    assert.ok(snapper.routes.some(route => route.weather === 'rainy' && route.times.join() === '600,1900'));
    const puffer = summer.fish.find(entry => entry.item.gameId === '(O)128');
    assert.ok(puffer.routes.some(route => route.weather === 'sunny' && route.times.join() === '1200,1600'));
    assert.ok(!summer.fish.some(entry => entry.item.gameId === '(O)151'));
    const winter = buildSeasonModel(catalog, rules, snapshot(), 'winter');
    assert.ok(winter.fish.some(entry => entry.item.gameId === '(O)151'));
    assert.equal(winter.traps.length, 10);
});

test('Pierre respeita estoque sazonal, ano 2 e preços de sementes/mudas', () => {
    const data = snapshot(), spring = buildSeasonModel(catalog, rules, data, 'spring');
    assert.equal(spring.seeds.find(entry => entry.item.gameId === '(O)472').price, 20);
    assert.equal(spring.seeds.find(entry => entry.item.gameId === '(O)476').locked, true);
    assert.equal(spring.seeds.find(entry => entry.item.gameId === '(O)273').locked, true);
    assert.ok(!spring.seeds.some(entry => entry.item.gameId === '(O)479'));
    assert.equal(spring.seeds.find(entry => entry.item.gameId === '(O)628').price, 3400);
    const summer = buildSeasonModel(catalog, rules, data, 'summer');
    assert.equal(summer.seeds.find(entry => entry.item.gameId === '(O)431').price, 200);
    assert.equal(summer.seeds.find(entry => entry.item.gameId === '(O)485').locked, true);
    data.farm.year = 2;
    assert.equal(buildSeasonModel(catalog, rules, data, 'summer').seeds.find(entry => entry.item.gameId === '(O)485').locked, false);
});

test('Centro mostra só pendências sazonais reais, preservando quantidade e qualidade', () => {
    const model = buildSeasonModel(catalog, rules, snapshot(), 'summer');
    assert.equal(model.hasProgress, true);
    assert.ok(!model.bundles.some(bundle => bundle.id === 3));
    assert.ok(!model.bundles.flatMap(bundle => bundle.pending).some(entry => entry.item.gameId === '(O)130'));
    assert.ok(!model.bundles.flatMap(bundle => bundle.pending).some(entry => entry.item.gameId === '(O)276'));
    const melon = model.bundles.flatMap(bundle => bundle.pending).find(entry => entry.item.gameId === '(O)254');
    assert.equal(melon.quality, 2); assert.equal(melon.quantity, 5);
    assert.equal(model.bundles.find(bundle => bundle.id === 1).remaining, 2);
    assert.equal(buildSeasonModel(catalog, rules, null, 'summer').hasProgress, false);
    assert.equal(buildSeasonModel(catalog, rules, null, 'summer').bundles.length, 0);
});

test('pendências distinguem o que falta coletar do que já está na mochila', () => {
    const data = snapshot(); data.inventory = [
        { qualifiedId: '(O)150', quantity: 1, quality: 0 },
        { qualifiedId: '(O)254', quantity: 3, quality: 2 },
        { qualifiedId: '(O)254', quantity: 10, quality: 0 }
    ];
    const model = buildSeasonModel(catalog, rules, data, 'summer'), pending = model.bundles.flatMap(bundle => bundle.pending);
    assert.equal(model.hasInventory, true);
    assert.equal(pending.find(entry => entry.item.gameId === '(O)150').toCollect, 0);
    assert.equal(pending.find(entry => entry.item.gameId === '(O)254').toCollect, 2);
    assert.equal(pending.find(entry => entry.item.gameId === '(O)701').toCollect, 1);
});

function browser(data = snapshot()) {
    class Element {
        constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.dataset = {}; this._text = ''; }
        append(child) { child.parent = this; this.children.push(child); }
        replaceChildren(...children) { this.children = []; this._text = ''; for (const child of children) this.append(child); }
        set textContent(value) { this._text = String(value); this.children = []; }
        get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
        setAttribute(key, value) { this.attrs[key] = value; }
        remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
        querySelector(selector) { return all(this).find(child => child.tagName === selector); }
        querySelectorAll(selector) { return all(this).filter(child => child.tagName === selector); }
        replaceWith(other) { const parent = this.parent, index = parent.children.indexOf(this); if (other.parent) other.parent.children = other.parent.children.filter(child => child !== other); parent.children[index] = other; other.parent = parent; this.parent = null; }
    }
    const content = new Element('main'), nav = new Element('nav'), head = new Element('head'), events = new Map(), opened = [];
    const document = { head, createElement: tag => new Element(tag), querySelector: selector => selector === '#content' ? content : null,
        querySelectorAll: () => nav.children };
    const context = { document, current: 'home', tabs: [['home', '🏡', 'Fazendeiro'], ['center', '🌳', 'Centro'], ['gifts', '🎁', 'Amizade']], guiaData: data,
        GuiaItemCatalog: { load: async () => catalog }, fetch: async () => ({ ok: true, json: async () => rules }),
        openItemPage: item => opened.push(item), render() {},
        nav() { nav.replaceChildren(); for (const [id, icon, label] of context.tabs) { const button = new Element('button');
            button.append(new Element('i')); button.append(new Element('span')); button.children[1].textContent = label; nav.append(button); } },
        addEventListener(type, fn) { events.set(type, fn); } };
    vm.runInNewContext(fs.readFileSync(path.join(src, 'season.js'), 'utf8'), context);
    return { context, content, nav, opened, events };
}
function all(node) { return node.children.flatMap(child => [child, ...all(child)]); }
const hasClass = (node, name) => (node.className || '').split(' ').includes(name);
const flush = () => new Promise(resolve => setImmediate(resolve));

test('menu e painel usam ícone atual, chuva visual acessível e modais corretas', async () => {
    const b = browser(); await flush();
    assert.equal(b.nav.children[1].attrs['aria-label'], 'Estação: Verão');
    assert.match(b.nav.children[1].querySelector('img').src, /Summer\.png/);
    b.context.current = 'season'; b.context.render(); await flush();
    for (const title of ['Peixes da estação', 'Sementes no Pierre', 'Falta no Centro', 'Coleta da estação', 'Nos covos']) assert.ok(b.content.textContent.includes(title));
    const rainy = all(b.content).find(node => hasClass(node, 'rainy'));
    assert.equal(rainy.textContent, '🌧️'); assert.equal(rainy.attrs['aria-label'], 'Chuva obrigatória');
    assert.ok(!b.content.textContent.includes('Chuva obrigatória'));
    const seeds = all(b.content).find(node => hasClass(node, 'season-item-button') && node.textContent.includes('Sementes de Melão'));
    seeds.onclick(); assert.equal(b.opened.at(-1).qualifiedId, '(O)479');
    const winter = all(b.content).find(node => node.tagName === 'button' && node.textContent === 'Inverno'); winter.onclick(); await flush();
    assert.equal(b.content.children[0].dataset.season, 'winter');
    assert.equal(b.nav.children[1].attrs['aria-label'], 'Estação: Verão'); // Preview selection does not change the save's icon.
});

test('sem save, a prévia não inventa progresso; atualizar estação atual troca o painel', async () => {
    const offline = browser(null); await flush(); offline.context.current = 'season'; offline.context.render(); await flush();
    assert.match(offline.content.textContent, /Escolha uma estação/);
    const summer = all(offline.content).find(node => node.tagName === 'button' && node.textContent === 'Verão'); summer.onclick(); await flush();
    assert.match(offline.content.textContent, /Conecte sua fazenda para ver o que ainda falta entregar/);
    const live = browser(); await flush(); live.context.current = 'season'; live.context.render(); await flush();
    live.context.guiaData.farm.season = 'fall'; live.events.get('guia:update')(); await flush();
    assert.equal(live.content.children[0].dataset.season, 'fall');
    assert.equal(live.nav.children[1].attrs['aria-label'], 'Estação: Outono');
});

test('bordas nos itens acompanham a estação real e desaparecem ao trocar de estação', async () => {
    const b = browser(); await flush();
    const melon = b.context.document.createElement('button'), pumpkin = b.context.document.createElement('div');
    b.context.GuiaSeason.markItem(melon, { qualifiedId: '(O)254' });
    b.context.GuiaSeason.markItem(pumpkin, { qualifiedId: '(O)276' }); await flush();
    assert.ok(hasClass(melon, 'seasonal-available')); assert.ok(!hasClass(pumpkin, 'seasonal-available'));
    assert.ok(melon.children.some(node => node.className === 'season-available-badge'));
    b.context.guiaData.farm.season = 'fall'; b.events.get('guia:update')(); await flush();
    assert.ok(!hasClass(melon, 'seasonal-available')); assert.ok(hasClass(pumpkin, 'seasonal-available'));
    assert.equal(melon.children.length, 0);
});

test('SSE de relógio preserva painel e ícone; inventário novo reaproveita as imagens', async () => {
    const b = browser(); await flush(); b.context.current = 'season'; b.context.render(); await flush();
    const board = b.content.children[0], icon = b.nav.children[1].querySelector('img');
    const image = all(board).find(node => node.tagName === 'img' && String(node.src).includes('Red_Snapper'));
    assert.ok(image);
    b.context.guiaData.farm.time = 1230; b.events.get('guia:update')(); await flush();
    assert.equal(b.content.children[0], board); assert.equal(b.nav.children[1].querySelector('img'), icon);
    b.context.guiaData.inventory = [{ qualifiedId: '(O)150', quantity: 1, quality: 0 }]; b.events.get('guia:update')();
    assert.equal(b.content.children[0], board, 'Refresh deve manter a tela anterior até terminar');
    await flush();
    assert.ok(all(b.content).includes(image), 'Imagem já carregada deve ser movida, não criada novamente');
});
