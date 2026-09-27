// admin-dashboard.js - Admin Management Dashboard (Passcode Session Mode)

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 1. Session Guard (Redirect immediately if passcode session is missing)
if (sessionStorage.getItem("admin_authenticated") !== "true") {
  window.location.href = "admin.html";
}

// Floating Toast Notification Helper
function showToast(message, type = "error") {
  const existingToast = document.querySelector(".toast-notification");
  if (existingToast) existingToast.remove();

  const toast = document.createElement("div");
  toast.className = `toast-notification toast-${type}`;

  const icon =
    type === "error"
      ? `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
      : `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`;

  toast.innerHTML = `${icon}<span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-hide");
    toast.addEventListener("transitionend", () => toast.remove());
  }, 3500);
}

// 2. Global State & DOM References
let registrationsCache = [];
let accountDetailsCache = new Map();
let currentFilter = "all";
let currentSearch = "";

const logoutBtn = document.getElementById("logoutBtn");
const scheduleForm = document.getElementById("scheduleForm");
const maxRegistrantsInput = document.getElementById("maxRegistrants");
const openingDateInput = document.getElementById("openingDate");
const closingDateInput = document.getElementById("closingDate");
const statusOverrideSelect = document.getElementById("statusOverride");
const scheduleSaveBtn = document.getElementById("scheduleSaveBtn");

const totalRegisteredEl = document.getElementById("totalRegistered");
const totalEligibleEl = document.getElementById("totalEligible");
const totalSubmittedAccountEl = document.getElementById("totalSubmittedAccount");

const searchInput = document.getElementById("searchInput");
const filterPills = document.querySelectorAll(".filter-pill");
const registrantsTableBody = document.getElementById("registrantsTableBody");
const exportCsvBtn = document.getElementById("exportCsvBtn");

// 3. Logout Action
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("admin_authenticated");
    window.location.href = "admin.html";
  });
}

// 4. Load & Manage Schedule Settings
const scheduleRef = doc(db, "giveawaySettings", "schedule");

async function loadScheduleSettings() {
  try {
    const snap = await getDoc(scheduleRef);
    if (snap.exists()) {
      const data = snap.data();
      if (maxRegistrantsInput) maxRegistrantsInput.value = data.maxRegistrants || 100;
      if (openingDateInput && data.openingDate) {
        openingDateInput.value = formatForDatetimeLocal(data.openingDate);
      }
      if (closingDateInput && data.closingDate) {
        closingDateInput.value = formatForDatetimeLocal(data.closingDate);
      }
      if (statusOverrideSelect) statusOverrideSelect.value = data.status || "auto";
    }
  } catch (err) {
    console.error("Error loading schedule settings:", err);
    showToast("Failed to load schedule settings.", "error");
  }
}

