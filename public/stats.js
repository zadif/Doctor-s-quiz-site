function formatDate(input) {
  // Fix the invalid underscore
  const cleanInput = input.replace("_", ".");
  const date = new Date(cleanInput);

  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "long" });

  // Add ordinal suffix (st, nd, rd, th)
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
      ? "nd"
      : day % 10 === 3 && day !== 13
      ? "rd"
      : "th";

  return `${day}${suffix} ${month}`;
}

function updateStats() {
  const stats = JSON.parse(
    localStorage.getItem("quizStats") || '{"quizzes":[], "totalQuizzes":0}'
  );

  if (stats.quizzes.length > 0) {
    document.getElementById("totalQuizzes").textContent = stats.totalQuizzes;

    const scores = stats.quizzes.map((quiz) => quiz.score);
    const average = scores.reduce((a, b) => a + b) / scores.length;
    const best = Math.max(...scores);

    document.getElementById("averageScore").textContent = `${Math.round(
      average
    )}%`;
    document.getElementById("bestScore").textContent = `${Math.round(best)}%`;
    console.log(stats.quizzes[0].date);
    // Update progress history with more details
    const historyHTML = stats.quizzes
      .slice(-5)
      .reverse()
      .map(
        (quiz) => `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1 stats-heading">
                                <i class="fas fa-book me-2"></i>${quiz.category}
                            </h6>
                            <small class="text-muted">
                                <i class="far fa-calendar me-1"></i>${formatDate(
                                  quiz.date
                                )}
                                <span class="ms-2">
                                    <i class="fas fa-check me-1"></i>${
                                      quiz.completedQuestions
                                    }/${quiz.totalQuestions} correct
                                </span>
                            </small>
                        </div>
                        <span class="badge ${getScoreBadgeClass(
                          quiz.score
                        )} rounded-pill">
                            ${quiz.score}%
                        </span>
                    </div>
                </div>
            `
      )
      .join("");

    document.getElementById("progressHistory").innerHTML = historyHTML;
  }
}

function getScoreBadgeClass(score) {
  if (score >= 80) return "bg-success";
  if (score >= 60) return "bg-primary";
  if (score >= 40) return "bg-warning";
  return "bg-danger";
}

function confirmResetStats() {
  const modal = document.createElement("div");
  modal.className = "modal fade";
  modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Reset Statistics</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p>Are you sure you want to reset all your statistics? This action cannot be undone.</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-danger" onclick="resetStats()">Reset Stats</button>
                </div>
            </div>
        </div>
    `;
  document.body.appendChild(modal);

  // Initialize Bootstrap modal
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();

  // Remove modal from DOM after it's hidden
  modal.addEventListener("hidden.bs.modal", function () {
    modal.remove();
  });
}

function resetStats() {
  // Reset stats in localStorage
  localStorage.setItem(
    "quizStats",
    JSON.stringify({ quizzes: [], totalQuizzes: 0 })
  );

  // Hide modal
  const modal = document.querySelector(".modal");
  const bsModal = bootstrap.Modal.getInstance(modal);
  bsModal.hide();

  // Show success toast
  const toast = document.createElement("div");
  toast.className = "alert alert-success position-fixed bottom-0 end-0 m-3";
  toast.style.zIndex = "1050";
  toast.innerHTML = `
        <i class="fas fa-check-circle me-2"></i>
        Statistics have been reset successfully
    `;
  document.body.appendChild(toast);

  // Reload the page after a short delay
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}

// Initialize dark mode and stats on page load
document.addEventListener("DOMContentLoaded", () => {
  updateStats();
  const darkMode = localStorage.getItem("darkMode");
  if (darkMode === "enabled") {
    document.body.classList.add("dark-mode");
  }
});
