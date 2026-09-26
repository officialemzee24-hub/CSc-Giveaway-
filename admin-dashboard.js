// admin-dashboard.js — Clean direct init

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  getDocs,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// ---------------- Auth guard & Direct Bypass ----------------

const authGate = document.getElementById("authGate");
const dashboard = document.getElementById("dashboard");

if (authGate) authGate.hidden = true;
if (dashboard) dashboard.hidden = false;

// Initialize dashboard immediately
initDashboard();

onAuthStateChanged(auth, (user) => {
  if (user) {
    const emailEl = document.getElementById("adminEmail");
    if (emailEl) emailEl.textContent = user.email;
  }
});

document.getElementById("signOutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "admin.html";
});

// ---------------- Dashboard state ----------------

let registrations = []; // [{id, ...data}]
let schedule = null;
let dashboardInitialized = false;

function initDashboard() {
  if (dashboardInitialized) return;
  dashboardInitialized = true;

  // Listen to registrations with error callback
  onSnapshot(
    collection(db, "registrations"),
    (snap) => {
      registrations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderStats();
      renderTable();
    },
    (err) => {
      console.error("Registrations snapshot error:", err);
      alert("Error loading registrations: " + (err.message || err.code));
    }
  );

  // Listen to giveaway schedule settings with error callback
  onSnapshot(
    doc(db, "giveawaySettings", "schedule"),
    (snap) => {
      schedule = snap.exists() ? snap.data() : null;
      renderScheduleSummary();
      renderStats();
    },
    (err) => {
      console.error("Schedule snapshot error:", err);
    }
  );

  wireScheduleForm();
  wireFilters();
  wireModal();
  wireExports();
}

// ---------------- Stats ----------------

function renderStats() {
  const total = registrations.length;
  const eligible = registrations.filter((r) => r.status === "eligible" || (r.eligible && r.status !== "processed")).length;
  const submitted = registrations.filter((r) => r.accountDetailsSubmitted).length;
  const processed = registrations.filter((r) => r.status === "processed").length;
  const max = schedule?.maxRegistrants || 0;
  const remaining = Math.max(max - (schedule?.registeredCount ?? total), 0);

  document.getElementById("statTotal").textContent = total;
  document.getElementById("statEligible").textContent = eligible;
  document.getElementById("statSubmitted").textContent = submitted;
  document.getElementById("statProcessed").textContent = processed;
  document.getElementById("statRemaining").textContent = max ? remaining : "—";

  ["100 Level", "200 Level", "300 Level", "400 Level"].forEach((level) => {
    const key = "lvl" + level.split(" ")[0];
    const count = registrations.filter((r) => r.level === level).length;
    const el = document.getElementById(key);
    if (el) el.textContent = count;
  });
}

// ---------------- Schedule control ----------------

