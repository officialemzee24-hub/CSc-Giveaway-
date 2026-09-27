// admin-dashboard.js — admin-dashboard.html

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  getDocs,
  Timestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// ---------------- Auth guard ----------------

const authGate = document.getElementById("authGate");
const dashboard = document.getElementById("dashboard");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "admin.html";
    return;
  }
  try {
    const adminSnap = await getDoc(doc(db, "admins", user.uid));
    if (!adminSnap.exists() || adminSnap.data().role !== "admin") {
      await signOut(auth);
      window.location.href = "admin.html";
      return;
    }
            const adminEmailEl = document.getElementById("adminEmail");
    if (adminEmailEl) adminEmailEl.textContent = user.email;
    
    // 1. Completely remove the loading element from the DOM
    if (authGate) authGate.remove();
    
    // 2. Reveal the dashboard
    if (dashboard) dashboard.hidden = false;
    
    initDashboard();
  } catch (err) {

    if (authGate) {
      authGate.textContent = "Could not verify admin access. Please sign in again.";
    }
  }

const signOutBtn = document.getElementById("signOutBtn");
if (signOutBtn) {
  signOutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "admin.html";
  });
}

// ---------------- Dashboard state ----------------

let registrations = []; // [{id, ...data}]
let accountDetailsMap = {}; // { id/matric: {...accountData} }
let schedule = null;
let dashboardInitialized = false;

function initDashboard() {
  if (dashboardInitialized) return;
  dashboardInitialized = true;

  // Real-time listener for registrations
  onSnapshot(collection(db, "registrations"), (snap) => {
    registrations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderStats();
    renderTable();
  });

  // Real-time listener for account details
  onSnapshot(collection(db, "accountDetails"), (snap) => {
    accountDetailsMap = {};
    snap.forEach((d) => {
      accountDetailsMap[d.id] = d.data();
    });
    renderTable();
  });

  // Real-time listener for schedule settings
  onSnapshot(doc(db, "giveawaySettings", "schedule"), (snap) => {
    schedule = snap.exists() ? snap.data() : null;
    renderScheduleSummary();
    renderStats();
  });

  wireScheduleForm();
  wireFilters();
  wireModal();
  wireExports();
}

// ---------------- Stats ----------------

function renderStats() {
  const total = registrations.length;
  const eligible = registrations.filter(
    (r) => r.status === "eligible" || (r.eligible && r.status !== "processed")
  ).length;
  const submitted = registrations.filter((r) => r.accountDetailsSubmitted).length;
  const processed = registrations.filter((r) => r.status === "processed").length;
  const max = schedule?.maxRegistrants || 0;
  const remaining = Math.max(max - (schedule?.registeredCount ?? total), 0);

  setText("statTotal", total);
  setText("statEligible", eligible);
  setText("statSubmitted", submitted);
  setText("statProcessed", processed);
  setText("statRemaining", max ? remaining : "—");

  ["100 Level", "200 Level", "300 Level", "400 Level"].forEach((level) => {
    const key = "lvl" + level.split(" ")[0];
    const count = registrations.filter(
      (r) => r.level === level || r.level === `${level.split(" ")[0]}`
    ).length;
    setText(key, count);
  });
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ---------------- Schedule control ----------------

function toLocalInputValue(date) {
  if (!date) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
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
    [statusEl, openingEl, closingEl, capacityEl, registeredEl, remainingEl].forEach(
      (el) => el && (el.textContent = "Not set")
    );
    return;
  }

  const opening = toDate(schedule.openingDate);
  const closing = toDate(schedule.closingDate);
  const count = schedule.registeredCount ?? registrations.length;
  const max = schedule.maxRegistrants || 0;

  let derivedStatus = schedule.status === "closed" ? "Closed" : "Open";
  if (schedule.status !== "closed") {
    const now = new Date();
    if (opening && now < opening) derivedStatus = "Starting soon";
    else if (closing && now > closing) derivedStatus = "Closed (schedule ended)";
    else if (count >= max && max > 0) derivedStatus = "Full";
  }

  if (statusEl) statusEl.textContent = derivedStatus;
  if (openingEl) openingEl.textContent = opening ? opening.toLocaleString() : "Not set";
  if (closingEl) closingEl.textContent = closing ? closing.toLocaleString() : "Not set";
  if (capacityEl) capacityEl.textContent = max || "Not set";
  if (registeredEl) registeredEl.textContent = count;
  if (remainingEl) remainingEl.textContent = max ? Math.max(max - count, 0) : "—";

  if (!scheduleFormPopulated) {
    const maxInput = document.getElementById("maxRegistrants");
    const openInput = document.getElementById("openingDate");
    const closeInput = document.getElementById("closingDate");

    if (maxInput) maxInput.value = max || "";
    if (openInput) openInput.value = toLocalInputValue(opening);
    if (closeInput) closeInput.value = toLocalInputValue(closing);
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
    if (!message) return;
    message.textContent = text;
    message.className = `form-message is-visible is-${type}`;
  }

  if (form) {
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

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.classList.add("is-loading");
      }

      try {
        await setDoc(
          doc(db, "giveawaySettings", "schedule"),
          {
            maxRegistrants: max,
            openingDate: Timestamp.fromDate(opening),
            closingDate: Timestamp.fromDate(closing),
            status: "scheduled",
          },
          { merge: true }
        );
        showMessage("Schedule saved.", "info");
      } catch (err) {
        showMessage("Could not save schedule. Please try again.", "error");
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.classList.remove("is-loading");
        }
      }
    });
  }

  if (openBtn) {
    openBtn.addEventListener("click", async () => {
      try {
        await setDoc(doc(db, "giveawaySettings", "schedule"), { status: "open" }, { merge: true });
        showMessage("Giveaway marked open.", "info");
      } catch (err) {
        showMessage("Could not update status.", "error");
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", async () => {
      try {
        await setDoc(doc(db, "giveawaySettings", "schedule"), { status: "closed" }, { merge: true });
        showMessage("Giveaway marked closed.", "info");
      } catch (err) {
        showMessage("Could not update status.", "error");
      }
    });
  }
}

