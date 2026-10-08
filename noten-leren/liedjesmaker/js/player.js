'use strict';

/* Plays the arranged melody with the instrument samples and highlights the notes. */
const Player = (() => {
  let elements = [];
  let current = null;
  let onEnd = null;
  let session = 0; // ignores callbacks that were already queued when playback stopped

  const transport = () => (Tone.getTransport ? Tone.getTransport() : Tone.Transport);
  const draw = () => (Tone.getDraw ? Tone.getDraw() : Tone.Draw);

  function highlight(el) {
    if (current) current.classList.remove('lm-playing');
    current = el || null;
    if (current) {
      current.classList.add('lm-playing');
      const svgLine = current.closest('svg');
      if (svgLine && svgLine.scrollIntoView) svgLine.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /**
   * timeline: [{ tick, midi (written), sound, dur }] in rendered notehead order.
   * Sounding pitch = written + inst.transpose.
   */
  async function play({ timeline, tempo, inst, container, onStop }) {
    stop();
    const id = ++session;
    onEnd = onStop;
    const sampler = await Sound.getSampler(inst);
    if (id !== session) return;
    elements = [...container.querySelectorAll('.abcjs-note')];
    const secondsPerTick = 60 / (tempo * Song.TPQ);
    const T = transport();
    T.stop();
    T.cancel();
    T.position = 0;
    let last = 0;
    timeline.forEach((ev, i) => {
      last = Math.max(last, ev.tick + (ev.sound ? ev.dur : 0));
      T.schedule((time) => {
        if (ev.sound) {
          const note = Tone.Frequency(ev.midi + inst.transpose, 'midi').toNote();
          sampler.triggerAttackRelease(note, Math.max(0.12, ev.dur * secondsPerTick * 0.92), time);
        }
        draw().schedule(() => { if (id === session) highlight(elements[i]); }, time);
      }, ev.tick * secondsPerTick);
    });
    T.schedule((time) => draw().schedule(() => { if (id === session) stop(); }, time), last * secondsPerTick + 0.4);
    T.start('+0.1');
  }

  function stop() {
    session++;
    if (typeof Tone !== 'undefined') {
      const T = transport();
      T.stop();
      T.cancel();
      Sound.stopAll();
    }
    highlight(null);
    if (onEnd) {
      const cb = onEnd;
      onEnd = null;
      cb();
    }
  }

  return { play, stop };
})();
