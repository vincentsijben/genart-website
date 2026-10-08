'use strict';

/*
 * Importers: ABC text, MusicXML (.musicxml/.xml/.mxl) and MIDI (.mid) -> Song (concert pitch).
 * Every importer returns { parts: [{ id, name }], build(partId) -> Song }.
 * Only one melody line is used: the first voice of a part; for chords the highest note.
 */
const Importers = (() => {
  const { TPQ } = Song;

  function finishSong(song) {
    song.notes.sort((a, b) => a.tick - b.tick);
    if (!song.bars.length) song.bars.push({ start: 0, num: 4, den: 4 });
    if (!song.notes.length) throw new Error('Geen noten gevonden in deze partij.');
    return song;
  }

  /** Merge a note with the previous one when tied, otherwise add it. */
  function addNote(notes, state, tick, dur, pitch, tieStop, tieStart) {
    const prev = state.tieFrom;
    let note;
    if (tieStop && prev && Song.samePitch(prev.pitch, pitch) && prev.tick + prev.dur === tick) {
      prev.dur += dur;
      note = prev;
    } else {
      note = { tick, dur, pitch };
      notes.push(note);
    }
    state.tieFrom = tieStart ? note : null;
    return note;
  }

  // ---------------------------------------------------------------- ABC
  function fromAbc(text) {
    if (typeof ABCJS === 'undefined') throw new Error('abcjs is niet geladen.');
    const tune = ABCJS.parseOnly(text)[0];
    if (!tune || !tune.lines || !tune.lines.some((l) => l.staff)) throw new Error('Dit lijkt geen geldige ABC-notatie.');

    const voices = [];
    const firstStaff = tune.lines.find((l) => l.staff).staff;
    firstStaff.forEach((st, si) => st.voices.forEach((_, vi) => voices.push({ id: si + '.' + vi, name: 'Notenbalk ' + (si + 1) + (st.voices.length > 1 ? ', stem ' + (vi + 1) : '') })));

    return {
      parts: voices,
      build(partId = voices[0].id) {
        const [si, vi] = partId.split('.').map(Number);
        const accMap = { sharp: 1, flat: -1, natural: 0, dblsharp: 2, dblflat: -2 };
        let fifths = 0;
        let mode = 'major';
        let keyMap = {};
        let meter = { num: 4, den: 4 };
        const setKey = (key) => {
          if (!key) return;
          keyMap = {};
          let f = 0;
          for (const a of key.accidentals || []) {
            const step = Song.LETTERS.indexOf(a.note.toUpperCase());
            keyMap[step] = accMap[a.acc] ?? 0;
            f += a.acc === 'sharp' ? 1 : a.acc === 'flat' ? -1 : 0;
          }
          fifths = Math.max(-7, Math.min(7, f));
          mode = /^m(in)?$/i.test(key.mode || '') ? 'minor' : 'major';
        };
        const setMeter = (m) => {
          const v = m && m.type === 'specified' && m.value && m.value[0];
          if (v) meter = { num: Number(v.num) || 4, den: Number(v.den) || 4 };
          else if (m && m.type === 'common_time') meter = { num: 4, den: 4 };
          else if (m && m.type === 'cut_time') meter = { num: 2, den: 2 };
        };

        const song = { title: (tune.metaText && tune.metaText.title) || 'Liedje', tempo: 100, fifths: 0, mode: 'major', bars: [], end: 0, notes: [] };
        const tempo = tune.metaText && tune.metaText.tempo;
        if (tempo && tempo.bpm) song.tempo = Math.round(tempo.bpm * ((tempo.duration && tempo.duration[0]) || 0.25) / 0.25);

        let tick = 0;
        let barStart = 0;
        let barMeter = null;
        let barAcc = {};
        let tripletLeft = 0;
        let tripletMult = 1;
        const state = { tieFrom: null };
        let keySet = false;

        const closeBar = () => {
          if (tick > barStart) {
            song.bars.push({ start: barStart, ...(barMeter || meter) });
            barStart = tick;
          }
          barMeter = null;
          barAcc = {};
        };

        for (const line of tune.lines) {
          const st = line.staff && line.staff[si];
          if (!st) continue;
          if (st.key && (!keySet || st.key.accidentals)) {
            setKey(st.key);
            if (!keySet) { song.fifths = fifths; song.mode = mode; keySet = true; }
          }
          if (st.meter) { setMeter(st.meter); if (tick === barStart) barMeter = { ...meter }; }
          for (const el of st.voices[vi] || []) {
            if (el.el_type === 'bar') { closeBar(); continue; }
            if (el.el_type === 'key') { setKey(el); continue; }
            if (el.el_type === 'meter') { setMeter(el); if (tick === barStart) barMeter = { ...meter }; continue; }
            if (el.el_type !== 'note') continue;

            let dur = (el.duration || 0) * 4 * TPQ;
            if (el.startTriplet) { tripletLeft = el.tripletR || el.startTriplet; tripletMult = el.tripletMultiplier || 1; }
            if (tripletLeft > 0) { dur *= tripletMult; tripletLeft--; }
            dur = Math.round(dur);
            if (!dur) continue;
            if (el.rest || !el.pitches || !el.pitches.length) {
              if (!el.rest || el.rest.type !== 'spacer') tick += dur;
              state.tieFrom = null;
              continue;
            }
            const top = el.pitches.reduce((a, b) => (b.pitch > a.pitch ? b : a));
            const step = Song.mod(top.pitch, 7);
            const octave = 4 + Math.floor(top.pitch / 7);
            const accKey = step + ':' + octave;
            let alter;
            if (top.accidental && top.accidental in accMap) { alter = accMap[top.accidental]; barAcc[accKey] = alter; }
            else if (accKey in barAcc) alter = barAcc[accKey];
            else if (top.endTie && state.tieFrom && state.tieFrom.pitch.step === step && state.tieFrom.pitch.octave === octave) alter = state.tieFrom.pitch.alter;
            else alter = keyMap[step] || 0;
            addNote(song.notes, state, tick, dur, { step, alter, octave }, Boolean(top.endTie), Boolean(top.startTie));
            tick += dur;
          }
        }
        closeBar();
        song.end = tick;
        return finishSong(song);
      },
    };
  }

  // ---------------------------------------------------------- MusicXML
  async function unzipMxl(buffer) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Deze browser kan geen .mxl uitpakken. Exporteer als ongecomprimeerde .musicxml.');
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Ongeldig .mxl-bestand.');
    const count = view.getUint16(eocd + 10, true);
    let p = view.getUint32(eocd + 16, true);
    const files = {};
    const dec = new TextDecoder();
    for (let i = 0; i < count; i++) {
      const method = view.getUint16(p + 10, true);
      const size = view.getUint32(p + 20, true);
      const nameLen = view.getUint16(p + 28, true);
      const extraLen = view.getUint16(p + 30, true);
      const commentLen = view.getUint16(p + 32, true);
      const local = view.getUint32(p + 42, true);
      const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      files[name] = { method, size, local };
      p += 46 + nameLen + extraLen + commentLen;
    }
    const read = async (name) => {
      const f = files[name];
      const start = f.local + 30 + view.getUint16(f.local + 26, true) + view.getUint16(f.local + 28, true);
      const data = bytes.subarray(start, start + f.size);
      if (f.method === 0) return dec.decode(data);
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(stream).text();
    };
    let root = null;
    if (files['META-INF/container.xml']) {
      const container = new DOMParser().parseFromString(await read('META-INF/container.xml'), 'application/xml');
      const rf = container.querySelector('rootfile');
      if (rf) root = rf.getAttribute('full-path');
    }
    if (!root || !files[root]) root = Object.keys(files).find((n) => /\.(xml|musicxml)$/i.test(n) && !n.startsWith('META-INF'));
    if (!root) throw new Error('Geen MusicXML gevonden in het .mxl-bestand.');
    return read(root);
  }

  function fromMusicXml(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Dit MusicXML-bestand kan niet gelezen worden.');
    if (doc.documentElement.nodeName === 'score-timewise') throw new Error('"score-timewise" MusicXML wordt niet ondersteund. Exporteer als gewone MusicXML (partwise).');
    const text = (el, sel) => { const e = el.querySelector(sel); return e ? e.textContent.trim() : null; };
    const partEls = [...doc.querySelectorAll('score-partwise > part')];
    const names = {};
    doc.querySelectorAll('part-list > score-part').forEach((sp) => { names[sp.getAttribute('id')] = text(sp, 'part-name') || sp.getAttribute('id'); });
    const parts = partEls.map((p, i) => ({ id: p.getAttribute('id') || String(i), name: names[p.getAttribute('id')] || 'Partij ' + (i + 1) }));
    if (!parts.length) throw new Error('Geen partijen gevonden in dit MusicXML-bestand.');
    const title = text(doc, 'work > work-title') || text(doc, 'movement-title') || 'Liedje';

    return {
      parts,
      build(partId = parts[0].id) {
        const part = partEls.find((p, i) => (p.getAttribute('id') || String(i)) === partId) || partEls[0];
        const song = { title, tempo: 100, fifths: 0, mode: 'major', bars: [], end: 0, notes: [] };
        let divisions = 1;
        let meter = { num: 4, den: 4 };
        let transpose = { steps: 0, semis: 0 };
        let chosenVoice = null;
        let tick = 0;
        let tempoSet = false;
        let keySet = false;
        const state = { tieFrom: null };
        const toTicks = (d) => Math.round((d * TPQ) / divisions);

        for (const measure of part.querySelectorAll(':scope > measure')) {
          let pos = 0;
          let maxPos = 0;
          let lastStart = 0;
          let lastNote = null;
          for (const el of measure.children) {
            const name = el.nodeName;
            if (name === 'attributes') {
              const div = text(el, 'divisions');
              if (div) divisions = Number(div) || divisions;
              const beats = text(el, 'time > beats');
              const beatType = text(el, 'time > beat-type');
              if (beats && beatType) meter = { num: Number(beats.split('+').reduce((a, b) => a + Number(b), 0)) || 4, den: Number(beatType) || 4 };
              const tr = el.querySelector('transpose');
              if (tr) {
                const oct = Number(text(tr, 'octave-change') || 0);
                transpose = { steps: Number(text(tr, 'diatonic') || 0) + 7 * oct, semis: Number(text(tr, 'chromatic') || 0) + 12 * oct };
              }
              const fifths = text(el, 'key > fifths');
              if (fifths !== null && !keySet) {
                // Written key of a transposing part -> concert key.
                song.fifths = Math.max(-7, Math.min(7, Number(fifths) + Song.fifthsOfInterval(transpose)));
                song.mode = text(el, 'key > mode') === 'minor' ? 'minor' : 'major';
                keySet = true;
              }
            } else if (name === 'direction' || name === 'sound') {
              const snd = name === 'sound' ? el : el.querySelector('sound');
              if (!tempoSet && snd && snd.getAttribute('tempo')) { song.tempo = Math.round(Number(snd.getAttribute('tempo'))) || 100; tempoSet = true; }
            } else if (name === 'backup') {
              pos -= Number(text(el, 'duration') || 0);
            } else if (name === 'forward') {
              pos += Number(text(el, 'duration') || 0);
              maxPos = Math.max(maxPos, pos);
            } else if (name === 'note') {
              if (el.querySelector('grace') || el.querySelector('cue')) continue;
              const dur = Number(text(el, 'duration') || 0);
              const isChord = Boolean(el.querySelector('chord'));
              const voice = text(el, 'voice') || '1';
              const isRest = Boolean(el.querySelector('rest'));
              if (chosenVoice === null && !isRest) chosenVoice = voice;
              const start = isChord ? lastStart : pos;
              if (!isChord) { lastStart = pos; pos += dur; maxPos = Math.max(maxPos, pos); }
              if (voice !== (chosenVoice || voice) || isRest) { if (!isChord) lastNote = null; continue; }
              const stepTxt = text(el, 'pitch > step');
              if (!stepTxt) continue;
              const written = {
                step: Song.LETTERS.indexOf(stepTxt.toUpperCase()),
                alter: Math.round(Number(text(el, 'pitch > alter') || 0)),
                octave: Number(text(el, 'pitch > octave') || 4),
              };
              const pitch = Song.transposePitch(written, transpose);
              const ties = [...el.querySelectorAll(':scope > tie')].map((t) => t.getAttribute('type'));
              const t = tick + toTicks(start);
              if (isChord) {
                if (lastNote && lastNote.tick === t && Song.midiOf(pitch) > Song.midiOf(lastNote.pitch)) lastNote.pitch = pitch;
                continue;
              }
              lastNote = addNote(song.notes, state, t, toTicks(dur), pitch, ties.includes('stop'), ties.includes('start'));
            }
          }
          const len = toTicks(Math.max(maxPos, pos)) || Song.barLength(meter);
          song.bars.push({ start: tick, ...meter });
          tick += len;
        }
        song.end = tick;
        return finishSong(song);
      },
    };
  }

  // -------------------------------------------------------------- MIDI
  function fromMidi(buffer, fileName) {
    if (typeof Midi === 'undefined') throw new Error('De MIDI-lezer is niet geladen.');
    const midi = new Midi(buffer);
    const tracks = midi.tracks
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.notes.length && !(t.instrument && t.instrument.percussion) && t.channel !== 9);
    if (!tracks.length) throw new Error('Geen bruikbare sporen (met noten) gevonden in dit MIDI-bestand.');
    const parts = tracks.map(({ t, i }) => ({
      id: String(i),
      name: (t.name || (t.instrument && t.instrument.name) || 'Spoor ' + (i + 1)) + ' (' + t.notes.length + ' noten)',
    }));

    return {
      parts,
      build(partId = parts[0].id) {
        const track = midi.tracks[Number(partId)];
        const ppq = midi.header.ppq || 480;
        const grid = TPQ / 4; // quantize to 16th notes
        const q = (ticks) => Math.round((ticks * TPQ) / ppq / grid) * grid;

        // Monophonic: per (quantized) onset keep the highest note.
        const byOnset = new Map();
        for (const n of track.notes) {
          const tick = q(n.ticks);
          const end = Math.max(tick + grid, q(n.ticks + n.durationTicks));
          const cur = byOnset.get(tick);
          if (!cur || n.midi > cur.midi) byOnset.set(tick, { tick, end, midi: n.midi });
        }
        const raw = [...byOnset.values()].sort((a, b) => a.tick - b.tick);
        raw.forEach((n, i) => {
          const next = raw[i + 1];
          n.dur = (next ? Math.min(n.end, next.tick) : n.end) - n.tick;
        });

        const ts = midi.header.timeSignatures[0];
        const meter = ts ? { num: ts.timeSignature[0], den: ts.timeSignature[1] } : { num: 4, den: 4 };
        const barLen = Song.barLength(meter);
        const ks = midi.header.keySignatures[0];
        const keyFifths = { Cb: -7, Gb: -6, Db: -5, Ab: -4, Eb: -3, Bb: -2, F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7 };
        let fifths = ks && ks.key in keyFifths ? keyFifths[ks.key] : Song.guessFifths(raw);
        const mode = ks && ks.scale === 'minor' ? 'minor' : 'major';
        if (ks && mode === 'minor' && !(ks.key in keyFifths)) fifths = Song.guessFifths(raw);

        // Drop empty bars before the first note.
        const shift = Math.floor(raw[0].tick / barLen) * barLen;
        const notes = raw.map((n) => ({ tick: n.tick - shift, dur: n.dur, pitch: Song.spellMidi(n.midi, fifths) }));
        const last = notes[notes.length - 1];
        const end = Math.ceil((last.tick + last.dur) / barLen) * barLen;
        const bars = [];
        for (let t = 0; t < end; t += barLen) bars.push({ start: t, ...meter });

        const tempo = midi.header.tempos[0] ? Math.round(midi.header.tempos[0].bpm) : 100;
        const title = midi.header.name || (fileName || 'Liedje').replace(/\.[^.]+$/, '');
        return finishSong({ title, tempo, fifths, mode, bars, end, notes });
      },
    };
  }

  /** Read an uploaded file and pick the right importer. */
  async function fromFile(file) {
    const name = file.name.toLowerCase();
    if (/\.(mid|midi)$/.test(name)) return fromMidi(await file.arrayBuffer(), file.name);
    if (name.endsWith('.mxl')) return fromMusicXml(await unzipMxl(await file.arrayBuffer()));
    if (/\.(musicxml|xml)$/.test(name)) return fromMusicXml(await file.text());
    if (/\.(abc|txt)$/.test(name)) return fromAbc(await file.text());
    throw new Error('Onbekend bestandstype. Gebruik .mid, .musicxml, .xml, .mxl of .abc.');
  }

  return { fromAbc, fromMusicXml, fromMidi, fromFile };
})();
