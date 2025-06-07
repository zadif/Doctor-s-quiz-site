/**
 * Responsive utilities for QuizMaster
 */

// Adjust UI elements based on screen size
function adjustForScreenSize() {
  // Get the current viewport width
  const vw = Math.max(
    document.documentElement.clientWidth || 0,
    window.innerWidth || 0
  );

  // Adjust font sizes for very small screens
  if (vw < 360) {
    document.documentElement.style.fontSize = "14px";
  } else {
    document.documentElement.style.fontSize = "";
  }

  // Handle navbar buttons on small screens
  const navbarButtons = document.querySelectorAll(".navbar .btn");
  if (vw < 992 && navbarButtons.length > 0) {
    navbarButtons.forEach((btn) => {
      btn.classList.add("btn-sm");
    });
  } else {
    navbarButtons.forEach((btn) => {
      btn.classList.remove("btn-sm");
    });
  }

  // Make the footer sticky only on desktop
  const footer = document.querySelector("footer");
  if (footer) {
    if (vw >= 768) {
      if (document.body.offsetHeight < window.innerHeight) {
        footer.style.position = "fixed";
        footer.style.bottom = "0";
        footer.style.width = "100%";
      } else {
        footer.style.position = "";
        footer.style.bottom = "";
        footer.style.width = "";
      }
    } else {
      footer.style.position = "";
      footer.style.bottom = "";
      footer.style.width = "";
    }
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", function () {
  adjustForScreenSize();

  // Reapply on resize
  window.addEventListener("resize", function () {
    adjustForScreenSize();
  });

  // Reapply when content might have changed the page height
  window.addEventListener("load", function () {
    adjustForScreenSize();
  });
});
