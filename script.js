// script.js - student landing + registration

import { firebaseConfig, db } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Student authentication setup (non-blocking)
const studentApp = initializeApp(firebaseConfig, "studentApp");
const studentAuth = getAuth(studentApp);

async function ensureAnonymousStudent() {
  if (studentAuth.currentUser?.isAnonymous) return studentAuth.currentUser;
  
  await setPersistence(studentAuth, inMemoryPersistence);
  const credential = await signInAnonymously(studentAuth);
  
  if (!credential.user.isAnonymous) {
    throw new Error("ANONYMOUS_AUTH_REQUIRED");
  }
  return credential.user;
}

// Floating Toast Notification Helper
function showToast(message, type = "error") {
  const existingToast = document.querySelector(".toast-notification");
  if (existingToast) existingToast.remove();

  const toast = document.createElement("div");
  toast.className = `toast-notification toast-${type}`;
  
  const icon = type === "error" 
    ? `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
    : `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`;

  toast.innerHTML = `${icon}<span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-hide");
    toast.addEventListener("transitionend", () => toast.remove());
  }, 3500);
}

// Clear error highlights on input typing/change
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("input", () => input.classList.remove("is-invalid"));
    input.addEventListener("change", () => input.classList.remove("is-invalid"));
  });
});

const scheduleRef = doc(db, "giveawaySettings", "schedule");
let schedule = null;
let countdownTimer = null;

onSnapshot(scheduleRef, (snap) => {
  if (!snap.exists()) {
    renderMissingSchedule();
    return;
  }
  schedule = snap.data();
  updateHeaderStatus();
  updateCapacity();
  startCountdownLoop();
}, () => {
  renderMissingSchedule();
});

function renderMissingSchedule() {
  const headerLabel = document.getElementById("headerStatusLabel");
  const countdownLabel = document.getElementById("countdownLabel");
  const capacityText = document.getElementById("capacityText");
  
  if (headerLabel) headerLabel.textContent = "Schedule not configured";
  if (countdownLabel) countdownLabel.textContent = "Schedule not available";
  if (capacityText) capacityText.textContent = "Capacity information unavailable";
}

function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  return new Date(ts);
}

function computePhase() {
  if (!schedule) return { phase: "unknown" };
  const now = new Date();
  const opening = toDate(schedule.openingDate);
  const closing = toDate(schedule.closingDate);
  const full = (schedule.registeredCount || 0) >= (schedule.maxRegistrants || 0);
  if (schedule.status === "closed") return { phase: "closed" };
  if (full) return { phase: "full" };
  if (opening && now < opening) return { phase: "before", target: opening };
  if (closing && now > closing) return { phase: "closed" };
  if (closing) return { phase: "during", target: closing };
  return { phase: "unknown" };
}

function updateHeaderStatus() {
  const dot = document.getElementById("headerStatusDot");
  const label = document.getElementById("headerStatusLabel");
  if (!dot || !label) return;

  const { phase } = computePhase();
  dot.className = "status-dot";
  const map = {
    before: ["is-soon", "Starting soon"],
    during: ["is-open", "Open"],
    full: ["is-closed", "Full"],
    closed: ["is-closed", "Closed"],
    unknown: ["", "Status unavailable"],
  };
  const [cls, text] = map[phase] || map.unknown;
  if (cls) dot.classList.add(cls);
  label.textContent = text;
}

function updateCapacity() {
  const fill = document.getElementById("capacityFill");
  const textEl = document.getElementById("capacityText");
  if (!fill || !textEl || !schedule) return;

  const max = schedule.maxRegistrants || 0;
  const count = schedule.registeredCount || 0;
  const remaining = Math.max(max - count, 0);
  const pct = max > 0 ? Math.min((count / max) * 100, 100) : 0;
  
  fill.style.width = pct + "%";
  textEl.textContent = max > 0
    ? remaining > 0
      ? `${count} / ${max} registered - ${remaining} spot${remaining === 1 ? "" : "s"} remaining`
      : `${count} / ${max} registered - registration full`
    : "Capacity not set";
}

