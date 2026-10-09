'use strict';

/* Notenquiz start-up: shared-link settings, personal student link, instrument picker and mute button. */
(() => {
  const CODE_KEY = 'saxnoten.code';
  const APPLIED_KEY = 'saxnoten.assignmentApplied';

  function cleanUrl(params) {
    let changed = false;
    for (const p of [...Settings.PARAMS, 'code']) {
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

  // ---------- Personal student link (?code=…): assignment from and results to the teacher dashboard ----------
  function rememberCode(params) {
    const code = params.get('code');
    if (code && /^[a-z0-9]{12,40}$/i.test(code)) {
      try { localStorage.setItem(CODE_KEY, code); } catch { /* private mode */ }
    }
  }

  async function connectStudent() {
    let code = null;
    try { code = localStorage.getItem(CODE_KEY); } catch { /* private mode */ }
    const online = window.FIREBASE_CONFIG || localStorage.getItem('saxnoten.emulator') === '1';
    if (!code || !online) return;
    let progress;
    let student;
    try {
      progress = await import(new URL('js/progress.js', document.baseURI).href);
      student = await progress.loadStudent(code);
    } catch (err) {
      console.warn('Online features unavailable:', err);
      return; // offline or blocked: the quiz just works locally
    }
    if (!student) {
      // The teacher removed this student: forget the link and the teacher's message.
      localStorage.removeItem(CODE_KEY);
      localStorage.removeItem(APPLIED_KEY + ':' + code);
      Settings.setMessage('');
      return;
    }
    // A new or changed assignment from the teacher replaces the local settings (once).
    const applied = Number(localStorage.getItem(APPLIED_KEY + ':' + code) || 0);
    if (student.assignmentUpdatedAt > applied) {
      const a = student.assignment;
      Instruments.set(student.instrument);
      Settings.set({ low: a.low, high: a.high, sharps: a.sharps, flats: a.flats, count: a.count, autoplay: a.autoplay });
      Settings.setMessage(a.message || '');
      localStorage.setItem(APPLIED_KEY + ':' + code, String(student.assignmentUpdatedAt));
    }
    const badge = document.getElementById('student-badge');
    badge.textContent = '👤 ' + student.name;
    badge.hidden = false;
    document.getElementById('student-note').hidden = false;

    const shared = document.getElementById('result-shared');
    document.addEventListener('quiz-finished', (e) => {
      shared.hidden = false;
      shared.textContent = '📨 Resultaat versturen…';
      const slow = setTimeout(() => { shared.textContent = '📨 Je resultaat wordt verstuurd zodra je weer internet hebt.'; }, 6000);
      progress.sendResult(code, e.detail)
        .then(() => { shared.textContent = '✔ Je leraar kan dit resultaat zien.'; })
        .catch(() => { shared.textContent = 'Het resultaat kon niet verstuurd worden.'; })
        .finally(() => clearTimeout(slow));
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof ABCJS === 'undefined') {
      document.getElementById('lib-error').hidden = false;
      return;
    }
    const params = new URLSearchParams(location.search);
    rememberCode(params);
    Settings.applyParams(params);
    cleanUrl(params);
    initMuteButton();
    initInstrumentPicker();
    Settings.init();
    Quiz.init();
    connectStudent();
  });
})();
