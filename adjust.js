(() => {
  const panel = document.getElementById('adjust');
  const article = document.getElementById('recipe');
  const sourceEl = document.getElementById('recipe-source');
  if (!panel || !article || !sourceEl) return;

  const originalHTML = article.innerHTML;
  const sourceMarkdown = JSON.parse(sourceEl.textContent);

  panel.hidden = false;

  function getApi() {
    if (typeof self !== 'undefined' && self.LanguageModel) return self.LanguageModel;
    if (typeof self !== 'undefined' && self.ai && self.ai.languageModel) return self.ai.languageModel;
    return null;
  }

  const api = getApi();
  if (!api) {
    panel.innerHTML =
      '<h2>Adjust</h2><p class="banner">Inline AI adjustments need Chrome (≥138) with the built-in Prompt API / Gemini Nano enabled. The recipe below works without it.</p>';
    return;
  }

  panel.innerHTML = `
    <h2>Adjust</h2>
    <div class="actions">
      <button data-act="scale">Scale servings</button>
      <button data-act="substitute">Substitute ingredient</button>
      <button data-act="units">Convert units</button>
      <button data-act="diet">Dietary rewrite</button>
      <button data-act="reset" hidden>Reset to original</button>
    </div>
    <progress id="dl" hidden></progress>
    <p class="status" id="status"></p>`;

  const statusEl = panel.querySelector('#status');
  const dlEl = panel.querySelector('#dl');
  const resetBtn = panel.querySelector('[data-act="reset"]');
  const actionBtns = [...panel.querySelectorAll('button[data-act]')].filter(
    (b) => b.dataset.act !== 'reset'
  );

  const SYSTEM = `You are a careful recipe editor. You will receive a recipe in Markdown and an adjustment request.
Return ONLY the full adjusted recipe in Markdown, preserving the original structure (headings, ingredient tables or lists, method, notes).
Recompute quantities accurately when scaling or converting. When substituting or adapting for diet, change only what is necessary and add a brief note explaining the swap. Do not add commentary outside the Markdown.`;

  function setBusy(busy) {
    actionBtns.forEach((b) => (b.disabled = busy));
  }

  async function ensureSession() {
    const availability = await api.availability();
    if (availability === 'unavailable') {
      throw new Error('On-device model is unavailable on this device.');
    }
    return api.create({
      initialPrompts: [{ role: 'system', content: SYSTEM }],
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          dlEl.hidden = false;
          dlEl.value = e.loaded;
          dlEl.max = 1;
          statusEl.textContent = `Downloading on-device model… ${Math.round(e.loaded * 100)}%`;
        });
      },
    });
  }

  async function run(request) {
    setBusy(true);
    statusEl.textContent = 'Thinking on-device…';
    try {
      const session = await ensureSession();
      dlEl.hidden = true;
      const stream = session.promptStreaming(
        `Adjustment request: ${request}\n\nRecipe:\n\n${sourceMarkdown}`
      );
      let out = '';
      for await (const chunk of stream) {
        out += chunk;
        article.innerHTML = window.marked.parse(out);
      }
      session.destroy?.();
      statusEl.textContent = 'Done — adjusted on your device. Nothing was sent anywhere.';
      resetBtn.hidden = false;
    } catch (err) {
      statusEl.textContent = `Couldn't adjust: ${err.message}`;
      article.innerHTML = originalHTML;
    } finally {
      setBusy(false);
    }
  }

  const PROMPTS = {
    scale: () => {
      const n = prompt('Scale to how many servings / how much yield?');
      return n && `Scale the recipe to ${n}.`;
    },
    substitute: () => {
      const s = prompt('What should change? (e.g. "no dill", "dairy-free butter")');
      return s && `Substitute: ${s}.`;
    },
    diet: () => {
      const d = prompt('Adapt for which diet? (e.g. vegan, gluten-free, lower-carb)');
      return d && `Rewrite this recipe to be ${d}.`;
    },
    units: () => {
      const to = prompt('Convert units to? Type "metric" or "imperial".');
      return to && `Convert all measurements to ${to} units.`;
    },
  };

  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'reset') {
      article.innerHTML = originalHTML;
      resetBtn.hidden = true;
      statusEl.textContent = '';
      return;
    }
    const request = PROMPTS[act]?.();
    if (request) run(request);
  });
})();
