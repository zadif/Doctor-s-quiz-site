// Auth page functionality

// Toggle password visibility
function togglePassword(fieldId) {
  const field = document.getElementById(fieldId);
  const toggle = field.nextElementSibling.querySelector("i");

  if (field.type === "password") {
    field.type = "text";
    toggle.classList.remove("fa-eye-slash");
    toggle.classList.add("fa-eye");
  } else {
    field.type = "password";
    toggle.classList.remove("fa-eye");
    toggle.classList.add("fa-eye-slash");
  }
}

// Form validation
document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector(".auth-form");
  if (!form) return;

  // Real-time password validation for signup
  const passwordField = document.getElementById("password");
  const confirmPasswordField = document.getElementById("confirmPassword");

  if (passwordField && confirmPasswordField) {
    // Password strength indicator
    passwordField.addEventListener("input", function () {
      validatePasswordStrength(this.value);
    });

    // Confirm password validation
    confirmPasswordField.addEventListener("input", function () {
      validatePasswordMatch(passwordField.value, this.value);
    });
  }

  // Form submission
  form.addEventListener("submit", function (e) {
    if (!validateForm()) {
      e.preventDefault();
    }
  });
});

function validatePasswordStrength(password) {
  const requirements = document.querySelector(".password-requirements");
  if (!requirements) return;

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[@$!%*?&]/.test(password);
  const hasLength = password.length >= 8;
  const notTooLong = password.length <= 128;

  const isStrong =
    hasUpper && hasLower && hasNumber && hasSpecial && hasLength && notTooLong;

  if (password.length > 0) {
    if (isStrong) {
      requirements.innerHTML =
        '<small class="text-success"><i class="fas fa-check me-1"></i>Password meets requirements</small>';
    } else {
      let missing = [];
      if (!hasLength) missing.push("8+ characters");
      if (!notTooLong) missing.push("max 128 characters");
      if (!hasUpper) missing.push("uppercase letter");
      if (!hasLower) missing.push("lowercase letter");
      if (!hasNumber) missing.push("number");
      if (!hasSpecial) missing.push("special character (@$!%*?&)");

      requirements.innerHTML = `<small class="text-warning"><i class="fas fa-exclamation-triangle me-1"></i>Missing: ${missing.join(
        ", "
      )}</small>`;
    }
  } else {
    requirements.innerHTML =
      '<small class="text-muted">Password must contain at least 6 characters with uppercase, lowercase, and number</small>';
  }
}

function validatePasswordMatch(password, confirmPassword) {
  const confirmField = document.getElementById("confirmPassword");
  if (!confirmField) return;

  if (confirmPassword.length > 0) {
    if (password === confirmPassword) {
      confirmField.classList.remove("is-invalid");
      confirmField.classList.add("is-valid");
    } else {
      confirmField.classList.remove("is-valid");
      confirmField.classList.add("is-invalid");
    }
  } else {
    confirmField.classList.remove("is-valid", "is-invalid");
  }
}

function validateForm() {
  const form = document.querySelector(".auth-form");
  const inputs = form.querySelectorAll("input[required]");
  let isValid = true;

  inputs.forEach((input) => {
    if (!input.value.trim()) {
      input.classList.add("is-invalid");
      isValid = false;
    } else {
      input.classList.remove("is-invalid");
    }
  });

  // Additional validation for signup form
  const passwordField = document.getElementById("password");
  const confirmPasswordField = document.getElementById("confirmPassword");

  if (passwordField && confirmPasswordField) {
    const password = passwordField.value;
    const confirmPassword = confirmPasswordField.value;

    // Password strength validation
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[@$!%*?&]/.test(password);
    const hasLength = password.length >= 8;
    const notTooLong = password.length <= 128;

    if (
      !hasUpper ||
      !hasLower ||
      !hasNumber ||
      !hasSpecial ||
      !hasLength ||
      !notTooLong
    ) {
      passwordField.classList.add("is-invalid");
      isValid = false;
    }

    // Password match validation
    if (password !== confirmPassword) {
      confirmPasswordField.classList.add("is-invalid");
      isValid = false;
    }
  }

  return isValid;
}

// Debug function for mobile authentication (only if debug parameter is present)
function debugMobileAuth() {
  fetch("/api/verify-session", {
    credentials: "include",
    method: "GET",
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Session Debug:", data);
      alert(JSON.stringify(data, null, 2));
    })
    .catch((error) => {
      console.error("Debug error:", error);
      alert("Debug error: " + error.message);
    });
}

// Add debug button for testing (only if debug parameter is present)
document.addEventListener("DOMContentLoaded", function () {
  if (window.location.search.includes("debug=1")) {
    const debugButton = document.createElement("button");
    debugButton.textContent = "Debug Auth";
    debugButton.onclick = debugMobileAuth;
    debugButton.style.cssText =
      "position:fixed;top:10px;right:10px;z-index:9999;padding:5px 10px;background:#007bff;color:white;border:none;border-radius:4px;font-size:12px;";
    document.body.appendChild(debugButton);
  }
});

// Auto-dismiss alerts after 5 seconds
document.addEventListener("DOMContentLoaded", function () {
  const alerts = document.querySelectorAll(".alert");
  alerts.forEach((alert) => {
    setTimeout(() => {
      const bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    }, 5000);
  });
});

// Smooth form animations
document.addEventListener("DOMContentLoaded", function () {
  const formGroups = document.querySelectorAll(".form-group");
  formGroups.forEach((group, index) => {
    group.style.opacity = "0";
    group.style.transform = "translateY(20px)";

    setTimeout(() => {
      group.style.transition = "all 0.3s ease";
      group.style.opacity = "1";
      group.style.transform = "translateY(0)";
    }, index * 100);
  });
});
