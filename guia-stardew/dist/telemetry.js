(function (root) {
  'use strict';
  const skills = [['farming','Cultivo'],['fishing','Pescaria'],['foraging','Coleta'],['mining','Mineração'],['combat','Combate']];
  function validateSnapshot(data) {
    const fail = () => { throw new Error('Snapshot incompatível. Use uma exportação schemaVersion 1 do mod.'); };
    if (!data || data.schemaVersion !== 1 || !data.farm || !data.player) fail();
    for (const value of [data.farm.saveId, data.farm.name, data.player.name, data.player.multiplayerId]) {
      if (typeof value !== 'string' || value.length > 200) fail();
    }
    if (!/^\d+$/.test(data.farm.saveId) || !/^-?\d+$/.test(data.player.multiplayerId)) fail();
    if (typeof data.player.isMale !== 'boolean') fail();
    if (data.player.steamId !== null && !/^\d{17}$/.test(data.player.steamId)) fail();
    if (!data.player.skills || skills.some(([key]) => !Number.isInteger(data.player.skills[key]) || data.player.skills[key] < 0 || data.player.skills[key] > 100)) fail();
    if (!['spring','summer','fall','winter'].includes(data.farm.season) || !Number.isInteger(data.farm.year) || data.farm.year < 1 || !Number.isInteger(data.farm.day) || data.farm.day < 1 || data.farm.day > 28) fail();
    if (typeof data.exportedAt !== 'string' || !Number.isFinite(Date.parse(data.exportedAt))) fail();
    return data;
  }
  root.GuiaTelemetry = { validateSnapshot };
  if (typeof document === 'undefined') return;

  root.showFarmerSnapshot = function(snapshot) {
    const out = document.querySelector('#saveinfo');
    try {
      const data = validateSnapshot(snapshot);
      if(!out)return;
      out.replaceChildren();
      const add = (tag, text) => { const element = document.createElement(tag); element.textContent = text; out.append(element); };
      add('h3', (data.player.isMale ? 'Fazendeiro: ' : 'Fazendeira: ') + data.player.name);
      add('p', 'Fazenda ' + data.farm.name);
      const seasons = {spring:'Primavera',summer:'Verão',fall:'Outono',winter:'Inverno'};
      add('p', `${data.farm.day} de ${seasons[data.farm.season]} · Ano ${data.farm.year}`);
      add('p', skills.map(([key,label]) => label + ': ' + data.player.skills[key]).join(' · '));
      add('p', 'Exportado em ' + new Date(data.exportedAt).toLocaleString('pt-BR'));
      add('p', 'SteamID informado pelo mod: ' + (data.player.steamId || 'indisponível') + '. Identidade ainda não verificada pelo site.');
      add('p', 'Maestrias e Centro Comunitário: coleta ainda não implementada no exportador.');
      const label = document.querySelector('#nav button span');
      if (label) label.textContent = data.player.isMale ? 'Fazendeiro' : 'Fazendeira';
    } catch(error) { out.textContent = error.message; }
  };
})(globalThis);