// ---------------- Table: search, filter, render ----------------

let filters = { search: "", level: "", status: "", account: "" };

function wireFilters() {
  document.getElementById("searchInput")?.addEventListener("input", (e) => {
    filters.search = e.target.value.trim().toLowerCase();
    renderTable();
  });
  document.getElementById("levelFilter")?.addEventListener("change", (e) => {
    filters.level = e.target.value;
    renderTable();
  });
  document.getElementById("statusFilter")?.addEventListener("change", (e) => {
    filters.status = e.target.value;
    renderTable();
  });
  document.getElementById("accountFilter")?.addEventListener("change", (e) => {
    filters.account = e.target.value;
    renderTable();
  });
}

function getFiltered() {
  return registrations.filter((r) => {
    const acc = accountDetailsMap[r.id] || accountDetailsMap[r.matricNumber] || {};

    if (filters.search) {
      const haystack = `${r.fullName || ""} ${r.matricNumber || ""} ${r.email || ""} ${r.phone || ""} ${
        acc.bankName || ""
      } ${acc.accountNumber || ""} ${acc.accountName || ""}`.toLowerCase();
      if (!haystack.includes(filters.search)) return false;
    }

    if (filters.level && r.level !== filters.level) return false;
    if (filters.status && (r.status || "registered") !== filters.status) return false;
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
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
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
  return String(str ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function renderTable() {
  const list = getFiltered();
  const tbody = document.getElementById("regTableBody");
  const cardsWrap = document.getElementById("regCards");
  const emptyState = document.getElementById("tableEmptyState");

  if (!tbody) return;

  if (emptyState) emptyState.hidden = list.length > 0;

  tbody.innerHTML = list
    .map((r) => {
      const acc = accountDetailsMap[r.id] || accountDetailsMap[r.matricNumber];
      const accountCell = acc
        ? `<div>
            <strong>${escapeHtml(acc.bankName)}</strong><br/>
            <span class="mono">${escapeHtml(acc.accountNumber)}</span>
            <button class="btn btn-ghost copy-btn" style="padding:2px 6px; font-size:11px;" data-copy="${escapeHtml(
              acc.accountNumber
            )}">Copy</button>
           </div>`
        : `<span class="text-muted">Not submitted</span>`;

      return `
    <tr>
      <td><strong>${escapeHtml(r.fullName)}</strong></td>
      <td class="mono">${escapeHtml(r.matricNumber)}</td>
      <td>${escapeHtml(r.email)}</td>
      <td>${escapeHtml(r.phone)}</td>
      <td>${escapeHtml(r.level)}</td>
      <td>${statusBadge(r.status)}</td>
      <td>${
        r.eligible
          ? '<span class="badge badge-yes">Eligible</span>'
          : '<span class="badge badge-no">Pending</span>'
      }</td>
      <td>${accountCell}</td>
      <td>${formatDate(r.registeredAt)}</td>
      <td><button class="link-btn" data-view="${escapeHtml(r.id)}">View</button></td>
    </tr>`;
    })
    .join("");

  if (cardsWrap) {
    cardsWrap.innerHTML = list
      .map((r) => {
        const acc = accountDetailsMap[r.id] || accountDetailsMap[r.matricNumber];
        return `
      <div class="reg-card">
        <h4>${escapeHtml(r.fullName)}</h4>
        <div class="mono">${escapeHtml(r.matricNumber)}</div>
        <div class="reg-card-row"><span>${escapeHtml(r.level)}</span><span>${formatDate(
          r.registeredAt
        )}</span></div>
        <div class="reg-card-badges">
          ${statusBadge(r.status)}
          ${
            r.eligible
              ? '<span class="badge badge-yes">Eligible</span>'
              : '<span class="badge badge-no">Pending</span>'
          }
          ${accountBadge(r.accountDetailsSubmitted)}
        </div>
        <p style="margin: 8px 0; font-size:13px;"><strong>Bank:</strong> ${
          acc
            ? `${escapeHtml(acc.bankName)} - <span class="mono">${escapeHtml(acc.accountNumber)}</span>`
            : "Not submitted"
        }</p>
        <div class="reg-card-row"><button class="link-btn" data-view="${escapeHtml(
          r.id
        )}">View details</button></div>
      </div>`;
      })
      .join("");
  }

  // Attach event listeners
  document.querySelectorAll("[data-view]").forEach((btn) =>
    btn.addEventListener("click", () => openDetailModal(btn.dataset.view))
  );

  document.querySelectorAll("[data-copy]").forEach((btn) =>
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(btn.dataset.copy);
      const originalText = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = originalText), 1500);
    })
  );
}

