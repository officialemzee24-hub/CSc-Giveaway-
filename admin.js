// admin.js - Passcode Gatekeeper

const ADMIN_PASSCODE = "ApexAdmin2026#"; // Set your secret admin passcode here

const loginForm = document.getElementById("loginForm");
const passcodeInput = document.getElementById("passcode");
const loginBtn = document.getElementById("loginBtn");
const loginMessage = document.getElementById("loginMessage");

function showMessage(text, type = "error") {
  if (loginMessage) {
    loginMessage.textContent = text;
    loginMessage.className = `form-message is-visible is-${type}`;
  }
}

function clearMessage() {
  if (loginMessage) {
    loginMessage.textContent = "";
    loginMessage.className = "form-message";
  }
}

if (loginForm) {
  // Clear error highlight as user types
  if (passcodeInput) {
    passcodeInput.addEventListener("input", () => {
      passcodeInput.classList.remove("is-invalid");
      clearMessage();
    });
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    clearMessage();

    const enteredPasscode = passcodeInput ? passcodeInput.value.trim() : "";

    if (!enteredPasscode) {
      if (passcodeInput) passcodeInput.classList.add("is-invalid");
      return showMessage("Please enter the admin passcode.", "error");
    }

    if (enteredPasscode === ADMIN_PASSCODE) {
      sessionStorage.setItem("admin_authenticated", "true");
      window.location.href = "admin-dashboard.html";
    } else {
      if (passcodeInput) passcodeInput.classList.add("is-invalid");
      showMessage("Invalid admin passcode.", "error");
    }
  });
}
