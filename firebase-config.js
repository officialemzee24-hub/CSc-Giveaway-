import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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
