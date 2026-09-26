// account.js - eligibility lookup and account-details submission (Passcode/Direct Mode)

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

const lookupForm = document.getElementById("lookupForm");
const lookupBtn = document.getElementById("lookupBtn");
const lookupMessage = document.getElementById("lookupMessage");
const lookupPanel = document.getElementById("lookupPanel");
const detailsPanel = document.getElementById("detailsPanel");
const successPanel = document.getElementById("successPanel");
const alreadyPanel = document.getElementById("alreadyPanel");
const notEligiblePanel = document.getElementById("notEligiblePanel");
let verifiedMatric = null;

function normalizeMatric(raw) { return raw.trim().toUpperCase().replace(/\s+/g, ""); }

function showLookupMessage(text) {
  if (lookupMessage) {
    lookupMessage.textContent = text;
    lookupMessage.className = "form-message is-visible is-error";
  }
  showToast(text, "error");
}

function setLookupLoading(isLoading) {
  if (!lookupBtn) return;
  lookupBtn.disabled = isLoading;
  lookupBtn.classList.toggle("is-loading", isLoading);
  const label = lookupBtn.querySelector(".btn-label") || lookupBtn;
  label.textContent = isLoading ? "Checking..." : "Check eligibility";
}

if (lookupForm) {
  lookupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (lookupMessage) lookupMessage.className = "form-message";
    
    const lookupMatricInput = document.getElementById("lookupMatric");
    const matricNumber = lookupMatricInput ? normalizeMatric(lookupMatricInput.value) : "";

    if (!matricNumber) {
      if (lookupMatricInput) lookupMatricInput.classList.add("is-invalid");
      return showLookupMessage("Enter your matric number.");
    }

    setLookupLoading(true);
    try {
      const snap = await getDoc(doc(db, "registrations", matricNumber));
      
      if (!snap.exists()) {
        if (lookupMatricInput) lookupMatricInput.classList.add("is-invalid");
        return showLookupMessage("No registration found for this matric number.");
      }

      const data = snap.data();
      if (data.accountDetailsSubmitted) {
        if (lookupPanel) lookupPanel.hidden = true;
        if (alreadyPanel) alreadyPanel.hidden = false;
        return;
      }
      if (!data.eligible) {
        if (lookupPanel) lookupPanel.hidden = true;
        if (notEligiblePanel) notEligiblePanel.hidden = false;
        return;
      }

      verifiedMatric = matricNumber;
      const labelElem = document.getElementById("detailsMatricLabel");
      if (labelElem) labelElem.textContent = matricNumber;

      if (lookupPanel) lookupPanel.hidden = true;
      if (detailsPanel) detailsPanel.hidden = false;
    } catch (err) {
      console.error("Eligibility lookup failed:", err);
      showLookupMessage("Could not check eligibility right now. Please try again.");
    } finally {
      setLookupLoading(false);
    }
  });
}

const detailsForm = document.getElementById("detailsForm");
const detailsBtn = document.getElementById("detailsBtn");
const detailsMessage = document.getElementById("detailsMessage");
const ACCOUNT_NUMBER_PATTERN = /^[0-9]{10}$/;

function showDetailsMessage(text) {
  if (detailsMessage) {
    detailsMessage.textContent = text;
    detailsMessage.className = "form-message is-visible is-error";
  }
  showToast(text, "error");
}

function setDetailsLoading(isLoading) {
  if (!detailsBtn) return;
  detailsBtn.disabled = isLoading;
  detailsBtn.classList.toggle("is-loading", isLoading);
  const label = detailsBtn.querySelector(".btn-label") || detailsBtn;
  label.textContent = isLoading ? "Submitting..." : "Submit account details";
}

if (detailsForm) {
  detailsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (detailsMessage) detailsMessage.className = "form-message";
    
    if (!verifiedMatric) return showDetailsMessage("Please verify your matric number first.");

    const bankNameInput = document.getElementById("bankName");
    const accountNameInput = document.getElementById("accountName");
    const accountNumberInput = document.getElementById("accountNumber");

    const bankName = bankNameInput ? bankNameInput.value.trim() : "";
    const accountName = accountNameInput ? accountNameInput.value.trim() : "";
    const accountNumber = accountNumberInput ? accountNumberInput.value.trim() : "";

    if (!bankName) {
      if (bankNameInput) bankNameInput.classList.add("is-invalid");
      return showDetailsMessage("Enter your bank name.");
    }
    if (!accountName) {
      if (accountNameInput) accountNameInput.classList.add("is-invalid");
      return showDetailsMessage("Enter the account name.");
    }
    if (!ACCOUNT_NUMBER_PATTERN.test(accountNumber)) {
      if (accountNumberInput) accountNumberInput.classList.add("is-invalid");
      return showDetailsMessage("Account number must be exactly 10 digits.");
    }

    setDetailsLoading(true);
    try {
      const accountRef = doc(db, "accountDetails", verifiedMatric);
      const regRef = doc(db, "registrations", verifiedMatric);

      await setDoc(accountRef, {
        bankName,
        accountName,
        accountNumber,
        submittedAt: serverTimestamp(),
      });

      await updateDoc(regRef, { accountDetailsSubmitted: true });

      if (detailsPanel) detailsPanel.hidden = true;
      if (successPanel) {
        successPanel.hidden = false;
      } else if (alreadyPanel) {
        alreadyPanel.hidden = false;
      }
      showToast("Account details submitted successfully!", "success");

    } catch (err) {
      console.error("Account details submission failed:", err);
      showDetailsMessage("Could not submit your details. Please check your connection and try again.");
    } finally {
      setDetailsLoading(false);
    }
  });
}
