// Interactive step schedule — no AI involved. Each direction step carries its
// original clock time in data-mins (minutes from midnight of Day 1, emitted at
// build time). Editing a step's time — or hitting its "now" button — shifts that
// step and every later step by the same delta, preserving the authored offsets
// (parallel steps, waits, Day 2 rollovers). Current values live in data-cur so
// state survives in the DOM, and are mirrored to localStorage so a schedule set
// mid-cook survives a reload.
(() => {
  const article = document.getElementById('recipe');
  if (!article) return;
  const steps = () => [...article.querySelectorAll('li.step[data-mins]')];
  if (!steps().length) return;

  // The per-step clocks make the "Full example schedule" section redundant
  // (and it would go stale as times are edited) — hide it, JS-only so the
  // no-script page keeps it.
  for (const h of article.querySelectorAll('h1, h2, h3')) {
    if (!/^full example schedule/i.test(h.textContent.trim())) continue;
    h.hidden = true;
    let el = h.nextElementSibling;
    while (el && !/^H[1-6]$/.test(el.tagName)) {
      el.hidden = true;
      el = el.nextElementSibling;
    }
  }

  const cur = (li) => Number(li.dataset.cur ?? li.dataset.mins);
  const hhmm = (mins) =>
    `${String(Math.floor((mins % 1440) / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

  // --- persistence -----------------------------------------------------
  // Saved per recipe URL as per-step deltas from the authored baseline, with a
  // fingerprint of that baseline: if the recipe's times are edited and the page
  // rebuilt, stale offsets are dropped rather than silently applied to steps
  // they no longer describe. Every access is guarded — localStorage throws in
  // some privacy modes, and a cook losing their schedule beats a dead page.
  const KEY = `rcp:times:${location.pathname}`;
  const baseline = () => steps().map((li) => li.dataset.mins).join(',');

  function forget() {
    try {
      localStorage.removeItem(KEY);
    } catch {}
  }

  function save() {
    const deltas = steps().map((li) => cur(li) - Number(li.dataset.mins));
    if (!deltas.some((d) => d !== 0)) return forget();
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 1, base: baseline(), deltas }));
    } catch {}
  }

  function restore() {
    let raw = null;
    try {
      raw = localStorage.getItem(KEY);
    } catch {}
    if (!raw) return false;
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {}
    const list = steps();
    if (
      !data ||
      data.v !== 1 ||
      data.base !== baseline() ||
      !Array.isArray(data.deltas) ||
      data.deltas.length !== list.length
    ) {
      forget();
      return false;
    }
    let restored = false;
    list.forEach((li, i) => {
      const d = Number(data.deltas[i]);
      if (!Number.isFinite(d) || d === 0) return;
      li.dataset.cur = Number(li.dataset.mins) + d;
      restored = true;
    });
    return restored;
  }

  // --- rendering -------------------------------------------------------
  function render() {
    const list = steps();
    const multiDay = list.some((li) => Math.floor(cur(li) / 1440) > 0);
    for (const li of list) {
      const input = li.querySelector('.step-clock');
      if (!input) continue;
      const mins = cur(li);
      input.value = hhmm(mins);
      let badge = li.querySelector('.step-day');
      if (multiDay) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'step-day';
          input.after(badge);
        }
        badge.textContent = `Day ${Math.floor(mins / 1440) + 1}`;
      } else {
        badge?.remove();
      }
    }
  }

  // A "now" button per step: the common move mid-cook is "I'm actually starting
  // this bit right now", which is the same shift as editing the clock by hand.
  for (const li of steps()) {
    const when = li.querySelector('.step-when');
    if (!when || when.querySelector('.step-now')) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'step-now';
    b.textContent = 'now';
    b.title = 'Start this step now — later steps shift to match';
    when.append(b);
  }

  const bar = document.createElement('p');
  bar.className = 'times-note';
  bar.innerHTML =
    'Edit any step’s start time, or hit <b>now</b> — later steps shift to match. ' +
    'Your times are saved on this device. ' +
    '<button type="button" class="times-reset" hidden>Reset times</button>';
  steps()[0].closest('ol, ul').before(bar);
  const resetBtn = bar.querySelector('.times-reset');

  function shiftFrom(li, target) {
    const list = steps();
    const i = list.indexOf(li);
    if (i === -1) return;
    const delta = target - cur(li);
    if (!delta) return;
    for (let j = i; j < list.length; j++) list[j].dataset.cur = cur(list[j]) + delta;
    resetBtn.hidden = false;
    save();
    render();
  }

  article.addEventListener('change', (e) => {
    const input = e.target.closest('.step-clock');
    if (!input) return;
    const li = input.closest('li.step');
    if (!input.value) {
      render(); // cleared input: restore the current value
      return;
    }
    const [h, m] = input.value.split(':').map(Number);
    const day = Math.floor(cur(li) / 1440); // time input edits within the step's day
    shiftFrom(li, day * 1440 + h * 60 + m);
  });

  article.addEventListener('click', (e) => {
    const btn = e.target.closest('.step-now');
    if (!btn) return;
    const li = btn.closest('li.step');
    const now = new Date();
    const day = Math.floor(cur(li) / 1440); // keep the step on its own day
    shiftFrom(li, day * 1440 + now.getHours() * 60 + now.getMinutes());
  });

  resetBtn.addEventListener('click', () => {
    for (const li of steps()) delete li.dataset.cur;
    resetBtn.hidden = true;
    forget();
    render();
  });

  if (restore()) resetBtn.hidden = false;
  render();
})();
