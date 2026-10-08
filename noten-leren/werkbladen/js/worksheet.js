'use strict';

/* PART 1 – Printable worksheets (multi-page, print / save as PDF from the browser). */
(() => {
  const KEY = 'saxnoten.worksheet.v1';
  const NOTES_KEY = 'saxnoten.worksheet.notes.v1';
  const DEFAULTS = {
    instrument: Instruments.DEFAULT_ID, title: 'Notenwerkblad', intro: '', introAll: false,
    showName: true, studentName: '', showDate: true, date: '',
    low: 'D4', high: 'C6', sharps: false, flats: false,
    pages: 2, lines: 6, perLine: 8, answers: true, hint: true,
  };

  const instrumentOf = (s) => Instruments.byId(s.instrument) || Instruments.byId(Instruments.DEFAULT_ID);

  let form, preview;
  let settings = null;
  let notes = null;
  let notesKey = '';
  let renderTimer = null;

  const clampInt = (v, min, max, def) => Math.min(max, Math.max(min, Math.round(Number(v)) || def));

  function sanitize(s) {
    const out = { ...DEFAULTS, ...s };
    const inst = instrumentOf(out);
    out.instrument = inst.id;
    Object.assign(out, Notes.sanitizeRange(out.low, out.high, inst.defaultLow, inst.defaultHigh, inst.rangeIds));
    out.title = String(out.title || '').slice(0, 80);
    out.intro = String(out.intro || '').slice(0, 1000);
    out.studentName = String(out.studentName || '').slice(0, 60);
    out.date = /^\d{4}-\d{2}-\d{2}$/.test(out.date) ? out.date : '';
    out.pages = clampInt(out.pages, 1, 30, DEFAULTS.pages);
    out.lines = clampInt(out.lines, 1, 10, DEFAULTS.lines);
    out.perLine = clampInt(out.perLine, 2, 12, DEFAULTS.perLine);
    ['sharps', 'flats', 'answers', 'hint', 'introAll', 'showName', 'showDate'].forEach((k) => { out[k] = Boolean(out[k]); });
    return out;
  }

  function load() {
    try {
      return sanitize(JSON.parse(localStorage.getItem(KEY) || '{}'));
    } catch {
      return { ...DEFAULTS };
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode */ }
  }

  function readForm() {
    const f = form.elements;
    return sanitize({
      instrument: settings.instrument,
      title: f.title.value, intro: f.intro.value, introAll: f.introAll.checked,
      showName: f.showName.checked, studentName: f.studentName.value,
      showDate: f.showDate.checked, date: f.date.value,
      low: f.low.value, high: f.high.value,
      sharps: f.sharps.checked, flats: f.flats.checked,
      pages: f.pages.value, lines: f.lines.value, perLine: f.perLine.value,
      answers: f.answers.checked, hint: f.hint.checked,
    });
  }

  function writeForm(s) {
    const f = form.elements;
    f.title.value = s.title;
    f.intro.value = s.intro;
    f.introAll.checked = s.introAll;
    f.showName.checked = s.showName;
    f.studentName.value = s.studentName;
    f.showDate.checked = s.showDate;
    f.date.value = s.date;
    updateFieldStates();
    const ids = instrumentOf(s).rangeIds;
    Notes.fillRangeSelect(f.low, s.low, ids);
    Notes.fillRangeSelect(f.high, s.high, ids);
    f.sharps.checked = s.sharps;
    f.flats.checked = s.flats;
    f.pages.value = s.pages;
    f.lines.value = s.lines;
    f.perLine.value = s.perLine;
    f.answers.checked = s.answers;
    f.hint.checked = s.hint;
  }

  /** The name/date inputs are only usable when that field is shown on the sheet. */
  function updateFieldStates() {
    const f = form.elements;
    f.studentName.disabled = !f.showName.checked;
    f.date.disabled = !f.showDate.checked;
  }

  function formatDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /** "Naam:" / "Datum:" with the teacher's text, or an empty line for the student to fill in. */
  function headerField(label, value) {
    const row = el('span');
    row.appendChild(document.createTextNode(label + ': '));
    row.appendChild(el('i', value ? 'filled' : null, value || null));
    return row;
  }

  function updateInstrumentButtons() {
    document.querySelectorAll('#ws-instruments .inst-btn').forEach((b) => {
      const on = b.dataset.inst === settings.instrument;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-checked', String(on));
    });
  }

  function buildInstrumentButtons() {
    const box = document.getElementById('ws-instruments');
    for (const inst of Instruments.LIST) {
      const b = el('button', 'inst-btn');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.inst = inst.id;
      b.innerHTML = '<span class="inst-icon" aria-hidden="true">' + inst.icon + '</span><span class="inst-name">' + inst.short + '</span>';
      b.addEventListener('click', () => {
        if (inst.id === settings.instrument) return;
        // Another instrument: start from its usual range.
        settings = sanitize({ ...readForm(), instrument: inst.id, low: inst.defaultLow, high: inst.defaultHigh });
        writeForm(settings);
        updateInstrumentButtons();
        save();
        render();
      });
      box.appendChild(b);
    }
    updateInstrumentButtons();
  }

  const notesKeyOf = (s) => [s.low, s.high, s.sharps, s.flats, s.pages, s.lines, s.perLine].join('|');

  function saveNotes() {
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify({ key: notesKey, ids: notes.map((p) => p.map((l) => l.map(Notes.id))) }));
    } catch { /* private mode / full */ }
  }

  /** Restore the previously generated notes, so the same worksheet comes back next time. */
  function loadNotes() {
    try {
      const saved = JSON.parse(localStorage.getItem(NOTES_KEY) || 'null');
      if (!saved || saved.key !== notesKeyOf(settings)) return;
      notes = saved.ids.map((p) => p.map((l) => l.map(Notes.parse)));
      notesKey = saved.key;
    } catch {
      notes = null;
    }
  }

  function generate(force) {
    const key = notesKeyOf(settings);
    if (!force && notes && key === notesKey) return;
    notesKey = key;
    const pool = Notes.pool(settings.low, settings.high, settings.sharps, settings.flats);
    const flat = Notes.sequence(pool, settings.pages * settings.lines * settings.perLine);
    notes = [];
    for (let p = 0; p < settings.pages; p++) {
      const page = [];
      for (let l = 0; l < settings.lines; l++) {
        const start = (p * settings.lines + l) * settings.perLine;
        page.push(flat.slice(start, start + settings.perLine));
      }
      notes.push(page);
    }
    saveNotes();
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function hintText() {
    const parts = [];
    if (settings.sharps) parts.push('♯ kruis → naam + is (f♯ = fis)');
    if (settings.flats) parts.push('♭ mol → naam + es (b♭ = bes, e♭ = es, a♭ = as)');
    return parts.join('   ·   ');
  }

  function buildPage(pageNotes, index, total, isAnswerKey) {
    const inst = instrumentOf(settings);
    const sheet = el('section', 'sheet' + (isAnswerKey ? ' answer-key' : ' student'));
    const head = el('header', 'sheet-head');
    const titleBox = el('div', 'sheet-title');
    const icon = el('span', 'sheet-icon');
    icon.innerHTML = inst.icon;
    const titleText = el('div');
    titleText.appendChild(el('h2', null, (settings.title || 'Notenwerkblad') + (isAnswerKey ? ' – antwoorden' : '')));
    titleText.appendChild(el('div', 'sheet-inst', inst.name));
    titleBox.append(icon, titleText);
    head.appendChild(titleBox);
    if (!isAnswerKey) {
      const fields = el('div', 'sheet-fields');
      if (settings.showName) fields.appendChild(headerField('Naam', settings.studentName.trim()));
      if (settings.showDate) fields.appendChild(headerField('Datum', settings.date ? formatDate(settings.date) : ''));
      if (fields.children.length) head.appendChild(fields);
    }
    sheet.appendChild(head);
    if (!isAnswerKey && settings.intro.trim() && (index === 0 || settings.introAll)) {
      sheet.appendChild(el('p', 'sheet-intro', settings.intro.trim()));
    }
    sheet.appendChild(el('p', 'sheet-instr', isAnswerKey
      ? 'Antwoordblad'
      : '✏️ Schrijf onder elke noot hoe hij heet.'));

    const systems = el('div', 'systems');
    const lines = pageNotes.map((line) => {
      const sys = el('div', 'system');
      systems.appendChild(sys);
      return [sys, line];
    });
    sheet.appendChild(systems);

    const foot = el('footer', 'sheet-foot');
    const hint = settings.hint && !isAnswerKey ? hintText() : '';
    foot.appendChild(el('span', 'sheet-hint', hint));
    foot.appendChild(el('span', 'sheet-page', 'Blad ' + (index + 1) + ' van ' + total));
    sheet.appendChild(foot);
    return { sheet, lines, isAnswerKey };
  }

  /** Shrink the staves (height scales with width) when they don't fit on the page. */
  function fitSystems(sheet) {
    const box = sheet.querySelector('.systems');
    const systems = [...box.children];
    const need = systems.reduce((sum, sys) => sum + sys.getBoundingClientRect().height, 0);
    const avail = box.clientHeight;
    if (need > avail && need > 0) {
      const pct = Math.floor((avail / need) * 97) + '%';
      systems.forEach((sys) => { sys.style.width = pct; });
    }
  }

  function render() {
    generate(false);
    preview.innerHTML = '';
    const pool = Notes.pool(settings.low, settings.high, settings.sharps, settings.flats);
    if (!pool.length) {
      preview.appendChild(el('p', 'ws-empty', 'Geen noten in dit bereik. Kies een groter bereik.'));
      return;
    }
    const sheets = notes.map((p, i) => buildPage(p, i, notes.length, false));
    if (settings.answers) notes.forEach((p, i) => sheets.push(buildPage(p, i, notes.length, true)));
    sheets.forEach((s) => preview.appendChild(s.sheet));
    // Render after the sheets are in the DOM so getBBox() works for the writing lines.
    // Smaller staffwidth = larger notes once scaled to the page width.
    const staffwidth = Math.max(480, 100 + settings.perLine * 60);
    for (const s of sheets) {
      for (const [sys, line] of s.lines) {
        Staff.renderLine(sys, line, { staffwidth });
        if (!s.isAnswerKey) Staff.addWritingLines(sys);
      }
      fitSystems(s.sheet);
    }
    document.getElementById('ws-summary').textContent =
      notes.length + (notes.length === 1 ? ' werkblad' : ' werkbladen') +
      (settings.answers ? ' + ' + notes.length + ' antwoordblad' + (notes.length === 1 ? '' : 'en') : '') +
      ' · ' + Notes.poolSummary(settings);
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      settings = readForm();
      save();
      render();
    }, 250);
  }

  function init() {
    form = document.getElementById('ws-form');
    preview = document.getElementById('ws-preview');
    settings = load();
    writeForm(settings);
    buildInstrumentButtons();
    loadNotes();
    form.addEventListener('change', updateFieldStates);
    form.addEventListener('input', scheduleRender);
    form.addEventListener('change', scheduleRender);
    form.addEventListener('submit', (e) => e.preventDefault());
    document.getElementById('ws-new').addEventListener('click', () => {
      settings = readForm();
      save();
      generate(true);
      render();
    });
    document.getElementById('ws-print').addEventListener('click', () => {
      clearTimeout(renderTimer);
      settings = readForm();
      save();
      render();
      window.print();
    });
    document.getElementById('ws-reset').addEventListener('click', () => {
      settings = sanitize({ ...DEFAULTS });
      writeForm(settings);
      updateInstrumentButtons();
      save();
      render();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof ABCJS === 'undefined') {
      document.getElementById('lib-error').hidden = false;
      return;
    }
    init();
    render();
  });
})();
