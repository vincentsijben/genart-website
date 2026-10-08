'use strict';

/*
 * Note model. All notes are WRITTEN pitch for the chosen instrument;
 * the transposition to concert pitch lives in instruments.js.
 */
const Notes = (() => {
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const SHARPABLE = ['C', 'D', 'F', 'G', 'A'];
  const FLATTABLE = ['D', 'E', 'G', 'A', 'B'];

  const NATURAL_NAMES = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
  const SHARP_NAMES = ['cis', 'dis', 'fis', 'gis', 'ais'];
  const FLAT_NAMES = ['des', 'es', 'ges', 'as', 'bes'];
  const ALL_NAMES = [...NATURAL_NAMES, ...SHARP_NAMES, ...FLAT_NAMES];
  const ALIASES = { ees: 'es', aes: 'as' };

  function make(letter, acc, octave) {
    return { letter, acc, octave, midi: 12 * (octave + 1) + SEMITONES[letter] + acc };
  }

  function parse(noteId) {
    const m = /^([A-Ga-g])(#|b)?(\d)$/.exec(String(noteId).trim());
    if (!m) throw new Error('Onbekende noot: ' + noteId);
    return make(m[1].toUpperCase(), m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0, Number(m[3]));
  }

  function id(n) {
    return n.letter + (n.acc === 1 ? '#' : n.acc === -1 ? 'b' : '') + n.octave;
  }

  function label(n) {
    return n.letter + (n.acc === 1 ? '♯' : n.acc === -1 ? '♭' : '') + n.octave;
  }

  function dutchName(n) {
    const base = n.letter.toLowerCase();
    if (n.acc === 1) return base + 'is';
    if (n.acc === -1) {
      if (n.letter === 'E') return 'es';
      if (n.letter === 'A') return 'as';
      return base + 'es';
    }
    return base;
  }

  function normalizeAnswer(text) {
    const s = String(text).toLowerCase().replace(/\s+/g, '');
    return ALIASES[s] || s;
  }

  function isKnownName(name) {
    return ALL_NAMES.includes(name);
  }

  function toAbc(n) {
    const acc = n.acc === 1 ? '^' : n.acc === -1 ? '_' : '';
    const pitch = n.octave >= 5
      ? n.letter.toLowerCase() + "'".repeat(n.octave - 5)
      : n.letter + ','.repeat(4 - n.octave);
    return acc + pitch;
  }

  /** Range choices: the lowest note (may have an accidental) followed by all naturals up to highestId. */
  function rangeIds(lowestId, highestId) {
    const lo = parse(lowestId);
    const hi = parse(highestId).midi;
    const ids = lo.acc ? [lowestId] : [];
    for (let o = 2; o <= 7; o++) {
      for (const L of LETTERS) {
        const n = make(L, 0, o);
        if (n.midi >= lo.midi && n.midi <= hi) ids.push(L + o);
      }
    }
    return ids;
  }

  // Default range choices (alto sax: Bb3–F6), used by the worksheets.
  const RANGE_IDS = rangeIds('Bb3', 'F6');

  function same(a, b) {
    return a.letter === b.letter && a.acc === b.acc && a.octave === b.octave;
  }

  /** All notes between low and high (inclusive), optionally with sharps/flats. */
  function pool(lowId, highId, sharps, flats) {
    let lo = parse(lowId).midi;
    let hi = parse(highId).midi;
    if (lo > hi) [lo, hi] = [hi, lo];
    const out = [];
    for (let o = 2; o <= 7; o++) {
      for (const L of LETTERS) {
        const candidates = [];
        if (flats && FLATTABLE.includes(L)) candidates.push(make(L, -1, o));
        candidates.push(make(L, 0, o));
        if (sharps && SHARPABLE.includes(L)) candidates.push(make(L, 1, o));
        for (const c of candidates) if (c.midi >= lo && c.midi <= hi) out.push(c);
      }
    }
    return out;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Balanced random sequence (shuffle-bag) without the same note twice in a row. */
  function sequence(notePool, count) {
    const out = [];
    if (!notePool.length) return out;
    let bag = [];
    while (out.length < count) {
      if (!bag.length) bag = shuffle(notePool.slice());
      const prev = out[out.length - 1];
      let idx = 0;
      if (prev && notePool.length > 1) {
        idx = bag.findIndex((n) => !same(n, prev));
        if (idx < 0) {
          bag = shuffle(notePool.slice());
          idx = bag.findIndex((n) => !same(n, prev));
        }
      }
      out.push(bag.splice(idx, 1)[0]);
    }
    return out;
  }

  /** Valid {low, high} range ids (swapped if reversed, defaults if unknown). */
  function sanitizeRange(low, high, defLow = 'D4', defHigh = 'C6', ids = RANGE_IDS) {
    if (!ids.includes(low)) low = defLow;
    if (!ids.includes(high)) high = defHigh;
    if (parse(low).midi > parse(high).midi) [low, high] = [high, low];
    return { low, high };
  }

  function fillRangeSelect(select, value, ids = RANGE_IDS) {
    select.innerHTML = '';
    for (const nid of ids) {
      const n = parse(nid);
      const opt = document.createElement('option');
      opt.value = nid;
      opt.textContent = label(n) + '  (' + dutchName(n) + ')';
      select.appendChild(opt);
    }
    select.value = value;
  }

  function poolSummary(s) {
    const p = pool(s.low, s.high, s.sharps, s.flats);
    if (!p.length) return 'Geen noten in dit bereik. Kies een groter bereik.';
    return p.length + ' noten: ' + p.map((n) => dutchName(n)).join(' ');
  }

  return {
    RANGE_IDS, NATURAL_NAMES, SHARP_NAMES, FLAT_NAMES, ALL_NAMES,
    parse, id, label, dutchName, normalizeAnswer, isKnownName, toAbc, same, pool, sequence,
    rangeIds, sanitizeRange, fillRangeSelect, poolSummary,
  };
})();
