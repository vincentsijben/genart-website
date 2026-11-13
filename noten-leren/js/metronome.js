'use strict';

/*
 * Metronome on the start screen: a click at "quarter note = N" beats per minute.
 * Plain Web Audio (no Tone.js / samples), so it also works when the music libraries could not be loaded.
 * The clicks are scheduled a little ahead on the audio clock, which keeps the beat steady even when
 * the page is busy. It ignores the quiz's mute button: the student starts it on purpose.
 */
const Metronome = (() => {
  const KEY = 'saxnoten.metronome';
  const MIN = 40;
  const MAX = 208;
  const DEFAULT = 100;

  let el = {};
  let bpm = DEFAULT;
  let ctx = null;
  let out = null; // output of the current run; disconnected on stop so clicks scheduled ahead stay silent
  let timer = null;
  let nextTime = 0;
  let run = 0; // ignores beat flashes that were queued before stop()
  let wakeLock = null;

  const clampBpm = (v) => Math.min(MAX, Math.max(MIN, Math.round(Number(v)) || DEFAULT));
  const isRunning = () => timer !== null;

  function click(time) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 1500;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(1, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    osc.connect(gain).connect(out);
    osc.start(time);
    osc.stop(time + 0.08);
  }

  function flash(time) {
    const id = run;
    setTimeout(() => {
      if (id !== run) return;
      el.display.classList.add('beat');
      setTimeout(() => el.display.classList.remove('beat'), 90);
    }, Math.max(0, (time - ctx.currentTime) * 1000));
  }

  function schedule() {
    // Browsers slow timers down to once a second in a background tab: schedule further ahead there.
    const ahead = document.hidden ? 1.5 : 0.12;
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05; // after a pause: no burst of late clicks
    while (nextTime < ctx.currentTime + ahead) {
      click(nextTime);
      flash(nextTime);
      nextTime += 60 / bpm;
    }
  }

  /** Keep the screen on while the metronome runs (the student has both hands on the instrument). */
  async function keepAwake(on) {
    try {
      if (on && !wakeLock && navigator.wakeLock && !document.hidden) {
        const lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; });
        if (isRunning()) wakeLock = lock;
        else lock.release();
      } else if (!on && wakeLock) {
        const lock = wakeLock;
        wakeLock = null;
        await lock.release();
      }
    } catch { /* unsupported or refused: the metronome works without it */ }
  }

  function start() {
    if (isRunning()) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      el.msg.textContent = 'De metronoom werkt niet in deze browser.';
      el.msg.hidden = false;
      return;
    }
    // iOS Safari: play even when the ringer/silent switch is on.
    if (navigator.audioSession) {
      try { navigator.audioSession.type = 'playback'; } catch { /* unsupported */ }
    }
    if (!ctx) ctx = new AudioCtx();
    ctx.resume().catch(() => {});
    out = ctx.createGain();
    out.connect(ctx.destination);
    run++;
    nextTime = ctx.currentTime + 0.08;
    schedule();
    timer = setInterval(schedule, 25);
    keepAwake(true);
    render();
  }

  function stop() {
    if (!isRunning()) return;
    clearInterval(timer);
    timer = null;
    run++;
    out.disconnect();
    out = null;
    ctx.suspend().catch(() => {}); // saves battery; start() resumes it
    keepAwake(false);
    render();
  }

  function setBpm(value) {
    bpm = clampBpm(value);
    try { localStorage.setItem(KEY, String(bpm)); } catch { /* private mode */ }
    render();
  }

  function render() {
    const on = isRunning();
    el.bpm.textContent = bpm;
    el.range.value = bpm;
    el.slower.disabled = bpm <= MIN;
    el.faster.disabled = bpm >= MAX;
    el.toggle.textContent = on ? '■ Stop' : '▶ Start';
    el.toggle.classList.toggle('btn-go', !on);
    el.toggle.classList.toggle('btn-stop', on);
    el.toggle.setAttribute('aria-pressed', String(on));
    el.helpNow.textContent = 'Nu staat de metronoom op ♩ = ' + bpm + ': je hoort ' + bpm + ' tikken in één minuut.';
    if (!on) el.display.classList.remove('beat');
  }

  /** − / + buttons: one step per tap, keeps going while held down. */
  function holdToRepeat(button, step) {
    let delay = null;
    let repeat = null;
    const end = () => { clearTimeout(delay); clearInterval(repeat); };
    button.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      end();
      delay = setTimeout(() => { repeat = setInterval(() => setBpm(bpm + step), 70); }, 450);
    });
    ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach((type) => button.addEventListener(type, end));
    button.addEventListener('click', () => setBpm(bpm + step));
  }

  function init() {
    const $ = (id) => document.getElementById(id);
    el = {
      box: $('metronome'), display: $('metro-display'), bpm: $('metro-bpm'), range: $('metro-range'),
      slower: $('metro-slower'), faster: $('metro-faster'), toggle: $('metro-toggle'), msg: $('metro-msg'),
      helpNow: $('metro-help-now'),
    };
    if (!el.box) return;
    try { bpm = clampBpm(localStorage.getItem(KEY)); } catch { /* private mode */ }
    el.range.min = MIN;
    el.range.max = MAX;
    el.range.addEventListener('input', () => setBpm(el.range.value));
    holdToRepeat(el.slower, -1);
    holdToRepeat(el.faster, 1);
    el.toggle.addEventListener('click', () => (isRunning() ? stop() : start()));

    // Only on the start screen: stop and hide it while the quiz is running.
    document.addEventListener('quiz-panel', (e) => {
      const onStart = e.detail === 'start';
      if (!onStart) stop();
      el.box.hidden = !onStart;
    });
    // Back from another tab/app or a phone call: wake the audio and the screen lock up again.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden || !isRunning()) return;
      ctx.resume().catch(() => {});
      keepAwake(true);
    });
    render();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { start, stop, setBpm, isRunning };
})();
