// Gallery filtering: free-text search (AND across whitespace-separated terms)
// plus a single-select kind filter. Progressive enhancement — the toolbar ships
// hidden and is revealed here, so a no-JS visitor sees the full list rather than
// controls that do nothing.
(function () {
  const toolbar = document.getElementById('toolbar');
  const input = document.getElementById('q');
  const list = document.getElementById('cards');
  const count = document.getElementById('count');
  const empty = document.getElementById('empty');
  if (!toolbar || !input || !list) return;
  toolbar.hidden = false;

  const items = [...list.querySelectorAll('li')].map((el) => ({
    el,
    kind: el.dataset.kind || '',
    text: (el.dataset.text || '').toLowerCase(),
  }));
  const buttons = [...toolbar.querySelectorAll('.kind-btn')];
  let kind = '';

  function apply() {
    const terms = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let n = 0;
    for (const it of items) {
      const ok = (!kind || it.kind === kind) && terms.every((t) => it.text.includes(t));
      it.el.hidden = !ok;
      if (ok) n++;
    }
    if (empty) empty.hidden = n > 0;
    if (count) {
      count.textContent =
        n === items.length ? `${n} recipes` : `${n} of ${items.length} recipes`;
    }
  }

  input.addEventListener('input', apply);
  for (const b of buttons) {
    b.addEventListener('click', () => {
      kind = b.dataset.kind || '';
      for (const o of buttons) o.setAttribute('aria-pressed', String(o === b));
      apply();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
      input.select();
    } else if (e.key === 'Escape' && document.activeElement === input) {
      input.value = '';
      apply();
      input.blur();
    }
  });

  apply();
})();
