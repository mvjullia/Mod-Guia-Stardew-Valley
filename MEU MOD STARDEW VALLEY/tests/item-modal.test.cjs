const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.style = {}; this.ownText = ''; }
  set textContent(value) { this.ownText = value; }
  get textContent() { return this.ownText + this.children.map(child => child.textContent).join(''); }
  append(...nodes) { this.children.push(...nodes); }
  querySelectorAll(selector) { return selector === 'p' ? this.children.filter(child => child.tag === 'p') : []; }
  querySelector() { return null; }
  setAttribute() {}
}
const fields = new Element('div');
const dialog = new Element('dialog');
const doc = { head: new Element('head'), createElement: tag => new Element(tag), createTextNode: text => { const node = new Element('#text'); node.textContent = text; return node; }, querySelector: s => s === '#dialogbody .item-fields' ? fields : s === '#dialog' ? dialog : null };
const window = { openItemPage() { fields.children = []; }, addEventListener() {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../guide-src/acquisition.js'), 'utf8'), { document: doc, window, console, setTimeout() {} });
window.openItemPage({ name: 'Chirívia', wikiName: 'Parsnip', obtaining: { methods: [{ method: 'Cultive sementes.', season: 'Primavera', growthDays: 4, source: 'Referência interna' }] } });
assert(fields.textContent.includes('Como conseguir'));
assert(fields.textContent.includes('Como obter no jogo'));
assert(fields.textContent.includes('Crescimento inicial'));
assert(!/Fonte:|Referência|stardewvalleywiki\.com/i.test(fields.textContent));
console.log('OK: detalhes do item mantêm obtenção e crescimento sem exibir referências.');
