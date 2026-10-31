const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { createServer } = require('../api/server.cjs');
const source = path.resolve(__dirname, '../../MEU MOD STARDEW VALLEY/guide-src');
const { groupPhotos } = require(path.join(source, 'albums.js'));
const photo = { id: 'a'.repeat(32), imageId: 'b'.repeat(32), kind: 'center-forgot', title: 'Levei o item e esqueci de deixar',
    description: 'Quando Maria entrou no Centro com Chirívia e saiu sem entregar.', playerName: 'Maria', location: 'CommunityCenter',
    year: 1, season: 'spring', day: 2, time: 900, capturedAt: '2026-10-31T00:00:00Z' };

test('álbuns agrupam dias e rejeitam identificadores de arquivo arbitrários', () => {
    const days = groupPhotos([photo, { ...photo, id: 'c'.repeat(32), day: 3 }, { ...photo, imageId: '../../segredo' }]);
    assert.equal(days.length, 2); assert.equal(days[0].photos.length, 1);
});

function browser(responseFactory) {
    class Element {
        constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this._text = ''; }
        append(child) { this.children.push(child); }
        replaceChildren(...children) { this.children = children; this._text = ''; }
        set textContent(value) { this._text = String(value); this.children = []; }
        get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
        setAttribute(key, value) { this.attrs[key] = value; }
    }
    const content = new Element('main'), body = new Element('div'), classes = new Set();
    const dialog = { open: false, setAttribute() {}, classList: { add: key => classes.add(key), remove: (...keys) => keys.forEach(key => classes.delete(key)) }, showModal() { this.open = true; } };
    const events = new Map(); let calls = 0;
    const context = { document: { head: new Element('head'), createElement: tag => new Element(tag), querySelector: selector =>
        selector === '#content' ? content : selector === '#dialogbody' ? body : dialog },
        tabs: [], current: 'albums', guiaData: { farm: { saveId: '1' }, player: { multiplayerId: '2' }, albums: { version: 1, enabled: true } },
        nav() {}, render() {}, addEventListener: (type, fn) => events.set(type, fn),
        fetch: async () => { calls++; return responseFactory(); } };
    vm.runInNewContext(fs.readFileSync(path.join(source, 'albums.js'), 'utf8'), context);
    return { context, content, body, dialog, events, get calls() { return calls; } };
}
const all = node => node.children.flatMap(child => [child, ...all(child)]);
const flush = () => new Promise(resolve => setImmediate(resolve));

test('fotos têm legenda abaixo e abrem na modal sem transformar texto em HTML', async () => {
    const malicious = { ...photo, description: '<img src=x onerror=alert(1)> é apenas texto' };
    const b = browser(async () => ({ ok: true, json: async () => ({ supported: true, active: true, photos: [malicious] }) }));
    b.context.render(); await flush();
    const figure = all(b.content).find(node => node.tagName === 'figure');
    assert.equal(figure.children[0].tagName, 'button'); assert.equal(figure.children[1].tagName, 'figcaption');
    assert.match(figure.children[1].textContent, /Levei o item/); assert.match(figure.children[1].textContent, /onerror/);
    figure.children[0].onclick();
    assert.equal(b.dialog.open, true); assert.equal(b.body.children[1].src, '/api/albums/photos/' + photo.imageId + '.png');
    assert.equal(b.body.children[2].textContent, malicious.description);
    assert.match(b.body.textContent, /Foto registrada na chegada/);
    assert.equal(all(b.body).filter(node => node.tagName === 'img').length, 1);
});

test('novas fotos atualizam o álbum; servidor sem suporte não entra em repetição a cada snapshot', async () => {
    const b = browser(async () => ({ ok: true, json: async () => ({ supported: true, active: true, photos: [] }) }));
    b.context.render(); await flush(); assert.match(b.content.textContent, /primeira história/);
    b.events.get('guia:update')(); await flush(); assert.equal(b.calls, 1);
    b.context.guiaData.albums.version++; b.events.get('guia:update')(); await flush(); assert.equal(b.calls, 2);
    const unavailable = browser(async () => ({ ok: false, status: 503 })); unavailable.context.render(); await flush();
    unavailable.events.get('guia:update')(); await flush(); assert.equal(unavailable.calls, 1);
    assert.match(unavailable.content.textContent, /Abra o guia pelo mod/);
});

test('API exige sessão e só serve fotos indexadas da fazenda e jogador ativos', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'guia-albums-'));
    const active = path.join(directory, '123', '456'); fs.mkdirSync(active, { recursive: true });
    fs.writeFileSync(path.join(active, 'index.json'), JSON.stringify([photo]));
    const png = fs.readFileSync(path.join(source, 'game-cursor.png')); fs.writeFileSync(path.join(active, photo.imageId + '.png'), png);
    fs.writeFileSync(path.join(active, 'c'.repeat(32) + '.png'), png);
    const origin = 'http://127.0.0.1:19088', token = 'album-test-'.repeat(6), server = createServer({ token, origin, albumDir: directory });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(19088, '127.0.0.1', resolve); });
    const request = (url, options = {}) => fetch(origin + url, { ...options, signal: AbortSignal.timeout(5000) });
    const data = { schemaVersion: 1, exportedAt: '2026-10-31T00:00:00Z', farm: { saveId: '123', name: 'Teste', year: 1, season: 'spring', day: 2 },
        player: { multiplayerId: '456', steamId: null, name: 'Maria', isMale: false, skills: { farming: 1, fishing: 1, foraging: 1, mining: 1, combat: 1 } } };
    try {
        assert.equal((await request('/api/albums')).status, 401);
        assert.equal((await request('/api/albums/photos/' + photo.imageId + '.png')).status, 401);
        const session = await request('/api/session', { method: 'POST', body: JSON.stringify({ token }) });
        const headers = { Cookie: session.headers.get('set-cookie').split(';')[0] };
        assert.equal((await (await request('/api/albums', { headers })).json()).active, false);
        const send = snapshot => request('/api/snapshots', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify(snapshot) });
        assert.equal((await send(data)).status, 202);
        const list = await (await request('/api/albums', { headers })).json(); assert.equal(list.photos[0].title, photo.title);
        const image = await request('/api/albums/photos/' + photo.imageId + '.png', { headers });
        assert.equal(image.headers.get('content-type'), 'image/png'); assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
        assert.equal((await request('/api/albums/photos/' + 'c'.repeat(32) + '.png', { headers })).status, 404);
        await send({ ...data, player: { ...data.player, multiplayerId: '789' } });
        assert.equal((await (await request('/api/albums', { headers })).json()).photos.length, 0);
        assert.equal((await request('/api/albums/photos/' + photo.imageId + '.png', { headers })).status, 404);
    } finally {
        server.closeStreams(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
        const resolved = fs.realpathSync(directory), temp = fs.realpathSync(os.tmpdir());
        assert.ok(resolved.startsWith(temp + path.sep) && path.basename(resolved).startsWith('guia-albums-'));
        fs.rmSync(resolved, { recursive: true });
    }
});
