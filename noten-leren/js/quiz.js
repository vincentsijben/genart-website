'use strict';

/* PART 1 – Notenquiz */
const Quiz = (() => {
  const PRAISE = ['Goed zo! 🎉', 'Super! ⭐', 'Top! 👍', 'Helemaal goed! 🎷', 'Knap gedaan! 🌈', 'Yes! 🙌'];
  const RESULT_MESSAGES = {
    3: ['Fantastisch! Jij bent een echte notenkenner! 🏆', 'Wauw, bijna alles goed! Jij kunt dit echt! 🎉'],
    2: ['Goed gedaan! Nog een beetje oefenen en je kent ze allemaal! 💪', 'Mooi zo! Je bent al heel goed op weg! 🌟'],
    1: ['Goed geprobeerd! Oefening baart kunst – probeer het nog een keer! 🎷', 'Elke keer word je beter. Zet hem op! 💖'],
  };

  let el = {};
  let state = null;
  let advanceTimer = null;

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function showPanel(name) {
    ['start', 'play', 'end'].forEach((p) => { el[p].hidden = p !== name; });
  }

  function buildButtons(s) {
    const rows = [Notes.NATURAL_NAMES];
    if (s.sharps) rows.push(Notes.SHARP_NAMES);
    if (s.flats) rows.push(Notes.FLAT_NAMES);
    el.buttons.innerHTML = '';
    for (const row of rows) {
      const div = document.createElement('div');
      div.className = 'answer-row' + (row === Notes.NATURAL_NAMES ? '' : ' acc');
      for (const name of row) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'answer-btn note-' + name[0];
        b.dataset.name = name;
        b.textContent = name;
        b.addEventListener('click', () => answer(name));
        div.appendChild(b);
      }
      el.buttons.appendChild(div);
    }
  }

  /** Disables every quiz control except the "Volgende" button. */
  function setButtonsDisabled(disabled) {
    el.buttons.querySelectorAll('button').forEach((b) => { b.disabled = disabled; });
    el.input.disabled = disabled;
    el.form.querySelector('button').disabled = disabled;
    el.replay.disabled = disabled;
    el.stop.disabled = disabled;
  }

  function play(fromButton = false) {
    if (!state) return;
    if (Sound.isMuted()) {
      if (fromButton) showAudioMsg('Het geluid staat uit. Zet het aan met de knop 🔇 bovenaan.');
      return;
    }
    const note = state.questions[state.i];
    el.replay.classList.add('playing');
    Sound.playWritten(note)
      .then(() => { el.audioMsg.hidden = true; })
      .catch(() => showAudioMsg('Geluid kon niet geladen worden.'))
      .finally(() => setTimeout(() => el.replay.classList.remove('playing'), 600));
  }

  function showAudioMsg(text) {
    el.audioMsg.textContent = text;
    el.audioMsg.hidden = false;
  }

  function renderDots() {
    el.dots.innerHTML = '';
    // Many questions: a progress bar fits better (especially on phones) than a row of dots.
    if (state.questions.length > 20) {
      el.dots.className = 'progress-bar';
      const fill = document.createElement('span');
      fill.style.width = (state.results.length / state.questions.length) * 100 + '%';
      el.dots.appendChild(fill);
      return;
    }
    el.dots.className = 'dots';
    state.questions.forEach((_, i) => {
      const d = document.createElement('span');
      d.className = 'dot';
      if (i < state.results.length) d.classList.add(state.results[i].correct ? 'ok' : 'bad');
      if (i === state.i) d.classList.add('current');
      el.dots.appendChild(d);
    });
  }

  function showQuestion() {
    state.answered = false;
    const note = state.questions[state.i];
    el.progress.textContent = 'Vraag ' + (state.i + 1) + ' van ' + state.questions.length;
    renderDots();
    Staff.renderNote(el.staff, note, { staffwidth: 150 });
    el.feedback.textContent = '';
    el.feedback.className = 'feedback';
    el.next.hidden = true;
    el.audioMsg.hidden = true;
    el.input.value = '';
    el.buttons.querySelectorAll('button').forEach((b) => b.classList.remove('right', 'wrong'));
    setButtonsDisabled(false);
    el.staffCard.classList.remove('pop');
    void el.staffCard.offsetWidth;
    el.staffCard.classList.add('pop');
    if (state.settings.autoplay) play();
    if (window.matchMedia('(pointer: fine)').matches) el.input.focus();
  }

  function start() {
    const s = Settings.get();
    const pool = Notes.pool(s.low, s.high, s.sharps, s.flats);
    if (!pool.length) {
      alert('Er zijn geen noten in het gekozen bereik. Pas de instellingen aan.');
      return;
    }
    state = { settings: s, questions: Notes.sequence(pool, s.count), i: 0, results: [], answered: false };
    buildButtons(s);
    showPanel('play');
    window.scrollTo(0, 0);
    showQuestion();
  }

  function answer(raw) {
    if (!state || state.answered) return;
    const given = Notes.normalizeAnswer(raw);
    if (!given) return;
    if (!Notes.isKnownName(given)) {
      el.feedback.className = 'feedback hint';
      el.feedback.textContent = '🤔 "' + raw + '" ken ik niet. Probeer bijvoorbeeld: c, d, fis of bes.';
      el.input.select();
      return;
    }
    const note = state.questions[state.i];
    const correctName = Notes.dutchName(note);
    const correct = given === correctName;
    state.answered = true;
    state.results.push({ note, given, correct });
    setButtonsDisabled(true);

    const correctBtn = el.buttons.querySelector('[data-name="' + correctName + '"]');
    const givenBtn = el.buttons.querySelector('[data-name="' + given + '"]');
    if (correctBtn) correctBtn.classList.add('right');
    renderDots();

    if (correct) {
      el.feedback.className = 'feedback good';
      el.feedback.textContent = pick(PRAISE);
      advanceTimer = setTimeout(next, 1100);
    } else {
      if (givenBtn) givenBtn.classList.add('wrong');
      el.feedback.className = 'feedback bad';
      el.feedback.innerHTML = 'Oei! Dit is een <strong>' + correctName + '</strong>.';
      el.next.hidden = false;
      el.next.focus();
    }
  }

  function next() {
    clearTimeout(advanceTimer);
    if (!state) return;
    state.i++;
    if (state.i >= state.questions.length) finish();
    else showQuestion();
  }

  function finish() {
    const total = state.results.length;
    const good = state.results.filter((r) => r.correct).length;
    const ratio = total ? good / total : 0;
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;

    el.stars.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.className = 'star' + (i < stars ? ' on' : '');
      s.style.animationDelay = (i * 0.25) + 's';
      s.textContent = '★';
      el.stars.appendChild(s);
    }
    el.score.textContent = good + ' van de ' + total + ' goed';
    el.message.textContent = pick(RESULT_MESSAGES[stars]);

    const seen = new Set();
    const mistakes = state.results
      .filter((r) => !r.correct && !seen.has(Notes.id(r.note)) && seen.add(Notes.id(r.note)))
      .sort((a, b) => a.note.midi - b.note.midi);
    el.mistakes.innerHTML = '';
    el.mistakesWrap.hidden = !mistakes.length;
    for (const m of mistakes) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'mistake-card';
      card.title = 'Luister';
      const staff = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'mistake-name';
      name.textContent = Notes.dutchName(m.note);
      card.append(staff, name);
      card.addEventListener('click', () => Sound.playWritten(m.note).catch(() => {}));
      el.mistakes.appendChild(card);
      Staff.renderNote(staff, m.note, { staffwidth: 110 });
    }

    showPanel('end');
    window.scrollTo(0, 0);
    if (stars === 3) confetti();
    state = null;
  }

  function confetti() {
    const colors = ['#ff5a5f', '#ffb400', '#00a699', '#7b61ff', '#ff7ac6', '#3fa9f5'];
    const layer = document.createElement('div');
    layer.className = 'confetti';
    for (let i = 0; i < 80; i++) {
      const c = document.createElement('i');
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = Math.random() * 0.8 + 's';
      c.style.animationDuration = 2 + Math.random() * 1.5 + 's';
      c.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
      layer.appendChild(c);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 4000);
  }

  function stop() {
    clearTimeout(advanceTimer);
    state = null;
    if (el.start) showPanel('start');
  }

  function init() {
    const $ = (id) => document.getElementById(id);
    el = {
      start: $('quiz-start'), play: $('quiz-play'), end: $('quiz-end'),
      progress: $('quiz-progress'), dots: $('quiz-dots'), staff: $('quiz-staff'), staffCard: $('quiz-staff-card'),
      replay: $('quiz-replay'), stop: $('quiz-stop'), feedback: $('quiz-feedback'), buttons: $('answer-buttons'),
      form: $('answer-form'), input: $('answer-input'), next: $('quiz-next'), audioMsg: $('audio-msg'),
      stars: $('result-stars'), score: $('result-score'), message: $('result-message'),
      mistakes: $('result-mistakes'), mistakesWrap: $('result-mistakes-wrap'),
    };
    $('quiz-start-btn').addEventListener('click', () => {
      Sound.load().catch(() => {});
      start();
    });
    $('quiz-again').addEventListener('click', start);
    el.stop.addEventListener('click', stop);
    $('quiz-settings').addEventListener('click', () => Settings.open());
    el.replay.addEventListener('click', () => play(true));
    document.addEventListener('sound-mute', (e) => { if (!e.detail) el.audioMsg.hidden = true; });
    el.next.addEventListener('click', next);
    el.form.addEventListener('submit', (e) => {
      e.preventDefault();
      answer(el.input.value);
    });
  }

  return { init };
})();
