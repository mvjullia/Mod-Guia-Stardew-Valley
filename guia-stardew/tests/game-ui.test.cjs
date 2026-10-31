const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = path.resolve(__dirname, '../../MEU MOD STARDEW VALLEY/guide-src');

function browser({ muted = false, storageBlocked = false, audioBlocked = false } = {}) {
    class Element {
        constructor() { this.listeners = new Map(); this.attrs = {}; this.children = []; }
        addEventListener(type, fn, capture = false) {
            const list = this.listeners.get(type) || []; list.push({ fn, capture }); this.listeners.set(type, list);
        }
        append(child) { this.children.push(child); }
        setAttribute(key, value) { this.attrs[key] = value; }
        getAttribute(key) { return this.attrs[key]; }
        closest() { return this; }
        contains(other) { return other === this; }
        fire(type, details = {}, action = () => {}) {
            const event = { type, isTrusted: true, pointerType: 'mouse', target: this, relatedTarget: null, ...details };
            const listeners = this.listeners.get(type) || [];
            for (const { fn, capture } of listeners) if (capture) fn(event);
            action();
            for (const { fn, capture } of listeners) if (!capture) fn(event);
        }
    }
    const document = new Element(), sidebar = new Element(), modal = new Element(); modal.open = false;
    document.head = new Element(); document.createElement = () => new Element();
    document.querySelector = selector => selector === '.sidebar' ? sidebar : modal;
    let now = 1000;
    const played = [], players = [], storage = new Map(muted ? [['guia-menu-sounds', 'off']] : []);
    const context = {
        document, performance: { now: () => now },
        localStorage: {
            getItem(key) { if (storageBlocked) throw Error(); return storage.get(key); },
            setItem(key, value) { if (storageBlocked) throw Error(); storage.set(key, value); }
        },
        Audio: class {
            constructor(file) { this.file = file; players.push(this); }
            play() { played.push(this.file); return audioBlocked ? Promise.reject(Error('Autoplay')) : Promise.resolve(); }
            pause() { this.paused = true; }
        }
    };
    vm.runInNewContext(fs.readFileSync(path.join(source, 'game-ui.js'), 'utf8'), context);
    return { document, modal, storage, played, players, button: new Element(), toggle: sidebar.children[0].children[0],
        advance() { now += 101; },
        click(target, action) { document.fire('click', { target }, () => { target.fire('click'); action?.(); }); }
    };
}

test('cursor original e peso normal dos valores; áudio só após interação', () => {
    const b = browser();
    const css = b.document.head.children[0].textContent;
    assert.match(css, /cursor:url\('game-cursor\.png'\) 0 0,auto/);
    assert.match(css, /item-field-value[^}]*font-weight:400/);
    assert.match(css, /item-field-label\{font-weight:800\}/);
    b.document.fire('pointerover', { target: b.button });
    assert.equal(b.played.length, 0);
    b.document.fire('pointerdown');
    b.advance(); b.document.fire('pointerover', { target: b.button });
    assert.deepEqual(b.played, ['menu-hover.wav']);
    b.click(b.button);
    assert.equal(b.played.at(-1), 'menu-select.wav');
    assert.ok(b.players.every(player => player.volume === 0.3));
});

test('abrir e fechar modal, incluindo Escape, usam efeitos distintos', () => {
    const b = browser(); b.document.fire('pointerdown');
    b.click(b.button, () => { b.modal.open = true; });
    assert.deepEqual(b.played, ['menu-open.wav']);
    b.click(b.button, () => { b.modal.open = false; });
    assert.equal(b.played.length, 1); // The subsequent close event owns the sound.
    b.modal.fire('close'); assert.equal(b.played.at(-1), 'menu-close.wav');
    b.modal.open = true; b.document.fire('keydown', { key: 'Escape' });
    b.modal.open = false; b.modal.fire('close');
    assert.equal(b.played.at(-1), 'menu-close.wav');
});

test('clique no fundo fecha modal; clique interno e arrasto para fora não fecham', () => {
    const b = browser(), dialog = b.modal; dialog.tagName = 'DIALOG'; dialog.open = true;
    dialog.getBoundingClientRect = () => ({ left: 100, top: 100, right: 500, bottom: 500 });
    dialog.close = () => { dialog.open = false; };
    const fire = (type, x, y) => b.document.fire(type, { target: dialog, clientX: x, clientY: y });
    fire('pointerdown', 150, 150); fire('click', 150, 150); assert.equal(dialog.open, true);
    fire('pointerdown', 150, 150); fire('click', 20, 20); assert.equal(dialog.open, true);
    fire('pointerdown', 20, 20); fire('click', 20, 20); assert.equal(dialog.open, false);
});

test('silenciar persiste preferência e para os efeitos ativos', () => {
    const b = browser(); b.document.fire('pointerdown'); b.click(b.button);
    b.click(b.toggle);
    assert.equal(b.toggle.attrs['aria-pressed'], 'false');
    assert.equal(b.storage.get('guia-menu-sounds'), 'off');
    assert.ok(b.players.every(player => player.paused));
    const count = b.played.length; b.click(b.button); assert.equal(b.played.length, count);
    b.click(b.toggle); assert.equal(b.toggle.attrs['aria-pressed'], 'true');
    assert.equal(b.storage.get('guia-menu-sounds'), 'on');
    assert.equal(b.played.at(-1), 'menu-select.wav');
    const muted = browser({ muted: true }); muted.document.fire('pointerdown'); muted.click(muted.button);
    assert.equal(muted.played.length, 0);
});

test('navegação por teclado funciona sem armazenamento e sem permissão de áudio', async () => {
    const b = browser({ storageBlocked: true, audioBlocked: true });
    b.document.fire('pointerdown'); b.document.fire('focusin', { target: b.button });
    assert.equal(b.played.length, 0); // Programmatic dialog focus does not double the click sound.
    b.document.fire('keydown', { key: 'Tab' }); b.advance();
    b.document.fire('focusin', { target: b.button });
    assert.equal(b.played.at(-1), 'menu-hover.wav');
    b.click(b.button); b.click(b.toggle);
    await new Promise(resolve => setImmediate(resolve)); // Rejected play promises must be handled.
    assert.equal(b.toggle.attrs['aria-pressed'], 'false');
});

test('recursos empacotados são PNG e WAV PCM válidos, com rastreabilidade', () => {
    const png = fs.readFileSync(path.join(source, 'game-cursor.png'));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 32); assert.equal(png.readUInt32BE(20), 32);
    const metadata = JSON.parse(fs.readFileSync(path.join(source, 'game-ui-sources.json'), 'utf8'));
    assert.match(metadata.cursor.sha256, /^[a-f0-9]{64}$/);
    assert.match(metadata.audio.sha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(metadata.audio.cues.map(c => c.cue), ['smallSelect', 'select', 'bigSelect', 'bigDeSelect']);
    for (const cue of metadata.audio.cues) {
        const wav = fs.readFileSync(path.join(source, cue.file));
        assert.equal(wav.subarray(0, 4).toString(), 'RIFF'); assert.equal(wav.subarray(8, 12).toString(), 'WAVE');
        assert.equal(wav.readUInt16LE(20), 1); assert.equal(wav.readUInt16LE(34), 16);
        assert.equal(wav.readUInt32LE(40), wav.length - 44);
        assert.ok(wav.readUInt32LE(24) > 40000);
        const samples = Array.from({ length: (wav.length - 44) / 2 }, (_, i) => wav.readInt16LE(44 + i * 2));
        assert.ok(samples.some(sample => Math.abs(sample) > 100));
    }
});
