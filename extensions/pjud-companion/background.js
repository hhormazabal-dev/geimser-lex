const OJV_URL = 'https://oficinajudicialvirtual.pjud.cl/indexN.php';

async function ensureTab(url) {
  const existing = await chrome.tabs.query({ url: 'https://oficinajudicialvirtual.pjud.cl/*' });
  const tab = existing[0];
  if (tab?.id) {
    if (tab.url !== url) await chrome.tabs.update(tab.id, { url, active: false });
    return tab.id;
  }
  const created = await chrome.tabs.create({ url, active: false });
  return created.id;
}

function waitForTabComplete(tabId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const listener = (id, info) => {
      if (id !== tabId) return;
      if (info.status === 'complete') {
        cleanup();
        resolve(true);
      }
      if (Date.now() - start > timeoutMs) {
        cleanup();
        reject(new Error('Timeout esperando carga de OJV.'));
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout esperando carga de OJV.'));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function exec(tabId, func, args = []) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func,
    args,
  });
  return result;
}

function scrapeSelectsInPage() {
  const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const pickLabel = (select) => {
    const id = select.getAttribute('id');
    if (id) {
      const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (label) return normalize(label.textContent);
    }
    const wrapping = select.closest('label');
    if (wrapping) return normalize(wrapping.textContent);
    const aria = select.getAttribute('aria-label');
    if (aria) return normalize(aria);
    return null;
  };

  const classify = (values) => {
    const nonEmpty = values.map((v) => (v || '').trim()).filter(Boolean);
    if (nonEmpty.length === 0) return 'string';
    const numeric = nonEmpty.filter((v) => /^\d+$/.test(v)).length;
    if (numeric === nonEmpty.length) return 'numeric-string';
    if (numeric === 0) return 'string';
    return 'mixed';
  };

  const selects = Array.from(document.querySelectorAll('select')).map((select) => {
    const options = Array.from(select.options).map((opt) => ({
      value: (opt.value || '').trim(),
      text: normalize(opt.textContent),
    }));
    const values = options.map((o) => o.value);
    return {
      id: select.getAttribute('id'),
      name: select.getAttribute('name'),
      label: pickLabel(select),
      valueTypeHint: classify(values),
      options,
    };
  });

  return { baseUrl: location.href, selects };
}

function submitLookupInPage(payload) {
  const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const forms = Array.from(document.querySelectorAll('form'));
  if (forms.length === 0) throw new Error('No se encontró formulario OJV.');

  let best = forms[0];
  let bestScore = -1;
  for (const f of forms) {
    const txt = normalize(f.textContent).toLowerCase();
    const score =
      f.querySelectorAll('select').length * 3 +
      f.querySelectorAll('input').length * 2 +
      (txt.includes('rut') ? 10 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }

  const { rut, contextValue, courtValue, contextSelectName, courtSelectName } = payload || {};
  if (!rut || !contextValue) throw new Error('Faltan datos (RUT/Context).');

  const cleanRut = String(rut).replace(/[^0-9kK]/g, '').toUpperCase();
  if (cleanRut.length < 8) throw new Error('RUT inválido.');
  const body = cleanRut.slice(0, -1);
  const dv = cleanRut.slice(-1);

  const inputs = Array.from(best.querySelectorAll('input[name]'));
  const names = inputs.map((i) => (i.getAttribute('name') || '').toLowerCase());
  const rutIdx = names.findIndex((n) => n.includes('rut') && !n.includes('dv'));
  const dvIdx = names.findIndex((n) => n.includes('dv') || n.includes('dig') || n.includes('verif'));
  if (rutIdx < 0) throw new Error('No se encontró input RUT en OJV.');

  inputs[rutIdx].value = dvIdx >= 0 ? body : `${body}-${dv}`;
  if (dvIdx >= 0) inputs[dvIdx].value = dv;

  const selects = Array.from(best.querySelectorAll('select[name]'));
  const byName = (n) => selects.find((s) => (s.getAttribute('name') || '') === n) || null;
  const byOption = (value) =>
    selects.find((s) => Array.from(s.options).some((o) => (o.value || '').trim() === value)) || null;

  const ctxSel = (contextSelectName && byName(contextSelectName)) || byOption(String(contextValue));
  if (!ctxSel) throw new Error('No se pudo identificar el select de competencia.');
  ctxSel.value = String(contextValue);

  if (courtValue) {
    const crtSel = (courtSelectName && byName(courtSelectName)) || byOption(String(courtValue));
    if (crtSel) crtSel.value = String(courtValue);
  }

  const submit =
    best.querySelector('button[type="submit"],input[type="submit"]') ||
    best.querySelector('button, input[type="button"]');

  if (submit && typeof submit.click === 'function') {
    submit.click();
  } else {
    best.submit();
  }

  return true;
}

function parseResultsInPage() {
  const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const tables = Array.from(document.querySelectorAll('table'));
  const keywords = ['rol', 'rit', 'ruc', 'tribunal', 'caratul', 'carátul', 'estado', 'fecha', 'proced'];

  let best = null;
  let bestScore = 0;
  for (const t of tables) {
    const headers = Array.from(t.querySelectorAll('th')).map((th) => normalize(th.textContent).toLowerCase());
    if (headers.length === 0) continue;
    const score = keywords.reduce((acc, k) => acc + (headers.some((h) => h.includes(k)) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  if (!best || bestScore === 0) {
    const text = normalize(document.body.textContent).toLowerCase();
    if (text.includes('captcha') || text.includes('recaptcha')) {
      throw new Error('OJV requiere captcha. Abre la pestaña OJV y completa el desafío.');
    }
    throw new Error('No se encontró tabla de resultados.');
  }

  const headerCells = Array.from(best.querySelectorAll('tr'))[0]?.querySelectorAll('th,td') || [];
  const headers = Array.from(headerCells).map((c, idx) => normalize(c.textContent) || `col_${idx + 1}`);

  const rows = Array.from(best.querySelectorAll('tr')).slice(1);
  const out = rows
    .map((tr) => {
      const tds = Array.from(tr.querySelectorAll('td'));
      if (tds.length === 0) return null;
      const obj = {};
      for (let i = 0; i < Math.max(headers.length, tds.length); i++) {
        obj[headers[i] || `col_${i + 1}`] = normalize(tds[i]?.textContent || '');
      }
      const a = tr.querySelector('a[href]');
      if (a) obj.SourceUrl = a.href;
      return obj;
    })
    .filter(Boolean);

  return out;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === 'APP_CONNECT') {
      const { tabId } = msg;
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-app.js'],
      });
      sendResponse({ ok: true });
      return;
    }

    if (msg?.type === 'APP_REQUEST') {
      const { action, payload } = msg;

      if (action === 'PING') {
        sendResponse({ ok: true, version: '0.1.0' });
        return;
      }

      const ojvTabId = await ensureTab(OJV_URL);
      await waitForTabComplete(ojvTabId, 30000);

      if (action === 'OPTIONS') {
        const data = await exec(ojvTabId, scrapeSelectsInPage, []);
        sendResponse(data);
        return;
      }

      if (action === 'LOOKUP') {
        await exec(ojvTabId, submitLookupInPage, [payload]);
        await waitForTabComplete(ojvTabId, 45000);
        const rows = await exec(ojvTabId, parseResultsInPage, []);
        sendResponse({ rows });
        return;
      }

      throw new Error('Acción no soportada.');
    }

    sendResponse({ ok: false });
  })()
    .catch((e) => sendResponse({ ok: false, error: e?.message ?? 'Error' }));

  return true;
});
