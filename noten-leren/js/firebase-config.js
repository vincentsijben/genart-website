'use strict';

/*
 * Firebase project settings for the online features (personal student links + teacher dashboard).
 * These values are public by design; the Firestore security rules (firebase/firestore.rules) protect the data.
 * Set to null to switch the online features off (the quiz then works exactly as before).
 */
window.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB_WRednPde-3dT1KcTLe8V1oThlPW3pSg',
  authDomain: 'noten-leren-es3fr.firebaseapp.com',
  projectId: 'noten-leren-es3fr',
  storageBucket: 'noten-leren-es3fr.firebasestorage.app',
  messagingSenderId: '337838896360',
  appId: '1:337838896360:web:44ac21d2a57f82dc7f055d'
};
