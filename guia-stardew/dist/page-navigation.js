(function () {
    'use strict';
    const content = document.querySelector('#content');
    if (!content) return;
    const style = document.createElement('style');
    style.textContent = `
    .content.page-nav-active{padding-left:220px}
    .page-nav{position:fixed;top:50%;transform:translateY(-50%);z-index:20;width:180px;max-height:70vh;overflow:auto;padding:10px;background:#fff3d5;border:4px ridge #a76227;box-shadow:inset 0 0 0 2px #ffdc99,0 4px 0 #754019;color:#62412d}
    .page-nav[hidden]{display:none}.page-nav-title{display:block;margin:2px 4px 8px;font:18px Pixellari,monospace;color:#623d23}.page-nav-list{display:grid;gap:5px}.page-nav button{width:100%;padding:8px;text-align:left;border:2px solid transparent;background:transparent;color:#684b31;font:700 13px/1.3 Nunito,sans-serif;overflow-wrap:anywhere}.page-nav button:hover,.page-nav button[aria-current="location"]{background:#e3edc7;border-color:#78945a}.page-nav button:focus-visible{outline:3px solid #315d94;outline-offset:1px}.page-nav-toggle{display:none}
    @media(max-width:900px){.content.page-nav-active{padding-left:5%}.page-nav{left:8px!important;width:auto;max-width:min(220px,80vw);padding:6px}.page-nav-toggle{display:block!important;width:auto!important}.page-nav-title{display:none}.page-nav-list{display:none}.page-nav[data-open="true"] .page-nav-list{display:grid}}
    @media(prefers-reduced-motion:reduce){.page-nav-target{scroll-behavior:auto}}
    `;
    document.head.append(style);
    const nav = document.createElement('nav'); nav.className = 'page-nav'; nav.hidden = true; nav.setAttribute('aria-label', 'Navegação nesta página');
    const title = document.createElement('strong'); title.className = 'page-nav-title'; title.textContent = 'Nesta página';
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'page-nav-toggle'; toggle.textContent = '☰ Seções'; toggle.setAttribute('aria-expanded', 'false');
    const list = document.createElement('div'); list.className = 'page-nav-list';
    nav.append(title, toggle, list); document.body.append(nav);
    let targets = [], buttons = [], scheduled = false;
    toggle.onclick = () => { const open = nav.dataset.open !== 'true'; nav.dataset.open = String(open); toggle.setAttribute('aria-expanded', String(open)); };
    function position() { if (!nav.hidden) nav.style.left = Math.max(8, content.getBoundingClientRect().left + 12) + 'px'; }
    function updateCurrent() {
        if (!targets.length) return;
        let index = 0;
        for (let i = 0; i < targets.length; i++) if (targets[i].getBoundingClientRect().top <= 130) index = i;
        buttons.forEach((button, i) => { if (i === index) button.setAttribute('aria-current', 'location'); else button.removeAttribute('aria-current'); });
    }
    function refresh() {
        scheduled = false;
        const headings = Array.from(content.querySelectorAll('.season-panel > h2, .bundle-room > h2, #list .sectionhead h2, .social-layout section > .page-title, .album-day > h2'));
        const labels = headings.map(heading => heading.closest('.season-panel') ? heading.children[1]?.textContent?.trim() : heading.textContent.trim());
        const next = headings.filter((_, i) => labels[i]);
        const nextLabels = labels.filter(Boolean);
        if (next.length === targets.length && next.every((node, i) => node === targets[i] && buttons[i]?.textContent === nextLabels[i])) { position(); updateCurrent(); return; }
        targets = next; buttons = []; list.replaceChildren(); nav.hidden = targets.length < 2;
        content.classList.toggle('page-nav-active', !nav.hidden);
        if (nav.hidden) { nav.dataset.open = 'false'; toggle.setAttribute('aria-expanded', 'false'); return; }
        targets.forEach((heading, i) => {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = nextLabels[i];
            button.onclick = () => { heading.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); nav.dataset.open = 'false'; toggle.setAttribute('aria-expanded', 'false'); };
            list.append(button); buttons.push(button);
        });
        position(); updateCurrent();
    }
    function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(refresh); } }
    new MutationObserver(schedule).observe(content, { childList: true, subtree: true, characterData: true });
    window.addEventListener('scroll', updateCurrent, { passive: true });
    window.addEventListener('resize', position);
    schedule();
})();
