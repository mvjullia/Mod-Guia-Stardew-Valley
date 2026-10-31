const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.attributes = {}; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this.attributes[name] = value; }
}
const list = new Element('div');
const document = { head: new Element('head'), createElement: tag => new Element(tag), querySelector: selector => selector === '#list' ? list : null, querySelectorAll: () => [] };
let selected;
const item = { name: 'Chirívia', icon: 'data:image/png;base64,ITEM' };
const window = { guiaData: { visuals: { ui: { gold: 'data:image/png;base64,STAR' }, bundles: [
  { room: 'Pantry', internalName: 'Spring Crops', name: 'Plantações de Primavera', items: [
    { item, quantity: 5, quality: 2, completed: true },
    { item: { name: 'Vagem' }, quantity: 1, quality: 0, completed: false },
  ] },
  { room: 'Vault', internalName: '2,500g', name: '2.500 ouros', items: [{ isMoney: true, quantity: 2500, completed: false }] },
] } }, render() {}, renderCenterList() {}, showFarmerSnapshot() {}, addEventListener() {}, openItemPage: value => { selected = value; } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../guide-src/visual.js'), 'utf8'), { document, window, Intl, setTimeout() {} });
window.renderCenterList();
const panel = list.children[0].children[1].children[0];
assert.equal(panel.children[0].textContent, 'Conjunto Plantações de Primavera');
const [delivered, pending] = panel.children[1].children;
assert(delivered.className.includes('done'));
assert.equal(delivered.children[1].textContent, 'Chirívia × 5 · qualidade 2');
assert.equal(delivered.children[2].textContent, '✓ Entregue');
assert.equal(delivered.children[0].children[1].alt, 'Qualidade ouro');
assert.equal(pending.children[2].textContent, 'Pendente');
delivered.children[1].onclick();
assert.equal(selected.name, 'Chirívia');
assert.equal(selected.quality, 2);
const vault = list.children[1].children[1].children[0].children[1].children[0];
assert.equal(vault.children[1].textContent, '2.500 ouros');
assert.equal(vault.children[2].textContent, 'Pendente');
console.log('OK: título, quantidade, qualidade, entrega, moeda e abertura dos itens.');
