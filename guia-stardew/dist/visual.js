(function () {
    const style = document.createElement('style'); style.textContent = `.hero p,.sectionhead p,.eyebrow,.crumb,.sidebottom,.card>p,.top+.notice{display:none!important}.hero{min-height:120px}.hero:after{content:''}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #335d97;outline-offset:4px}.item.done{background:#d9efce;border:2px solid #4e793f}.bundle-room{margin-top:28px;padding:22px;border:3px ridge #c69759;background:#fff8e7}.bundle-room>h2{margin:0 0 22px;color:#65422d;font-size:24px}.bundle-room>.bundle-panels{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,370px),1fr));gap:18px}.bundle-panel{padding:18px;border:4px ridge #bc8e5a;background:linear-gradient(#fff1d1,#fffaf0);border-radius:4px;min-width:0;box-shadow:0 4px 0 #8a603a22}.bundle-panel>h3{margin:0 0 16px;padding:10px 14px;border-bottom:3px double var(--bundle-border,#b27d49);color:#573820}.bundle-panel>.items{grid-template-columns:1fr;gap:9px}.bundle-panel.spring{--bundle-border:#8cab6e;background:linear-gradient(#e4f3d6,#fffaf0)}.bundle-panel.summer{--bundle-border:#d7a24f;background:linear-gradient(#fff1c7,#fffaf0)}.bundle-panel.fall{--bundle-border:#c47749;background:linear-gradient(#ffe2c8,#fffaf0)}.bundle-panel.winter{--bundle-border:#80a8c6;background:linear-gradient(#e2f1fa,#fffaf0)}.bundle-panel.fish{--bundle-border:#6b9eb1;background:linear-gradient(#dfeff2,#fffaf0)}.bundle-panel.mining{--bundle-border:#9b83a4;background:linear-gradient(#ede4f1,#fffaf0)}.bundle-panel.vault{--bundle-border:#c79d48;background:linear-gradient(#fff0c2,#fffaf0)}.bundle-star{display:inline-flex;align-items:center;justify-content:center;flex:none;color:#805213;background:#fff1c7;border:1px solid #d5ae57;border-radius:6px;width:28px;height:28px;font-size:18px;font-weight:900}.item .completion{font-weight:900;color:#31582a}.item{background:#fffaf0}.gift-list{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.gift{display:inline-flex;align-items:center;gap:6px;padding:7px;background:#f4ecd8;border-radius:8px;color:#533b2e;font-size:13px}.game-icon{width:32px;height:32px;image-rendering:pixelated;object-fit:contain}.farmer-avatar{width:128px;height:128px;image-rendering:pixelated;background:#dbeccf;border-radius:12px}.game-clock{display:flex;gap:16px;align-items:center;font-weight:900;color:#4d663d}.top small,.top>button{display:none}.item input[type=checkbox]{display:none}.item small{display:none}.game-grid{display:grid;gap:14px}.npc-card{position:relative}.npc-card:focus-within,.npc-card:hover{border-color:#739458}.npc-card .portrait{width:64px;height:64px}.game-progress{color:#31582a;font-weight:900}`; document.head.append(style);
    const seasons = { spring: 'Primavera', summer: 'Verão', fall: 'Outono', winter: 'Inverno' };
    const picture = (url, name, cls = 'game-icon') => { const img = document.createElement('img'); img.alt = name; img.className = cls; if (typeof url === 'string' && url.startsWith('data:image/png;base64,')) img.src = url; return img; };
    const add = (parent, tag, text, cls) => { const el = document.createElement(tag); el.textContent = text; if (cls) el.className = cls; parent.append(el); return el; };
    function bundleRoomName(name) { return typeof name === 'string' ? name.trim().replace(/([a-z])([A-Z])/g, '$1 $2') : ''; }
    function bundles(target, data) { target.replaceChildren(); const rooms = { CraftsRoom: 'Sala de Artesanato', Pantry: 'Copa', FishTank: 'Aquário', BoilerRoom: 'Sala da Caldeira', BulletinBoard: 'Mural de Recados', Vault: 'Cofre', AbandonedJojaMart: 'Mercado Joja abandonado' }; const names = { 'Spring Foraging': 'Conjunto Recursos de Primavera', 'Summer Foraging': 'Conjunto Recursos de Verão', 'Fall Foraging': 'Conjunto Recursos de Outono', 'Winter Foraging': 'Conjunto Recursos de Inverno', 'Construction': 'Conjunto Construção', 'Exotic Foraging': 'Conjunto Recursos Exóticos', 'Spring Crops': 'Conjunto Plantações de Primavera', 'Summer Crops': 'Conjunto Plantações de Verão', 'Fall Crops': 'Conjunto Plantações de Outono', 'Quality Crops': 'Conjunto Plantações de Qualidade', 'Animal': 'Conjunto Animal', 'Artisan': 'Conjunto Artesão', 'River Fish': 'Conjunto Peixes de Rio', 'Lake Fish': 'Conjunto Peixes de Lago', 'Ocean Fish': 'Conjunto Peixes de Oceano', 'Night Fishing': 'Conjunto Pesca Noturna', 'Crab Pot': 'Conjunto Covo', 'Specialty Fish': 'Conjunto Peixes Especializados', "Blacksmith's": 'Conjunto de Ferreiro', "Geologist's": 'Conjunto de Geólogo', "Adventurer's": 'Conjunto de Aventureiro', "Chef's": 'Conjunto de Cozinheiro', 'Dye': 'Conjunto Tinta', 'Field Research': 'Conjunto Pesquisa de campo', 'Fodder': 'Conjunto Forragem', 'The Missing': 'Conjunto A Desaparecida', "Enchanter's": 'Conjunto de Encantador' }; const grouped = new Map(); for (const bundle of data.visuals.bundles) { const room = String(bundle.room || (bundle.items.some(e => e.isMoney) ? 'Vault' : 'Other')).replace(/\s+/g, '').toLowerCase(); if (!grouped.has(room)) grouped.set(room, []); grouped.get(room).push(bundle); } for (const [room, entries] of grouped) { const section = add(target, 'section', '', 'bundle-room'); add(section, 'h2', Object.entries(rooms).find(([key]) => key.toLowerCase() === room)?.[1] || (bundleRoomName(entries[0].room) || 'Sala desconhecida')); const panels = add(section, 'div', '', 'bundle-panels'); for (const bundle of entries) { const money = bundle.items.find(entry => entry.isMoney); const raw = (bundle.internalName || '').replace(/ Bundle$/, ''); const official = money ? 'Conjunto ' + new Intl.NumberFormat('pt-BR').format(money.quantity) + ' ouros' : names[raw] || (/^Conjunto/i.test(bundle.name || '') ? bundle.name : 'Conjunto ' + (bundle.name || raw || 'sem nome')); const theme = /spring/i.test(raw) ? 'spring' : /summer/i.test(raw) ? 'summer' : /fall|autumn/i.test(raw) ? 'fall' : /winter/i.test(raw) ? 'winter' : room === 'fishtank' ? 'fish' : room === 'boilerroom' ? 'mining' : room === 'vault' ? 'vault' : ''; const panel = add(panels, 'article', '', 'bundle-panel ' + theme); add(panel, 'h3', official); const list = add(panel, 'div', '', 'items'); for (const entry of bundle.items) { const row = add(list, 'div', '', 'item' + (entry.completed ? ' done' : '')); if (entry.isMoney) { const coin = document.createElement('img'); coin.className = 'game-icon bundle-coin'; coin.src = 'https://stardewvalleywiki.com/Special:Redirect/file/Gold.png'; coin.alt = ''; row.append(coin); const label = add(row, 'span', new Intl.NumberFormat('pt-BR').format(entry.quantity) + ' ouros', 'item-amount'); label.style.fontWeight = '900'; add(row, 'span', entry.completed ? '✓ Entregue' : 'Pendente', entry.completed ? 'item-status completion' : 'item-status'); row.setAttribute('aria-label', label.textContent + (entry.completed ? ' — concluído' : ' — pendente')); continue; } const frame = add(row, 'span', '', 'sprite-frame'); frame.append(picture(entry.item.icon, entry.item.name)); if (entry.quality) { const tier = { 1: 'silver', 2: 'gold', 4: 'iridium' }[entry.quality]; if (tier && data.visuals.ui) { const star = picture(data.visuals.ui[tier], 'Qualidade ' + ({ 1: 'prata', 2: 'ouro', 4: 'irídio' }[entry.quality]), 'quality-star'); frame.append(star); } } const button = add(row, 'button', entry.item.name + ' × ' + entry.quantity + (entry.quality ? ' · qualidade ' + entry.quality : '')); button.onclick = () => window.openItemPage({ ...entry.item, quality: entry.quality }); add(row, 'span', entry.completed ? '✓ Entregue' : 'Pendente', entry.completed ? 'item-status completion' : 'item-status'); } } } }
    // Default residences: https://stardewvalleywiki.com/Villagers and each resident's page.
    // Leo's move: https://stardewvalleywiki.com/Treehouse
    const residentHomes = {
        Abigail:'Na loja do Pierre, no centro da vila.', Alex:'Na casa de George e Evelyn, ao lado da loja do Pierre.',
        Caroline:'Na loja do Pierre, no centro da vila.', Clint:'Na Ferraria, a leste da vila.',
        Demetrius:'Na Carpintaria da Robin, na montanha.', Dwarf:'Na caverna à direita da entrada das Minas.',
        Elliott:'Na cabana da praia.', Emily:'Na casa ao sul da praça, ao lado da casa da Jodi.',
        Evelyn:'Na casa de George, ao lado da loja do Pierre.', George:'Na casa ao lado da loja do Pierre.',
        Gus:'No Saloon Fruta Estrelar, no centro da vila.', Haley:'Na casa ao sul da praça, ao lado da casa da Jodi.',
        Harvey:'No apartamento acima da Clínica, na vila.', Jas:'No Rancho da Marnie, na floresta ao sul da fazenda.',
        Jodi:'Na casa ao sul da praça, ao lado da casa de Haley e Emily.', Kent:'Na casa da Jodi, ao sul da praça; retorna no ano 2.',
        Krobus:'Nos Esgotos, acessíveis pela vila ou floresta.', Leo:'Na cabana da Ilha Gengibre; depois pode mudar para a casa na árvore, na montanha.',
        Leah:'Na cabana ao sul do Rancho da Marnie, na floresta.', Lewis:'Na Mansão do Prefeito, ao sul da vila.',
        Linus:'Na barraca junto às Minas, na montanha.', Marnie:'No Rancho da Marnie, na floresta ao sul da fazenda.',
        Maru:'Na Carpintaria da Robin, na montanha.', Pam:'No trailer, a leste da vila; pode ser substituído por uma casa.',
        Penny:'No trailer com a Pam, a leste da vila; pode ser substituído por uma casa.',
        Pierre:'Na loja do Pierre, no centro da vila.', Robin:'Na Carpintaria, na montanha ao norte da vila.',
        Sam:'Na casa da Jodi, ao sul da praça.', Sandy:'No Oásis, no Deserto de Calico.',
        Sebastian:'No porão da Carpintaria da Robin, na montanha.', Shane:'No Rancho da Marnie, na floresta ao sul da fazenda.',
        Vincent:'Na casa da Jodi, ao sul da praça.', Willy:'Na Peixaria, na praia ao sul da vila.',
        Wizard:'Na Torre do Feiticeiro, a oeste da floresta.'
    };
    const residentAliases = { 'Anão':'Dwarf', 'Feiticeiro':'Wizard', 'Mago':'Wizard' };
    const residentColors = new Map();
    function colorResidentBorder(card, portrait) {
        if (typeof portrait !== 'string' || !portrait.startsWith('data:image/png;base64,')) return;
        if (residentColors.has(portrait)) { const hue = residentColors.get(portrait); if (hue !== null) card.style.setProperty('--npc-card-hue', hue); return; }
        const image = new Image();
        image.onload = () => {
            try {
                const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
                const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) return;
                ctx.drawImage(image, 0, 0, 64, 64);
                const pixels = ctx.getImageData(0, 0, 64, 64).data; const hues = new Map();
                for (let i = 0; i < pixels.length; i += 4) {
                    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
                    const high = Math.max(r, g, b), low = Math.min(r, g, b), chroma = high - low;
                    if (pixels[i + 3] < 128 || chroma < 35 || high < 55 || high > 245) continue;
                    if (r > g && g > b && r > 130 && g > 75 && chroma < 120) continue;
                    let hue = high === r ? ((g - b) / chroma) % 6 : high === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
                    const bucket = Math.round(((hue * 60 + 360) % 360) / 15) % 24;
                    hues.set(bucket, (hues.get(bucket) || 0) + chroma);
                }
                let best = null, score = 0;
                for (const [hue, value] of hues) if (value > score) { best = hue; score = value; }
                const hue = best === null ? null : String(best * 15);
                residentColors.set(portrait, hue);
                if (hue !== null && card.isConnected) card.style.setProperty('--npc-card-hue', hue);
            } catch (error) { console.warn('[Guia] Não foi possível obter a cor do morador:', error.name); }
        };
        image.src = portrait;
    }
    function gifts(target, data) {
        target.classList.add('friendship-grid');
        target.replaceChildren();
        for (const npc of data.visuals.npcs) {
            const card = add(target, 'article', '', 'card npc-card');
            colorResidentBorder(card, npc.portrait);
            const summary = add(card, 'div', '', 'resident-summary');
            const frame = add(summary, 'div', '', 'resident-frame');
            frame.append(picture(npc.portrait, npc.name, 'portrait'));
            const hearts = add(summary, 'div', '', 'hearts');
            hearts.setAttribute('role', 'img');
            hearts.setAttribute('aria-label', npc.hearts + ' de ' + npc.maxHearts + ' corações');
            for (let i = 0; i < (npc.maxHearts || 10); i++) {
                hearts.append(picture(data.visuals.ui?.heart, '', 'heart' + (i < npc.hearts ? '' : ' empty')));
            }
            add(summary, 'h2', npc.name, 'resident-name');
            const home = npc.movesToFarm ? 'Na casa da fazenda de seu parceiro.' : residentHomes[npc.id || residentAliases[npc.name] || npc.name];
            if (home) add(summary, 'p', home, 'resident-home');
            const list = add(card, 'div', '', 'gift-list');
            for (const gift of npc.gifts) {
                const chip = add(list, 'button', '', 'gift');
                chip.type = 'button';
                chip.onclick = () => window.openItemPage(gift);
                const iconFrame = add(chip, 'span', '', 'sprite-frame');
                iconFrame.append(picture(gift.icon, ''));
                const label = add(chip, 'span', gift.name);
                if (gift.personal) add(label, 'small', 'Favorito pessoal', 'personal-gift');
            }
        }
    }
    function update() {
        const d = window.guiaData; if (!d) return; let clock = document.querySelector('.game-clock'); if (!clock) { clock = add(document.querySelector('.top'), 'div', '', 'game-clock'); clock.setAttribute('role', 'status'); } const t = d.farm.time; clock.textContent = (d.farm.isNight ? '☾ Noite' : '☀ Dia') + ' · ' + (t === undefined ? '' : String(Math.floor(t / 100)).padStart(2, '0') + ':' + String(t % 100).padStart(2, '0') + ' · ') + d.farm.day + ' de ' + seasons[d.farm.season] + ' · Ano ' + d.farm.year;
        const out = document.querySelector('#saveinfo'); if (out && d.portrait) { let portrait = out.querySelector('.farmer-avatar'); if (!portrait) { portrait = picture(d.portrait, d.player.name, 'farmer-avatar'); out.prepend(portrait); } }
        if (current === 'center' && d.visuals) { const list = document.querySelector('#list'); if (list) bundles(list, d); document.querySelector('.toolbar')?.remove(); document.querySelector('.progress')?.remove(); document.querySelectorAll('.badge').forEach(x => x.remove()); }
        if (current === 'gifts' && d.visuals) { const target = document.querySelector('#content .grid'); if (target) gifts(target, d); }
        if (d.visuals?.icons) { document.querySelectorAll('#nav button').forEach((button, index) => { button.setAttribute('aria-label', tabs[index][2]); const icon = d.visuals.icons[tabs[index][0]]; const i = button.querySelector('i'); const head = index === 0 && typeof d.headPortrait === 'string' && d.headPortrait.startsWith('data:image/png;base64,') ? d.headPortrait : null; if (!i) return; if (index === 1) { const image = document.createElement('img'); image.className = 'menu-game-icon community-center-icon'; image.alt = ''; image.src = '/community-center.png'; i.replaceChildren(image); } else if (index === 2 && d.visuals.ui?.heart) { i.replaceChildren(picture(d.visuals.ui.heart, '', 'menu-game-icon')); } else if (head || icon) { i.replaceChildren(head ? picture(head, '', 'farmer-head') : picture(icon.icon, '')); } }); document.querySelectorAll('.card .icon').forEach(el => { const title = el.parentElement.querySelector('h3')?.textContent || ''; const key = /Centro/.test(title) ? 'center' : /Presentes|Habitantes/.test(title) ? 'gifts' : /Peixes/.test(title) ? 'fishing' : /Minas/.test(title) ? 'mining' : /Cultivos|Maestria/.test(title) ? 'farming' : 'wiki'; el.replaceChildren(picture(d.visuals.icons[key].icon, '')); }); }
        document.querySelectorAll('.hero p,.sectionhead p,.eyebrow,.crumb').forEach(x => x.remove());
    }
    const originalRender = window.render; window.render = function () { originalRender(); update(); };
    const originalList = window.renderCenterList; window.renderCenterList = function () { if (window.guiaData?.visuals) { const target = document.querySelector('#list'); if (target) bundles(target, window.guiaData); } else { originalList(); document.querySelectorAll('.item input').forEach(x => x.remove()); } };
    window.addEventListener('guia:update', () => { update(); setTimeout(update, 0); });
    const originalShow = window.showFarmerSnapshot; window.showFarmerSnapshot = function (data) { originalShow(data); const out = document.querySelector('#saveinfo'); if (out) out.querySelectorAll('p').forEach(p => { if (/Exportado em|SteamID|Maestrias e Centro/.test(p.textContent)) p.remove(); }); update(); };
})();
