'use strict';

/* Notenquiz settings, saved per instrument (localStorage + shareable link + settings dialog). */
const Settings = (() => {
  const KEY = 'saxnoten.quiz.v2';
  const OLD_KEY = 'saxnoten.quiz.v1'; // before instruments existed: alto sax only
  const COMMON_DEFAULTS = { sharps: false, flats: false, count: 10, autoplay: true };

  function defaultsFor(inst) {
    return { low: inst.defaultLow, high: inst.defaultHigh, ...COMMON_DEFAULTS };
  }

  function sanitize(s, inst = Instruments.get()) {
    const d = defaultsFor(inst);
    const out = { ...d, ...s };
    Object.assign(out, Notes.sanitizeRange(out.low, out.high, d.low, d.high, inst.rangeIds));
    out.sharps = Boolean(out.sharps);
    out.flats = Boolean(out.flats);
    out.autoplay = Boolean(out.autoplay);
    out.count = Math.min(100, Math.max(1, Math.round(Number(out.count)) || d.count));
    return out;
  }

  /** { altsax: {...}, klarinet: {...}, trompet: {...} } */
  let all = loadAll();

  function loadAll() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && typeof saved === 'object') return saved;
      const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
      return old ? { altsax: old } : {};
    } catch {
      return {};
    }
  }

  function get() {
    return sanitize(all[Instruments.get().id] || {});
  }

  function set(patch) {
    all[Instruments.get().id] = sanitize({ ...get(), ...patch });
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode */ }
  }

  const PARAMS = ['instrument', 'laag', 'hoog', 'kruizen', 'mollen', 'aantal', 'geluid', 'bericht'];

  // Personal message from the teacher (same for every instrument).
  const MESSAGE_KEY = 'saxnoten.message';
  const MESSAGE_MAX = 200;
  let message = '';
  try { message = (localStorage.getItem(MESSAGE_KEY) || '').slice(0, MESSAGE_MAX); } catch { /* private mode */ }

  function setMessage(text) {
    message = String(text || '').trim().slice(0, MESSAGE_MAX);
    try { localStorage.setItem(MESSAGE_KEY, message); } catch { /* private mode */ }
    renderMessage();
  }

  function renderMessage() {
    const box = document.getElementById('personal-message');
    if (!box) return;
    box.textContent = message;
    box.hidden = !message;
  }

  /** Apply settings from a shared link like ?instrument=klarinet&laag=E4&hoog=C6&kruizen=1&aantal=10 */
  function applyParams(params) {
    if (params.has('instrument')) Instruments.set(params.get('instrument'));
    if (params.has('bericht')) setMessage(params.get('bericht'));
    const map = { laag: 'low', hoog: 'high', kruizen: 'sharps', mollen: 'flats', aantal: 'count', geluid: 'autoplay' };
    const patch = {};
    for (const [nl, key] of Object.entries(map)) {
      if (!params.has(nl)) continue;
      const v = params.get(nl);
      patch[key] = ['sharps', 'flats', 'autoplay'].includes(key) ? v === '1' : v;
    }
    if (Object.keys(patch).length) set(patch);
  }

  function shareUrl(s) {
    const q = new URLSearchParams({
      instrument: Instruments.get().id,
      laag: s.low, hoog: s.high, kruizen: s.sharps ? 1 : 0, mollen: s.flats ? 1 : 0,
      aantal: s.count, geluid: s.autoplay ? 1 : 0,
    });
    const msg = form.elements.message.value.trim().slice(0, MESSAGE_MAX);
    if (msg) q.set('bericht', msg);
    return location.href.split(/[?#]/)[0] + '?' + q.toString();
  }

  // ---------- Settings dialog ----------
  let dialog, form, onSaved;

  function readForm() {
    const f = form.elements;
    return sanitize({
      low: f.low.value, high: f.high.value, sharps: f.sharps.checked, flats: f.flats.checked,
      count: f.count.value, autoplay: f.autoplay.checked,
    });
  }

  function writeForm(s) {
    const f = form.elements;
    const ids = Instruments.get().rangeIds;
    Notes.fillRangeSelect(f.low, s.low, ids);
    Notes.fillRangeSelect(f.high, s.high, ids);
    f.sharps.checked = s.sharps;
    f.flats.checked = s.flats;
    f.count.value = s.count;
    f.autoplay.checked = s.autoplay;
    updatePoolInfo();
  }

  function updatePoolInfo() {
    document.getElementById('pool-info').textContent = Notes.poolSummary(readForm());
  }

  function open(savedCallback) {
    onSaved = savedCallback;
    document.getElementById('settings-title').textContent = 'Instellingen – ' + Instruments.get().name;
    document.getElementById('copy-status').textContent = '';
    writeForm(get());
    form.elements.message.value = message;
    dialog.showModal();
  }

  function init() {
    dialog = document.getElementById('settings-dialog');
    form = document.getElementById('settings-form');
    renderMessage();

    dialog.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dialog.close()));

    form.addEventListener('input', updatePoolInfo);
    form.addEventListener('change', updatePoolInfo);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const s = readForm();
      if (!Notes.pool(s.low, s.high, s.sharps, s.flats).length) {
        updatePoolInfo();
        return;
      }
      set(s);
      setMessage(form.elements.message.value);
      dialog.close();
      if (onSaved) onSaved();
    });

    document.getElementById('settings-reset').addEventListener('click', () => writeForm(defaultsFor(Instruments.get())));

    document.getElementById('copy-link').addEventListener('click', async () => {
      const url = shareUrl(readForm());
      const status = document.getElementById('copy-status');
      try {
        await navigator.clipboard.writeText(url);
        status.textContent = 'Link gekopieerd! ✔';
      } catch {
        window.prompt('Kopieer deze link:', url);
      }
    });
  }

  return { PARAMS, init, get, set, applyParams, open, setMessage };
})();