function toLocalInputValue(date) {
  if (!date) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDate(ts) {
  if (!ts) return null;
  return typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
}

let scheduleFormPopulated = false;

function renderScheduleSummary() {
  const statusEl = document.getElementById("summaryStatus");
  const openingEl = document.getElementById("summaryOpening");
  const closingEl = document.getElementById("summaryClosing");
  const capacityEl = document.getElementById("summaryCapacity");
  const registeredEl = document.getElementById("summaryRegistered");
  const remainingEl = document.getElementById("summaryRemaining");

  if (!schedule) {
    [statusEl, openingEl, closingEl, capacityEl, registeredEl, remainingEl].forEach((el) => (el.textContent = "Not set"));
    return;
  }

  const opening = toDate(schedule.openingDate);
  const closing = toDate(schedule.closingDate);
  const count = schedule.registeredCount || 0;
  const max = schedule.maxRegistrants || 0;

  let derivedStatus = schedule.status === "closed" ? "Closed" : "Open";
  if (schedule.status !== "closed") {
    const now = new Date();
    if (opening && now < opening) derivedStatus = "Starting soon";
    else if (closing && now > closing) derivedStatus = "Closed (schedule ended)";
    else if (count >= max && max > 0) derivedStatus = "Full";
  }

  statusEl.textContent = derivedStatus;
  openingEl.textContent = opening ? opening.toLocaleString() : "Not set";
  closingEl.textContent = closing ? closing.toLocaleString() : "Not set";
  capacityEl.textContent = max || "Not set";
  registeredEl.textContent = count;
  remainingEl.textContent = max ? Math.max(max - count, 0) : "—";

  if (!scheduleFormPopulated) {
    document.getElementById("maxRegistrants").value = max || "";
    document.getElementById("openingDate").value = toLocalInputValue(opening);
    document.getElementById("closingDate").value = toLocalInputValue(closing);
    scheduleFormPopulated = true;
  }
}

function wireScheduleForm() {
  const form = document.getElementById("scheduleForm");
  const message = document.getElementById("scheduleMessage");
  const saveBtn = document.getElementById("saveScheduleBtn");
  const openBtn = document.getElementById("openBtn");
  const closeBtn = document.getElementById("closeBtn");

  function showMessage(text, type) {
    message.textContent = text;
    message.className = `form-message is-visible is-${type}`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const max = parseInt(document.getElementById("maxRegistrants").value, 10);
    const openingVal = document.getElementById("openingDate").value;
    const closingVal = document.getElementById("closingDate").value;

    if (!max || max < 1) return showMessage("Enter a valid maximum registrant count.", "error");
    if (!openingVal || !closingVal) return showMessage("Set both opening and closing dates.", "error");

    const opening = new Date(openingVal);
    const closing = new Date(closingVal);
    if (closing <= opening) return showMessage("Closing date must be after the opening date.", "error");

    saveBtn.disabled = true;
    saveBtn.classList.add("is-loading");
    try {
      await updateDoc(doc(db, "giveawaySettings", "schedule"), {
        maxRegistrants: max,
        openingDate: Timestamp.fromDate(opening),
        closingDate: Timestamp.fromDate(closing),
        status: "scheduled"
      });
      showMessage("Schedule saved.", "info");
    } catch (err) {
      showMessage("Could not save schedule. Please try again.", "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.classList.remove("is-loading");
    }
  });

  openBtn.addEventListener("click", async () => {
    try {
      await updateDoc(doc(db, "giveawaySettings", "schedule"), { status: "open" });
      showMessage("Giveaway marked open.", "info");
    } catch (err) {
      showMessage("Could not update status.", "error");
    }
  });

  closeBtn.addEventListener("click", async () => {
    try {
      await updateDoc(doc(db, "giveawaySettings", "schedule"), { status: "closed" });
      showMessage("Giveaway marked closed.", "info");
    } catch (err) {
      showMessage("Could not update status.", "error");
    }
  });
}

// ---------------- Table: search, filter, render ----------------

let filters = { search: "", level: "", status: "", account: "" };

function wireFilters() {
  document.getElementById("searchInput").addEventListener("input", (e) => {
    filters.search = e.target.value.trim().toLowerCase();
    renderTable();
  });
  document.getElementById("levelFilter").addEventListener("change", (e) => {
    filters.level = e.target.value;
    renderTable();
  });
  document.getElementById("statusFilter").addEventListener("change", (e) => {
    filters.status = e.target.value;
    renderTable();
  });
  document.getElementById("accountFilter").addEventListener("change", (e) => {
    filters.account = e.target.value;
    renderTable();
  });
}

function getFiltered() {
  return registrations.filter((r) => {
    if (filters.search) {
      const haystack = `${r.fullName || ""} ${r.matricNumber || ""}`.toLowerCase();
      if (!haystack.includes(filters.search)) return false;
    }
    if (filters.level && r.level !== filters.level) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (filters.account === "submitted" && !r.accountDetailsSubmitted) return false;
    if (filters.account === "notSubmitted" && r.accountDetailsSubmitted) return false;
    return true;
  });
}

function statusBadge(status) {
  const map = {
    registered: ["badge-registered", "Registered"],
    eligible: ["badge-eligible", "Eligible"],
    notEligible: ["badge-notEligible", "Not eligible"],
    processed: ["badge-processed", "Processed"],
  };
  const [cls, label] = map[status] || ["badge-registered", status || "—"];
  return `<span class="badge ${cls}">${label}</span>`;
}

function accountBadge(submitted) {
  return submitted
    ? `<span class="badge badge-yes">Submitted</span>`
    : `<span class="badge badge-no">Not submitted</span>`;
}

function formatDate(ts) {
  const d = toDate(ts);
  return d ? d.toLocaleDateString() : "—";
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderTable() {
  const list = getFiltered();
  const tbody = document.getElementById("regTableBody");
  const cardsWrap = document.getElementById("regCards");
  const emptyState = document.getElementById("tableEmptyState");

  emptyState.hidden = list.length > 0;

  tbody.innerHTML = list
    .map(
      (r) => `
    <tr>
      <td>${escapeHtml(r.fullName)}</td>
      <td class="mono">${escapeHtml(r.matricNumber)}</td>
      <td>${escapeHtml(r.email)}</td>
      <td>${escapeHtml(r.phone)}</td>
      <td>${escapeHtml(r.level)}</td>
      <td>${statusBadge(r.status)}</td>
      <td>${r.eligible ? '<span class="badge badge-yes">Eligible</span>' : '<span class="badge badge-no">Pending</span>'}</td>
      <td>${accountBadge(r.accountDetailsSubmitted)}</td>
      <td>${formatDate(r.registeredAt)}</td>
      <td><button class="link-btn" data-view="${escapeHtml(r.id)}">View</button></td>
    </tr>`
    )
    .join("");

  cardsWrap.innerHTML = list
    .map(
      (r) => `
    <div class="reg-card">
      <h4>${escapeHtml(r.fullName)}</h4>
      <div class="mono">${escapeHtml(r.matricNumber)}</div>
      <div class="reg-card-row"><span>${escapeHtml(r.level)}</span><span>${formatDate(r.registeredAt)}</span></div>
      <div class="reg-card-badges">
        ${statusBadge(r.status)}
        ${r.eligible ? '<span class="badge badge-yes">Eligible</span>' : '<span class="badge badge-no">Pending</span>'}
        ${accountBadge(r.accountDetailsSubmitted)}
      </div>
      <div class="reg-card-row"><button class="link-btn" data-view="${escapeHtml(r.id)}">View details</button></div>
    </div>`
    )
    .join("");

  tbody.querySelectorAll("[data-view]").forEach((btn) =>
    btn.addEventListener("click", () => openDetailModal(btn.dataset.view))
  );
  cardsWrap.querySelectorAll("[data-view]").forEach((btn) =>
    btn.addEventListener("click", () => openDetailModal(btn.dataset.view))
  );
}

// ---------------- Detail modal ----------------

let currentModalId = null;

function wireModal() {
  document.getElementById("closeDetailModal").addEventListener("click", closeDetailModal);
  document.getElementById("detailModal").addEventListener("click", (e) => {
    if (e.target.id === "detailModal") closeDetailModal();
  });
  document.getElementById("markEligibleBtn").addEventListener("click", () => updateStatus("eligible", true));
  document.getElementById("markNotEligibleBtn").addEventListener("click", () => updateStatus("notEligible", false));
  document.getElementById("markProcessedBtn").addEventListener("click", () => updateStatus("processed", true));
}

async function openDetailModal(id) {
  const r = registrations.find((x) => x.id === id);
  if (!r) return;
  currentModalId = id;

  let accountFields = "";
  try {
    const accSnap = await getDoc(doc(db, "accountDetails", id));
    if (accSnap.exists()) {
      const a = accSnap.data();
      accountFields = `
        <div><dt>Bank name</dt><dd>${escapeHtml(a.bankName)}</dd></div>
        <div><dt>Account name</dt><dd>${escapeHtml(a.accountName)}</dd></div>
        <div><dt>Account number</dt><dd class="mono">${escapeHtml(a.accountNumber)}</dd></div>`;
    }
  } catch (err) {
    // Admin reads should succeed under security rules
  }

  document.getElementById("detailModalTitle").textContent = r.fullName || "Student details";
  document.getElementById("detailList").innerHTML = `
    <div><dt>Full name</dt><dd>${escapeHtml(r.fullName)}</dd></div>
    <div><dt>Matric number</dt><dd>${escapeHtml(r.matricNumber)}</dd></div>
    <div><dt>Email</dt><dd>${escapeHtml(r.email)}</dd></div>
    <div><dt>Phone</dt><dd>${escapeHtml(r.phone)}</dd></div>
    <div><dt>Department</dt><dd>${escapeHtml(r.department)}</dd></div>
    <div><dt>Level</dt><dd>${escapeHtml(r.level)}</dd></div>
    <div><dt>Registered</dt><dd>${formatDate(r.registeredAt)}</dd></div>
    <div><dt>Status</dt><dd>${r.status || "—"}</dd></div>
    ${accountFields}
  `;
  document.getElementById("detailModal").hidden = false;
}

function closeDetailModal() {
  document.getElementById("detailModal").hidden = true;
  currentModalId = null;
}

async function updateStatus(status, eligible) {
  if (!currentModalId) return;
  try {
    await updateDoc(doc(db, "registrations", currentModalId), { status, eligible });
    closeDetailModal();
  } catch (err) {
    alert("Could not update this student's status. Please try again.");
  }
}

// ---------------- CSV export ----------------

function toCsv(rows, columns) {
  const escapeCell = (val) => {
    const s = String(val ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => c.label).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(",")).join("\n");
  return header + "\n" + body;
}

function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function wireExports() {
  document.getElementById("exportRegistrationsBtn").addEventListener("click", () => {
    const csv = toCsv(registrations, [
      { label: "Full Name", value: (r) => r.fullName },
      { label: "Matric Number", value: (r) => r.matricNumber },
      { label: "Email", value: (r) => r.email },
      { label: "Phone", value: (r) => r.phone },
      { label: "Level", value: (r) => r.level },
      { label: "Status", value: (r) => r.status },
      { label: "Eligible", value: (r) => (r.eligible ? "Yes" : "No") },
      { label: "Account Details Submitted", value: (r) => (r.accountDetailsSubmitted ? "Yes" : "No") },
      { label: "Registered At", value: (r) => formatDate(r.registeredAt) },
    ]);
    downloadCsv("registrations.csv", csv);
  });

  document.getElementById("exportAccountsBtn").addEventListener("click", async () => {
    try {
      const snap = await getDocs(collection(db, "accountDetails"));
      const rows = snap.docs.map((d) => ({ matricNumber: d.id, ...d.data() }));
      const csv = toCsv(rows, [
        { label: "Matric Number", value: (r) => r.matricNumber },
        { label: "Bank Name", value: (r) => r.bankName },
        { label: "Account Name", value: (r) => r.accountName },
        { label: "Account Number", value: (r) => r.accountNumber },
        { label: "Submitted At", value: (r) => formatDate(r.submittedAt) },
      ]);
      downloadCsv("account-details.csv", csv);
    } catch (err) {
      alert("Could not export account details. Please try again.");
    }
  });
}
