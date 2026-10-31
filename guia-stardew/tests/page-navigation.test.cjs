const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('navegação acompanha seções, posição e substituição do conteúdo', () => {
    class Element {
        constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.dataset = {}; this.style = {}; this.textContent = ''; this.hidden = false; this.classes = new Set(); this.classList = { toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name) }; }
        append(...nodes) { this.children.push(...nodes); }
        replaceChildren(...nodes) { this.children = nodes; }
        setAttribute(k, v) { this.attrs[k] = v; }
        removeAttribute(k) { delete this.attrs[k]; }
        getBoundingClientRect() { return { left: 250, top: this.top ?? 300 }; }
        closest() { return null; }
        querySelectorAll() { return this.headings || []; }
        scrollIntoView(options) { this.scrolled = options; }
    }
    const content = new Element('main'), head = new Element('head'), body = new Element('body'), listeners = {};
    const first = new Element('h2'), second = new Element('h2'); first.textContent = 'Peixes'; second.textContent = 'Sementes'; first.top = 10; second.top = 500; content.headings = [first, second];
    let observer;
    const context = { document: { head, body, querySelector: () => content, createElement: tag => new Element(tag) },
        MutationObserver: class { constructor(fn) { observer = fn; } observe() {} }, requestAnimationFrame: fn => fn(),
        window: { matchMedia: () => ({ matches: false }), addEventListener: (type, fn) => { listeners[type] = fn; } } };
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../MEU MOD STARDEW VALLEY/guide-src/page-navigation.js'), 'utf8'), context);
    const nav = body.children[0], toggle = nav.children[1], list = nav.children[2];
    assert.equal(nav.hidden, false); assert.ok(content.classes.has('page-nav-active')); assert.equal(nav.style.left, '262px');
    assert.equal(list.children.length, 2); assert.equal(list.children[0].attrs['aria-current'], 'location');
    list.children[1].onclick(); assert.equal(second.scrolled.behavior, 'smooth'); assert.equal(second.scrolled.block, 'start');
    toggle.onclick(); assert.equal(toggle.attrs['aria-expanded'], 'true');
    second.top = 40; listeners.scroll(); assert.equal(list.children[1].attrs['aria-current'], 'location');
    content.headings = [second]; observer(); assert.equal(nav.hidden, true); assert.ok(!content.classes.has('page-nav-active'));
});
