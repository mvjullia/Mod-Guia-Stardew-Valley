(function () {
    'use strict';
    const style = document.createElement('style');
    style.textContent = `
        html,body,button,a,[role="button"],label,select,summary,.gift {
            cursor:url('game-cursor.png') 0 0,auto!important;
        }
        input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]),textarea,[contenteditable="true"] {
            cursor:text!important;
        }
        .item-fields p,.item-fields .item-field-value,.item-fields a{font-weight:400}
        .item-fields .item-field-label{font-weight:800}
        .item-fields .item-reference{color:#245b7a;text-decoration:underline;text-underline-offset:3px}
        .item-fields .item-reference:hover{color:#7a431c;background:#ffe4aa}
        .item-fields .item-reference:focus-visible{outline:2px solid #315d94;outline-offset:3px}
        .item-details{flex-wrap:wrap}
        .item-reference-back{margin-left:auto;border:2px solid #a76227;background:#fff1d1;color:#245b7a;padding:7px 10px;font:inherit;font-size:13px}
        .menu-sound-control{margin-top:auto;padding-top:18px}
        .menu-sound-toggle{width:100%;padding:10px;border:3px ridge #b77940;background:#fff1d1;color:#553822;font:inherit;font-size:12px;line-height:1.5}
        .menu-sound-toggle:focus-visible{outline:3px solid #315d94;outline-offset:4px}
    `;
    document.head.append(style);

    const files = { hover: 'menu-hover.wav', select: 'menu-select.wav', open: 'menu-open.wav', close: 'menu-close.wav' };
    const players = new Map();
    let enabled = true, unlocked = false, keyboardNavigation = false, lastHover = -Infinity;
    try { enabled = localStorage.getItem('guia-menu-sounds') !== 'off'; } catch { /* Storage may be disabled. */ }
    function play(cue) {
        if (!enabled || !unlocked || typeof Audio === 'undefined') return;
        try {
            let audio = players.get(cue);
            if (!audio) { audio = new Audio(files[cue]); audio.preload = 'auto'; audio.volume = 0.3; players.set(cue, audio); }
            for (const other of players.values()) if (other !== audio) { other.pause(); other.currentTime = 0; }
            audio.currentTime = 0;
            const playing = audio.play();
            playing?.catch(() => {}); // Autoplay restrictions or unavailable audio must not block navigation.
        } catch { /* Audio devices and browser policies are optional. */ }
    }
    const control = document.createElement('div'); control.className = 'menu-sound-control';
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'menu-sound-toggle';
    function updateToggle() {
        toggle.textContent = enabled ? 'Sons do menu: ativados' : 'Sons do menu: desativados';
        toggle.setAttribute('aria-label', 'Sons do menu'); toggle.setAttribute('aria-pressed', String(enabled));
        toggle.title = enabled ? 'Desativar sons do menu' : 'Ativar sons do menu';
    }
    toggle.addEventListener('click', () => {
        enabled = !enabled;
        try { localStorage.setItem('guia-menu-sounds', enabled ? 'on' : 'off'); } catch { /* Keep the session preference. */ }
        if (!enabled) for (const audio of players.values()) { audio.pause(); audio.currentTime = 0; }
        updateToggle();
        if (enabled) play('select');
    });
    updateToggle(); control.append(toggle);
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.append(control);

    const unlock = event => {
        if (!event.isTrusted) return;
        unlocked = true;
        keyboardNavigation = event.type === 'keydown';
    };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    const interactive = target => {
        const element = target?.closest?.('button,a[href],[role="button"],input[type="button"],input[type="submit"],select,summary');
        return element && !element.disabled && element.getAttribute('aria-disabled') !== 'true' && element !== toggle ? element : null;
    };
    const modal = document.querySelector('#dialog');
    let backdropStart = null;
    function outsideDialog(event) {
        const dialog = event.target;
        if (!dialog || dialog.tagName !== 'DIALOG' || !dialog.open) return null;
        const box = dialog.getBoundingClientRect();
        return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom ? dialog : null;
    }
    document.addEventListener('pointerdown', event => { backdropStart = outsideDialog(event); }, true);
    document.addEventListener('click', event => {
        const outside = outsideDialog(event);
        if (outside && outside === backdropStart) outside.close();
        backdropStart = null;
    }, true);
    let wasOpen = false;
    document.addEventListener('click', () => { wasOpen = Boolean(modal?.open); }, true);
    document.addEventListener('click', event => {
        if (!event.isTrusted || !interactive(event.target)) return;
        if (modal?.open && !wasOpen) play('open');
        else if (modal?.open || !wasOpen) play('select');
        // Closing is handled by the dialog's close event, including Escape.
    });
    modal?.addEventListener('close', () => play('close'));
    function hover(event) {
        const element = interactive(event.target);
        if (!event.isTrusted || !element || element.contains(event.relatedTarget) ||
            (event.type === 'focusin' && !keyboardNavigation) ||
            (event.type === 'pointerover' && event.pointerType !== 'mouse')) return;
        const now = performance.now();
        if (now - lastHover < 100) return;
        lastHover = now; play('hover');
    }
    document.addEventListener('pointerover', hover);
    document.addEventListener('focusin', hover);
    const dialogStyle = document.createElement('style');
    dialogStyle.textContent = `.dialog,.dialog.item-modal{box-sizing:border-box;width:min(1100px,94vw);max-width:94vw;max-height:90vh;overflow:auto}.item-modal .item-details .sprite-frame{width:56px;height:56px}.item-modal .item-details .sprite-frame .game-icon{width:40px;height:40px;padding:0;border:0;background:transparent;margin:0;box-sizing:border-box}`;
    document.head.append(dialogStyle);
})();
