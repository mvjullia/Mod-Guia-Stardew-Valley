const assert=require('node:assert/strict');
require('../dist/telemetry.js');
const validate=globalThis.GuiaTelemetry.validateSnapshot;
const example={schemaVersion:1,exportedAt:'2026-10-30T23:00:00Z',modVersion:'1.0.0',farm:{saveId:'123',name:'Estrela',year:1,season:'spring',day:15},player:{multiplayerId:'456',steamId:null,name:'Maria',isMale:false,skills:{farming:5,fishing:4,foraging:3,mining:2,combat:1}},mastery:null,communityCenter:null};
assert.equal(validate(example).player.name,'Maria');
for(const change of [d=>d.schemaVersion=2,d=>d.player.steamId='456',d=>d.player.skills.farming='10',d=>d.farm.day=29,d=>d.exportedAt='invalid']){const data=structuredClone(example);change(data);assert.throws(()=>validate(data));}
const fs=require('fs');const html=fs.readFileSync(require('path').join(__dirname,'../dist/index.html'),'utf8');new Function(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
console.log('OK: snapshot válido, 5 entradas inválidas e sintaxe da página.');
