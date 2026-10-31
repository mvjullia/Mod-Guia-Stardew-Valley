const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.style = {}; this.className = ''; this.textContent = ''; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute() {}
}
const list = new Element('div');
const document = {
  head: new Element('head'),
  createElement: tag => new Element(tag),
  querySelector: selector => selector === '#list' ? list : null,
  querySelectorAll: () => [],
};
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'bundle-fixture.json'), 'utf8').replace(/^\uFEFF/, ''));
const window = { guiaData: { visuals: { bundles: fixture, ui: {} } }, render() {}, renderCenterList() {}, showFarmerSnapshot() {}, addEventListener() {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/visual.js'), 'utf8'), { window, document, Intl, setTimeout });
window.renderCenterList();
const rooms = new Map(list.children.map(section => [section.children[0].textContent, section]));
for (const room of ['Copa', 'Sala de Artesanato', 'Aquário', 'Sala da Caldeira', 'Cofre', 'Mural de Recados', 'Mercado Joja abandonado']) assert(rooms.has(room), `Sala ausente: ${room}`);
assert(!rooms.has('Conjuntos'));
const boiler = rooms.get('Sala da Caldeira');
assert.deepEqual(boiler.children[1].children.map(panel => panel.children[0].textContent), ['Conjunto de Ferreiro', 'Conjunto de Geólogo', 'Conjunto de Aventureiro']);
assert(boiler.children[1].children.every(panel => panel.className.includes('mining')));
const rendered = list.children.flatMap(section => section.children[1].children.map(panel => panel.children[0].textContent));
assert.equal(rendered.length, fixture.length);
assert(rendered.every(name => name.startsWith('Conjunto ') && !/undefined|null|^Conjunto\s*$/i.test(name)));
const expected = ['Recursos de Primavera', 'Recursos de Verão', 'Recursos de Outono', 'Recursos de Inverno', 'Construção', 'Recursos Exóticos', 'Plantações de Primavera', 'Plantações de Verão', 'Plantações de Outono', 'Plantações de Qualidade', 'Animal', 'Artesão', 'Peixes de Rio', 'Peixes de Lago', 'Peixes de Oceano', 'Pesca Noturna', 'Covo', 'Peixes Especializados', 'de Ferreiro', 'de Geólogo', 'de Aventureiro', 'de Cozinheiro', 'Tinta', 'Pesquisa de campo', 'Forragem', 'de Encantador', 'A Desaparecida', '2.500 ouros', '5.000 ouros', '10.000 ouros', '25.000 ouros'];
assert.deepEqual([...rendered].sort(), expected.map(name => `Conjunto ${name}`).sort());
for (const amount of ['2.500', '5.000', '10.000', '25.000']) assert(rendered.includes(`Conjunto ${amount} ouros`));
window.guiaData.visuals.bundles = [
  { room: 'Boiler Room', internalName: "Blacksmith's Bundle", name: 'de Ferreiro', items: [] },
  { room: 'BoilerRoom', internalName: 'Remixed Test', name: 'Personalizado', items: [] },
  { room: 'ModRoom', internalName: 'Untranslated Mod Bundle', items: [] },
];
window.renderCenterList();
assert.equal(list.children.length, 2);
assert.equal(list.children[0].children[0].textContent, 'Sala da Caldeira');
assert.deepEqual(list.children[0].children[1].children.map(panel => panel.children[0].textContent), ['Conjunto de Ferreiro', 'Conjunto Personalizado']);
assert.equal(list.children[1].children[0].textContent, 'Mod Room');
assert.equal(list.children[1].children[1].children[0].children[0].textContent, 'Conjunto Untranslated Mod');
console.log(`OK: ${rendered.length} conjuntos, nomes das salas, caldeira e valores do cofre.`);
