// Apply dark mode immediately if it's enabled (no waiting for DOM)
(function () {
  // Create a style element for critical dark mode styles
  const style = document.createElement('style');
  style.textContent = `
    :root {
      --bg-color: #f8f9fa;
      --text-color: #333333;
      --card-bg: #ffffff;
      --card-text: #333333;
    }
    
    :root.dark-mode {
      --bg-color: #121212;
      --text-color: #e0e0e0;
      --card-bg: #1e1e1e;
      --card-text: #e0e0e0;
    }

    body {
      background-color: var(--bg-color);
      color: var(--text-color);
      transition: background-color 0.3s, color 0.3s;
    }

    .card {
      background-color: var(--card-bg);
      color: var(--card-text);
    }

    #dark-mode-init {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: var(--bg-color);
      z-index: 9999;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s;
    }

    html.dark-mode-initializing #dark-mode-init {
      opacity: 1;
      visibility: visible;
    }
  `;
  document.head.appendChild(style);

  // Check dark mode status and apply immediately
  if (localStorage.getItem("darkMode") === "enabled") {
    document.documentElement.classList.add("dark-mode");
    document.documentElement.classList.add("dark-mode-initializing");
  }

  // Remove initializing class after a short delay
  setTimeout(() => {
    document.documentElement.classList.remove("dark-mode-initializing");
  }, 100);
})();

// Dark Mode functionality
function toggleDarkMode() {
  const isDarkMode = document.documentElement.classList.toggle("dark-mode");
  document.body.classList.toggle("dark-mode");
  localStorage.setItem("darkMode", isDarkMode ? "enabled" : "disabled");

  // Update icon if it exists
  const icon = document.querySelector("#darkModeToggle i");
  if (icon) {
    icon.className = isDarkMode ? "fas fa-sun" : "fas fa-moon";
  }
}

// Initialize dark mode based on localStorage
function initializeDarkMode() {
  const darkMode = localStorage.getItem("darkMode");
  if (darkMode === "enabled") {
    document.documentElement.classList.add("dark-mode");
    document.body.classList.add("dark-mode");
    
    // Update icon if it exists
    const icon = document.querySelector("#darkModeToggle i");
    if (icon) {
      icon.className = "fas fa-sun";
    }
  }
}

// Apply dark mode on page load
document.addEventListener("DOMContentLoaded", initializeDarkMode);
