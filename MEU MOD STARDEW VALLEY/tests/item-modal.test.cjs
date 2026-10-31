const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.style = {}; this.ownText = ''; this.isConnected = true; }
  set textContent(value) { this.ownText = value; this.children = []; }
  get textContent() { return this.ownText + this.children.map(child => child.textContent).join(''); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; this.ownText = ''; }
  querySelectorAll(selector) { return selector === 'p' ? this.children.filter(child => child.tag === 'p') : []; }
  querySelector() { return null; }
  setAttribute() {}
}
const body = new Element('div');
const dialog = new Element('dialog');
dialog.classList = { add() {}, remove() {} }; dialog.showModal = () => { dialog.open = true; };
const doc = { head: new Element('head'), createElement: tag => new Element(tag), createTextNode: text => { const node = new Element('#text'); node.textContent = text; return node; }, querySelector: s => s === '#dialogbody' ? body : s === '#dialog' ? dialog : null };
const source = path.join(__dirname, '../guide-src');
const context = { document: doc, fetch: async file => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(source, file), 'utf8')) }) };
vm.runInNewContext(fs.readFileSync(path.join(source, 'item-catalog.js'), 'utf8'), context);
context.openItemPage({ qualifiedId: '(O)24', name: 'Parsnip', obtaining: { methods: [{ method: 'Dado legado', growthDays: 999 }] } });
setImmediate(() => {
  const fields = body.children[1];
  assert.equal(body.children[0].children[0].textContent, 'Chirívia');
  assert(fields.textContent.includes('Produção / fabricação: Cultivo a partir de Sementes de Chirívia'));
  assert(fields.textContent.includes('Tempo de crescimento: 4'));
  assert(!fields.textContent.includes('999'));
  assert(fields.children.every(row => row.children[0].tag === 'strong' && row.children[1].className === 'item-field-value'));
  // The JSON contract keeps optional source fields; obsolete acquisition.js dictionaries are no longer the renderer.
  assert(fields.textContent.includes('Fonte do item:'));
  console.log('OK: modal usa nomes traduzidos, dados JSON atuais e labels em negrito com valores normais.');
});
