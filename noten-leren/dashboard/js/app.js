/*
 * Teacher dashboard: sign in, manage students and their assignment, follow their progress.
 * Data model and access rules: firebase/firestore.rules.
 */
import { cloud, isConfigured, usingEmulator } from '../../js/cloud.js';
import {
  onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut,
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limit, getDocs,
  serverTimestamp, writeBatch, Timestamp,
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';

const $ = (id) => document.getElementById(id);
const VIEWS = ['setup', 'loading', 'signin', 'denied', 'main'];
const DAY = 24 * 60 * 60 * 1000;

let db;
let auth;
let user = null;
let students = [];
let selected = null;
let results = [];

function show(view) {
  VIEWS.forEach((v) => { $('view-' + v).hidden = v !== view; });
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function message(id, text, isError = false) {
  const box = $(id);
  box.textContent = text || '';
  box.hidden = !text;
  box.classList.toggle('error', isError);
}

const inst = (id) => Instruments.byId(id) || Instruments.byId(Instruments.DEFAULT_ID);
const toDate = (ts) => (ts && ts.toDate ? ts.toDate() : null);

function ago(ts) {
  const d = toDate(ts);
  if (!d) return 'not practised yet';
  const days = Math.floor((startOfToday() - startOfDay(d)) / DAY);
  if (days <= 0) return 'practised today';
  if (days === 1) return 'practised yesterday';
  if (days < 14) return `practised ${days} days ago`;
  return 'practised on ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function startOfToday() {
  return startOfDay(new Date());
}

function pctClass(p) {
  return p >= 90 ? 'good' : p >= 60 ? 'mid' : 'low';
}

function noteLabel(id) {
  try {
    const n = Notes.parse(id);
    return { dutch: Notes.dutchName(n), label: Notes.label(n) };
  } catch {
    return { dutch: id, label: id };
  }
}

function randomCode() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'; // no look-alikes (l/1, o/0)
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

function studentLink(code) {
  return new URL('../?code=' + code, location.href).href;
}

function authError(err) {
  const map = {
    'auth/invalid-credential': 'Wrong e-mail address or password.',
    'auth/wrong-password': 'Wrong e-mail address or password.',
    'auth/user-not-found': 'There is no account with this e-mail address. Use "Create account".',
    'auth/email-already-in-use': 'There already is an account with this e-mail address. Sign in instead.',
    'auth/weak-password': 'Choose a password of at least 8 characters.',
    'auth/invalid-email': 'This is not a valid e-mail address.',
    'auth/popup-closed-by-user': 'The sign-in window was closed.',
    'auth/popup-blocked': 'The browser blocked the sign-in window. Allow pop-ups for this site and try again.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase yet (see docs/firebase-setup.md).',
    'auth/unauthorized-domain': 'This website address is not allowed yet: add it in Firebase under Authentication → Settings → Authorized domains.',
    'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  };
  return map[err.code] || err.message || String(err);
}

// ------------------------------------------------------------------ sign in / access
async function checkAccess() {
  $('db-user').textContent = user.email || '';
  $('db-signout').hidden = false;
  $('db-verify').hidden = true;
  message('db-denied-msg', '');
  if (!user.emailVerified) {
    $('db-denied-text').textContent = `Your e-mail address (${user.email}) is not verified yet. Click the link in the verification e-mail, then click "Try again".`;
    $('db-verify').hidden = false;
    show('denied');
    return;
  }
  try {
    await getDoc(doc(db, 'config', 'teachers'));
  } catch {
    $('db-denied-text').textContent = `${user.email} is not on the teacher list yet. In the Firebase console, open Firestore → config → teachers and add this address to "emails". Then click "Try again".`;
    show('denied');
    return;
  }
  show('main');
  await loadStudents();
}

function initSignIn() {
  $('db-google').addEventListener('click', async () => {
    message('db-signin-msg', '');
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      message('db-signin-msg', authError(err), true);
    }
  });
  const form = $('db-email-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    message('db-signin-msg', '');
    try {
      await signInWithEmailAndPassword(auth, form.email.value.trim(), form.password.value);
    } catch (err) {
      message('db-signin-msg', authError(err), true);
    }
  });
  $('db-signup').addEventListener('click', async () => {
    message('db-signin-msg', '');
    if (!form.reportValidity()) return;
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email.value.trim(), form.password.value);
      await sendEmailVerification(cred.user);
      message('db-signin-msg', 'Account created. We sent you a verification e-mail: click the link in it, then click "Try again".');
    } catch (err) {
      message('db-signin-msg', authError(err), true);
    }
  });
  $('db-reset').addEventListener('click', async () => {
    const email = form.email.value.trim();
    if (!email) {
      message('db-signin-msg', 'Fill in your e-mail address first.', true);
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      message('db-signin-msg', 'If this address has an account, you will receive an e-mail to choose a new password.');
    } catch (err) {
      message('db-signin-msg', authError(err), true);
    }
  });
  $('db-signout').addEventListener('click', () => signOut(auth));
  $('db-verify').addEventListener('click', async () => {
    try {
      await sendEmailVerification(user);
      message('db-denied-msg', 'Verification e-mail sent. Click the link in it, then click "Try again".');
    } catch (err) {
      message('db-denied-msg', authError(err), true);
    }
  });
  $('db-retry').addEventListener('click', async () => {
    await user.reload();
    await user.getIdToken(true);
    user = auth.currentUser;
    checkAccess();
  });
}