function startCountdownLoop() {
  if (countdownTimer) clearInterval(countdownTimer);
  renderCountdown();
  updateHeaderStatus();
  countdownTimer = setInterval(() => {
    renderCountdown();
    updateHeaderStatus();
  }, 1000);
}

function renderCountdown() {
  const label = document.getElementById("countdownLabel");
  const days = document.getElementById("ctDays");
  const hours = document.getElementById("ctHours");
  const minutes = document.getElementById("ctMinutes");
  const seconds = document.getElementById("ctSeconds");
  if (!label || !days || !hours || !minutes || !seconds) return;

  const { phase, target } = computePhase();
  if (phase === "full" || phase === "closed") {
    label.textContent = phase === "full" ? "Registration full" : "Registration closed";
    [days, hours, minutes, seconds].forEach((el) => (el.textContent = "00"));
    return;
  }
  if ((phase === "before" || phase === "during") && target) {
    label.textContent = phase === "before" ? "Giveaway opens in" : "Giveaway closes in";
    const diff = Math.max(target.getTime() - Date.now(), 0);
    days.textContent = String(Math.floor(diff / 86400000)).padStart(2, "0");
    hours.textContent = String(Math.floor((diff / 3600000) % 24)).padStart(2, "0");
    minutes.textContent = String(Math.floor((diff / 60000) % 60)).padStart(2, "0");
    seconds.textContent = String(Math.floor((diff / 1000) % 60)).padStart(2, "0");
    return;
  }
  label.textContent = "Schedule unavailable";
}

// Fixed ID matching index.html
const form = document.getElementById("registrationForm");
const submitBtn = document.getElementById("submitBtn");
const formMessage = document.getElementById("formMessage");

