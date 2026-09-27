// admin.js — admin.html (login only; dashboard logic lives in admin-dashboard.js)

import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const form = document.getElementById("loginForm");
const btn = document.getElementById("loginBtn");
const message = document.getElementById("loginMessage");

function showMessage(text) {
  message.textContent = text;
  message.classList.add("is-visible");
}
function setLoading(isLoading) {
  btn.disabled = isLoading;
  btn.classList.toggle("is-loading", isLoading);
  btn.querySelector(".btn-label").textContent = isLoading ? "Signing in…" : "Sign in";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.classList.remove("is-visible");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  setLoading(true);
  let authenticatedUser = null;
  try {
    // Force browser storage for mobile devices to prevent network rejection
    await setPersistence(auth, browserLocalPersistence);

    const cred = await signInWithEmailAndPassword(auth, email, password);
    authenticatedUser = cred.user;

    const adminRef = doc(db, "admins", authenticatedUser.uid);
    const adminSnap = await getDoc(adminRef);

    console.log("Admin check:", {
      projectId: "giveaway-84ec1",
      uid: authenticatedUser.uid,
      adminDocumentExists: adminSnap.exists(),
      role: adminSnap.exists() ? adminSnap.data().role : null
    });

    if (!adminSnap.exists() || adminSnap.data().role !== "admin") {
      await signOut(auth);
      authenticatedUser = null;
      showMessage("This account does not have administrator access.");
      return;
    }

    window.location.href = "admin-dashboard.html";
  } catch (err) {
    console.error("Admin sign-in error:", err.code, err.message);

    // Never leave a partially-authorized admin session behind.
    if (authenticatedUser) {
      try { await signOut(auth); } catch (signOutErr) {
        console.error("Could not clear failed admin session:", signOutErr);
      }
    }
    const map = {
      "auth/invalid-email": "Enter a valid email address.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/wrong-password": "Incorrect email or password.",
      "auth/user-not-found": "Incorrect email or password.",
      "auth/too-many-requests": "Too many attempts. Try again later.",
    };
    showMessage(map[err.code] || `Could not sign in (${err.code || "no error code — see below"}).`);
  } finally {
    setLoading(false);
  }
});
