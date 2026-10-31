(function (root) {
    'use strict';
    const validId = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
    const collectionOf = photo => ['coop', 'romance', 'nights', 'festivals', 'joja'].includes(photo.collection) ? photo.collection : 'memories';
    const filterPhotos = (photos, collection = 'all', pair = '') => photos.filter(photo =>
        (collection === 'all' || collectionOf(photo) === collection) && (!pair || photo.pairKey === pair));
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
    if (typeof module !== 'undefined' && module.exports) module.exports = { groupPhotos, validId, filterPhotos, collectionOf };
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
    .album-photo[data-collection="joja"]{border:3px solid #7c8bb0;background:#f0f1fd}.album-photo[data-collection="joja"]::after{content:'🧾 JOJA';position:absolute;right:12px;top:17px;padding:3px 7px;background:#eeeaf4df;border:2px solid #787a9c;color:#5a4b76;font-size:11px;font-weight:900;transform:rotate(7deg)}
    .album-photo[data-collection="nights"]{border-color:#708ca0;background:#eff3f7}.album-photo[data-collection="romance"]{border-color:#cba099;background:#fff0e9}.album-photo[data-collection="festivals"]{border-color:#c4a658;background:#fff8dc}
    `; document.head.append(style);
    const seasons = { spring: 'Primavera', summer: 'Verão', fall: 'Outono', winter: 'Inverno' };
    let ticket = 0, lastVersion, lastIdentity, requesting = false, selectedCollection = 'all', selectedPair = '';
    const collections = [['all', '📷 Todas'], ['coop', '🌱 Coop'], ['romance', '💕 Românticos'], ['nights', '🌙 Nossas noites'], ['festivals', '🎪 Festivais'], ['joja', '🧾 Cantinho da vergonha'], ['memories', '📖 Outras lembranças']];
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
        if (photo.id !== photo.imageId) add(body, 'p', photo.kind === 'center-forgot' ? 'Foto registrada na chegada; legenda adicionada depois da visita.' : 'Esta foto também registra outras lembranças do mesmo momento.');
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
            const photos = (Array.isArray(data.photos) ? data.photos : []).filter(photo => photo && validId(photo.id) && validId(photo.imageId));
            const filters = add(content, 'nav', null, 'album-filters'); filters.setAttribute('aria-label', 'Coleções de fotos');
            for (const [id, label] of collections) {
                const button = add(filters, 'button', label); button.type = 'button'; button.setAttribute('aria-pressed', String(id === selectedCollection));
                button.onclick = () => { selectedCollection = id; selectedPair = ''; renderAlbums(); };
            }
            const pairs = new Map();
            for (const photo of photos) if (photo.pairKey && Array.isArray(photo.participants) && photo.participants.length > 1) pairs.set(photo.pairKey, photo.participants.join(' & '));
            if (pairs.size && selectedCollection !== 'joja' && selectedCollection !== 'memories') {
                const select = add(filters, 'select', null, 'album-pair-filter'); select.setAttribute('aria-label', 'Escolher dupla');
                const any = add(select, 'option', 'Todas as duplas'); any.value = '';
                for (const [key, name] of pairs) { const option = add(select, 'option', name); option.value = key; }
                select.value = selectedPair; select.onchange = () => { selectedPair = select.value; renderAlbums(); };
            }
            const days = groupPhotos(filterPhotos(photos, selectedCollection, selectedPair));
            if (!data.active || !days.length) {
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
                    if (prior?._albumPhotoKey === key) { grid.append(prior); continue; }
                    const figure = add(grid, 'figure', null, 'album-photo'), button = add(figure, 'button'); button.type = 'button'; button.setAttribute('aria-label', 'Abrir foto: ' + photo.title);
                    figure._albumPhotoId = photo.id; figure._albumPhotoKey = key;
                    figure.setAttribute('data-collection', collectionOf(photo));
                    const image = add(button, 'img'); image.src = imageUrl(photo); image.alt = photo.description; image.loading = 'lazy';
                    button.onclick = () => show(photo);
                    const caption = add(figure, 'figcaption'); add(caption, 'strong', photo.title); add(caption, 'p', photo.description);
                    if (photo.id !== photo.imageId) add(caption, 'small', photo.kind === 'center-forgot' ? 'Foto da chegada · lembrança da visita' : 'Uma foto · mais de uma lembrança');
                    if (Array.isArray(photo.participants) && photo.participants.length > 1) add(caption, 'small', photo.participants.join(' & '));
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
    if (!tabs.some(tab => tab[0] === 'albums')) tabs.push(['albums', '📸', 'Álbuns']);
    const previous = root.render; root.render = function () { if (active()) renderAlbums(); else { ticket++; requesting = false; previous(); } };
    root.addEventListener('guia:update', () => {
        if (active() && !requesting && (lastVersion !== root.guiaData?.albums?.version || identity() !== lastIdentity)) renderAlbums();
    });
    root.nav();
})(globalThis);
