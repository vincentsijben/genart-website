'use strict';

/*
 * Song (written pitch) -> ABC notation for abcjs.
 * Also returns a timeline with one entry per rendered notehead (same order as abcjs draws them),
 * used for playback and highlighting.
 */
const AbcWriter = (() => {
  const { TPQ } = Song;
  const UNIT = TPQ / 2; // L:1/8
  const VALUES = [96, 72, 48, 36, 24, 18, 12, 9, 6, 3]; // whole … 32nd, incl. dotted values

  const gcd = (a, b) => (b ? gcd(b, a % b) : a);

  function abcLength(ticks) {
    const g = gcd(ticks, UNIT);
    const num = ticks / g;
    const den = UNIT / g;
    return (num === 1 ? '' : String(num)) + (den === 1 ? '' : '/' + den);
  }

  function beatOf(bar) {
    if (bar.den === 8) return bar.num % 3 === 0 && bar.num > 3 ? 36 : 12;
    if (bar.den === 16) return 6;
    return TPQ;
  }

  function abcPitch(p) {
    const letter = Song.LETTERS[p.step];
    if (p.octave >= 5) return letter.toLowerCase() + "'".repeat(p.octave - 5);
    return letter + ','.repeat(Math.max(0, 4 - p.octave));
  }

  /** Can a note value v start at position p without making the bar hard to read? */
  function fits(p, v, beat) {
    if (v >= beat) return p % beat === 0;
    const dotted = v === 18 || v === 9;
    const base = dotted ? (v / 3) * 2 : v;
    return p % base === 0 && Math.floor(p / beat) === Math.floor((p + v - 1) / beat);
  }

  function splitValue(p, d, beat) {
    const parts = [];
    while (d > 0) {
      const v = VALUES.find((x) => x <= d && fits(p, x, beat)) || Math.min(d, 3);
      parts.push(v);
      p += v;
      d -= v;
    }
    return parts;
  }

  /** Notes and rests of one bar, as { start, dur, pitch|null, tieIn, tieOut, note } relative to the bar. */
  function barEvents(song, start, end) {
    const events = [];
    let t = start;
    for (const n of song.notes) {
      if (n.tick + n.dur <= start || n.tick >= end) continue;
      const s = Math.max(n.tick, start);
      const e = Math.min(n.tick + n.dur, end);
      if (s > t) events.push({ start: t - start, dur: s - t, pitch: null });
      events.push({ start: s - start, dur: e - s, pitch: n.pitch, tieIn: n.tick < start, tieOut: n.tick + n.dur > end, note: n });
      t = e;
    }
    if (t < end) events.push({ start: t - start, dur: end - t, pitch: null });
    return events;
  }

  /** Split the bar into binary and triplet segments; null if the rhythm can't be written cleanly. */
  function segments(events, len, beat) {
    const bounds = new Set();
    events.forEach((e) => { bounds.add(e.start); bounds.add(e.start + e.dur); });
    if ([...bounds].every((b) => b % 3 === 0)) return [{ start: 0, end: len, triplet: false }];
    const segs = [];
    for (let b = 0; b < len; b += beat) {
      const segEnd = Math.min(len, b + beat);
      const inside = [...bounds].filter((x) => x > b && x < segEnd);
      if (inside.every((x) => x % 3 === 0)) segs.push({ start: b, end: segEnd, triplet: false });
      else segs.push({ start: b, end: segEnd, triplet: true });
    }
    // Triplet segments: no event may cross their edges and all boundaries are on a third of the beat.
    for (const seg of segs.filter((s) => s.triplet)) {
      const third = (seg.end - seg.start) / 3;
      const crossing = events.some((e) => (e.start < seg.start && e.start + e.dur > seg.start) || (e.start < seg.end && e.start + e.dur > seg.end));
      const inside = events.filter((e) => e.start >= seg.start && e.start < seg.end);
      const ok = !crossing && inside.every((e) => (e.start - seg.start) % third === 0 && e.dur % third === 0 && VALUES.includes((e.dur * 3) / 2));
      if (!ok) return null;
    }
    // Merge neighbouring binary segments so notes can span beats (e.g. a half note after a triplet).
    return segs.reduce((acc, seg) => {
      const prev = acc[acc.length - 1];
      if (prev && !prev.triplet && !seg.triplet) prev.end = seg.end;
      else acc.push({ ...seg });
      return acc;
    }, []);
  }

  function quantizeEvents(events, len) {
    const g = TPQ / 4;
    const out = [];
    for (const e of events) {
      const s = Math.round(e.start / g) * g;
      const end = Math.min(len, Math.round((e.start + e.dur) / g) * g);
      if (end > s) out.push({ ...e, start: s, dur: end - s });
    }
    return out;
  }

  function write(song, { barsPerLine = 4, names = false } = {}) {
    const lines = [];
    const timeline = [];
    let lineMusic = '';
    let lineLyrics = [];
    let prevMeter = null;
    const fifths = song.fifths;
    const firstBar = song.bars[0];

    song.bars.forEach((bar, bi) => {
      const start = bar.start;
      const end = bi + 1 < song.bars.length ? song.bars[bi + 1].start : song.end;
      const len = end - start;
      const beat = beatOf(bar);
      let events = barEvents(song, start, end);
      let segs = segments(events, len, beat);
      if (!segs) {
        events = quantizeEvents(events, len);
        segs = [{ start: 0, end: len, triplet: false }];
      }

      let out = '';
      if (prevMeter && (prevMeter.num !== bar.num || prevMeter.den !== bar.den)) out += '[M:' + bar.num + '/' + bar.den + '] ';
      prevMeter = bar;
      const accState = {};

      const noteToken = (ev, value, isFirstChunk, isLastChunk) => {
        const p = ev.pitch;
        const key = p.step + ':' + p.octave;
        let acc = '';
        const continuation = !isFirstChunk || ev.tieIn;
        if (!continuation) {
          const current = key in accState ? accState[key] : Song.keyAlter(fifths, p.step);
          if (current !== p.alter) {
            acc = { '-2': '__', '-1': '_', 0: '=', 1: '^', 2: '^^' }[p.alter];
            accState[key] = p.alter;
          }
        }
        const tie = !isLastChunk || ev.tieOut ? '-' : '';
        timeline.push({
          tick: start + ev.start, // updated by caller for chunks
          midi: Song.midiOf(p),
          sound: !continuation,
          dur: ev.note ? ev.note.dur : ev.dur,
        });
        if (names) lineLyrics.push(continuation ? '*' : Song.dutchName(p));
        return acc + abcPitch(p) + abcLength(value) + tie;
      };

      for (const seg of segs) {
        const segEvents = events.filter((e) => e.start < seg.end && e.start + e.dur > seg.start);
        if (seg.triplet) {
          const inside = segEvents.filter((e) => e.start >= seg.start);
          out += ' (3:2:' + inside.length;
          for (const ev of inside) {
            const value = (ev.dur * 3) / 2;
            if (ev.pitch) {
              const tokenStart = timeline.length;
              out += noteToken(ev, value, true, true);
              timeline[tokenStart].tick = start + ev.start;
            } else out += 'z' + abcLength(value);
          }
          out += ' ';
          continue;
        }
        for (const ev of segEvents) {
          const s = Math.max(ev.start, seg.start);
          const e = Math.min(ev.start + ev.dur, seg.end);
          const parts = splitValue(s, e - s, beat);
          let p = s;
          parts.forEach((v) => {
            if (p % beat === 0 || v >= beat) out += ' ';
            if (ev.pitch) {
              const isFirst = p === ev.start;
              const isLast = p + v === ev.start + ev.dur;
              const idx = timeline.length;
              out += noteToken(ev, v, isFirst, isLast);
              timeline[idx].tick = start + p;
            } else {
              out += 'z' + abcLength(v);
            }
            p += v;
          });
        }
      }

      const isLast = bi === song.bars.length - 1;
      lineMusic += out.trim() + (isLast ? ' |]' : ' | ');
      if ((bi + 1) % barsPerLine === 0 || isLast) {
        lines.push(lineMusic.trim());
        if (names && lineLyrics.length) lines.push('w: ' + lineLyrics.join(' '));
        lineMusic = '';
        lineLyrics = [];
      }
    });

    const header = [
      'X:1',
      'M:' + firstBar.num + '/' + firstBar.den,
      'L:1/8',
      '%%vocalfont Helvetica 14',
      'K:' + (Song.abcKey(fifths) || 'C') + ' clef=treble',
    ];
    return { abc: header.join('\n') + '\n' + lines.join('\n') + '\n', timeline };
  }

  return { write };
})();
