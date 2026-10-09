/*
 * Firebase connection shared by the quiz (js/progress.js) and the teacher dashboard.
 * Uses the config from js/firebase-config.js, or the local emulators when
 * localStorage 'saxnoten.emulator' is '1' (for development only).
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator,
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';

const EMULATOR_CONFIG = { apiKey: 'demo-key', authDomain: 'demo-noten.firebaseapp.com', projectId: 'demo-noten', appId: 'demo-app' };

let cached = null;

export function usingEmulator() {
  try { return localStorage.getItem('saxnoten.emulator') === '1'; } catch { return false; }
}

export function isConfigured() {
  return usingEmulator() || Boolean(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.projectId);
}

/** { app, db, auth } – created on first use. */
export function cloud() {
  if (cached) return cached;
  if (!isConfigured()) throw new Error('Firebase is not configured (js/firebase-config.js).');
  const emulator = usingEmulator();
  const app = initializeApp(emulator ? EMULATOR_CONFIG : window.FIREBASE_CONFIG);
  // Local cache: results are kept and sent later when the student is offline.
  const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  const auth = getAuth(app);
  if (emulator) {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  cached = { app, db, auth };
  return cached;
}