// ------------------------------------------------------------------ students
async function loadStudents() {
  const snap = await getDocs(query(collection(db, 'students'), where('teacherId', '==', user.uid)));
  students = snap.docs.map((d) => ({ code: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  renderStudentList();
  if (selected && students.some((s) => s.code === selected)) selectStudent(selected);
  else if (selected) {
    selected = null;
    $('db-student').hidden = true;
    $('db-empty').hidden = false;
  }
}

function renderStudentList() {
  const list = $('db-students');
  list.innerHTML = '';
  $('db-no-students').hidden = students.length > 0;
  for (const s of students) {
    const li = el('li');
    const b = el('button');
    b.type = 'button';
    if (s.code === selected) b.classList.add('selected');
    const icon = el('span', 'db-st-icon');
    icon.innerHTML = inst(s.instrument).icon;
    const main = el('span', 'db-st-main');
    main.append(el('span', 'db-st-name', s.name), el('span', 'db-st-sub', inst(s.instrument).shortEn + ' · ' + ago(s.lastResultAt)));
    const last = toDate(s.lastResultAt);
    const days = last ? (startOfToday() - startOfDay(last)) / DAY : Infinity;
    const dot = el('span', 'db-dot' + (days <= 2 ? ' recent' : days <= 7 ? ' week' : ''));
    dot.title = ago(s.lastResultAt);
    b.append(icon, main, dot);
    b.addEventListener('click', () => selectStudent(s.code));
    li.appendChild(b);
    list.appendChild(li);
  }
}

function defaultAssignment(instrumentId) {
  const i = inst(instrumentId);
  return { low: i.defaultLow, high: i.defaultHigh, sharps: false, flats: false, count: 10, autoplay: true, message: '' };
}

async function addStudent(name, instrument) {
  const code = randomCode();
  await setDoc(doc(db, 'students', code), {
    teacherId: user.uid,
    name,
    instrument,
    assignment: defaultAssignment(instrument),
    assignmentUpdatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  selected = code;
  await loadStudents();
}

// ------------------------------------------------------------------ one student
async function selectStudent(code) {
  selected = code;
  const s = students.find((x) => x.code === code);
  if (!s) return;
  renderStudentList();
  $('db-empty').hidden = true;
  $('db-student').hidden = false;
  $('db-s-icon').innerHTML = inst(s.instrument).icon;
  $('db-s-name').textContent = s.name;
  $('db-s-link').value = studentLink(code);
  $('db-open').href = studentLink(code);
  $('db-copy-msg').textContent = '';
  $('db-save-msg').textContent = '';
  writeAssignment(s);
  results = [];
  renderProgress();
  const snap = await getDocs(query(collection(db, 'students', code, 'results'), orderBy('at', 'desc'), limit(200)));
  if (selected !== code) return;
  results = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => r.at);
  renderProgress();
}

function fillRangeSelects(form, instrumentId, low, high) {
  const ids = inst(instrumentId).rangeIds;
  Notes.fillRangeSelect(form.low, low, ids);
  Notes.fillRangeSelect(form.high, high, ids);
  if (!form.low.value) form.low.value = inst(instrumentId).defaultLow;
  if (!form.high.value) form.high.value = inst(instrumentId).defaultHigh;
}

function writeAssignment(s) {
  const f = $('db-assignment');
  const a = { ...defaultAssignment(s.instrument), ...s.assignment };
  f.name.value = s.name;
  f.instrument.value = s.instrument;
  fillRangeSelects(f, s.instrument, a.low, a.high);
  f.sharps.checked = a.sharps;
  f.flats.checked = a.flats;
  f.count.value = a.count;
  f.autoplay.checked = a.autoplay;
  f.message.value = a.message;
  updatePool();
}

function readAssignment() {
  const f = $('db-assignment');
  const i = inst(f.instrument.value);
  const range = Notes.sanitizeRange(f.low.value, f.high.value, i.defaultLow, i.defaultHigh, i.rangeIds);
  return {
    name: f.name.value.trim().slice(0, 40),
    instrument: i.id,
    assignment: {
      low: range.low,
      high: range.high,
      sharps: f.sharps.checked,
      flats: f.flats.checked,
      count: Math.min(100, Math.max(1, Math.round(Number(f.count.value)) || 10)),
      autoplay: f.autoplay.checked,
      message: f.message.value.trim().slice(0, 200),
    },
  };
}

function updatePool() {
  const { assignment } = readAssignment();
  $('db-pool').textContent = Notes.poolSummary(assignment);
}

function renderProgress() {
  renderStats();
  renderChart();
  renderMistakes();
  renderTable();
}

function pct(r) {
  return Math.round((r.correct / r.count) * 100);
}

function renderStats() {
  const box = $('db-stats');
  box.innerHTML = '';
  const now = Date.now();
  const week = results.filter((r) => now - toDate(r.at).getTime() < 7 * DAY);
  const last10 = results.slice(0, 10);
  const avg = last10.length ? Math.round(last10.reduce((sum, r) => sum + pct(r), 0) / last10.length) : null;
  const questions = results.reduce((sum, r) => sum + r.count, 0);
  const s = students.find((x) => x.code === selected);
  const stats = [
    [week.length, 'sessions in the last 7 days'],
    [results.length, 'sessions in total' + (results.length >= 200 ? ' (latest 200)' : '')],
    [avg == null ? '–' : avg + '%', 'average of the last 10'],
    [questions, 'questions answered'],
    [s ? ago(s.lastResultAt).replace('practised ', '') : '–', 'last practised'],
  ];
  for (const [value, label] of stats) {
    const card = el('div', 'db-stat');
    card.append(el('b', null, String(value)), el('span', null, label));
    box.appendChild(card);
  }
}

function renderChart() {
  const box = $('db-chart');
  box.innerHTML = '';
  const data = results.slice(0, 20).reverse();
  if (!data.length) return;
  const W = 600;
  const H = 150;
  const pad = 22;
  const bw = Math.min(40, (W - pad) / data.length - 6);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H + 18}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Score per session (%)');
  const add = (name, attrs, text) => {
    const n = document.createElementNS(ns, name);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (text != null) n.textContent = text;
    svg.appendChild(n);
    return n;
  };
  for (const g of [0, 50, 100]) {
    const y = H - (g / 100) * (H - 10);
    add('line', { x1: pad, x2: W, y1: y, y2: y, class: 'grid' });
    add('text', { x: 0, y: y + 3 }, g + '%');
  }
  data.forEach((r, i) => {
    const p = pct(r);
    const x = pad + 4 + i * ((W - pad) / data.length);
    const h = Math.max(2, (p / 100) * (H - 10));
    const bar = add('rect', { x, y: H - h, width: bw, height: h, rx: 4, class: 'bar ' + pctClass(p) });
    const d = toDate(r.at);
    const t = document.createElementNS(ns, 'title');
    t.textContent = `${d.toLocaleString('en-GB')}: ${r.correct}/${r.count} (${p}%)`;
    bar.appendChild(t);
    add('text', { x: x + bw / 2, y: H + 13, 'text-anchor': 'middle' }, d.getDate() + '/' + (d.getMonth() + 1));
  });
  box.appendChild(svg);
}

function renderMistakes() {
  const box = $('db-mistakes');
  box.innerHTML = '';
  const counts = new Map();
  for (const r of results.slice(0, 50)) {
    for (const m of r.mistakes || []) {
      const entry = counts.get(m.note) || { note: m.note, n: 0, given: new Map() };
      entry.n++;
      entry.given.set(m.given, (entry.given.get(m.given) || 0) + 1);
      counts.set(m.note, entry);
    }
  }
  const top = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 10);
  if (!top.length) {
    box.appendChild(el('p', 'small', results.length ? 'No mistakes in the latest sessions. 🎉' : 'No results yet.'));
    return;
  }
  const wrap = el('div', 'db-miss');
  for (const t of top) {
    const { dutch, label } = noteLabel(t.note);
    const [given] = [...t.given.entries()].sort((a, b) => b[1] - a[1])[0];
    const item = el('div', 'db-miss-item');
    item.append(el('b', null, dutch), document.createTextNode(` (${label}) – ${t.n}× wrong, mostly answered “${given}”`));
    wrap.appendChild(item);
  }
  box.appendChild(wrap);
  box.appendChild(el('p', 'small', 'Based on the latest 50 sessions.'));
}

function renderTable() {
  const table = $('db-results');
  table.innerHTML = '';
  $('db-no-results').hidden = results.length > 0;
  if (!results.length) return;
  const head = el('tr');
  ['Date', 'Instrument', 'Range', '♯ / ♭', 'Score', '%', 'Time'].forEach((h) => head.appendChild(el('th', null, h)));
  table.appendChild(head);
  for (const r of results.slice(0, 30)) {
    const tr = el('tr');
    const d = toDate(r.at);
    const p = pct(r);
    const secs = Math.round(r.durationSec || 0);
    const cells = [
      d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      inst(r.instrument).shortEn,
      r.low + '–' + r.high,
      [r.sharps ? '♯' : '', r.flats ? '♭' : ''].join(' ').trim() || '–',
      r.correct + '/' + r.count,
    ];
    cells.forEach((c) => tr.appendChild(el('td', null, c)));
    tr.appendChild(el('td', 'db-pct ' + pctClass(p), p + '%'));
    tr.appendChild(el('td', null, Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0')));
    table.appendChild(tr);
  }
}

async function deleteResults(code, olderThan) {
  const constraints = olderThan ? [where('at', '<', Timestamp.fromDate(olderThan))] : [];
  let deleted = 0;
  for (;;) {
    const snap = await getDocs(query(collection(db, 'students', code, 'results'), ...constraints, limit(400)));
    if (snap.empty) break;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < 400) break;
  }
  return deleted;
}

// ------------------------------------------------------------------ start
function initMain() {
  for (const select of [$('db-add').instrument, $('db-assignment').instrument]) {
    for (const i of Instruments.LIST) select.add(new Option(i.nameEn, i.id));
  }
  $('db-add').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const name = f.name.value.trim();
    if (!name) return;
    try {
      await addStudent(name.slice(0, 40), f.instrument.value);
      f.name.value = '';
    } catch (err) {
      alert('Could not add the student: ' + err.message);
    }
  });

  const af = $('db-assignment');
  af.addEventListener('input', updatePool);
  af.instrument.addEventListener('change', () => {
    const i = inst(af.instrument.value);
    fillRangeSelects(af, i.id, i.defaultLow, i.defaultHigh);
    updatePool();
  });
  af.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = readAssignment();
    if (!data.name) return;
    if (!Notes.pool(data.assignment.low, data.assignment.high, data.assignment.sharps, data.assignment.flats).length) {
      $('db-save-msg').textContent = 'There are no notes in this range.';
      return;
    }
    $('db-save-msg').textContent = 'Saving…';
    try {
      await updateDoc(doc(db, 'students', selected), { ...data, assignmentUpdatedAt: serverTimestamp() });
      await loadStudents();
      $('db-save-msg').textContent = 'Saved ✔';
    } catch (err) {
      $('db-save-msg').textContent = 'Could not save: ' + err.message;
    }
  });

  $('db-copy').addEventListener('click', async () => {
    const link = $('db-s-link').value;
    try {
      await navigator.clipboard.writeText(link);
      $('db-copy-msg').textContent = 'Copied ✔';
    } catch {
      $('db-s-link').select();
      $('db-copy-msg').textContent = 'Press Cmd+C to copy.';
    }
  });

  $('db-del-results').addEventListener('click', async () => {
    const s = students.find((x) => x.code === selected);
    if (!s || !confirm(`Delete all results of ${s.name}?`)) return;
    await deleteResults(s.code);
    selectStudent(s.code);
  });
  $('db-del-student').addEventListener('click', async () => {
    const s = students.find((x) => x.code === selected);
    if (!s || !confirm(`Delete ${s.name} and all their results? Their personal link stops working.`)) return;
    await deleteResults(s.code);
    await deleteDoc(doc(db, 'students', s.code));
    selected = null;
    $('db-student').hidden = true;
    $('db-empty').hidden = false;
    await loadStudents();
  });
  $('db-cleanup').addEventListener('click', async () => {
    if (!confirm('Delete all results older than 12 months, for all your students?')) return;
    const cutoff = new Date(Date.now() - 365 * DAY);
    let total = 0;
    for (const s of students) total += await deleteResults(s.code, cutoff);
    const msg = $('db-cleanup-msg');
    msg.textContent = `${total} old result(s) deleted.`;
    msg.hidden = false;
    if (selected) selectStudent(selected);
  });
}

function start() {
  if (!isConfigured()) {
    show('setup');
    return;
  }
  ({ db, auth } = cloud());
  $('db-emulator').hidden = !usingEmulator();
  initSignIn();
  initMain();
  onAuthStateChanged(auth, (u) => {
    user = u;
    selected = null;
    if (!u) {
      $('db-user').textContent = '';
      $('db-signout').hidden = true;
      show('signin');
      return;
    }
    show('loading');
    checkAccess().catch((err) => {
      $('db-denied-text').textContent = 'Something went wrong: ' + err.message;
      show('denied');
    });
  });
}

start();
