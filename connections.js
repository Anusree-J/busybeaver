/* ========================================
   Busy Beaver — Connections-style hero game
   ======================================== */

(function () {
    const GROUPS = [
        {
            key: 'yellow',
            label: 'TOPPING THE WATCHLIST',
            items: ['SHRINKING', 'DR. HOUSE', 'ABOUT TIME', 'SHOE DOG']
        },
        {
            key: 'green',
            label: 'ON THE RÉSUMÉ',
            items: ['P&G', 'EY', 'CDPI', 'GUARDIANS']
        },
        {
            key: 'blue',
            label: 'PROTOCOLS & BUILDS',
            items: ['BECKN', 'DEDI', 'OPENCRED', 'DEG']
        },
        {
            key: 'purple',
            label: "QUESTIONS I'M CIRCLING",
            items: ['HOW WE WORK', 'OUR BODIES', 'ILLNESS', 'THE MIND']
        }
    ];

    const STORAGE_KEY = 'bb-connections-v1';
    const groupOf = {};
    GROUPS.forEach(g => g.items.forEach(item => { groupOf[item] = g; }));

    const els = {
        solved: document.getElementById('cx-solved'),
        grid: document.getElementById('cx-grid'),
        dots: document.getElementById('cx-dots'),
        toast: document.getElementById('cx-toast'),
        controls: document.getElementById('cx-controls'),
        outro: document.getElementById('cx-outro')
    };
    if (!els.grid) return;

    let state = {
        solved: [],        // group keys in solve order
        mistakes: 4,
        failed: false,
        tiles: [],         // remaining tile order
        selected: new Set()
    };

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                solved: state.solved,
                mistakes: state.mistakes,
                failed: state.failed
            }));
        } catch (e) { /* private mode etc. */ }
    }

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const s = JSON.parse(raw);
            if (Array.isArray(s.solved)) state.solved = s.solved.filter(k => GROUPS.some(g => g.key === k));
            if (typeof s.mistakes === 'number') state.mistakes = Math.max(0, Math.min(4, s.mistakes));
            if (s.failed) state.failed = true;
        } catch (e) { /* ignore */ }
    }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function remainingItems() {
        return GROUPS
            .filter(g => !state.solved.includes(g.key))
            .flatMap(g => g.items);
    }

    function toast(msg) {
        els.toast.textContent = msg;
        els.toast.classList.add('is-on');
        clearTimeout(toast._t);
        toast._t = setTimeout(() => els.toast.classList.remove('is-on'), 1800);
    }

    function renderSolved() {
        els.solved.innerHTML = state.solved.map(key => {
            const g = GROUPS.find(x => x.key === key);
            return `<div class="cx-bar cx-bar--${g.key}">
                <span class="cx-bar-label">${g.label}</span>
                <span class="cx-bar-items">${g.items.join(', ')}</span>
            </div>`;
        }).join('');
    }

    function renderGrid() {
        els.grid.innerHTML = state.tiles.map(item => {
            const sel = state.selected.has(item) ? ' is-selected' : '';
            return `<button type="button" class="cx-tile${sel}" data-item="${item}" aria-pressed="${sel ? 'true' : 'false'}">${item}</button>`;
        }).join('');
    }

    function renderDots() {
        els.dots.innerHTML = 'MISTAKES LEFT ' + Array.from({ length: 4 }, (_, i) =>
            `<span class="cx-dot${i < state.mistakes ? ' is-on' : ''}"></span>`).join('');
    }

    function renderEnd() {
        const done = state.solved.length === GROUPS.length;
        els.controls.hidden = done;
        els.dots.hidden = done;
        els.outro.hidden = !done;
        if (done) {
            els.outro.querySelector('.cx-outro-msg').textContent = state.failed
                ? 'The dam broke — but now you know the beaver.'
                : 'Solved. Now you know the beaver.';
        }
    }

    function render() {
        renderSolved();
        renderGrid();
        renderDots();
        renderEnd();
    }

    function solveGroup(key) {
        state.solved.push(key);
        state.selected.clear();
        state.tiles = shuffle(remainingItems());
        save();
        render();
    }

    function revealAll() {
        state.failed = true;
        GROUPS.forEach(g => { if (!state.solved.includes(g.key)) state.solved.push(g.key); });
        state.selected.clear();
        state.tiles = [];
        save();
        render();
    }

    function submit() {
        if (state.selected.size !== 4) return;
        const picked = [...state.selected];
        const g = groupOf[picked[0]];
        if (picked.every(item => groupOf[item] === g)) {
            solveGroup(g.key);
            if (state.solved.length === GROUPS.length) save();
            return;
        }
        // wrong — count best overlap for the "one away" toast
        const best = Math.max(...GROUPS.map(x => picked.filter(i => groupOf[i] === x).length));
        state.mistakes--;
        save();
        renderDots();
        picked.forEach(item => {
            const el = els.grid.querySelector(`[data-item="${CSS.escape(item)}"]`);
            if (el) el.classList.add('is-shake');
        });
        setTimeout(() => {
            els.grid.querySelectorAll('.is-shake').forEach(el => el.classList.remove('is-shake'));
        }, 500);
        if (state.mistakes <= 0) {
            setTimeout(revealAll, 550);
        } else if (best === 3) {
            toast('One away…');
        }
    }

    els.grid.addEventListener('click', e => {
        const btn = e.target.closest('.cx-tile');
        if (!btn) return;
        const item = btn.dataset.item;
        if (state.selected.has(item)) state.selected.delete(item);
        else if (state.selected.size < 4) state.selected.add(item);
        renderGrid();
    });

    els.controls.addEventListener('click', e => {
        const action = e.target.closest('[data-action]');
        if (!action) return;
        if (action.dataset.action === 'shuffle') { state.tiles = shuffle(state.tiles); render(); }
        if (action.dataset.action === 'deselect') { state.selected.clear(); renderGrid(); }
        if (action.dataset.action === 'submit') submit();
    });

    load();
    state.tiles = shuffle(remainingItems());
    render();
})();
