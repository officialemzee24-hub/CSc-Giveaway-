// admin.js - Fail-Safe Passcode Gatekeeper

const ADMIN_PASSCODE = "123456"; // Try 123456 first to verify

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const passcodeInput = document.getElementById("passcode");
  const loginMessage = document.getElementById("loginMessage");

  function showMsg(text, isError = true) {
    if (loginMessage) {
      loginMessage.textContent = text;
      loginMessage.className = `form-message is-visible ${isError ? 'is-error' : 'is-success'}`;
    } else {
      alert(text);
    }
  }

  if (passcodeInput) {
    passcodeInput.addEventListener("input", () => {
      passcodeInput.classList.remove("is-invalid");
      if (loginMessage) loginMessage.className = "form-message";
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();

      // Clean input string from invisible whitespace
      const rawInput = passcodeInput ? passcodeInput.value : "";
      const enteredPasscode = rawInput.trim().replace(/[\u200B-\u200D\uFEFF]/g, "");

      if (!enteredPasscode) {
        if (passcodeInput) passcodeInput.classList.add("is-invalid");
        return showMsg("Please enter the admin passcode.");
      }

      // Check passcode
      if (enteredPasscode === ADMIN_PASSCODE) {
        sessionStorage.setItem("admin_authenticated", "true");
        showMsg("Passcode accepted! Redirecting...", false);
        setTimeout(() => {
          window.location.href = "admin-dashboard.html";
        }, 300);
      } else {
        if (passcodeInput) passcodeInput.classList.add("is-invalid");
        showMsg(`Invalid passcode. Received "${enteredPasscode}" (${enteredPasscode.length} chars). Expected ${ADMIN_PASSCODE.length} chars.`);
      }
    });
  }
});