function showMessage(text, type = "error") {
  if (formMessage) {
    formMessage.textContent = text;
    formMessage.className = `form-message is-visible is-${type}`;
    formMessage.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  showToast(text, type);
}

function clearMessage() {
  if (!formMessage) return;
  formMessage.className = "form-message";
  formMessage.textContent = "";
}

function normalizeMatric(raw) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

const MATRIC_PATTERN = /^[A-Z0-9/]{4,20}$/;
const PHONE_PATTERN = /^[0-9+ ]{7,15}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();

    const fullNameInput = document.getElementById("fullName");
    const matricNumberInput = document.getElementById("matricNumber");
    const emailInput = document.getElementById("email");
    const phoneInput = document.getElementById("phone");
    const levelInput = document.getElementById("level");

    const fullName = fullNameInput ? fullNameInput.value.trim() : "";
    const matricNumber = matricNumberInput ? normalizeMatric(matricNumberInput.value) : "";
    const email = emailInput ? emailInput.value.trim() : "";
    const phone = phoneInput ? phoneInput.value.trim() : "";
    const level = levelInput ? levelInput.value : "";

    let hasErrors = false;
    let firstErrorMsg = "";

    // Validate Full Name
    if (!fullName) {
      if (fullNameInput) fullNameInput.classList.add("is-invalid");
      hasErrors = true;
      if (!firstErrorMsg) firstErrorMsg = "Please enter your full name.";
    }

    // Validate Matric Number
    if (!MATRIC_PATTERN.test(matricNumber)) {
      if (matricNumberInput) matricNumberInput.classList.add("is-invalid");
      hasErrors = true;
      if (!firstErrorMsg) firstErrorMsg = "Enter a valid matric number.";
    }

    // Validate Email
    if (!EMAIL_PATTERN.test(email)) {
      if (emailInput) emailInput.classList.add("is-invalid");
      hasErrors = true;
      if (!firstErrorMsg) firstErrorMsg = "Enter a valid email address.";
    }

    // Validate Phone
    if (!PHONE_PATTERN.test(phone)) {
      if (phoneInput) phoneInput.classList.add("is-invalid");
      hasErrors = true;
      if (!firstErrorMsg) firstErrorMsg = "Enter a valid phone number.";
    }

    // Validate Level
    if (!level) {
      if (levelInput) levelInput.classList.add("is-invalid");
      hasErrors = true;
      if (!firstErrorMsg) firstErrorMsg = "Please select your level.";
    }

    // If any field failed validation, highlight all of them and show error
    if (hasErrors) {
      const isAllEmpty = !fullName && !matricNumber && !email && !phone && !level;
      const displayMsg = isAllEmpty ? "Please fill in all required fields." : firstErrorMsg;
      return showMessage(displayMsg, "error");
    }

    if (!schedule) return showMessage("Schedule is still loading or unconfigured in Firebase.", "error");

    const { phase } = computePhase();
    if (phase === "before") return showMessage("Registration has not opened yet.", "error");
    if (phase === "closed") return showMessage("Registration is closed.", "error");
    if (phase === "full") return showMessage("Registration is full.", "error");

    // Automatic eligibility rule: Check if matric number contains '514'
    const isEligible = matricNumber.includes("514");

    setLoading(true);
    try {
      const studentUser = await ensureAnonymousStudent();
      console.log("Student anonymous auth ready:", studentUser.uid);

      const regRef = doc(db, "registrations", matricNumber);

      await runTransaction(db, async (tx) => {
        const scheduleSnap = await tx.get(scheduleRef);
        if (!scheduleSnap.exists()) throw new Error("NO_SCHEDULE");

        const existingRegSnap = await tx.get(regRef);
        if (existingRegSnap.exists()) throw new Error("ALREADY_REGISTERED");

        const s = scheduleSnap.data();
        const count = s.registeredCount || 0;
        const max = s.maxRegistrants || 0;
        const now = new Date();
        const opening = toDate(s.openingDate);
        const closing = toDate(s.closingDate);

        if (s.status === "closed") throw new Error("CLOSED");
        if (count >= max) throw new Error("FULL");
        if (opening && now < opening) throw new Error("NOT_OPEN");
        if (closing && now > closing) throw new Error("CLOSED");

        tx.set(regRef, {
          fullName,
          matricNumber,
          email,
          phone,
          department: "Computer Science",
          level,
          registeredAt: serverTimestamp(),
          status: "registered",
          eligible: isEligible,
          accountDetailsSubmitted: false,
        });

        tx.update(scheduleRef, { registeredCount: count + 1 });
      });

      showSuccessModal(fullName, matricNumber, level);
      form.reset();
    } catch (err) {
      console.error("Registration failed:", err);
      if (err.code === "permission-denied") {
        showMessage("Registration was rejected by Firebase security rules. Please check your Firestore rules.", "error");
      } else if (err.code === "auth/operation-not-allowed") {
        showMessage("Anonymous Authentication is disabled in your Firebase Console. Go to Authentication > Sign-in method and enable Anonymous.", "error");
      } else {
        const messages = {
          NO_SCHEDULE: "Registration is not configured in Firebase yet.",
          CLOSED: "Registration is closed.",
          FULL: "Registration is full.",
          NOT_OPEN: "Registration has not opened yet.",
          ALREADY_REGISTERED: "This matric number has already been registered.",
          ANONYMOUS_AUTH_REQUIRED: "Anonymous registration could not be started. Please reload the page.",
        };
        showMessage(messages[err.message] || err.message || "Something went wrong. Please try again.", "error");
      }
    } finally {
      setLoading(false);
    }
  });
}

function setLoading(isLoading) {
  if (!submitBtn) return;
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle("is-loading", isLoading);
  const labelSpan = submitBtn.querySelector(".btn-label");
  if (labelSpan) {
    labelSpan.textContent = isLoading ? "Registering..." : "Register";
  } else {
    submitBtn.textContent = isLoading ? "Registering..." : "Register";
  }
}

const modal = document.getElementById("successModal");
const closeModalBtn = document.getElementById("closeModalBtn");

function showSuccessModal(fullName, matricNumber, level) {
  const summaryName = document.getElementById("summaryName");
  const summaryMatric = document.getElementById("summaryMatric");
  const summaryLevel = document.getElementById("summaryLevel");

  if (summaryName) summaryName.textContent = fullName;
  if (summaryMatric) summaryMatric.textContent = matricNumber;
  if (summaryLevel) summaryLevel.textContent = level;

  if (modal) {
    modal.classList.remove("hidden");
    modal.hidden = false;
  }
}

if (closeModalBtn && modal) {
  closeModalBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
    modal.hidden = true;
  });
}

if (modal) {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.add("hidden");
      modal.hidden = true;
    }
  });
}
