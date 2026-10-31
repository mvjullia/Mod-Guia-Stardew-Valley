(function (root) {
    'use strict';
    const validId = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
    const collectionOf = photo => {
        if (photo.collection === 'mishaps') return photo.collection;
        if (photo.kind?.startsWith('center-')) return 'center';
        if (photo.kind === 'rain-watering') return 'mishaps';
        if (photo.collection === 'coop') {
            if (/-(fishing|panning)$/.test(photo.kind || '')) return 'fishing';
            if (/-(planting|harvesting|watering|digging|milking|shearing|petting)$/.test(photo.kind || '')) return 'farm';
            if (/-(mining|fighting|chopping|foraging)$/.test(photo.kind || '')) return 'adventures';
        }
        return ['coop', 'romance', 'nights', 'festivals', 'joja'].includes(photo.collection) ? photo.collection : 'memories';
    };
    const filterPhotos = (photos, collection = 'all', pair = '') => photos.filter(photo =>
        (collection === 'all' || collectionOf(photo) === collection) && (!pair || photo.pairKey === pair));
    const displayPhotos = photos => { const combined = new Set(photos.filter(photo => photo.isComposite && photo.sessionId).map(photo => photo.sessionId)); return photos.filter(photo => photo.isComposite || !photo.sessionId || !combined.has(photo.sessionId)); };
    const sessionStatus = session => ({ synchronized: '✓ Sincronizada nos dois computadores', confirming: 'Conferindo as duas cópias…', 'capture-failed': 'Captura não concluída · tente novamente no jogo', pending: 'Pendente · aguardando a outra visão' })[session?.status] || 'Pendente';
    function groupPhotos(photos) {
        const days = new Map();
        for (const photo of photos) {
            if (!photo || !validId(photo.id) || !validId(photo.imageId)) continue;
            const key = [photo.year, photo.season, photo.day].join('/');
            if (!days.has(key)) days.set(key, { year: photo.year, season: photo.season, day: photo.day, photos: [] });
            days.get(key).photos.push(photo);
        }
        return [...days.values()];
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = { groupPhotos, validId, filterPhotos, collectionOf, displayPhotos, sessionStatus };
    if (typeof document === 'undefined') return;
    const style = document.createElement('style'); style.textContent = `
    .album-header{padding:24px;background:linear-gradient(120deg,#f7d59a,#fff3d7);border:5px solid #a76227;box-shadow:inset 0 0 0 3px #ffe3ae,0 4px 0 #754019;margin-bottom:26px;display:flex;gap:18px;align-items:center}
    .album-header>span{font-size:46px}.album-header h1{margin:0 0 6px;font-size:27px;color:#623d23}.album-header p{margin:0;color:#856341;line-height:1.5}
    .album-day{margin:28px 0}.album-day h2{font-size:19px;color:#6a492b;border-bottom:3px double #b68751;padding-bottom:12px}.album-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:26px;padding:8px}
    .album-photo{position:relative;margin:0;background:#fffcf0;padding:12px 12px 18px;border:1px solid #cebd99;box-shadow:2px 5px 0 #9a6a3433,0 8px 15px #5c381722;transform:rotate(-1deg)}
    .album-photo:nth-child(even){transform:rotate(1deg)}.album-photo::before{content:'';position:absolute;top:-9px;left:35%;width:30%;height:22px;background:#f3d99cb3;transform:rotate(-4deg);box-shadow:0 1px 2px #5b462b22}
    .album-photo:hover,.album-photo:focus-within{transform:rotate(0)}.album-photo button{border:0;padding:0;background:none;width:100%;text-align:left;color:#61432d;font:inherit}
    .album-photo img{display:block;width:100%;aspect-ratio:16/9;object-fit:contain;background:#3a3025;image-rendering:pixelated;border:2px solid #c1a77b}
    .album-photo figcaption{padding:14px 4px 0;line-height:1.6}.album-photo strong{display:block;font-size:17px;margin-bottom:7px}.album-photo p{margin:0;font-size:14px;font-weight:400}.album-photo small{display:block;color:#8a704e;margin-top:9px;font-size:11px}
    .album-empty{padding:32px;text-align:center;background:#fff2d4;border:3px dashed #bb905d;color:#7e5e3a;line-height:1.7}.album-empty>span{font-size:48px;display:block}.album-retry{padding:10px 18px;border:3px ridge #b77940;background:#fff1d1;color:#553822;font:inherit;margin-top:12px}
    .dialog.album-viewer{width:min(1100px,94vw);max-width:1100px;border:6px ridge #a76227;background:#fff4d9}.album-viewer img{display:block;width:100%;height:auto;max-height:70vh;object-fit:contain;background:#30271d;image-rendering:pixelated}.album-viewer h2{font-size:23px}.album-viewer p{font-weight:400;line-height:1.7}
    @media(prefers-reduced-motion:reduce){.album-photo{transform:none!important}}
    .album-header h1,.album-day h2{font-family:Pixellari,monospace}
    .album-filters{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin:0 0 20px}.album-filters button,.album-pair-filter{padding:9px 12px;border:3px solid #a76227;background:#fff1d1;color:#604126;font:800 14px Nunito,sans-serif;box-shadow:inset 0 0 0 2px #ffe4ad}.album-filters button[aria-pressed="true"]{background:#e3eabd;border-color:#63814b;transform:translateY(2px)}
    .album-books{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:28px;padding:12px;perspective:1000px}.album-book{position:relative;min-height:235px;border:0;background:transparent;padding:0;text-align:left;color:#593b24;cursor:pointer;perspective:900px;font:inherit}.album-book-pages,.album-book-cover{position:absolute;inset:0;border-radius:4px 12px 12px 4px;box-sizing:border-box}.album-book-pages{padding:34px 22px 20px;background:#fff4d5;border:4px solid #b58a55;box-shadow:5px 6px 0 #8a592f55;display:flex;align-items:center;justify-content:center;text-align:center;line-height:1.5}.album-book-cover{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:20px;background:linear-gradient(90deg,#754324 0 12px,#b9793e 13px,#d59d58);border:4px solid #754324;box-shadow:inset 0 0 0 4px #e9ba76;transform-origin:left center;transition:transform .3s ease;backface-visibility:hidden;text-align:center;color:#fff5d6}.album-book-cover span{font-size:38px}.album-book-cover strong{font:20px Pixellari,monospace}.album-book:hover .album-book-cover,.album-book:focus-visible .album-book-cover{transform:rotateY(-145deg)}.album-book:focus-visible{outline:3px solid #63814b;outline-offset:5px}.album-back{padding:9px 14px;border:3px solid #a76227;background:#fff1d1;color:#604126;font:800 14px Nunito,sans-serif;cursor:pointer}.album-theme-title{color:#6a492b}.album-book-count{font-size:13px}.album-pair-filter{margin-left:12px}@media(prefers-reduced-motion:reduce){.album-book-cover{transition:none}}
    .album-photo[data-collection="joja"]{border:3px solid #7c8bb0;background:#f0f1fd}.album-photo[data-collection="joja"]::after{content:'🧾 JOJA';position:absolute;right:12px;top:17px;padding:3px 7px;background:#eeeaf4df;border:2px solid #787a9c;color:#5a4b76;font-size:11px;font-weight:900;transform:rotate(7deg)}
    .album-photo[data-collection="nights"]{border-color:#708ca0;background:#eff3f7}.album-photo[data-collection="romance"]{border-color:#cba099;background:#fff0e9}.album-photo[data-collection="festivals"]{border-color:#c4a658;background:#fff8dc}
    .album-book{--dark:#754324;--mid:#b9793e;--light:#d59d58;--trim:#e9ba76}.album-book[data-theme="coop"],.album-book[data-theme="farm"]{--dark:#345d39;--mid:#668c48;--light:#91ae5e;--trim:#d3e6a2}.album-book[data-theme="fishing"]{--dark:#28536d;--mid:#4388a0;--light:#74b9c4;--trim:#c5edef}.album-book[data-theme="adventures"]{--dark:#47465c;--mid:#6d6b82;--light:#9995aa;--trim:#d9cee2}.album-book[data-theme="center"]{--dark:#5b6635;--mid:#97a250;--light:#c7b967;--trim:#f5e7a1}.album-book[data-theme="mishaps"]{--dark:#843d30;--mid:#c36d46;--light:#e7a16a;--trim:#ffe0a7}.album-book[data-theme="romance"]{--dark:#893f56;--mid:#c9687e;--light:#e5a3a5;--trim:#ffe1cf}.album-book[data-theme="nights"]{--dark:#303a69;--mid:#505b94;--light:#8189b8;--trim:#e3dca9}.album-book[data-theme="festivals"]{--dark:#8c5824;--mid:#c79236;--light:#ecd17c;--trim:#fff1b2}.album-book[data-theme="joja"]{--dark:#303e70;--mid:#596ba2;--light:#8894c1;--trim:#d8ddf5}.album-book-cover{background:linear-gradient(90deg,var(--dark) 0 12px,var(--mid) 13px,var(--light));border-color:var(--dark);box-shadow:inset 0 0 0 4px var(--trim)}.album-book-cover::before,.album-book-cover::after{position:absolute;color:var(--trim);font-size:18px;letter-spacing:7px}.album-book-cover::before{content:attr(data-decoration);top:16px}.album-book-cover::after{content:attr(data-decoration);bottom:16px}.album-photo[data-collection="farm"]{background:#f2f8dc;border-color:#84a55c}.album-photo[data-collection="fishing"]{background:#e7f5f5;border-color:#6d9fad}.album-photo[data-collection="adventures"]{background:#efedf4;border-color:#89839d}.album-photo[data-collection="center"]{background:#f8f5da;border-color:#a5a065}.album-photo[data-collection="mishaps"]{background:#fff0df;border-color:#c77e58}
    `; document.head.append(style);
    const seasons = { spring: 'Primavera', summer: 'Verão', fall: 'Outono', winter: 'Inverno' };
    let ticket = 0, availabilityTicket = 0, lastVersion, lastIdentity, requesting = false, selectedCollection = '', selectedPair = '';
    const collections = [
        ['farm', 'Vida na fazenda', 'Plantações, animais e trabalho em boa companhia.', '🌾'],
        ['fishing', 'À beira da água', 'Pescarias e garimpos compartilhados.', '🎣'],
        ['adventures', 'Grandes aventuras', 'Minas, batalhas e descobertas pelo vale.', '⛏️'],
        ['center', 'Centro Comunitário', 'Entregas, conquistas e visitas aos Junimos.', '🌳'],
        ['mishaps', 'Pequenas trapalhadas', 'Desmaios e momentos inesperados das aventuras.', '💫'],
        ['coop', 'Coop', 'Momentos compartilhados na fazenda.', '\u{1f331}'],
        ['romance', 'Rom\u00e2nticos', 'Lembran\u00e7as cheias de carinho.', '\u{1f495}'],
        ['nights', 'Nossas noites', 'Hist\u00f3rias guardadas depois do p\u00f4r do sol.', '\u{1f319}'],
        ['festivals', 'Festivais', 'Celebra\u00e7\u00f5es e encontros pelo vale.', '\u{1f3aa}'],
        ['joja', 'Cantinho da vergonha', 'Pequenas trapalhadas que merecem ser lembradas.', '\u{1f9fe}'],
        ['memories', 'Outras lembran\u00e7as', 'Outros momentos especiais da vida no vale.', '\u{1f4d6}']
    ];
    const decorations = { coop: '🌱 ☀ 🌱', farm: '🌻 ✿ 🌻', fishing: '〰 🐟 〰', adventures: '✦ 💎 ✦', center: '🍃 ✦ 🍃', mishaps: '✦ 💤 ✦', romance: '♡ ✿ ♡', nights: '✦ ☾ ✦', festivals: '✦ 🎈 ✦', joja: '★ ▰ ★', memories: '✦ ♡ ✦' };
    const identity = () => JSON.stringify([root.guiaData?.farm?.saveId, root.guiaData?.player?.multiplayerId]);
    const descendants = node => Array.from(node?.children || []).flatMap(child => [child, ...descendants(child)]);
    const active = () => typeof current !== 'undefined' && current === 'albums';
    function add(parent, tag, text, cls) { const element = document.createElement(tag); if (text != null) element.textContent = text; if (cls) element.className = cls; parent.append(element); return element; }
    function imageUrl(photo) { return '/api/albums/photos/' + photo.imageId + '.png'; }
    function show(photo) {
        const dialog = document.querySelector('#dialog'), body = document.querySelector('#dialogbody');
        dialog.classList.remove('item-modal', 'wiki-dialog'); dialog.classList.add('album-viewer'); dialog.setAttribute('aria-label', photo.title);
        body.replaceChildren(); add(body, 'h2', photo.title);
        const image = add(body, 'img'); image.src = imageUrl(photo); image.alt = photo.description;
        add(body, 'p', photo.description);
        if (photo.isComposite) add(body, 'p', 'Montagem das duas perspectivas originais, com moldura de coração. As capturas podem ter uma pequena diferença de tempo.');
        else if (photo.id !== photo.imageId) add(body, 'p', photo.kind === 'center-forgot' ? 'Foto registrada na chegada; legenda adicionada depois da visita.' : 'Esta foto também registra outras lembranças do mesmo momento.');
        if (!dialog.open) dialog.showModal();
    }
    async function renderAlbums() {
        const run = ++ticket, target = document.querySelector('#content'), requestedIdentity = identity(), requestedVersion = root.guiaData?.albums?.version; requesting = true;
        const previous = target._albumView && target.children[0] === target._albumView.header && target._albumView.identity === requestedIdentity ? target._albumView : null;
        let header = previous?.header;
        if (!header) {
            target.replaceChildren(); header = add(target, 'header', null, 'album-header'); add(header, 'span', '📸');
            const heading = add(header, 'div'); add(heading, 'h1', 'Álbuns'); add(heading, 'p', 'As grandes aventuras e as pequenas trapalhadas do seu vale.');
        }
        const content = document.createElement('div');
        if (!previous) { target.append(content); add(content, 'div', 'Abrindo as lembranças…', 'album-empty'); }
        try {
            const response = await fetch('/api/albums');
            if (!response.ok) {
                if (response.status === 401) throw Error('Conecte sua fazenda para abrir os álbuns.');
                if (response.status === 503) throw Error('Abra o guia pelo mod para ver suas fotos ou configure a pasta de álbuns na API local.');
                throw Error('Não foi possível abrir o álbum agora.');
            }
            const data = await response.json(); if (run !== ticket || !active()) return;
            if (requestedIdentity !== identity()) return;
            if (!data.supported) throw Error('Este servidor ainda não oferece álbuns. Abra o guia pelo mod atualizado.');
            content.replaceChildren();
            const cards = new Map(descendants(previous?.content).filter(node => node._albumPhotoId).map(node => [node._albumPhotoId, node]));
            const photos = displayPhotos((Array.isArray(data.photos) ? data.photos : []).filter(photo => photo && validId(photo.id) && validId(photo.imageId)));
            const sessions = new Map((Array.isArray(data.sessions) ? data.sessions : []).map(session => [session.id, session]));
            const available = collections.filter(([id]) => photos.some(photo => collectionOf(photo) === id));
            if (selectedCollection && !available.some(([id]) => id === selectedCollection)) { selectedCollection = ''; selectedPair = ''; }
            if (!selectedCollection) {
                const gallery = add(content, 'div', null, 'album-books'); gallery.setAttribute('aria-label', 'Galeria de \u00c1lbuns');
                for (const [id, title, description, icon] of available) {
                    const count = photos.filter(photo => collectionOf(photo) === id).length;
                    const book = add(gallery, 'button', null, 'album-book'); book.type = 'button';
                    book.setAttribute('data-theme', id);
                    book.setAttribute('aria-label', title + ': ' + description + ' ' + count + (count === 1 ? ' foto' : ' fotos'));
                    const pages = add(book, 'span', null, 'album-book-pages'); add(pages, 'span', description);
                    const cover = add(book, 'span', null, 'album-book-cover'); cover.setAttribute('data-decoration', decorations[id]); add(cover, 'span', icon); add(cover, 'strong', title); add(cover, 'small', count + (count === 1 ? ' foto' : ' fotos'), 'album-book-count');
                    book.onclick = () => { selectedCollection = id; selectedPair = ''; renderAlbums(); };
                }
            } else {
                const controls = add(content, 'nav', null, 'album-filters');
                const back = add(controls, 'button', 'Voltar para a galeria de \u00c1lbuns', 'album-back'); back.type = 'button'; back.onclick = () => { selectedCollection = ''; selectedPair = ''; renderAlbums(); };
                add(content, 'h2', collections.find(([id]) => id === selectedCollection)[1], 'album-theme-title');
                const pairs = new Map();
                for (const photo of filterPhotos(photos, selectedCollection)) if (photo.pairKey && Array.isArray(photo.participants) && photo.participants.length > 1) pairs.set(photo.pairKey, photo.participants.join(' & '));
                if (pairs.size) {
                    const select = add(controls, 'select', null, 'album-pair-filter'); select.setAttribute('aria-label', 'Escolher dupla');
                    const any = add(select, 'option', 'Todas as duplas'); any.value = '';
                    for (const [key, name] of pairs) { const option = add(select, 'option', name); option.value = key; }
                    select.value = selectedPair; select.onchange = () => { selectedPair = select.value; renderAlbums(); };
                }
            }
            const days = selectedCollection ? groupPhotos(filterPhotos(photos, selectedCollection, selectedPair)) : [];
            for (const session of sessions.values()) if (!photos.some(photo => photo.sessionId === session.id) && (selectedCollection && selectedCollection === session.collection)) {
                const pending = add(content, 'div', null, 'album-empty'); add(pending, 'strong', session.playerNames.join(' & ')); add(pending, 'div', sessionStatus(session));
            }
            if (!data.active || !photos.length || (selectedCollection && !days.length)) {
                const empty = add(content, 'div', null, 'album-empty'); add(empty, 'span', '📷');
                add(empty, 'div', !data.active ? 'Carregue sua fazenda no jogo para abrir o álbum dela.' : photos.length && !days.length ? 'Esta coleção ainda não tem fotos com esse filtro.' : root.guiaData?.albums?.enabled === false ?
                    'A captura automática está desativada no mod.' : 'Seu álbum ainda está esperando a primeira história.');
                if (data.active) add(empty, 'p', 'Leve um item necessário ao Centro, entregue-o ou protagonize uma pequena trapalhada. O mod aguarda você caminhar sem menus para guardar a foto.');
            }
            for (const day of days) {
                const section = add(content, 'section', null, 'album-day'); add(section, 'h2', 'Ano ' + day.year + ' · ' + (seasons[day.season] || day.season) + ' · Dia ' + day.day);
                const grid = add(section, 'div', null, 'album-grid');
                for (const photo of day.photos) {
                    const key = JSON.stringify(photo), prior = cards.get(photo.id);
                    if (prior?._albumPhotoKey === key) { if (prior._sessionStatus) prior._sessionStatus.textContent = sessionStatus(sessions.get(photo.sessionId)); grid.append(prior); continue; }
                    const figure = add(grid, 'figure', null, 'album-photo'), button = add(figure, 'button'); button.type = 'button'; button.setAttribute('aria-label', 'Abrir foto: ' + photo.title);
                    figure._albumPhotoId = photo.id; figure._albumPhotoKey = key;
                    figure.setAttribute('data-collection', collectionOf(photo));
                    const image = add(button, 'img'); image.src = imageUrl(photo); image.alt = photo.description; image.loading = 'lazy';
                    button.onclick = () => show(photo);
                    const caption = add(figure, 'figcaption'); add(caption, 'strong', photo.title); add(caption, 'p', photo.description);
                    if (photo.isComposite) add(caption, 'small', 'Duas perspectivas · moldura de coração');
                    else if (photo.id !== photo.imageId) add(caption, 'small', photo.kind === 'center-forgot' ? 'Foto da chegada · lembrança da visita' : 'Uma foto · mais de uma lembrança');
                    if (Array.isArray(photo.participants) && photo.participants.length > 1) add(caption, 'small', photo.participants.join(' & '));
                    if (photo.sessionId) figure._sessionStatus = add(caption, 'small', sessionStatus(sessions.get(photo.sessionId)));
                    add(caption, 'small', photo.playerName + ' · ' + String(Math.floor(photo.time / 100) % 24).padStart(2, '0') + ':' + String(photo.time % 100).padStart(2, '0'));
                }
            }
            target.replaceChildren(header, content); target._albumView = { header, content, identity: requestedIdentity };
        } catch (error) {
            if (run !== ticket || !active()) return;
            content.replaceChildren(); const box = add(content, 'div', null, 'album-empty'); add(box, 'div', error.message);
            const retry = add(box, 'button', 'Tentar novamente', 'album-retry'); retry.onclick = renderAlbums;
            if (!previous) target.replaceChildren(header, content);
            else { previous.error?.remove?.(); previous.error = box; previous.content.append(box); }
        } finally {
            if (run === ticket) {
                requesting = false; lastVersion = requestedVersion; lastIdentity = requestedIdentity;
                if (active() && (requestedIdentity !== identity() || requestedVersion !== root.guiaData?.albums?.version)) renderAlbums();
            }
        }
    }
    async function updateAvailability() {
        const run = ++availabilityTicket, requestedIdentity = identity();
        try {
            const response = await fetch('/api/albums');
            if (!response.ok) return;
            const data = await response.json();
            if (run !== availabilityTicket || requestedIdentity !== identity()) return;
            const hasPhotos = data.supported && data.active && Array.isArray(data.photos) && data.photos.some(photo => photo && validId(photo.id) && validId(photo.imageId));
            const index = tabs.findIndex(tab => tab[0] === 'albums');
            if (hasPhotos && index < 0) { tabs.push(['albums', '\u{1f4f8}', '\u00c1lbuns']); root.nav(); }
            else if (!hasPhotos && index >= 0) { tabs.splice(index, 1); selectedCollection = ''; selectedPair = ''; if (active()) { current = 'home'; root.render(); } root.nav(); }
        } catch (_) { /* Keep the last known state on temporary failures. */ }
    }
    const previous = root.render; root.render = function () { if (active()) renderAlbums(); else { ticket++; requesting = false; previous(); } };
    let availabilityVersion = root.guiaData?.albums?.version, availabilityIdentity = identity();
    root.addEventListener('guia:update', () => {
        if (availabilityVersion !== root.guiaData?.albums?.version || availabilityIdentity !== identity()) {
            if (availabilityIdentity !== identity()) {
                const index = tabs.findIndex(tab => tab[0] === 'albums');
                if (index >= 0) { tabs.splice(index, 1); selectedCollection = ''; selectedPair = ''; if (active()) { current = 'home'; root.render(); } root.nav(); }
            }
            availabilityVersion = root.guiaData?.albums?.version; availabilityIdentity = identity(); updateAvailability();
        }
        if (active() && !requesting && (lastVersion !== root.guiaData?.albums?.version || identity() !== lastIdentity)) renderAlbums();
    });
    updateAvailability();
})(globalThis);
