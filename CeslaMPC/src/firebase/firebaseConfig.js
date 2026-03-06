// src/firebase/firebaseConfig.js
// ─────────────────────────────────────────────────────────────────────────────
// CESLA MPC — Firebase Configuration
// Replace the firebaseConfig object below with YOUR project's config.
// Get it from: Firebase Console → Project Settings → Your Apps → Web App
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ─── YOUR FIREBASE PROJECT CONFIG ────────────────────────────────────────────
// TODO: Replace these values with your own Firebase project config.
const firebaseConfig = {
  apiKey:          "AIzaSyAfl7O9RunYc6SqBqKD5yt21Bbgp2qhzek",
  authDomain:        "cesla-mpc.firebaseapp.com",
  projectId:         "cesla-mpc",
  storageBucket:     "cesla-mpc.firebasestorage.app",
  messagingSenderId:  "163161704622",
  appId:             "G-ZZR4S341SN",
};

// ─── INITIALIZE FIREBASE (safe: prevent double-init) ─────────────────────────
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ─── AUTH (use AsyncStorage persistence on mobile) ───────────────────────────
let auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e) {
    auth = getAuth(app);
  }
}

// ─── FIRESTORE & STORAGE ─────────────────────────────────────────────────────
const db      = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
