// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA2UraSdeBnin5GQm1vyNoFxXoeZLIQCAk",
  authDomain: "cesla-mpc-11cde.firebaseapp.com",
  projectId: "cesla-mpc-11cde",
  storageBucket: "cesla-mpc-11cde.firebasestorage.app",
  messagingSenderId: "752072378625",
  appId: "1:752072378625:web:271aa59d5cec066a4f3300",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export default app;