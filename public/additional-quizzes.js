/**
 * Additional Quizzes functionality
 */

// Function to refresh the custom quizzes list
function refreshCustomQuizzes() {
  // Add a spinner to the button
  const refreshBtn = document.querySelector(
    'button[onclick="refreshCustomQuizzes()"]'
  );
  const originalContent = refreshBtn.innerHTML;
  refreshBtn.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
  refreshBtn.disabled = true;

  // Force reload the page to get updated quiz list
  window.location.href = "/additional-quizzes?refresh=" + new Date().getTime();
}

// Initialize any event listeners when the DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  // Add any additional initialization here if needed
});