function formatForDatetimeLocal(ts) {
  const date = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

if (scheduleForm) {
  scheduleForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (scheduleSaveBtn) {
      scheduleSaveBtn.disabled = true;
      scheduleSaveBtn.textContent = "Saving...";
    }

    try {
      const maxVal = parseInt(maxRegistrantsInput.value, 10) || 0;
      const openVal = openingDateInput.value ? new Date(openingDateInput.value) : null;
      const closeVal = closingDateInput.value ? new Date(closingDateInput.value) : null;
      const statusVal = statusOverrideSelect.value;

      await setDoc(
        scheduleRef,
        {
          maxRegistrants: maxVal,
          openingDate: openVal ? Timestamp.fromDate(openVal) : null,
          closingDate: closeVal ? Timestamp.fromDate(closeVal) : null,
          status: statusVal,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      showToast("Schedule settings saved successfully!", "success");
    } catch (err) {
      console.error("Error saving schedule settings:", err);
      showToast("Could not save schedule settings.", "error");
    } finally {
      if (scheduleSaveBtn) {
        scheduleSaveBtn.disabled = false;
        scheduleSaveBtn.textContent = "Save Schedule Settings";
      }
    }
  });
}

// 5. Real-Time Listeners for Registrations & Account Details
function initRealtimeListeners() {
  // Listen to Account Details Collection
  const accountsCol = collection(db, "accountDetails");
  onSnapshot(accountsCol, (snapshot) => {
    accountDetailsCache.clear();
    snapshot.forEach((docSnap) => {
      accountDetailsCache.set(docSnap.id, docSnap.data());
    });
    renderDashboard();
  }, (err) => {
    console.error("Error fetching account details:", err);
  });

  // Listen to Registrations Collection
  const regCol = collection(db, "registrations");
  const q = query(regCol, orderBy("registeredAt", "desc"));

  onSnapshot(q, (snapshot) => {
    registrationsCache = [];
    snapshot.forEach((docSnap) => {
      registrationsCache.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderDashboard();
  }, (err) => {
    console.error("Error fetching registrations:", err);
    showToast("Error loading registrants data.", "error");
  });
}

// 6. UI Rendering & Metrics Calculation
function renderDashboard() {
  // Compute Metrics
  const totalReg = registrationsCache.length;
  const totalEligible = registrationsCache.filter((r) => r.eligible).length;
  const totalSubmitted = registrationsCache.filter((r) => r.accountDetailsSubmitted).length;

  if (totalRegisteredEl) totalRegisteredEl.textContent = totalReg;
  if (totalEligibleEl) totalEligibleEl.textContent = totalEligible;
  if (totalSubmittedAccountEl) totalSubmittedAccountEl.textContent = totalSubmitted;

  // Filter Table Data
  let filtered = registrationsCache.filter((item) => {
    if (currentFilter === "eligible" && !item.eligible) return false;
    if (currentFilter === "submitted" && !item.accountDetailsSubmitted) return false;
    if (currentFilter === "ineligible" && item.eligible) return false;

    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      const name = (item.fullName || "").toLowerCase();
      const matric = (item.matricNumber || "").toLowerCase();
      const email = (item.email || "").toLowerCase();
      const phone = (item.phone || "").toLowerCase();
      return name.includes(q) || matric.includes(q) || email.includes(q) || phone.includes(q);
    }
    return true;
  });

  renderTable(filtered);
}

function renderTable(data) {
  if (!registrantsTableBody) return;
  registrantsTableBody.innerHTML = "";

  if (data.length === 0) {
    registrantsTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted, #888); padding: 2rem;">
          No registrants found matching criteria.
        </td>
      </tr>`;
    return;
  }

  data.forEach((item) => {
    const tr = document.createElement("tr");
    const accountInfo = accountDetailsCache.get(item.matricNumber);

    const bankDetailsHtml = accountInfo
      ? `<div style="font-size: 0.85rem;">
           <strong>${escapeHtml(accountInfo.bankName || "N/A")}</strong><br/>
           <code>${escapeHtml(accountInfo.accountNumber || "")}</code><br/>
           <span style="color: #666;">${escapeHtml(accountInfo.accountName || "")}</span>
         </div>`
      : `<span style="color: #aaa; font-style: italic;">Not Submitted</span>`;

    const statusBadge = item.eligible
      ? `<span class="badge badge-success">Eligible</span>`
      : `<span class="badge badge-danger">Ineligible</span>`;

    tr.innerHTML = `
      <td><strong>${escapeHtml(item.fullName || "N/A")}</strong></td>
      <td><code>${escapeHtml(item.matricNumber || "N/A")}</code></td>
      <td>${escapeHtml(item.email || "N/A")}<br/><small>${escapeHtml(item.phone || "")}</small></td>
      <td>${escapeHtml(item.level || "N/A")}</td>
      <td>${statusBadge}</td>
      <td>${bankDetailsHtml}</td>
      <td>
        <button class="btn-action toggle-eligibility-btn" data-matric="${item.matricNumber}" data-eligible="${item.eligible}">
          ${item.eligible ? "Mark Ineligible" : "Mark Eligible"}
        </button>
        <button class="btn-action btn-danger delete-btn" data-matric="${item.matricNumber}">
          Delete
        </button>
      </td>
    `;
    registrantsTableBody.appendChild(tr);
  });

  attachTableActionListeners();
}

function attachTableActionListeners() {
  document.querySelectorAll(".toggle-eligibility-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const matric = btn.getAttribute("data-matric");
      const currentStatus = btn.getAttribute("data-eligible") === "true";
      try {
        await updateDoc(doc(db, "registrations", matric), {
          eligible: !currentStatus,
        });
        showToast(`Eligibility updated for ${matric}`, "success");
      } catch (err) {
        console.error("Error toggling eligibility:", err);
        showToast("Could not update eligibility.", "error");
      }
    });
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const matric = btn.getAttribute("data-matric");
      if (confirm(`Are you sure you want to delete registration for ${matric}?`)) {
        try {
          await deleteDoc(doc(db, "registrations", matric));
          await deleteDoc(doc(db, "accountDetails", matric));
          showToast(`Deleted ${matric} successfully.`, "success");
        } catch (err) {
          console.error("Error deleting document:", err);
          showToast("Failed to delete record.", "error");
        }
      }
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 7. Search & Filter Handlers
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    currentSearch = e.target.value.trim();
    renderDashboard();
  });
}

filterPills.forEach((pill) => {
  pill.addEventListener("click", () => {
    filterPills.forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    currentFilter = pill.getAttribute("data-filter") || "all";
    renderDashboard();
  });
});

// 8. CSV Export
if (exportCsvBtn) {
  exportCsvBtn.addEventListener("click", () => {
    if (registrationsCache.length === 0) {
      return showToast("No registration data available to export.", "error");
    }

    const headers = [
      "Full Name",
      "Matric Number",
      "Email",
      "Phone",
      "Level",
      "Eligible",
      "Account Submitted",
      "Bank Name",
      "Account Number",
      "Account Name",
    ];

    const rows = registrationsCache.map((item) => {
      const acc = accountDetailsCache.get(item.matricNumber) || {};
      return [
        `"${item.fullName || ""}"`,
        `"${item.matricNumber || ""}"`,
        `"${item.email || ""}"`,
        `"${item.phone || ""}"`,
        `"${item.level || ""}"`,
        item.eligible ? "YES" : "NO",
        item.accountDetailsSubmitted ? "YES" : "NO",
        `"${acc.bankName || ""}"`,
        `"${acc.accountNumber || ""}"`,
        `"${acc.accountName || ""}"`,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `giveaway_registrations_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  });
}

// 9. Startup Initialization
document.addEventListener("DOMContentLoaded", () => {
  loadScheduleSettings();
  initRealtimeListeners();
});