// ---------------- Detail modal ----------------

let currentModalId = null;

function wireModal() {
  document.getElementById("closeDetailModal")?.addEventListener("click", closeDetailModal);
  document.getElementById("detailModal")?.addEventListener("click", (e) => {
    if (e.target.id === "detailModal") closeDetailModal();
  });
  document.getElementById("markEligibleBtn")?.addEventListener("click", () => updateStatus("eligible", true));
  document.getElementById("markNotEligibleBtn")?.addEventListener("click", () => updateStatus("notEligible", false));
  document.getElementById("markProcessedBtn")?.addEventListener("click", () => updateStatus("processed", true));
}

async function openDetailModal(id) {
  const r = registrations.find((x) => x.id === id);
  if (!r) return;
  currentModalId = id;

  let acc = accountDetailsMap[id] || accountDetailsMap[r.matricNumber];

  if (!acc) {
    try {
      const accSnap = await getDoc(doc(db, "accountDetails", id));
      if (accSnap.exists()) acc = accSnap.data();
    } catch (err) {
      // Ignored: fallback to unsubmitted UI state
    }
  }

  const accountFields = acc
    ? `
      <div><dt>Bank name</dt><dd>${escapeHtml(acc.bankName)}</dd></div>
      <div><dt>Account name</dt><dd>${escapeHtml(acc.accountName)}</dd></div>
      <div><dt>Account number</dt><dd class="mono">${escapeHtml(acc.accountNumber)}</dd></div>`
    : `<div><dt>Bank account</dt><dd class="text-muted">Not submitted</dd></div>`;

  const modalTitle = document.getElementById("detailModalTitle");
  const detailList = document.getElementById("detailList");
  const modal = document.getElementById("detailModal");

  if (modalTitle) modalTitle.textContent = r.fullName || "Student details";
  if (detailList) {
    detailList.innerHTML = `
      <div><dt>Full name</dt><dd>${escapeHtml(r.fullName)}</dd></div>
      <div><dt>Matric number</dt><dd class="mono">${escapeHtml(r.matricNumber)}</dd></div>
      <div><dt>Email</dt><dd>${escapeHtml(r.email)}</dd></div>
      <div><dt>Phone</dt><dd>${escapeHtml(r.phone)}</dd></div>
      <div><dt>Department</dt><dd>${escapeHtml(r.department || "Computer Science")}</dd></div>
      <div><dt>Level</dt><dd>${escapeHtml(r.level)}</dd></div>
      <div><dt>Registered</dt><dd>${formatDate(r.registeredAt)}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(r.status)}</dd></div>
      ${accountFields}
    `;
  }
  if (modal) modal.hidden = false;
}

function closeDetailModal() {
  const modal = document.getElementById("detailModal");
  if (modal) modal.hidden = true;
  currentModalId = null;
}

async function updateStatus(status, eligible) {
  if (!currentModalId) return;
  try {
    await updateDoc(doc(db, "registrations", currentModalId), {
      status,
      eligible,
      updatedAt: Timestamp.now(),
    });
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
  document.getElementById("exportRegistrationsBtn")?.addEventListener("click", () => {
    const csv = toCsv(registrations, [
      { label: "Full Name", value: (r) => r.fullName },
      { label: "Matric Number", value: (r) => r.matricNumber },
      { label: "Email", value: (r) => r.email },
      { label: "Phone", value: (r) => r.phone },
      { label: "Level", value: (r) => r.level },
      { label: "Status", value: (r) => r.status || "registered" },
      { label: "Eligible", value: (r) => (r.eligible ? "Yes" : "No") },
      { label: "Account Details Submitted", value: (r) => (r.accountDetailsSubmitted ? "Yes" : "No") },
      { label: "Registered At", value: (r) => formatDate(r.registeredAt) },
    ]);
    downloadCsv("Giveaway_Registrations.csv", csv);
  });

  document.getElementById("exportAccountsBtn")?.addEventListener("click", async () => {
    try {
      const snap = await getDocs(collection(db, "accountDetails"));
      const rows = snap.docs.map((d) => ({ matricNumber: d.id, ...d.data() }));
      const csv = toCsv(rows, [
        { label: "Matric Number", value: (r) => r.matricNumber || r.id },
        { label: "Bank Name", value: (r) => r.bankName },
        { label: "Account Name", value: (r) => r.accountName },
        { label: "Account Number", value: (r) => r.accountNumber },
        { label: "Submitted At", value: (r) => formatDate(r.submittedAt) },
      ]);
      downloadCsv("Giveaway_Payout_Accounts.csv", csv);
    } catch (err) {
      alert("Could not export account details. Please try again.");
    }
  });
}
