const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.isConnected = true; this.style = { setProperty: (k, v) => this.style[k] = v, removeProperty: k => delete this.style[k] }; }
  append(el) { this.children.push(el); }
  replaceChildren() { this.children = []; }
}
const profile = new Element('div');
const pixels = new Uint8ClampedArray(10 * 10 * 4);
for (let i = 0; i < pixels.length; i += 4) { pixels[i] = 40; pixels[i + 1] = 80; pixels[i + 2] = 180; pixels[i + 3] = 255; }
const document = { head: new Element('head'), querySelector: s => s === '#saveinfo' ? profile : null, createElement: tag => tag === 'canvas' ? { width: 0, height: 0, getContext: () => ({ drawImage() {}, getImageData: () => ({ data: pixels }) }) } : new Element(tag) };
class Image { constructor() { this.naturalWidth = 10; this.naturalHeight = 10; } set src(value) { this.onload(); } }
const context = { document, Image, nav() {}, addEventListener() {} };
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../dist/profile.js'), 'utf8'), context);
const d = { portrait: 'data:image/png;base64,abc', player: { name: 'Ana', isMale: false, skills: { farming: 1, fishing: 2, foraging: 3, mining: 4, combat: 5 } }, farm: { name: 'Sol', day: 5, season: 'spring', year: 1 }, visuals: { pets: [{ name: 'Gato', icon: 'pet' }, { name: 'Cão', icon: 'pet2' }] } };
context.showFarmerSnapshot(d);
const [art, info] = profile.children;
assert.deepEqual(art.children.map(x => x.className), ['farmer-avatar', 'pet-gallery']);
assert.deepEqual(art.children[1].children.map(x => x.alt), ['Gato', 'Cão']);
assert.equal(info.children[0].children[0].textContent, 'Fazendeira');
assert.equal(info.children[1].children[0].textContent, 'Fazenda');
assert.equal(info.children[1].children[1].children[0].textContent, 'Sol');
assert.equal(info.children[2].children[0].textContent, 'Data');
assert.equal(info.children[4].children.length, 5);
assert.equal(profile.style['--outfit-hue'], '225');
context.showFarmerSnapshot({ ...d, visuals: { pet: { name: 'Legado', icon: 'pet' } } });
assert.equal(profile.children[0].children[1].children[0].alt, 'Legado');
context.showFarmerSnapshot({ ...d, portrait: null, visuals: {} });
assert.equal(profile.style['--outfit-hue'], undefined);
assert.equal(profile.children[0].children.length, 0);
console.log('OK: títulos, habilidades, retratos e paleta de roupa com alternativa padrão.');
