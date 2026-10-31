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
const d = { portrait: 'data:image/png;base64,abc', player: { name: 'Ana', isMale: false, money: 1234567, relationship: { status: 'married', partnerName: 'Leah' }, skills: { farming: 1, fishing: 2, foraging: 3, mining: 4, combat: 5 } }, farm: { name: 'Sol', day: 5, season: 'spring', year: 1, totalEarnings: 9876543 }, visuals: { pets: [{ name: 'Gato', icon: 'pet' }, { name: 'Cão', icon: 'pet2' }] } };
context.showFarmerSnapshot(d);
const [art, info] = profile.children;
assert.deepEqual(art.children.map(x => x.className), ['profile-portrait', 'profile-field', 'pet-gallery']);
assert.equal(art.children[0].children[1].textContent, 'Ana');
assert.equal(art.children[1].children[0].textContent, 'Estado Civil');
assert.equal(art.children[1].children[1].children[0].textContent, 'Casada com Leah');
assert.deepEqual(art.children[2].children.map(x => x.children[1].textContent), ['Gato', 'Cão']);
assert.equal(info.children[0].textContent, 'Fazenda Sol');
assert.equal(info.children[1].children[0].textContent, 'Data');
assert.equal(info.children[2].children[0].textContent, 'Sua Carteira');
assert.equal(info.children[2].children[1].children[1].textContent, '1.234.567 ouros');
assert.equal(info.children[3].children[0].textContent, 'Ganhos da Fazenda');
assert.equal(info.children[3].children[1].children[1].textContent, '9.876.543 ouros');
assert.equal(info.children[5].children.length, 5);
assert.equal(profile.style['--outfit-hue'], '225');
const stableArt = profile.children[0], stablePortrait = stableArt.children[0].children[0];
context.showFarmerSnapshot({ ...d, exportedAt: 'outro instante', farm: { ...d.farm, time: 1230 } });
assert.equal(profile.children[0], stableArt, 'SSE sem alteração visual deve preservar os elementos do perfil');
context.showFarmerSnapshot({ ...d, player: { ...d.player, money: d.player.money + 10 } });
assert.equal(profile.children[0].children[0].children[0], stablePortrait, 'Atualizar carteira não deve recarregar o retrato');
assert.equal(profile.style['--outfit-hue'], '225', 'Não deve haver passagem pela cor padrão entre dois snapshots');
context.showFarmerSnapshot({ ...d, portrait: 'data:image/png;base64,walking-frame' });
assert.equal(profile.children[0].children[0].children[0], stablePortrait, 'Uma pose nova deve atualizar a imagem no mesmo elemento');
context.showFarmerSnapshot({ ...d, visuals: { pet: { name: 'Legado', icon: 'pet' } } });
assert.equal(profile.children[0].children[2].children[0].children[1].textContent, 'Legado');
context.showFarmerSnapshot({ ...d, player: { ...d.player, relationship: { status: 'single' } } });
assert.equal(profile.children[0].children[1].children[1].children[0].textContent, 'Solteira');
context.showFarmerSnapshot({ ...d, player: { ...d.player, relationship: { status: 'roommate', partnerName: 'Krobus' } } });
assert.equal(profile.children[0].children[1].children[1].children[0].textContent, 'Mora com Krobus');
context.showFarmerSnapshot({ ...d, portrait: null, visuals: {} });
assert.equal(profile.style['--outfit-hue'], undefined);
assert.equal(profile.children[0].children[0].children[1].children[0].textContent, 'Casada com Leah');
console.log('OK: títulos, habilidades, retratos e paleta de roupa com alternativa padrão.');
