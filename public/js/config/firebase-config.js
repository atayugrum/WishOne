/* public/js/config/firebase-config.js */

// --- USE THESE EXACT URLS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js"; // [NEW] Import Storage

const firebaseConfig = {
  apiKey: "AIzaSyC2VwvJV6en5l2Oq1n0WHv2mPaSbPpL-wA",
  authDomain: "wishone-8f785.firebaseapp.com",
  projectId: "wishone-8f785",
  storageBucket: "wishone-8f785.firebasestorage.app",
  messagingSenderId: "216906320360",
  appId: "1:216906320360:web:4a9e27c49d41f00413fc5d",
  measurementId: "G-FJ57127YVY"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const storage = getStorage(app); // [NEW] Initialize Storage

export { db, auth, googleProvider, storage };