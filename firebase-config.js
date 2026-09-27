import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

export const firebaseConfig = {
  apiKey: "// firebase-config.js
//
// This file connects the app to YOUR Firebase project.
// Replace the values below with the config object from:
// Firebase Console -> Project Settings -> General -> Your apps -> SDK setup and configuration
//
// This is safe to keep in client-side code: it only identifies your project,
// it is not a secret. Security is enforced by Firestore rules, not by hiding this file.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

export const firebaseConfig = {
  apiKey: "AIzaSyAE4nm_U8oHLf7EKptJQoL6ucrtTmAUmcw",
  authDomain: "giveaway-84ec1.firebaseapp.com",
  projectId: "giveaway-84ec1",
  storageBucket: "giveaway-84ec1.firebasestorage.app",
  messagingSenderId: "97978455219",
  appId: "1:97978455219:web:2153d374c34583edafccc6",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
",
  authDomain: "giveaway-84ec1.firebaseapp.com",
  projectId: "giveaway-84ec1",
  storageBucket: "giveaway-84ec1.firebasestorage.app",
  messagingSenderId: "97978455219",
  appId: "1:97978455219:web:2153d374c34583edafccc6",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
