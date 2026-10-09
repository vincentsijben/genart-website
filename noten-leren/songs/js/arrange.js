'use strict';

/* Arranging: select bars, transpose for an instrument, suggest a key, simplify rhythm. */
const Arrange = (() => {
  const { TPQ } = Song;
  const KEY_CHOICES = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6]; // Des … Fis (12 unique keys)

  const barEnd = (song, i) => (i + 1 < song.bars.length ? song.bars[i + 1].start : song.end);

  /** Bars `from`..`to` (0-based, inclusive) as a new song starting at tick 0. */
  function slice(song, from, to) {
    const last = song.bars.length - 1;
    from = Math.max(0, Math.min(last, from));
    to = Math.max(from, Math.min(last, to));
    const start = song.bars[from].start;
    const end = barEnd(song, to);
    const notes = song.notes
      .filter((n) => n.tick < end && n.tick + n.dur > start)
      .map((n) => {
        const s = Math.max(n.tick, start);
        return { tick: s - start, dur: Math.min(n.tick + n.dur, end) - s, pitch: n.pitch };
      });
    const bars = song.bars.slice(from, to + 1).map((b) => ({ ...b, start: b.start - start }));
    return { ...song, bars, end: end - start, notes };
  }

  function transposeSong(song, iv, fifths) {
    return {
      ...song,
      fifths: fifths ?? song.fifths + Song.fifthsOfInterval(iv),
      notes: song.notes.map((n) => ({ ...n, pitch: Song.transposePitch(n.pitch, iv) })),
    };
  }

  /** Concert pitch -> written pitch for this instrument. */
  function writtenInterval(inst) {
    return { steps: -inst.transposeSteps, semis: -inst.transpose };
  }

  function pitchRange(song) {
    const midis = song.notes.map((n) => Song.midiOf(n.pitch));
    return { min: Math.min(...midis), max: Math.max(...midis) };
  }

  /**
   * All 12 written keys with the best octave for each, plus:
   * - original:  the key that sounds like the original (so different instruments can play together),
   * - suggested: fits the range, fewest accidentals in the key signature, then closest to the original pitch.
   */
  function keyOptions(song, inst, low, high) {
    const base = transposeSong(song, writtenInterval(inst));
    const { min, max } = pitchRange(base);
    const options = KEY_CHOICES.map((fifths) => {
      const up = Song.intervalForFifths(fifths - base.fifths);
      let best = null;
      for (let o = -3; o <= 2; o++) {
        const iv = { steps: up.steps + 7 * o, semis: up.semis + 12 * o };
        const lowBy = Math.max(0, low - (min + iv.semis));
        const highBy = Math.max(0, max + iv.semis - high);
        const cand = { fifths, iv, lowBy, highBy, overflow: lowBy + highBy };
        if (!best || cand.overflow < best.overflow || (cand.overflow === best.overflow && Math.abs(iv.semis) < Math.abs(best.iv.semis))) best = cand;
      }
      return best;
    });
    const rank = (o) => [o.overflow > 0 ? 1 : 0, o.overflow, Math.abs(o.fifths), Math.abs(o.iv.semis)];
    const suggested = options.slice().sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
      return 0;
    })[0];
    // The key at the original sounding pitch (same pitch classes, so the shift is whole octaves at most).
    const original = options.find((o) => Song.mod(o.iv.semis, 12) === 0);
    return { base, options, suggested, original };
  }

  /** Apply a key option plus extra octaves (-1, 0, +1 …) to the written base. */
  function applyKey(base, option, octaves, low, high) {
    const iv = { steps: option.iv.steps + 7 * octaves, semis: option.iv.semis + 12 * octaves };
    const song = transposeSong(base, iv, option.fifths);
    const r = pitchRange(song);
    return { song, iv, min: r.min, max: r.max, lowBy: Math.max(0, low - r.min), highBy: Math.max(0, r.max - high) };
  }

  /**
   * "Vereenvoudig ritme": only quarter and eighth based rhythms.
   * Onsets snap to an eighth-note grid; in x/4 and x/2 time an off-beat note without a note
   * on the beat before it moves to that beat (dotted / syncopated rhythms become straight),
   * and off-beat notes are at most an eighth long.
   */
  function simplify(song) {
    const slot = TPQ / 2;
    const result = [];
    song.bars.forEach((bar, bi) => {
      const start = bar.start;
      const end = barEnd(song, bi);
      const len = end - start;
      const inBar = song.notes.filter((n) => n.tick < end && n.tick + n.dur > start);
      if (len % slot) {
        inBar.forEach((n) => result.push({ ...n }));
        return;
      }
      const slotsInBar = len / slot;
      // Events = notes and the rests between them.
      const events = [];
      let t = start;
      for (const n of inBar) {
        const s = Math.max(n.tick, start);
        const e = Math.min(n.tick + n.dur, end);
        if (s > t) events.push({ start: t - start, len: s - t, pitch: null });
        events.push({ start: s - start, len: e - s, pitch: n.pitch, cont: n.tick < start });
        t = e;
      }
      if (t < end) events.push({ start: t - start, len: end - t, pitch: null });

      const slots = new Map();
      for (const ev of events) {
        const k = Math.min(slotsInBar - 1, Math.round(ev.start / slot));
        const cur = slots.get(k);
        const better = !cur || (ev.pitch && !cur.pitch) || (Boolean(ev.pitch) === Boolean(cur.pitch) && ev.len > cur.len);
        if (better) slots.set(k, ev);
      }
      const beatBased = bar.den === 4 || bar.den === 2;
      if (beatBased) {
        for (let k = 1; k < slotsInBar; k += 2) {
          if (slots.has(k) && !slots.has(k - 1)) {
            slots.set(k - 1, slots.get(k));
            slots.delete(k);
          }
        }
      }
      const keys = [...slots.keys()].sort((a, b) => a - b);
      keys.forEach((k, i) => {
        const ev = slots.get(k);
        if (!ev.pitch) return;
        let dur = ((i + 1 < keys.length ? keys[i + 1] : slotsInBar) - k) * slot;
        if (beatBased && k % 2 === 1) dur = Math.min(dur, slot);
        result.push({ tick: start + k * slot, dur, pitch: ev.pitch, cont: ev.cont && k === 0 });
      });
    });
    // Re-join notes that were tied over the bar line.
    const notes = [];
    for (const n of result) {
      const prev = notes[notes.length - 1];
      if (n.cont && prev && prev.tick + prev.dur === n.tick && Song.samePitch(prev.pitch, n.pitch)) prev.dur += n.dur;
      else notes.push({ tick: n.tick, dur: n.dur, pitch: n.pitch });
    }
    return { ...song, notes };
  }

  return { slice, keyOptions, applyKey, simplify, writtenInterval, pitchRange };
})();
