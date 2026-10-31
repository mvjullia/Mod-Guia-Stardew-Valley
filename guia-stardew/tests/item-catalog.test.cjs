const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = path.resolve(__dirname, '../../MEU MOD STARDEW VALLEY/guide-src');
const { createCatalog, hasValue } = require(path.join(src, 'item-catalog.js'));
const columns = JSON.parse(fs.readFileSync(path.join(src, 'item-fields.json'), 'utf8'));
const data = JSON.parse(fs.readFileSync(path.join(src, 'items.json'), 'utf8'));

test('catálogo real preserva as 35 colunas e os dias com fertilizante', () => {
    const catalog = createCatalog(columns, data);
    assert.equal(columns.length, 35);
    assert.ok(data.items.length > 0);
    assert.equal(data.schemaVersion, 2);
    assert.ok(columns.every(field => /^[a-z][A-Za-z0-9]*$/.test(field.key) && typeof field.label === 'string'));
    assert.ok(data.items.every(item => JSON.stringify(Object.keys(item)) === JSON.stringify(columns.map(field => field.key))));
    const values = Object.fromEntries(catalog.values({ qualifiedId: '(O)24', name: 'Nome antigo', price: 999 }));
    assert.equal(values.Nome, 'Chirívia');
    assert.equal(values['Preço de venda'], '35');
    assert.equal(values['Dias com Speed-Gro'], '3');
    assert.equal(values['Dias com Hyper Speed-Gro'], '2');
    assert.equal(values['Quem compra'], 'Pierre; caixa de remessas');
    assert.ok(!('Preço de compra' in values));
    assert.ok(!('Fonte de compra' in values));
    assert.ok(hasValue(0));
    for (const value of [null, undefined, '', ' ', ' Não verificado ', 'Não se aplica', NaN]) assert.equal(hasValue(value), false);
});

test('IDs qualificados impedem colisões; snapshots antigos usam ID e nome juntos', () => {
    const catalog = createCatalog(columns, { schemaVersion: 2, items: [
        { name: 'Chirívia', englishName: 'Parsnip', gameId: '(O)24' },
        { name: 'Outro', englishName: 'Other', gameId: '(TR)24' }
    ] });
    assert.equal(catalog.find({ qualifiedId: '(TR)24' }).name, 'Outro');
    assert.equal(catalog.find({ id: '24', wikiName: 'Parsnip' }).name, 'Chirívia');
    assert.equal(catalog.find({ id: '24' }), null);
    assert.equal(catalog.find({ id: '999', wikiName: 'Parsnip' }), null);
    assert.equal(catalog.find({ qualifiedId: '(F)24', wikiName: 'Parsnip' }), null);
    assert.equal(catalog.find({ name: 'CHIRÍVIA' }).name, 'Chirívia');
    assert.deepEqual(Object.fromEntries(catalog.values({ id: '(O)modded', name: 'Item do mod', price: 0 })), {
        Nome: 'Item do mod', 'Preço de venda': 0, 'ID do jogo': '(O)modded'
    });
});

test('snapshot anterior continua encontrando os itens mesmo com IDs sem tipo', () => {
    const catalog = createCatalog(columns, data);
    const snapshot = JSON.parse(fs.readFileSync(path.resolve(src, '../../auditoria-itens/itens-atuais.json'), 'utf8'));
    const found = snapshot.itens.filter(item => catalog.find(item));
    // Furniture and objects can share numeric IDs in the old save export.
    assert.ok(found.some(item => item.wikiName === 'Parsnip'));
    assert.ok(found.some(item => item.wikiName === 'Pumpkin'));
    assert.ok(found.length > 200, `Encontrados ${found.length} de ${snapshot.itens.length}`);
});

test('referências preferem o nome completo, respeitam palavras e preservam o texto', () => {
    const catalog = createCatalog(columns, data);
    const text = 'Plante sementes de chirívia e SEMENTES DE\nCHIRÍVIA. Chirívia, Parsnip Seeds; superchirívia não é referência.';
    const parts = catalog.references(text, '(O)24');
    assert.equal(parts.map(part => part.text).join(''), text);
    assert.deepEqual(parts.filter(part => part.item).map(part => [part.text, part.item.gameId]), [
        ['sementes de chirívia', '(O)472'], ['SEMENTES DE\nCHIRÍVIA', '(O)472'], ['Parsnip Seeds', '(O)472']
    ]);
    assert.ok(!catalog.references('Sementes de Chirívia', '(O)472').some(part => part.item));
});

test('URLs, nomes ambíguos e caracteres de expressão regular são tratados corretamente', () => {
    const catalog = createCatalog(columns, { schemaVersion: 2, items: [
        { gameId: '(O)1', name: 'Leite', englishName: 'Milk' },
        { gameId: '(O)2', name: 'Leite', englishName: 'Other Milk' },
        { gameId: '(O)3', name: 'Fertilizante (Básico)', englishName: 'Fertilizer (Basic)' }
    ] });
    const text = 'Leite. https://example.com/Milk?q=Leite Fertilizante (Básico) e Fertilizer (Basic).';
    const parts = catalog.references(text);
    assert.equal(parts.map(part => part.text).join(''), text);
    assert.deepEqual(parts.filter(part => part.url).map(part => part.url), ['https://example.com/Milk?q=Leite']);
    assert.deepEqual(parts.filter(part => part.item).map(part => part.item.gameId), ['(O)3', '(O)3']);
    assert.equal(catalog.references(35).map(part => part.text).join(''), '35');
});

