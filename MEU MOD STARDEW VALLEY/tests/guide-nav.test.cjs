const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.style = {}; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute() {}
  querySelector(selector) { return selector === 'i' ? this.icon : null; }
}
const buttons = Array.from({ length: 3 }, () => { const el = new Element('button'); el.icon = new Element('i'); return el; });
const top = new Element('header');
const doc = { head: new Element('head'), createElement: tag => new Element(tag), querySelector: selector => selector === '.top' ? top : null, querySelectorAll: selector => selector === '#nav button' ? buttons : [] };
let update;
const window = { guiaData: { headPortrait: 'data:image/png;base64,HEAD', farm: { day: 1, season: 'spring', year: 1 }, visuals: { ui: { heart: 'data:image/png;base64,HEART' }, icons: { home: { icon: 'data:image/png;base64,PARSNIP' }, center: { icon: 'data:image/png;base64,CENTER' }, gifts: { icon: 'data:image/png;base64,GIFTS' } } } }, render() {}, renderCenterList() {}, showFarmerSnapshot() {}, addEventListener: (_, fn) => { update = fn; } };
const context = { document: doc, window, current: 'home', tabs: [['home', '', 'Fazendeira'], ['center', '', 'Centro'], ['gifts', '', 'Amizade']], setTimeout() {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../guide-src/visual.js'), 'utf8'), context);
update();
assert.equal(buttons[0].icon.children[0].src, 'data:image/png;base64,HEAD');
assert.equal(buttons[0].icon.children[0].className, 'farmer-head');
assert.equal(buttons[1].icon.children[0].src, '/community-center.png');
assert.equal(buttons[1].icon.children[0].className, 'menu-game-icon');
assert.equal(buttons[2].icon.children[0].src, 'data:image/png;base64,HEART');
window.guiaData.headPortrait = 'data:image/png;base64,NEW';
update();
assert.equal(buttons[0].icon.children[0].src, 'data:image/png;base64,NEW');
console.log('OK: cabeça do jogador no menu e atualização do retrato.');
