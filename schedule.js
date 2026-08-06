// Interactive step schedule — no AI involved. Each direction step carries its
// original clock time in data-mins (minutes from midnight of Day 1, emitted at
// build time). Editing a step's time shifts that step and every later step by
// the same delta, preserving the authored offsets (parallel steps, waits, Day 2
// rollovers). Current values live in data-cur so state survives in the DOM.
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

  const bar = document.createElement('p');
  bar.className = 'times-note';
  bar.innerHTML =
    'Edit any step’s start time — later steps shift automatically. <button type="button" class="times-reset" hidden>Reset times</button>';
  steps()[0].closest('ol, ul').before(bar);
  const resetBtn = bar.querySelector('.times-reset');

  article.addEventListener('change', (e) => {
    const input = e.target.closest('.step-clock');
    if (!input) return;
    const li = input.closest('li.step');
    if (!input.value) {
      render(); // cleared input: restore the current value
      return;
    }
    const list = steps();
    const i = list.indexOf(li);
    const [h, m] = input.value.split(':').map(Number);
    const day = Math.floor(cur(li) / 1440); // time input edits within the step's day
    const delta = day * 1440 + h * 60 + m - cur(li);
    if (!delta) return;
    for (let j = i; j < list.length; j++) {
      list[j].dataset.cur = cur(list[j]) + delta;
    }
    resetBtn.hidden = false;
    render();
  });

  resetBtn.addEventListener('click', () => {
    for (const li of steps()) delete li.dataset.cur;
    resetBtn.hidden = true;
    render();
  });

  render();
})();