// Small DOM harness exercises async rendering through the public modal API.
function browser(fetcher, search) {
    class Element {
        constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.parent = null; this._text = ''; }
        append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
        replaceChildren(...children) { for (const child of this.children) child.parent = null; this.children = []; this._text = ''; this.append(...children); }
        set textContent(value) { this.replaceChildren(); this._text = value; }
        get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
        get isConnected() { return this === body || Boolean(this.parent?.isConnected); }
        setAttribute(key, value) { this.attrs[key] = value; }
    }
    const body = new Element('div');
    const modal = { open: false, classList: { add() {}, remove() {} }, setAttribute() {}, showModal() { this.open = true; } };
    const document = {
        createElement: tag => new Element(tag),
        createTextNode: text => { const el = new Element('#text'); el.textContent = text; return el; },
        querySelector: selector => selector === '#dialog' ? modal : body
    };
    const context = { document, fetch: fetcher };
    if (search !== undefined) { context.location = { search }; context.URLSearchParams = URLSearchParams; }
    vm.runInNewContext(fs.readFileSync(path.join(src, 'item-catalog.js'), 'utf8'), context);
    return { context, body, modal };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('modais compartilham o carregamento, ocultam lacunas e ignoram abertura anterior', async () => {
    const requests = [];
    const { context, body } = browser(file => new Promise(resolve => requests.push({ file, resolve })));
    context.openItemPage({ qualifiedId: '(O)24', name: 'Chirívia' });
    const oldFields = body.children[1];
    context.openItemPage({ qualifiedId: '(O)276', name: 'Pumpkin' });
    assert.equal(requests.length, 2);
    for (const request of requests) request.resolve({ ok: true, json: async () => request.file === 'items.json' ? data : columns });
    await flush();
    assert.match(oldFields.textContent, /Carregando/);
    assert.match(body.textContent, /Abóbora/);
    assert.equal(body.children[0].children[0].textContent, 'Abóbora');
    assert.match(body.textContent, /Dias com Hyper Speed-Gro/);
    assert.doesNotMatch(body.textContent, /Não verificado|Não se aplica|Como conseguir|Preço base/);
    for (const p of body.children[1].children) {
        assert.equal(p.children[0].tagName, 'strong');
        assert.equal(p.children[0].className, 'item-field-label');
        assert.equal(p.children[1].tagName, 'span');
        assert.equal(p.children[1].className, 'item-field-value');
        assert.doesNotMatch(p.children[0].textContent, /growthDays|salePrice|gameId/);
    }
    const links = body.children[1].children.flatMap(p => p.children[1].children).filter(el => el.tagName === 'a' && el.className !== 'item-reference');
    assert.ok(links.length > 0);
    assert.ok(links.every(link => /^https?:/.test(link.href) && link.rel === 'noopener noreferrer'));
    context.openItemPage({ qualifiedId: '(O)24', name: 'Chirívia' });
    await flush();
    assert.equal(requests.length, 2);
    assert.match(body.textContent, /Chirívia/);
});

test('clicar em sementes de chirívia abre a modal das sementes pelo ID qualificado', async () => {
    let calls = 0;
    const { context, body } = browser(async file => {
        calls++;
        return { ok: true, json: async () => file === 'items.json' ? data : columns };
    });
    context.openItemPage({ qualifiedId: '(O)24', name: 'Chirívia' });
    await flush();
    const links = body.children[1].children.flatMap(p => p.children[1].children).filter(el => el.className === 'item-reference');
    const seeds = links.find(link => link.attrs['data-item-id'] === '(O)472');
    assert.ok(seeds);
    assert.equal(seeds.textContent, 'Sementes de Chirívia');
    assert.equal(seeds.href, '?item=(O)472');
    let prevented = false;
    seeds.onclick({ button: 0, ctrlKey: true, preventDefault() { prevented = true; } });
    assert.equal(prevented, false); // The href remains available for a new tab.
    seeds.onclick({ button: 0, preventDefault() { prevented = true; } });
    await flush();
    assert.equal(prevented, true);
    assert.equal(body.children[0].children[0].textContent, 'Sementes de Chirívia');
    assert.match(body.textContent, /ID do jogo: \(O\)472/);
    assert.equal(calls, 2); // Reuse the already loaded catalog.
    const back = body.children[0].children.find(el => el.className === 'item-reference-back');
    assert.ok(back);
    back.onclick(); await flush();
    assert.equal(body.children[0].children[0].textContent, 'Chirívia');
    assert.ok(!body.children[0].children.some(el => el.className === 'item-reference-back'));
    seeds.onclick({ button: 0, preventDefault() {} }); await flush();
    context.openItemPage({ qualifiedId: '(O)276', name: 'Abóbora' }); await flush();
    assert.ok(!body.children[0].children.some(el => el.className === 'item-reference-back')); // A new opening resets the trail.
});

test('o destino da referência abre diretamente em uma nova página', async () => {
    const { body, modal } = browser(async file => ({ ok: true, json: async () => file === 'items.json' ? data : columns }), '?item=(O)472');
    await flush();
    assert.equal(modal.open, true);
    assert.equal(body.children[0].children[0].textContent, 'Sementes de Chirívia');
    assert.match(body.textContent, /ID do jogo: \(O\)472/);
});

test('falha de carregamento pode ser repetida na próxima abertura', async () => {
    let fail = true, calls = 0;
    const { context, body } = browser(async file => {
        calls++;
        if (fail) throw Error('Offline');
        return { ok: true, json: async () => file === 'items.json' ? data : columns };
    });
    context.openItemPage({ id: '(O)24', name: 'Chirívia' });
    await flush();
    assert.match(body.textContent, /Não foi possível carregar/);
    fail = false;
    context.openItemPage({ id: '(O)24', name: 'Chirívia' });
    await flush();
    assert.equal(calls, 4);
    assert.match(body.textContent, /Tempo de crescimento: 4/);
});
