// admin.js - Debug Version

const ADMIN_PASSCODE = "1234567890#"; // Set your desired passcode here

document.addEventListener("DOMContentLoaded", () => {
  console.log("admin.js loaded successfully");

  const loginForm = document.getElementById("loginForm");
  const passcodeInput = document.getElementById("passcode");
  const loginMessage = document.getElementById("loginMessage");

  if (!loginForm) {
    console.error("Error: loginForm element not found!");
    return;
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    console.log("Form submit caught!");

    const enteredPasscode = passcodeInput ? passcodeInput.value.trim() : "";

    if (!enteredPasscode) {
      if (loginMessage) {
        loginMessage.textContent = "Please enter the admin passcode.";
        loginMessage.className = "form-message is-visible is-error";
      } else {
        alert("Please enter the admin passcode.");
      }
      return;
    }

    if (enteredPasscode === ADMIN_PASSCODE) {
      sessionStorage.setItem("admin_authenticated", "true");
      console.log("Passcode correct. Redirecting...");
      window.location.href = "admin-dashboard.html";
    } else {
      if (loginMessage) {
        loginMessage.textContent = "Invalid admin passcode.";
        loginMessage.className = "form-message is-visible is-error";
      } else {
        alert("Invalid admin passcode.");
      }
    }
  });
});
