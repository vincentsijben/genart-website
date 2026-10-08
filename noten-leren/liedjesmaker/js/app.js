'use strict';

/* PART 2 – Liedjesmaker: import -> select bars -> transpose for an instrument -> render, play, print. */
(() => {
  const KEY = 'saxnoten.liedjesmaker.v1';
  const EXAMPLE = [
    'X:1', 'T:Vader Jacob', 'M:4/4', 'L:1/4', 'Q:1/4=100', 'K:F',
    'F G A F | F G A F | A B c2 | A B c2 |',
    'c/d/ c/B/ A F | c/d/ c/B/ A F | F C F2 | F C F2 |]',
  ].join('\n');
  const STAFFWIDTH = { large: 420, medium: 560, small: 760 };
  const DEFAULT_OPTS = {
    instrument: Instruments.DEFAULT_ID, low: null, high: null, from: 0, to: 0, key: 'auto', octave: 0,
    simplify: false, names: false, barsPerLine: 4, size: 'large', title: '', showName: true, studentName: '', tempo: 100,
  };

  let form;
  const el = {};
  let state = { abc: '', song: null, sourceType: null, partId: null, opts: { ...DEFAULT_OPTS } };
  let importer = null;
  let result = null;
  let timer = null;

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const inst = () => Instruments.byId(state.opts.instrument) || Instruments.byId(Instruments.DEFAULT_ID);

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode / full */ }
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && typeof saved === 'object') state = { ...state, ...saved, opts: { ...DEFAULT_OPTS, ...saved.opts } };
    } catch { /* ignore */ }
  }

  function showError(msg) {
    el.error.textContent = msg || '';
    el.error.hidden = !msg;
  }

  // ------------------------------------------------------------ importing
  function fillParts(parts, selected) {
    el.partField.hidden = !parts || parts.length < 2;
    form.elements.part.innerHTML = '';
    (parts || []).forEach((p) => form.elements.part.add(new Option(p.name, p.id, false, p.id === selected)));
  }

  function setSong(song, sourceType, partId) {
    Player.stop();
    state.song = song;
    state.sourceType = sourceType;
    state.partId = partId;
    const o = state.opts;
    Object.assign(o, { from: 0, to: song.bars.length - 1, key: 'auto', octave: 0, title: song.title, tempo: clamp(song.tempo || 100, 40, 200) });
    writeForm();
    update();
  }

  function useImporter(imp, sourceType) {
    importer = imp;
    const partId = imp.parts[0].id;
    fillParts(imp.parts, partId);
    setSong(imp.build(partId), sourceType, partId);
  }

  function loadAbc(text) {
    showError('');
    try {
      useImporter(Importers.fromAbc(text), 'abc');
      state.abc = text;
      save();
    } catch (err) {
      showError(err.message);
    }
  }

  async function loadFile(file) {
    showError('');
    el.fileName.textContent = file.name;
    try {
      if (/\.(abc|txt)$/i.test(file.name)) {
        const text = await file.text();
        form.elements.abc.value = text;
        loadAbc(text);
        return;
      }
      useImporter(await Importers.fromFile(file), 'file');
    } catch (err) {
      showError('Dit bestand kon niet gelezen worden: ' + err.message);
    }
  }

  // ------------------------------------------------------------ form
  function barLabel(song, i) {
    const bar = song.bars[i];
    const next = i + 1 < song.bars.length ? song.bars[i + 1].start : song.end;
    return 'Maat ' + (i + 1) + (i === 0 && next - bar.start < Song.barLength(bar) ? ' (opmaat)' : '');
  }

  function writeForm() {
    const f = form.elements;
    const o = state.opts;
    const i = inst();
    const range = Notes.sanitizeRange(o.low, o.high, i.defaultLow, i.defaultHigh, i.rangeIds);
    o.low = range.low;
    o.high = range.high;
    Notes.fillRangeSelect(f.low, o.low, i.rangeIds);
    Notes.fillRangeSelect(f.high, o.high, i.rangeIds);
    f.from.innerHTML = '';
    f.to.innerHTML = '';
    if (state.song) {
      state.song.bars.forEach((_, bi) => {
        f.from.add(new Option(barLabel(state.song, bi), bi));
        f.to.add(new Option(barLabel(state.song, bi), bi));
      });
      f.from.value = clamp(o.from, 0, state.song.bars.length - 1);
      f.to.value = clamp(o.to, 0, state.song.bars.length - 1);
    }
    f.simplify.checked = o.simplify;
    f.names.checked = o.names;
    f.barsPerLine.value = o.barsPerLine;
    f.size.value = o.size;
    f.title.value = o.title;
    f.showName.checked = o.showName;
    f.studentName.value = o.studentName;
    f.studentName.disabled = !o.showName;
    f.tempo.value = o.tempo;
    el.tempoLabel.textContent = o.tempo + ' tellen per minuut';
    el.octLabel.textContent = o.octave > 0 ? '+' + o.octave : String(o.octave);
    el.arrange.disabled = !state.song;
    updateInstrumentButtons();
  }

  function readForm() {
    const f = form.elements;
    const o = state.opts;
    const i = inst();
    o.from = Number(f.from.value) || 0;
    o.to = Math.max(o.from, Number(f.to.value) || 0);
    if (Number(f.to.value) < o.from) f.to.value = o.to;
    Object.assign(o, Notes.sanitizeRange(f.low.value, f.high.value, i.defaultLow, i.defaultHigh, i.rangeIds));
    o.key = f.key.value || 'auto';
    o.simplify = f.simplify.checked;
    o.names = f.names.checked;
    o.barsPerLine = clamp(Math.round(Number(f.barsPerLine.value)) || 4, 1, 8);
    o.size = STAFFWIDTH[f.size.value] ? f.size.value : 'large';
    o.title = f.title.value.slice(0, 80);
    o.showName = f.showName.checked;
    o.studentName = f.studentName.value.slice(0, 60);
    f.studentName.disabled = !o.showName;
    o.tempo = clamp(Number(f.tempo.value) || 100, 40, 200);
    el.tempoLabel.textContent = o.tempo + ' tellen per minuut';
  }

  function updateInstrumentButtons() {
    el.instruments.querySelectorAll('.inst-btn').forEach((b) => {
      const on = b.dataset.inst === state.opts.instrument;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-checked', String(on));
    });
  }

  function buildInstrumentButtons() {
    for (const i of Instruments.LIST) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'inst-btn';
      b.setAttribute('role', 'radio');
      b.dataset.inst = i.id;
      b.innerHTML = '<span class="inst-icon" aria-hidden="true">' + i.icon + '</span><span class="inst-name">' + i.short + '</span>';
      b.addEventListener('click', () => {
        if (i.id === state.opts.instrument) return;
        Player.stop();
        clearTimeout(timer);
        readForm();
        Object.assign(state.opts, { instrument: i.id, low: i.defaultLow, high: i.defaultHigh, key: 'auto', octave: 0 });
        writeForm();
        update();
        Sound.load(i).catch(() => {});
      });
      el.instruments.appendChild(b);
    }
  }

  function fillKeySelect(ko, mode, value) {
    const sel = form.elements.key;
    sel.innerHTML = '';
    const label = (o) => Song.keyName(o.fifths, mode) + ' (' + Song.keySignatureLabel(o.fifths) + ')';
    sel.add(new Option('Automatisch: ' + label(ko.suggested) + (ko.suggested.overflow ? '' : ' ✔'), 'auto'));
    for (const o of ko.options) {
      sel.add(new Option(label(o) + (o.overflow ? ' – past niet' : ' ✔'), String(o.fifths)));
    }
    sel.value = value;
    if (sel.value !== value) sel.value = 'auto';
  }

  function soundingText(semis) {
    if (semis === 0) return 'Klinkt zoals het origineel.';
    if (Math.abs(semis) % 12 === 0) {
      const n = Math.abs(semis) / 12;
      return 'Klinkt ' + (n === 1 ? 'een octaaf' : n + ' octaven') + (semis > 0 ? ' hoger' : ' lager') + ' dan het origineel.';
    }
    return 'Klinkt ' + Math.abs(semis) + ' halve ' + (Math.abs(semis) === 1 ? 'toon' : 'tonen') + (semis > 0 ? ' hoger' : ' lager') + ' dan het origineel.';
  }

  function fitText(song, lo, hi, iv) {
    const sorted = song.notes.slice().sort((a, b) => Song.midiOf(a.pitch) - Song.midiOf(b.pitch));
    const lowest = sorted[0].pitch;
    const highest = sorted[sorted.length - 1].pitch;
    const outside = song.notes.filter((n) => Song.midiOf(n.pitch) < lo || Song.midiOf(n.pitch) > hi).length;
    const range = state.opts.low + '–' + state.opts.high;
    const lines = ['Laagste noot ' + Song.pitchLabel(lowest) + ', hoogste ' + Song.pitchLabel(highest) + '.'];
    if (outside) {
      const tooHigh = Song.midiOf(highest) > hi;
      const tooLow = Song.midiOf(lowest) < lo;
      lines.push('✖ ' + outside + (outside === 1 ? ' noot valt' : ' noten vallen') + ' buiten het bereik ' + range +
        (tooHigh && !tooLow ? ' (te hoog)' : tooLow && !tooHigh ? ' (te laag)' : '') + '. Kies een andere toonsoort of octaaf.');
    } else {
      lines.push('✔ Past in het bereik ' + range + '.');
    }
    lines.push(soundingText(iv.semis));
    el.fit.textContent = lines.join(' ');
    el.fit.className = 'lm-fit ' + (outside ? 'bad' : 'ok');
  }

  function renderHeader(fifths, mode) {
    const o = state.opts;
    const i = inst();
    el.title.textContent = state.song ? o.title || 'Liedje' : '';
    el.subtitle.textContent = state.song ? i.name + ' · ' + Song.keyName(fifths, mode) : '';
    el.icon.innerHTML = state.song ? i.icon : '';
    el.fields.innerHTML = '';
    if (state.song && o.showName) {
      const row = document.createElement('span');
      row.append('Naam: ');
      const line = document.createElement('i');
      const name = o.studentName.trim();
      if (name) { line.textContent = name; line.className = 'filled'; }
      row.appendChild(line);
      el.fields.appendChild(row);
    }
  }

  function clearMusic(message) {
    el.music.innerHTML = '';
    el.empty.hidden = false;
    el.empty.textContent = message;
    result = null;
  }

  function update() {
    Player.stop();
    if (!state.song) {
      renderHeader(0, 'major');
      clearMusic('Voer links muziek in (of kies het voorbeeld) om te beginnen. 🎶');
      return;
    }
    readForm();
    const o = state.opts;
    const i = inst();
    const lo = Notes.parse(o.low).midi;
    const hi = Notes.parse(o.high).midi;
    const sliced = Arrange.slice(state.song, o.from, o.to);
    el.songInfo.hidden = false;
    el.songInfo.textContent = '“' + state.song.title + '” · ' + state.song.bars.length + ' maten · ' +
      state.song.bars[0].num + '/' + state.song.bars[0].den + ' · origineel in ' + Song.keyName(state.song.fifths, state.song.mode) + ' (concert).';
    if (!sliced.notes.length) {
      renderHeader(sliced.fifths, sliced.mode);
      el.fit.textContent = '';
      el.fit.className = 'lm-fit';
      clearMusic('In deze maten staan geen noten. Kies andere maten.');
      save();
      return;
    }

    const ko = Arrange.keyOptions(sliced, i, lo, hi);
    fillKeySelect(ko, sliced.mode, o.key);
    o.key = form.elements.key.value;
    const option = o.key === 'auto' ? ko.suggested : ko.options.find((x) => String(x.fifths) === o.key) || ko.suggested;
    const applied = Arrange.applyKey(ko.base, option, o.octave, lo, hi);
    const written = o.simplify ? Arrange.simplify(applied.song) : applied.song;
    fitText(written, lo, hi, applied.iv);
    el.octLabel.textContent = o.octave > 0 ? '+' + o.octave : String(o.octave);

    const { abc, timeline } = AbcWriter.write(written, { barsPerLine: o.barsPerLine, names: o.names });
    renderHeader(option.fifths, sliced.mode);
    el.empty.hidden = true;
    el.music.innerHTML = '';
    ABCJS.renderAbc(el.music, abc, {
      responsive: 'resize',
      staffwidth: STAFFWIDTH[o.size],
      add_classes: true,
      oneSvgPerLine: true,
      paddingtop: 4,
      paddingbottom: 8,
      paddingleft: 0,
      paddingright: 4,
    });
    if (o.names) Staff.centerLyrics(el.music);
    result = { abc, timeline };
    save();
  }

  function scheduleUpdate() {
    clearTimeout(timer);
    timer = setTimeout(update, 200);
  }

  // ------------------------------------------------------------ start
  function init() {
    form = document.getElementById('lm-form');
    const $ = (id) => document.getElementById(id);
    Object.assign(el, {
      error: $('lm-error'), partField: $('lm-part-field'), songInfo: $('lm-song-info'), fileName: $('lm-file-name'),
      arrange: $('lm-arrange'), instruments: $('lm-instruments'), fit: $('lm-fit'), octLabel: $('lm-oct-label'),
      tempoLabel: $('lm-tempo-label'), audioMsg: $('lm-audio-msg'), play: $('lm-play'), stop: $('lm-stop'),
      title: $('lm-title'), subtitle: $('lm-subtitle'), icon: $('lm-icon'), fields: $('lm-fields'),
      music: $('lm-music'), empty: $('lm-empty'),
    });

    load();
    buildInstrumentButtons();
    form.elements.abc.value = state.abc || '';
    if (state.sourceType === 'abc' && state.abc) {
      try {
        importer = Importers.fromAbc(state.abc);
        fillParts(importer.parts, state.partId);
      } catch { /* keep the saved song */ }
    }
    writeForm();
    if (!state.song && state.abc) loadAbc(state.abc);
    else update();

    form.addEventListener('submit', (e) => e.preventDefault());
    const ignored = (t) => t.name === 'abc' || t.name === 'part' || t.id === 'lm-file';
    form.addEventListener('input', (e) => { if (!ignored(e.target)) scheduleUpdate(); });
    form.addEventListener('change', (e) => {
      if (ignored(e.target)) return;
      if (e.target.name === 'key') state.opts.octave = 0;
      scheduleUpdate();
    });

    document.querySelectorAll('.lm-tab').forEach((tab) => tab.addEventListener('click', () => {
      document.querySelectorAll('.lm-tab').forEach((t) => {
        const on = t === tab;
        t.classList.toggle('selected', on);
        t.setAttribute('aria-selected', String(on));
      });
      document.querySelectorAll('.lm-tabpanel').forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
    }));

    $('lm-load-abc').addEventListener('click', () => loadAbc(form.elements.abc.value));
    $('lm-example').addEventListener('click', () => {
      form.elements.abc.value = EXAMPLE;
      loadAbc(EXAMPLE);
    });
    $('lm-file').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) loadFile(file);
      e.target.value = '';
    });
    form.elements.part.addEventListener('change', () => {
      if (!importer) return;
      showError('');
      try {
        setSong(importer.build(form.elements.part.value), state.sourceType, form.elements.part.value);
      } catch (err) {
        showError(err.message);
      }
    });

    const shiftOctave = (by) => {
      clearTimeout(timer);
      state.opts.octave = clamp(state.opts.octave + by, -3, 3);
      update();
    };
    $('lm-oct-down').addEventListener('click', () => shiftOctave(-1));
    $('lm-oct-up').addEventListener('click', () => shiftOctave(1));

    el.play.addEventListener('click', async () => {
      if (!result) return;
      el.audioMsg.hidden = true;
      el.play.disabled = true;
      el.stop.disabled = false;
      try {
        await Player.play({
          timeline: result.timeline, tempo: state.opts.tempo, inst: inst(), container: el.music,
          onStop: () => { el.play.disabled = false; el.stop.disabled = true; },
        });
      } catch {
        el.play.disabled = false;
        el.stop.disabled = true;
        el.audioMsg.textContent = 'Het geluid kon niet geladen worden. Controleer de internetverbinding.';
        el.audioMsg.hidden = false;
      }
    });
    el.stop.addEventListener('click', () => Player.stop());
    $('lm-print').addEventListener('click', () => {
      clearTimeout(timer);
      update();
      window.print();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof ABCJS === 'undefined' || typeof Tone === 'undefined') {
      document.getElementById('lib-error').hidden = false;
      return;
    }
    init();
  });
})();
