/*
 * Quiz side of the online features: read the student's assignment and send quiz results.
 * Loaded on demand (when a personal link ?code=… was opened or a code was typed in).
 */
import {
  doc, getDoc, addDoc, updateDoc, collection, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { cloud } from './cloud.js';

/** Looks up a code typed by the student; returns the student's personal code, or null when unknown. */
export async function resolveShortCode(short) {
  const { db } = cloud();
  const snap = await getDoc(doc(db, 'codes', short));
  return snap.exists() ? snap.data().studentId : null;
}

/** The student's document, or null when the code doesn't exist (anymore). */
export async function loadStudent(code) {
  const { db } = cloud();
  const snap = await getDoc(doc(db, 'students', code));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    name: data.name,
    instrument: data.instrument,
    shortCode: data.shortCode || '',
    assignment: data.assignment,
    assignmentUpdatedAt: data.assignmentUpdatedAt ? data.assignmentUpdatedAt.toMillis() : 0,
  };
}

/** Resolves when the server has the result; while offline Firestore keeps it and retries. */
export async function sendResult(code, result) {
  const { db } = cloud();
  await addDoc(collection(db, 'students', code, 'results'), { ...result, at: serverTimestamp() });
  await updateDoc(doc(db, 'students', code), { lastResultAt: serverTimestamp() });
}
