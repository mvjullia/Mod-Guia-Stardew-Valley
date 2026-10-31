const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.attributes = {}; this.classes = new Set(); this.classList = { add: value => this.classes.add(value) }; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this.attributes[key] = value; }
}
const grid = new Element('div');
const top = new Element('header');
const document = { head: new Element('head'), createElement: tag => new Element(tag), querySelector: selector => selector === '#content .grid' ? grid : selector === '.top' ? top : null, querySelectorAll: () => [] };
let opened;
const gift = { name: 'Pêssego', icon: 'data:image/png;base64,ITEM', personal: true };
const window = { guiaData: { farm: { day: 1, year: 1, season: 'spring' }, visuals: { ui: { heart: 'data:image/png;base64,HEART' }, npcs: [{ name: 'Robin', portrait: 'data:image/png;base64,NPC', hearts: 3, maxHearts: 10, gifts: [gift] }] } }, render() {}, renderCenterList() {}, showFarmerSnapshot() {}, addEventListener() {}, openItemPage: item => { opened = item; } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../guide-src/visual.js'), 'utf8'), { document, window, current: 'gifts', setTimeout() {} });
window.render();
assert(grid.classes.has('friendship-grid'));
assert.equal(grid.children.length, 1);
const [summary, gifts] = grid.children[0].children;
assert.equal(summary.className, 'resident-summary');
assert.deepEqual(summary.children.map(element => element.className), ['resident-frame', 'hearts', 'resident-name']);
assert.equal(summary.children[1].attributes['aria-label'], '3 de 10 corações');
assert.equal(summary.children[2].textContent, 'Robin');
assert.equal(gifts.className, 'gift-list');
assert.equal(gifts.children[0].children[1].textContent, 'Pêssego');
gifts.children[0].onclick();
assert.equal(opened, gift);
console.log('OK: morador agrupado, corações e presente clicável em cartão horizontal.');
