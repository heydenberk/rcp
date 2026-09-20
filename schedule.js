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
  const hhmm = (mins) => {
    const m = Math.floor(mins) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  // Matches how <input type="time"> renders for this locale, so the alert
  // countdown reads the same as the clocks beside the steps.
  const clock = (mins) => {
    const m = Math.floor(mins) % 1440;
    const d = new Date(2000, 0, 1, Math.floor(m / 60), m % 60);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

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
  // Set by the alerts block below; called at the end of every render so the
  // countdown and armed timers follow whatever the clocks now say.
  let onRender = () => {};

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
    onRender();
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
    '<button type="button" class="times-alarm-all">🔔 Alarm every step</button> ' +
    '<button type="button" class="times-reset" hidden>Reset times</button>' +
    '<span class="next-alert" role="status" aria-live="polite"></span>';
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


  // --- alarms ----------------------------------------------------------
  // Alarms are armed per step: each step carries its own bell, so a cook can
  // set one on the 30-minute rest and ignore the rest. Day 1 is whatever
  // calendar day the page was opened on, so a step's clock time maps to a real
  // instant; Day 2 steps land 24h later. When an armed step comes due the chime
  // repeats until it's dismissed or snoozed — the point is to be heard from
  // another room, not to be missed while your hands are in dough.
  const alarmAllBtn = bar.querySelector('.times-alarm-all');
  const nextLabel = bar.querySelector('.next-alert');
  const ALARM_KEY = `rcp:alarms:${location.pathname}`;
  const SNOOZES = [1, 5, 10, 15, 30, 60];
  const RING_EVERY_MS = 2500;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const nowMins = () => (Date.now() - dayStart.getTime()) / 60000;

  const isArmed = (li) => li.dataset.alarm === '1';
  // A snoozed step rings at its snooze time, not its place in the schedule.
  const dueAt = (li) => (li.dataset.snooze ? Number(li.dataset.snooze) : cur(li));
  const stepNo = (li) => steps().indexOf(li) + 1;

  let audio = null;
  let ringTimer = null;
  let ticker = null;
  let ringing = [];

  // --- sound -----------------------------------------------------------
  function unlockAudio() {
    if (!audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audio = new Ctx();
    }
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    return audio;
  }
  // Browsers only allow sound after a user gesture. Any interaction counts, so
  // alarms restored from a previous visit go live as soon as the page is touched.
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });

  // Synthesized so there's no audio file to ship or fail to load: a rising
  // three-note ping, played twice.
  function ping(freqs, offset) {
    const t0 = audio.currentTime + offset;
    freqs.forEach((f, i) => {
      const at = t0 + i * 0.13;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.25, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
      osc.connect(gain).connect(audio.destination);
      osc.start(at);
      osc.stop(at + 0.5);
    });
  }

  function chime() {
    if (!unlockAudio()) return;
    ping([880, 1108.73, 1318.51], 0);
    ping([880, 1108.73, 1318.51], 0.75);
  }

  function startRinging() {
    if (ringTimer) return;
    chime();
    ringTimer = setInterval(chime, RING_EVERY_MS);
  }

  function stopRinging() {
    clearInterval(ringTimer);
    ringTimer = null;
  }

  // --- the ringing banner ----------------------------------------------
  const banner = document.createElement('div');
  banner.className = 'alarm-banner';
  banner.hidden = true;
  banner.setAttribute('role', 'alertdialog');
  banner.setAttribute('aria-live', 'assertive');
  banner.innerHTML =
    '<div class="alarm-body"><b class="alarm-title"></b><span class="alarm-text"></span></div>' +
    '<div class="alarm-acts">' +
    '<span class="alarm-snoozes" role="group" aria-label="Snooze this alarm">' +
    '<span class="alarm-snooze-label">Snooze</span>' +
    SNOOZES.map(
      (m) =>
        `<button type="button" class="alarm-snooze" data-mins="${m}" ` +
        `title="Ring again in ${m} minute${m === 1 ? '' : 's'}">${m}m</button>`
    ).join('') +
    '</span>' +
    '<button type="button" class="alarm-dismiss">Dismiss</button></div>';
  document.body.append(banner);
  const dismissBtn = banner.querySelector('.alarm-dismiss');

  function showBanner() {
    if (!ringing.length) {
      banner.hidden = true;
      stopRinging();
      return;
    }
    const li = ringing[0];
    const more = ringing.length - 1;
    banner.querySelector('.alarm-title').textContent =
      `Step ${stepNo(li)} · ${clock(dueAt(li))}` + (more ? ` (+${more} more)` : '');
    banner.querySelector('.alarm-text').textContent =
      li.querySelector('.step-text')?.textContent.trim() ?? '';
    banner.hidden = false;
    startRinging();
    if (document.activeElement === document.body) dismissBtn.focus({ preventScroll: true });
  }

  function clearRing(li, snoozeMins) {
    ringing = ringing.filter((x) => x !== li);
    if (snoozeMins) {
      li.dataset.snooze = String(nowMins() + snoozeMins);
      delete li.dataset.fired; // re-arms for the snoozed time
    } else {
      delete li.dataset.snooze;
      setAlarm(li, false); // dismissing a step means you're done with it
      saveAlarms(); // ...and that has to survive a reload
    }
    showBanner();
    sync();
  }

  banner.addEventListener('click', (e) => {
    const snooze = e.target.closest('.alarm-snooze');
    const dismiss = e.target.closest('.alarm-dismiss');
    if (!snooze && !dismiss) return;
    if (ringing[0]) clearRing(ringing[0], snooze ? Number(snooze.dataset.mins) : 0);
  });

  // --- per-step bells ---------------------------------------------------
  for (const li of steps()) {
    const when = li.querySelector('.step-when');
    if (!when || when.querySelector('.step-alarm')) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'step-alarm';
    b.setAttribute('aria-pressed', 'false');
    b.textContent = '🔔';
    when.append(b);
  }

  function setAlarm(li, on) {
    if (on) li.dataset.alarm = '1';
    else delete li.dataset.alarm;
    // Arming a step whose time already passed shouldn't ring instantly.
    if (on && dueAt(li) <= nowMins()) li.dataset.fired = '1';
    if (!on) delete li.dataset.fired;
    const b = li.querySelector('.step-alarm');
    if (b) {
      b.setAttribute('aria-pressed', String(on));
      b.title = on
        ? `Alarm set for step ${stepNo(li)} — click to cancel`
        : `Alarm me when step ${stepNo(li)} is due`;
    }
    li.classList.toggle('step-armed', on);
  }

  article.addEventListener('click', (e) => {
    const b = e.target.closest('.step-alarm');
    if (!b) return;
    const li = b.closest('li.step');
    setAlarm(li, !isArmed(li));
    if (isArmed(li)) chime(); // confirms the sound works, and unlocks audio
    saveAlarms();
    sync();
  });

  alarmAllBtn.addEventListener('click', () => {
    const list = steps();
    const turnOn = !list.every(isArmed);
    for (const li of list) setAlarm(li, turnOn);
    if (turnOn) chime();
    saveAlarms();
    sync();
  });

  // --- persistence -------------------------------------------------------
  function saveAlarms() {
    const armed = steps().flatMap((li, i) => (isArmed(li) ? [i] : []));
    try {
      if (!armed.length) localStorage.removeItem(ALARM_KEY);
      else localStorage.setItem(ALARM_KEY, JSON.stringify({ v: 1, base: baseline(), armed }));
    } catch {}
  }

  function restoreAlarms() {
    let data = null;
    try {
      data = JSON.parse(localStorage.getItem(ALARM_KEY) || 'null');
    } catch {}
    const list = steps();
    if (!data || data.v !== 1 || data.base !== baseline() || !Array.isArray(data.armed)) return;
    for (const i of data.armed) if (list[i]) setAlarm(list[i], true);
  }

  // --- the clock ---------------------------------------------------------
  // One pass: fire anything armed that has come due, keep the "you are here"
  // highlight on the most recent due step, and refresh the countdown. `silent`
  // re-baselines after a time edit so shifting the schedule never rings.
  function sync(silent) {
    const list = steps();
    const now = nowMins();
    let current = null;
    let next = null;
    for (const li of list) {
      const due = dueAt(li);
      if (due <= now) {
        if (isArmed(li) && li.dataset.fired !== '1' && !silent && !ringing.includes(li)) {
          ringing.push(li);
        }
        li.dataset.fired = '1';
        current = li;
      } else if (isArmed(li)) {
        delete li.dataset.fired; // a step shifted back into the future re-arms
        // The soonest pending alarm, which is not always the next in document
        // order once a step has been pulled forward with "now" or snoozed.
        if (!next || due < dueAt(next)) next = li;
      }
      li.classList.remove('step-current');
    }
    current?.classList.add('step-current');
    if (ringing.length > 0 !== !banner.hidden) showBanner();
    renderNext(next);

    const anyArmed = list.some(isArmed);
    alarmAllBtn.textContent = list.every(isArmed) ? '🔕 Clear all alarms' : '🔔 Alarm every step';
    if (anyArmed && !ticker) ticker = setInterval(() => sync(false), 1000);
    if (!anyArmed && ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  }

  function renderNext(next) {
    if (!next) {
      nextLabel.textContent = steps().some(isArmed)
        ? 'All armed steps have rung.'
        : 'No alarms set — tap a 🔔 beside any step.';
      return;
    }
    const mins = Math.max(0, Math.round(dueAt(next) - nowMins()));
    const h = Math.floor(mins / 60);
    const away = h ? `${h}h ${mins % 60}m` : `${mins}m`;
    const day = Math.floor(dueAt(next) / 1440);
    const when = day ? `${clock(dueAt(next))} on Day ${day + 1}` : clock(dueAt(next));
    const snoozed = next.dataset.snooze ? ' (snoozed)' : '';
    nextLabel.textContent = `Next alarm: step ${stepNo(next)} at ${when}${snoozed}, in ${away}.`;
  }

  // Times just changed: re-baseline silently so an edit or a "now" click never
  // rings, then refresh the countdown.
  onRender = () => sync(true);

  if (restore()) resetBtn.hidden = false;
  restoreAlarms();
  render();
})();
