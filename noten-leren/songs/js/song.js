'use strict';

/*
 * Song model + music theory helpers for the Songs tool.
 *
 * Song = {
 *   title, tempo (quarter notes per minute), fifths (key signature), mode ('major' | 'minor'),
 *   bars:  [{ start, num, den }]   bar start ticks and time signature,
 *   end:   tick where the music ends,
 *   notes: [{ tick, dur, pitch: { step 0-6 (C-B), alter -2..2, octave } }]   (monophonic, ties merged)
 * }
 * Gaps between notes are rests. Times are in ticks, TPQ ticks per quarter note.
 */
const Song = (() => {
  const TPQ = 24;
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const STEP_SEMIS = [0, 2, 4, 5, 7, 9, 11];
  const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B
  const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3]; // B E A D G C F

  const MAJOR_NL = { '-7': 'Ces', '-6': 'Ges', '-5': 'Des', '-4': 'As', '-3': 'Es', '-2': 'Bes', '-1': 'F', 0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'Fis', 7: 'Cis' };
  const MINOR_NL = { '-7': 'as', '-6': 'es', '-5': 'bes', '-4': 'f', '-3': 'c', '-2': 'g', '-1': 'd', 0: 'a', 1: 'e', 2: 'b', 3: 'fis', 4: 'cis', 5: 'gis', 6: 'dis', 7: 'ais' };
  const MAJOR_ABC = { '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F', 0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#' };

  const mod = (n, m) => ((n % m) + m) % m;

  function midiOf(p) {
    return 12 * (p.octave + 1) + STEP_SEMIS[p.step] + p.alter;
  }

  function diatonicOf(p) {
    return p.octave * 7 + p.step;
  }

  function fromDiatonic(dia, midi) {
    const octave = Math.floor(dia / 7);
    const step = mod(dia, 7);
    return { step, octave, alter: midi - (12 * (octave + 1) + STEP_SEMIS[step]) };
  }

  /** Transpose by an interval { steps (diatonic), semis }; keeps correct spelling. */
  function transposePitch(p, iv) {
    return fromDiatonic(diatonicOf(p) + iv.steps, midiOf(p) + iv.semis);
  }

  function samePitch(a, b) {
    return Boolean(a && b && a.step === b.step && a.alter === b.alter && a.octave === b.octave);
  }

  /** Alteration of a step in a key signature (fifths > 0 = sharps, < 0 = flats). */
  function keyAlter(fifths, step) {
    if (fifths > 0) return SHARP_ORDER.slice(0, fifths).includes(step) ? 1 : 0;
    if (fifths < 0) return FLAT_ORDER.slice(0, -fifths).includes(step) ? -1 : 0;
    return 0;
  }

  /** Key signature change (in fifths) caused by transposing with an interval. */
  function fifthsOfInterval(iv) {
    let best = 0;
    let found = false;
    for (let k = -11; k <= 11; k++) {
      if (mod(4 * k, 7) === mod(iv.steps, 7) && mod(7 * k, 12) === mod(iv.semis, 12)) {
        if (!found || Math.abs(k) < Math.abs(best)) best = k;
        found = true;
      }
    }
    return best;
  }

  /** Upward interval (within an octave) that moves a key by `delta` fifths. */
  function intervalForFifths(delta) {
    return { steps: mod(4 * delta, 7), semis: mod(7 * delta, 12) };
  }

  /** Spell a MIDI number in a key (used for MIDI files, which have no spelling). */
  function spellMidi(midi, fifths) {
    const pc = mod(midi, 12);
    const options = [];
    for (let step = 0; step < 7; step++) {
      let alter = pc - STEP_SEMIS[step];
      if (alter > 6) alter -= 12;
      if (alter < -6) alter += 12;
      if (Math.abs(alter) <= 1) options.push({ step, alter });
    }
    const score = (o) => {
      if (o.alter === keyAlter(fifths, o.step)) return 0;
      if (o.alter === 0) return 1;
      return (o.alter > 0) === (fifths >= 0) ? 2 : 3;
    };
    options.sort((a, b) => score(a) - score(b));
    const { step, alter } = options[0];
    const octave = Math.floor((midi - alter - STEP_SEMIS[step]) / 12) - 1;
    return { step, alter, octave };
  }

  function dutchName(p) {
    const base = LETTERS[p.step].toLowerCase();
    if (p.alter === 1) return base + 'is';
    if (p.alter === 2) return base + 'isis';
    if (p.alter === -1) return base === 'e' ? 'es' : base === 'a' ? 'as' : base + 'es';
    if (p.alter === -2) return base === 'e' ? 'eses' : base === 'a' ? 'ases' : base + 'eses';
    return base;
  }

  /** e.g. "D4", "F♯5" */
  function pitchLabel(p) {
    const acc = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' }[p.alter];
    return LETTERS[p.step] + acc + p.octave;
  }

  function keyName(fifths, mode) {
    return mode === 'minor' ? MINOR_NL[fifths] + '-mineur' : MAJOR_NL[fifths] + '-majeur';
  }

  /** English key name for the teacher interface, e.g. "D major" / "B minor". */
  function keyNameEn(fifths, mode) {
    const MAJOR_EN = { '-7': 'C♭', '-6': 'G♭', '-5': 'D♭', '-4': 'A♭', '-3': 'E♭', '-2': 'B♭', '-1': 'F', 0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F♯', 7: 'C♯' };
    const MINOR_EN = { '-7': 'A♭', '-6': 'E♭', '-5': 'B♭', '-4': 'F', '-3': 'C', '-2': 'G', '-1': 'D', 0: 'A', 1: 'E', 2: 'B', 3: 'F♯', 4: 'C♯', 5: 'G♯', 6: 'D♯', 7: 'A♯' };
    return mode === 'minor' ? MINOR_EN[fifths] + ' minor' : MAJOR_EN[fifths] + ' major';
  }

  function keySignatureLabelEn(fifths) {
    if (fifths === 0) return 'no sharps or flats';
    const n = Math.abs(fifths);
    return n + (fifths > 0 ? (n === 1 ? ' sharp' : ' sharps') : (n === 1 ? ' flat' : ' flats'));
  }

  function abcKey(fifths) {
    return MAJOR_ABC[fifths];
  }

  function barLength(bar) {
    return Math.round((bar.num * 4 * TPQ) / bar.den);
  }

  /** Simple key guess from a pitch-class histogram (for MIDI files without a key signature). */
  function guessFifths(notes) {
    const hist = new Array(12).fill(0);
    for (const n of notes) hist[mod(n.midi, 12)] += n.dur;
    let best = 0;
    let bestScore = -Infinity;
    for (let f = -5; f <= 6; f++) {
      const tonic = mod(7 * f, 12);
      const scale = [0, 2, 4, 5, 7, 9, 11].map((s) => mod(tonic + s, 12));
      const score = scale.reduce((sum, pc) => sum + hist[pc], 0) + hist[tonic] * 0.5 - Math.abs(f) * 0.01;
      if (score > bestScore) { bestScore = score; best = f; }
    }
    return best;
  }

  return {
    TPQ, LETTERS, mod, midiOf, diatonicOf, transposePitch, samePitch, keyAlter, fifthsOfInterval,
    intervalForFifths, spellMidi, dutchName, pitchLabel, keyName, keyNameEn, keySignatureLabelEn, abcKey, barLength, guessFifths,
  };
})();
