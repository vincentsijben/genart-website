'use strict';

/* Instrument samplers (Tone.js + gleitz/midi-js-soundfonts). Samples are concert pitch. */
const Sound = (() => {
  const BASE_URL = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/';
  // One sample every 3 semitones; Tone.Sampler pitch-shifts the notes in between.
  const SAMPLE_NOTES = ['A2', 'C3', 'Eb3', 'Gb3', 'A3', 'C4', 'Eb4', 'Gb4', 'A4', 'C5', 'Eb5', 'Gb5', 'A5', 'C6', 'Eb6', 'Gb6', 'A6', 'C7'];

  const samplers = {};
  const loading = {};

  /** Only the samples needed for this instrument's (concert) range. */
  function samplesFor(inst) {
    const lo = Notes.parse(inst.lowest).midi + inst.transpose - 3;
    const hi = Notes.parse(inst.highest).midi + inst.transpose + 3;
    return SAMPLE_NOTES.filter((n) => {
      const m = Notes.parse(n).midi;
      return m >= lo && m <= hi;
    });
  }

  function load(inst = Instruments.get()) {
    if (loading[inst.id]) return loading[inst.id];
    if (typeof Tone === 'undefined') return Promise.reject(new Error('Tone.js niet geladen'));
    loading[inst.id] = new Promise((resolve, reject) => {
      const urls = {};
      for (const n of samplesFor(inst)) urls[n] = n + '.mp3';
      samplers[inst.id] = new Tone.Sampler({
        urls,
        baseUrl: BASE_URL + inst.soundfont + '-mp3/',
        release: 0.8,
        onload: resolve,
        onerror: reject,
      }).toDestination();
    }).catch((err) => {
      delete loading[inst.id];
      throw err;
    });
    return loading[inst.id];
  }

  function stopAll() {
    Object.values(samplers).forEach((s) => s.releaseAll());
  }

  /** Play a WRITTEN note on the current instrument (transposed to concert pitch). */
  async function playWritten(note, seconds = 1.6) {
    if (muted) return;
    const inst = Instruments.get();
    // iOS Safari: play even when the ringer/silent switch is on.
    if (navigator.audioSession) {
      try { navigator.audioSession.type = 'playback'; } catch { /* unsupported */ }
    }
    await Tone.start();
    await load(inst);
    stopAll();
    const freq = Tone.Frequency(note.midi + inst.transpose, 'midi');
    samplers[inst.id].triggerAttackRelease(freq.toNote(), seconds);
  }

  // ---------- Mute (saved in localStorage) ----------
  const MUTE_KEY = 'saxnoten.muted';
  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* private mode */ }

  function isMuted() {
    return muted;
  }

  function setMuted(value) {
    muted = Boolean(value);
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* private mode */ }
    if (muted) stopAll();
    document.dispatchEvent(new CustomEvent('sound-mute', { detail: muted }));
  }

  /** Loaded sampler for an instrument (for scheduling sequences, e.g. the Liedjesmaker player). */
  async function getSampler(inst = Instruments.get()) {
    await Tone.start();
    await load(inst);
    return samplers[inst.id];
  }

  return { load, playWritten, getSampler, stopAll, isMuted, setMuted };
})();
