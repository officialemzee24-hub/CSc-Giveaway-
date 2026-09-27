// admin.js - Fail-safe Passcode Gatekeeper

const ADMIN_PASSCODE = "ApexAdmin2026#"; // Make sure this matches what you type exactly

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

      // Read raw value and strip unexpected spaces/invisible characters
      const enteredPasscode = passcodeInput ? passcodeInput.value.trim().replace(/[\u200B-\u200D\uFEFF]/g, "") : "";

      console.log("Entered length:", enteredPasscode.length);
      console.log("Expected length:", ADMIN_PASSCODE.length);

      if (!enteredPasscode) {
        if (passcodeInput) passcodeInput.classList.add("is-invalid");
        return showMsg("Please enter the admin passcode.");
      }

      // Case-sensitive comparison
      if (enteredPasscode === ADMIN_PASSCODE) {
        sessionStorage.setItem("admin_authenticated", "true");
        showMsg("Passcode accepted! Redirecting...", false);
        setTimeout(() => {
          window.location.href = "admin-dashboard.html";
        }, 300);
      } else {
        if (passcodeInput) passcodeInput.classList.add("is-invalid");
        showMsg(`Invalid admin passcode. (Typed ${enteredPasscode.length} chars, expected ${ADMIN_PASSCODE.length})`);
      }
    });
  }
});
