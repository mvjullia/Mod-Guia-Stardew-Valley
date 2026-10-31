(function (root) {
    'use strict';
    const missing = new Set(['', 'não verificado', 'não se aplica']);
    const hasValue = value => typeof value === 'number' ? Number.isFinite(value)
        : typeof value === 'string' && !missing.has(value.trim().toLocaleLowerCase('pt-BR'));
    const normalize = value => String(value ?? '').trim().normalize('NFC').toLocaleLowerCase('pt-BR');

    function createCatalog(columns, data) {
        if (!Array.isArray(columns) || columns.length !== 35 ||
            !columns.every(c => c && typeof c.key === 'string' && /^[a-z][A-Za-z0-9]*$/.test(c.key) && hasValue(c.label)) ||
            new Set(columns.map(c => c.key)).size !== columns.length || data.schemaVersion !== 2 || !Array.isArray(data.items)) {
            throw new Error('Formato de catálogo inválido.');
        }
        const ids = new Map(), bareIds = new Map(), english = new Map(), names = new Map();
        function index(map, key, item) {
            if (!hasValue(key)) return;
            key = normalize(key);
            // Ambiguous aliases must never select a different item type.
            map.set(key, map.has(key) ? null : item);
        }
        for (const item of data.items) {
            const id = item.gameId;
            if (!hasValue(id) || !hasValue(item.name) || ids.has(String(id))) throw new Error('ID de item inválido ou duplicado.');
            ids.set(String(id), item);
            index(bareIds, String(id).replace(/^\([^)]*\)/, ''), item);
            index(english, item.englishName, item);
            index(names, item.name, item);
        }
        const referenceNames = new Map();
        const referenceKey = value => normalize(value).replace(/\s+/g, ' ');
        for (const item of data.items) {
            for (const name of [item.name, item.englishName]) {
                if (!hasValue(name) || !/\p{L}/u.test(name)) continue;
                const key = referenceKey(name);
                if (!referenceNames.has(key)) referenceNames.set(key, item);
                else if (referenceNames.get(key)?.gameId !== item.gameId) referenceNames.set(key, null);
            }
        }
        // Longest names take precedence: "Sementes de Chirívia" must not become a link to "Chirívia".
        const referenceTerms = [...referenceNames].filter(([, item]) => item).map(([name]) => name)
            .sort((a, b) => b.length - a.length || a.localeCompare(b));
        const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
        const referencePattern = referenceTerms.length ? new RegExp(
            '(?<![\\p{L}\\p{N}_])(?:' + referenceTerms.map(escape).join('|') + ')(?![\\p{L}\\p{N}_])', 'giu') : null;
        function references(value, currentId) {
            const text = String(value), parts = [];
            function plain(chunk) {
                if (!referencePattern) { if (chunk) parts.push({ text: chunk }); return; }
                let end = 0;
                for (const match of chunk.matchAll(referencePattern)) {
                    if (match.index > end) parts.push({ text: chunk.slice(end, match.index) });
                    const target = referenceNames.get(referenceKey(match[0]));
                    parts.push(target.gameId === currentId ? { text: match[0] } : { text: match[0], item: target });
                    end = match.index + match[0].length;
                }
                if (end < chunk.length) parts.push({ text: chunk.slice(end) });
            }
            let end = 0;
            // URLs are already references; never insert another link inside one.
            for (const match of text.matchAll(/https?:\/\/[^\s<>]+/g)) {
                plain(text.slice(end, match.index));
                parts.push({ text: match[0], url: match[0] });
                end = match.index + match[0].length;
            }
            plain(text.slice(end));
            return parts;
        }
        function find(item) {
            const qualified = item.qualifiedId || (/^\([^)]*\)/.test(item.id || '') ? item.id : null);
            if (qualified) return ids.get(String(qualified)) || null;
            if (hasValue(item.id)) {
                const id = normalize(item.id);
                if (bareIds.get(id)) return bareIds.get(id);
                // Old snapshots omit type prefixes; use the name only when the ID agrees.
                const named = english.get(normalize(item.wikiName)) || names.get(normalize(item.name));
                if (named && normalize(String(named.gameId).replace(/^\([^)]*\)/, '')) === id) return named;
                return null;
            }
            return english.get(normalize(item.wikiName)) || names.get(normalize(item.name)) || null;
        }
        function values(item) {
            const record = find(item);
            // The save supplies icons/quality; catalog values take priority for information.
            const fallback = {
                name: item.name, description: item.description, category: item.category,
                salePrice: record ? undefined : item.price, gameId: item.qualifiedId || item.id,
                englishName: item.wikiName
            };
            return columns.map(({ key, label }) => [label, hasValue(record?.[key]) ? record[key] : fallback[key], key])
                .filter(([, value]) => hasValue(value));
        }
        return { find, values, references, items: data.items };
    }

    if (typeof module !== 'undefined' && module.exports) module.exports = { createCatalog, hasValue };
    if (typeof document === 'undefined') return;
    let pending, currentItem, navigatingReference = false;
    let referenceTrail = [];
    async function load() {
        if (!pending) {
            pending = Promise.all(['item-fields.json', 'items.json'].map(async file => {
                const response = await fetch(file);
                if (!response.ok) throw new Error('Falha ao carregar ' + file);
                return response.json();
            })).then(([columns, data]) => createCatalog(columns, data)).catch(error => {
                pending = null; // A later opening can retry a transient failure.
                throw error;
            });
        }
        return pending;
    }
    root.GuiaItemCatalog = { load };
    function catalogItem(item) {
        return { qualifiedId: item.gameId, name: item.name, wikiName: item.englishName, category: item.category };
    }
    function navigateReference(item, remember = true) {
        if (remember && currentItem) referenceTrail.push(currentItem);
        navigatingReference = true;
        try { root.openItemPage(item); } finally { navigatingReference = false; }
    }
    function appendValue(parent, value, catalog, currentId) {
        for (const part of catalog.references(value, currentId)) {
            if (!part.url && !part.item) { parent.append(document.createTextNode(part.text)); continue; }
            const link = document.createElement('a');
            link.textContent = part.text;
            if (part.url) {
                link.href = part.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
            } else {
                link.href = '?item=' + encodeURIComponent(part.item.gameId);
                link.className = 'item-reference';
                link.title = 'Abrir ' + part.item.name;
                link.setAttribute('data-item-id', part.item.gameId);
                link.onclick = event => {
                    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    navigateReference(catalogItem(part.item));
                };
            }
            parent.append(link);
        }
    }
    root.openItemPage = function (item) {
        if (!navigatingReference) referenceTrail = [];
        currentItem = item;
        const modal = document.querySelector('#dialog'), body = document.querySelector('#dialogbody');
        modal.classList.remove('wiki-dialog', 'album-viewer'); modal.classList.add('item-modal');
        body.replaceChildren();
        const header = document.createElement('div'); header.className = 'item-details';
        const frame = document.createElement('span'); frame.className = 'sprite-frame';
        const icon = document.createElement('img'); icon.alt = ''; icon.className = 'game-icon';
        const iconFor = record => item.icon || ((record?.englishName || item.wikiName) ? 'https://stardewvalleywiki.com/Special:Redirect/file/' + encodeURIComponent((record?.englishName || item.wikiName).replaceAll(' ', '_') + '.png') : '');
        const initialIcon = iconFor(null); if (initialIcon) icon.src = initialIcon; else icon.hidden = true;
        icon.onerror = () => { icon.hidden = true; }; frame.append(icon); header.append(frame);
        const heading = document.createElement('h2'); heading.textContent = item.name || '';
        header.append(heading);
        if (referenceTrail.length) {
            const back = document.createElement('button');
            back.type = 'button'; back.className = 'item-reference-back'; back.textContent = '← Voltar';
            back.title = 'Voltar ao item anterior';
            back.onclick = () => navigateReference(referenceTrail.pop(), false);
            header.append(back);
        }
        body.append(header);
        root.GuiaSeason?.markItem(header, item);
        const fields = document.createElement('div'); fields.className = 'item-fields';
        fields.setAttribute('aria-live', 'polite');
        const status = document.createElement('p'); status.textContent = 'Carregando informações do item…';
        fields.append(status); body.append(fields);
        if (!modal.open) modal.showModal();
        function render(catalog) {
            if (!fields.isConnected || !modal.open) return;
            const resolvedIcon = iconFor(catalog.find(item));
            if (resolvedIcon && icon.src !== resolvedIcon) { icon.hidden = false; icon.src = resolvedIcon; }
            const currentId = catalog.find(item)?.gameId || item.qualifiedId || item.id;
            fields.replaceChildren();
            for (const [label, value, key] of catalog.values(item)) {
                if (key === 'name') {
                    heading.textContent = String(value); modal.setAttribute('aria-label', String(value));
                    continue;
                }
                const p = document.createElement('p'), strong = document.createElement('strong');
                strong.className = 'item-field-label';
                strong.textContent = label + ': '; p.append(strong);
                const content = document.createElement('span'); content.className = 'item-field-value';
                appendValue(content, value, catalog, currentId); p.append(content); fields.append(p);
            }
        }
        load().then(render).catch(() => {
            if (!fields.isConnected || !modal.open) return;
            const message = document.createElement('p');
            message.textContent = 'Não foi possível carregar o catálogo. Feche e abra o item para tentar novamente.';
            fields.replaceChildren(message);
        });
    };
    // References also have a real destination for opening in another tab or bookmarking.
    if (typeof location !== 'undefined') {
        const id = new URLSearchParams(location.search).get('item');
        if (id) load().then(catalog => {
            const item = catalog.find({ qualifiedId: id });
            if (item) root.openItemPage(catalogItem(item));
        }).catch(() => {});
    }
})(globalThis);
