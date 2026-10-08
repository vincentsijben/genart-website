'use strict';

/* Notenquiz start-up: shared-link settings, instrument picker and mute button. */
(() => {
  function cleanUrl(params) {
    let changed = false;
    for (const p of Settings.PARAMS) {
      if (params.has(p)) { params.delete(p); changed = true; }
    }
    if (changed) {
      const q = params.toString();
      history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
    }
  }

  function initMuteButton() {
    const btn = document.getElementById('mute-btn');
    const update = () => {
      const muted = Sound.isMuted();
      btn.innerHTML = '<span aria-hidden="true">' + (muted ? '🔇' : '🔊') + '</span>' +
        '<span class="mute-label">Geluid ' + (muted ? 'uit' : 'aan') + '</span>';
      btn.setAttribute('aria-pressed', String(muted));
      btn.setAttribute('aria-label', muted ? 'Geluid aanzetten' : 'Geluid uitzetten');
      btn.title = muted ? 'Geluid staat uit – klik om aan te zetten' : 'Geluid staat aan – klik om uit te zetten';
    };
    btn.addEventListener('click', () => Sound.setMuted(!Sound.isMuted()));
    document.addEventListener('sound-mute', update);
    update();
  }

  function initInstrumentPicker() {
    const picker = document.getElementById('instrument-picker');
    for (const inst of Instruments.LIST) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'inst-btn';
      b.setAttribute('role', 'radio');
      b.dataset.inst = inst.id;
      b.innerHTML = '<span class="inst-icon" aria-hidden="true">' + inst.icon + '</span><span class="inst-name">' + inst.short + '</span>';
      b.addEventListener('click', () => {
        Instruments.set(inst.id);
        Sound.load().catch(() => {}); // start fetching samples right away
      });
      picker.appendChild(b);
    }
    const update = () => {
      const current = Instruments.get();
      picker.querySelectorAll('.inst-btn').forEach((b) => {
        const on = b.dataset.inst === current.id;
        b.classList.toggle('selected', on);
        b.setAttribute('aria-checked', String(on));
      });
      document.getElementById('logo-icon').innerHTML = current.icon;
      document.getElementById('start-icon').innerHTML = current.icon;
    };
    document.addEventListener('instrument-change', update);
    update();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof ABCJS === 'undefined') {
      document.getElementById('lib-error').hidden = false;
      return;
    }
    const params = new URLSearchParams(location.search);
    Settings.applyParams(params);
    cleanUrl(params);
    initMuteButton();
    initInstrumentPicker();
    Settings.init();
    Quiz.init();
  });
})();
