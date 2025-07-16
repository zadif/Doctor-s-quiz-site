// Progress tracking for authenticated users
let currentQuestionIndex = 0;
let score = 0;
let userMarkedAnswers = []; // Store user's answers for each question
const carousel = new bootstrap.Carousel(
  document.getElementById("quiz-carousel"),
  {
    interval: false,
    wrap: false,
  }
);

// Track user's marked answers
function trackAnswer(questionIndex, answerIndex) {
  // Create or update the marked answer for this question
  if (userMarkedAnswers[questionIndex] === undefined) {
    userMarkedAnswers[questionIndex] = answerIndex;
  } else {
    userMarkedAnswers[questionIndex] = answerIndex;
  }
}

// Initialize progress for authenticated users
async function initializeProgress() {
  // Use a promise to ensure we only proceed when auth is definitely ready
  return new Promise((resolve) => {
    // If we have auth monitoring, use it
    if (window.authEvents) {
      window.authEvents.onAuthReady(async (isAuthenticated) => {
        await checkQuizProgress(isAuthenticated);
        resolve();
      });
    } else {
      // Fallback to direct check
      console.log(
        "Direct authentication status check:",
        window.userSync?.isAuthenticated
      );
      checkQuizProgress(window.userSync?.isAuthenticated).then(resolve);
    }
  });
}

// Separated the progress checking logic for better clarity
async function checkQuizProgress(isAuthenticated) {
  // Only check progress for authenticated users
  if (isAuthenticated) {
    try {
      // Get the quiz title from the header
      let quizTitle = document.querySelector(".category-header h2").textContent;

      // Try different variations of the title
      // First try the exact title as it appears in the header

      // Try to fetch with the original title
      let response = await fetch(
        `/quiz-progress/${encodeURIComponent(quizTitle)}`
      );
      let data = await response.json();

      // Then always try without " Quiz" suffix if it exists
      if (quizTitle.endsWith(" Quiz")) {
        const titleWithoutSuffix = quizTitle.replace(" Quiz", "");

        const responseWithoutSuffix = await fetch(
          `/quiz-progress/${encodeURIComponent(titleWithoutSuffix)}`
        );
        const dataWithoutSuffix = await responseWithoutSuffix.json();

        // If we found progress with the suffix-less version, use that data
        if (dataWithoutSuffix.success && dataWithoutSuffix.hasProgress) {
          data = dataWithoutSuffix;
        }
      }

      if (data.success && data.hasProgress) {
        showProgressModal(data.progress);
      }
    } catch (error) {
      console.error("Error fetching quiz progress:", error);
    }
  } else {
    console.log("User not authenticated or userSync not available");
  }
}

function showProgressModal(progressData) {
  // Create overlay first
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.right = "0";
  overlay.style.bottom = "0";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  overlay.style.zIndex = "999";
  document.body.appendChild(overlay);

  // Then create modal
  const modal = document.createElement("div");
  modal.className = "progress-modal";
  modal.innerHTML = `
        <h3>Previous Progress Found</h3>
        <p>You were on question ${progressData.lastQuestion + 1}</p>
        <div class="progress-options">
            <button class="btn btn-primary" onclick="continueProgress(${JSON.stringify(
              progressData
            ).replace(/"/g, "&quot;")})">
                Continue
            </button>
            <button class="btn btn-outline-primary" onclick="startNew('${
              progressData.title
            }')">
                Start New
            </button>
        </div>
    `;
  document.body.appendChild(modal);
  document.body.classList.add("modal-open"); // Add blur effect

  try {
    document.querySelector(".chat-sidebar").classList.remove("open"); // Ensure chat box appears closed
    document.querySelector(".chat-sidebar").style.display = "none"; // Hide chat box
  } catch (error) {
    console.log(
      "Chat sidebar elements not found, skipping chat sidebar modifications"
    );
  }
}

function continueProgress(progressData) {
  // Set the current question index
  currentQuestionIndex = progressData.lastQuestion;
  carousel.to(currentQuestionIndex);

  // Pre-mark answers for questions the user has already answered
  userMarkedAnswers = progressData.markedAnswers || [];

  // Reset score to properly count correct answers
  score = 0;

  // Mark questions visually - improved approach to ensure all answers are marked
  if (userMarkedAnswers && userMarkedAnswers.length > 0) {
    // First get all carousel items for efficient processing
    const allCarouselItems = document.querySelectorAll(
      ".carousel-item:not(.intro-slide)"
    );

    // Process each saved answer
    userMarkedAnswers.forEach((answerIndex, questionIndex) => {
      if (answerIndex !== undefined && answerIndex !== null) {
        // Find the carousel item for this question - now we handle items without data-question-index
        // First try to find by data-question-index (preferred way)
        let carouselItem = Array.from(allCarouselItems).find(
          (item) =>
            item.getAttribute("data-question-index") ===
            questionIndex.toString()
        );

        // If we couldn't find by data-question-index, try using array index
        // This is a fallback in case the data attributes aren't set properly
        if (!carouselItem && questionIndex < allCarouselItems.length) {
          carouselItem = allCarouselItems[questionIndex];
        }

        if (!carouselItem) {
          return;
        }

        const options = carouselItem.querySelectorAll(".option-btn");
        if (!options || options.length === 0) {
          return;
        }

        if (options[answerIndex]) {
          // Simulate the user's click
          const isCorrect = options[answerIndex].dataset.correct === "true";
          if (isCorrect) score++;

          // Apply appropriate styles - first mark user's selection
          options[answerIndex].classList.add("selected");

          if (isCorrect) {
            options[answerIndex].classList.add("correct");
          } else {
            options[answerIndex].classList.add("incorrect");

            // Find and highlight the correct answer
            let correctOptionFound = false;
            options.forEach((opt) => {
              if (opt.dataset.correct === "true") {
                opt.classList.add("correct");
                correctOptionFound = true;
              }
            });
          }

          // Disable all options for this question
          options.forEach((opt) => opt.classList.add("disabled"));
        }
      }
    });
  }
  // Make sure all carousel items have data-question-index attributes
  ensureQuestionIndices();

  // Set up navigation buttons correctly based on current question index
  setupNavigationButtons();

  updateProgress();
  closeProgressModal();
}

// Function to ensure all question slides have data-question-index attributes
function ensureQuestionIndices() {
  const carouselItems = document.querySelectorAll(
    ".carousel-item:not(.intro-slide)"
  );

  carouselItems.forEach((item, index) => {
    // Only set if not already set
    if (!item.hasAttribute("data-question-index")) {
      item.setAttribute("data-question-index", index.toString());
    }
  });

  // After setting indices, verify if there are options that need correct/incorrect styling
  verifyAnswerStyling();
}

// Helper function to verify that all answer options have proper styling
function verifyAnswerStyling() {
  // Get all selected answers
  const selectedOptions = document.querySelectorAll(".option-btn.selected");

  selectedOptions.forEach((selectedOption) => {
    const optionContainer = selectedOption.parentElement;
    const allOptions = optionContainer.querySelectorAll(".option-btn");
    const isCorrect = selectedOption.dataset.correct === "true";

    // If it's already styled correctly, skip
    if (
      (isCorrect && selectedOption.classList.contains("correct")) ||
      (!isCorrect && selectedOption.classList.contains("incorrect"))
    ) {
      return;
    }

    // Apply styling
    if (isCorrect) {
      selectedOption.classList.add("correct");
    } else {
      selectedOption.classList.add("incorrect");

      // Find and highlight correct answer
      allOptions.forEach((opt) => {
        if (opt.dataset.correct === "true") {
          opt.classList.add("correct");
        }
      });
    }

    // Make sure all options are disabled
    allOptions.forEach((opt) => opt.classList.add("disabled"));
  });
}

// Function to properly set up navigation buttons based on current question index
function setupNavigationButtons() {
  // Get references to buttons
  const nextBtn = document.getElementById("nextBtn");
  const prevBtn = document.getElementById("prevBtn");

  if (!nextBtn || !prevBtn) {
    return;
  }

  const totalQuestions = document.querySelectorAll(
    ".carousel-item:not(.intro-slide)"
  ).length;

  // Previous button should be visible if not on the first question
  if (currentQuestionIndex > 0) {
    prevBtn.style.display = "block";
  } else {
    prevBtn.style.display = "none";
  }

  // Next button should be enabled if an answer is selected for the current question
  // or if we're restoring progress for questions that were already answered
  const currentQuestionAnswered =
    userMarkedAnswers[currentQuestionIndex] !== undefined;

  if (currentQuestionAnswered) {
    nextBtn.disabled = false;
  } else {
    nextBtn.disabled = true;
  }
}

function startNew(quizTitle) {
  // For authenticated users, remove the saved progress from the server
  if (window.userSync && window.userSync.isAuthenticated && quizTitle) {
    // Standardize the quiz title format - remove " Quiz" suffix if it exists
    if (quizTitle.endsWith(" Quiz")) {
      quizTitle = quizTitle.replace(" Quiz", "");
    }

    fetch(`/quiz-progress/${encodeURIComponent(quizTitle)}`, {
      method: "DELETE",
    }).catch((error) => {
      console.error("Error removing quiz progress:", error);
    });
  }

  // Reset quiz state
  currentQuestionIndex = 0;
  score = 0;
  userMarkedAnswers = [];
  carousel.to(0);

  // Reset all question options
  document.querySelectorAll(".option-btn").forEach((option) => {
    option.classList.remove("selected", "correct", "incorrect", "disabled");
  });

  updateProgress();
  closeProgressModal();
}

function closeProgressModal() {
  const modal = document.querySelector(".progress-modal");
  const overlay = document.querySelector(".modal-overlay");

  if (modal) {
    modal.remove();
  }

  if (overlay) {
    overlay.remove();
  }

  document.body.classList.remove("modal-open"); // Remove blur effect

  try {
    document.querySelector(".chat-sidebar").style.display = ""; // Reset chat box display
  } catch (error) {
    console.log("Chat sidebar not found when closing modal");
  }
}

function updateProgress() {
  const totalQuestions = document.querySelectorAll(".carousel-item").length - 1;
  document.getElementById("currentQuestion").textContent =
    currentQuestionIndex + 1;
  const progressBar = document.querySelector(".progress-bar");
  progressBar.style.width = `${
    ((currentQuestionIndex + 1) / totalQuestions) * 100
  }%`;

  // Progress is now only saved when quitting, not on every interaction
  // This dramatically reduces database load when many users are active
}

// Helper function to get current question index
function getCurrentQuestionIndex() {
  return currentQuestionIndex;
}

// Save quiz progress to server for authenticated users
async function saveQuizProgress() {
  // Only save progress for authenticated users
  if (window.userSync && window.userSync.isAuthenticated) {
    try {
      // Get the quiz title
      let quizTitle = document.querySelector(".category-header h2").textContent;

      // Standardize the quiz title format - remove " Quiz" suffix if it exists
      if (quizTitle.endsWith(" Quiz")) {
        quizTitle = quizTitle.replace(" Quiz", "");
      }

      // Get array of question indices that have been answered
      const answeredQuestions = userMarkedAnswers
        .map((answer, index) => (answer !== undefined ? index : null))
        .filter((index) => index !== null);

      // Save progress to server
      const response = await fetch("/quiz-progress/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: quizTitle,
          questions: answeredQuestions,
          markedAnswers: userMarkedAnswers,
          lastQuestion: currentQuestionIndex,
        }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error saving quiz progress:", error);
    }
  }
}

function showExplanation(explanation) {
  const modal = document.createElement("div");
  modal.className = "explanation-modal";
  modal.innerHTML = `
        <div class="explanation-content">${explanation}</div>
        <button class="btn btn-primary w-100" onclick="closeExplanation()">Close</button>
    `;
  document.body.appendChild(modal);

  // Auto-close after 5 seconds
  setTimeout(closeExplanation, 5000);
}

function closeExplanation() {
  const modal = document.querySelector(".explanation-modal");
  if (modal) {
    modal.remove();
  }
}

function checkAnswer(button, isCorrect) {
  const options = button.parentElement.querySelectorAll(".option-btn");
  markSelectedAnswer(button, isCorrect);

  // Track this answer for progress saving
  const questionIndex = getCurrentQuestionIndex();
  const answerIndex = Array.from(options).indexOf(button);
  trackAnswer(questionIndex, answerIndex);

  // Enable the Next button now that an answer has been selected
  document.getElementById("nextBtn").disabled = false;

  // No longer saving progress on every answer to reduce server load
  // Progress will only be saved when quitting
}

// Function to mark an answer as selected - extracted for reuse
function markSelectedAnswer(button, isCorrect) {
  const options = button.parentElement.querySelectorAll(".option-btn");
  options.forEach((opt) => opt.classList.add("disabled"));

  // Add selected class to track user's choice
  button.classList.add("selected");

  if (isCorrect) {
    button.classList.add("correct");
    score++;
  } else {
    button.classList.add("incorrect");
    options.forEach((opt) => {
      if (opt.dataset.correct === "true") {
        opt.classList.add("correct");
      }
    });
  }

  // Get the explanation from the button's data attribute and decode it
  const explanation = decodeURIComponent(button.dataset.explanation || "");

  // Show explanation section only if there's actual content
  const card = button.closest(".card-body");
  const explanationSection = card.querySelector(".explanation-section");

  if (explanationSection) {
    // Only display the explanation section if there's actual content
    if (explanation && explanation.trim() !== "") {
      explanationSection.style.display = "block";

      const explanationToggle = explanationSection.querySelector(
        ".explanation-toggle"
      );
      const explanationContent = explanationSection.querySelector(
        ".explanation-content"
      );

      if (explanationContent) {
        // Set the explanation content safely
        explanationContent.innerHTML = explanation;
      }

      if (explanationToggle) {
        // Remove any existing event listeners to prevent duplicates
        const newToggle = explanationToggle.cloneNode(true);
        explanationToggle.parentNode.replaceChild(newToggle, explanationToggle);

        // Add the event listener to the new element
        newToggle.addEventListener("click", function () {
          const isVisible = explanationContent.style.display === "block";
          explanationContent.style.display = isVisible ? "none" : "block";
          this.innerHTML = isVisible
            ? '<i class="fas fa-lightbulb me-2"></i>View Explanation'
            : '<i class="fas fa-times me-2"></i>Hide Explanation';
        });
      }
    } else {
      // If there's no explanation, ensure the section is hidden
      explanationSection.style.display = "none";
    }
  }

  document.getElementById("nextBtn").disabled = false;
}

function nextQuestion() {
  if (window.incorrectQuestions) {
    // Review mode navigation
    window.currentReviewIndex++;
    if (window.currentReviewIndex < window.incorrectQuestions.length) {
      carousel.to(window.incorrectQuestions[window.currentReviewIndex]);
      currentQuestionIndex =
        window.incorrectQuestions[window.currentReviewIndex];
      updateReviewNavigation();
    }
  } else {
    // Normal quiz navigation
    const totalQuestions =
      document.querySelectorAll(".carousel-item").length - 1;
    currentQuestionIndex++;

    if (currentQuestionIndex < totalQuestions) {
      carousel.next();
      document.getElementById("nextBtn").disabled = true;
      document.getElementById("prevBtn").style.display = "block";
      updateProgress();
    } else {
      // Show results and save stats
      const finalScore = Math.round((score / totalQuestions) * 100);
      document.getElementById("finalScore").textContent = score;

      // Save statistics
      const stats = JSON.parse(
        localStorage.getItem("quizStats") || '{"quizzes":[], "totalQuizzes":0}'
      );
      const quizData = {
        date: new Date(),
        category: document.querySelector(".category-header h2").textContent,
        score: finalScore,
        totalQuestions: totalQuestions,
        correctAnswers: score,
      };

      stats.quizzes.push(quizData);
      stats.totalQuizzes++;
      localStorage.setItem("quizStats", JSON.stringify(stats));

      // Sync to server if user is authenticated
      if (window.userSync && window.userSync.isAuthenticated) {
        window.userSync.forcSync();

        // Remove quiz progress once the quiz is complete
        const quizTitle = document.querySelector(
          ".category-header h2"
        ).textContent;
        fetch(`/quiz-progress/${encodeURIComponent(quizTitle)}`, {
          method: "DELETE",
        }).catch((error) => {
          console.error("Error removing quiz progress:", error);
        });
      }

      carousel.next();
      document.getElementById("nextBtn").style.display = "none";
      document.getElementById("prevBtn").style.display = "none";
    }
  }
}

function previousQuestion() {
  if (window.incorrectQuestions) {
    // Review mode navigation
    window.currentReviewIndex--;
    if (window.currentReviewIndex >= 0) {
      carousel.to(window.incorrectQuestions[window.currentReviewIndex]);
      currentQuestionIndex =
        window.incorrectQuestions[window.currentReviewIndex];
      updateReviewNavigation();
    }
  } else {
    // Normal quiz navigation
    if (currentQuestionIndex > 0) {
      currentQuestionIndex--;
      carousel.prev();
      document.getElementById("nextBtn").disabled = false;
      if (currentQuestionIndex === 0) {
        document.getElementById("prevBtn").style.display = "none";
      }
      updateProgress();
    }
  }
}

function restartQuiz() {
  currentQuestionIndex = 0;
  score = 0;

  // Reset all buttons
  document.querySelectorAll(".option-btn").forEach((btn) => {
    btn.classList.remove("correct", "incorrect", "disabled");
  });

  // Reset carousel to first slide
  carousel.to(0);

  // Reset navigation buttons
  document.getElementById("nextBtn").style.display = "block";
  document.getElementById("nextBtn").disabled = true;
  document.getElementById("prevBtn").style.display = "none";

  // Progress clearing code removed as we no longer save progress

  window.incorrectQuestions = null;
  window.currentReviewIndex = null;

  updateProgress();
}

function reviewAnswers() {
  const questions = document.querySelectorAll(".carousel-item");
  let incorrectQuestions = [];
  let userAnswers = [];

  // First pass: identify incorrect questions and store user selections
  questions.forEach((question, index) => {
    if (index < questions.length - 1) {
      // Skip the results slide
      const options = question.querySelectorAll(".option-btn");
      let hasIncorrectAnswer = false;
      let userSelection = null;

      options.forEach((option) => {
        // Clear previous review styling
        option.classList.remove("correct", "incorrect", "disabled");
        option.innerHTML = option.innerHTML.replace(
          ' <i class="fas fa-check"></i>',
          ""
        );

        if (option.classList.contains("selected")) {
          userSelection = option;
          if (option.dataset.correct === "false") {
            hasIncorrectAnswer = true;
          }
        }
      });

      if (hasIncorrectAnswer) {
        incorrectQuestions.push(index);
        userAnswers[index] = userSelection;
      }
    }
  });

  // If no incorrect answers, show a message
  if (incorrectQuestions.length === 0) {
    alert("Congratulations! All your answers were correct!");
    return;
  }

  // Show navigation buttons for review mode
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  prevBtn.style.display = "block";
  nextBtn.style.display = "block";
  nextBtn.disabled = false;

  // Second pass: style incorrect questions
  questions.forEach((question, index) => {
    if (incorrectQuestions.includes(index)) {
      const options = question.querySelectorAll(".option-btn");
      options.forEach((option) => {
        option.classList.add("disabled");

        // Show user's incorrect answer
        if (option === userAnswers[index]) {
          option.classList.add("incorrect");
        }

        // Show correct answer
        if (option.dataset.correct === "true") {
          option.classList.add("correct");
          option.innerHTML += ' <i class="fas fa-check"></i>';
        }
      });
    }
  });

  // Go to the first incorrect question
  carousel.to(incorrectQuestions[0]);
  currentQuestionIndex = incorrectQuestions[0];

  // Store incorrect questions for navigation
  window.incorrectQuestions = incorrectQuestions;
  window.currentReviewIndex = 0;

  // Update navigation for review mode
  updateReviewNavigation();
}

function updateReviewNavigation() {
  if (!window.incorrectQuestions) return;

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  prevBtn.style.display = window.currentReviewIndex > 0 ? "block" : "none";

  // If we're at the last incorrect question
  if (window.currentReviewIndex >= window.incorrectQuestions.length - 1) {
    nextBtn.innerHTML = 'Finish Review<i class="fas fa-check ms-2"></i>';
    nextBtn.onclick = function () {
      // Reset review mode
      window.incorrectQuestions = null;
      window.currentReviewIndex = null;

      // Go to results slide
      const totalQuestions = document.querySelectorAll(".carousel-item").length;
      carousel.to(totalQuestions - 1);

      // Hide navigation buttons
      prevBtn.style.display = "none";
      nextBtn.style.display = "none";

      // Reset next button
      nextBtn.innerHTML = 'Next<i class="fas fa-arrow-right ms-2"></i>';
      nextBtn.onclick = nextQuestion;
    };
  } else {
    nextBtn.style.display = "block";
    nextBtn.innerHTML = 'Next<i class="fas fa-arrow-right ms-2"></i>';
    nextBtn.onclick = nextQuestion;
  }
}

// Chat functions - updating the toggle and close functionality
function toggleChat() {
  const chatSidebar = document.querySelector(".chat-sidebar");
  if (chatSidebar) {
    const isOpen = chatSidebar.classList.contains("open");

    if (isOpen) {
      closeChat();
    } else {
      chatSidebar.classList.add("open");
      // Initialize resize handle after opening
      setTimeout(initResizeHandle, 100);
    }
  }
}

function closeChat() {
  const chatSidebar = document.querySelector(".chat-sidebar");
  if (chatSidebar) {
    chatSidebar.classList.remove("open");
    // Reset width to default when closing
    chatSidebar.style.width = "";
  }
}

// Initialize resize handle
function initResizeHandle() {
  const sidebar = document.querySelector(".chat-sidebar");
  const handle = document.querySelector(".resize-handle");

  if (!handle || !sidebar) return;

  let startX, startWidth;

  handle.addEventListener("mousedown", function (e) {
    startX = e.clientX;
    startWidth = parseInt(
      document.defaultView.getComputedStyle(sidebar).width,
      10
    );
    sidebar.classList.add("resizing");

    document.addEventListener("mousemove", resizeMove);
    document.addEventListener("mouseup", resizeEnd);

    e.preventDefault(); // Prevent text selection
  });

  // Touch support
  handle.addEventListener("touchstart", function (e) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      startX = touch.clientX;
      startWidth = parseInt(
        document.defaultView.getComputedStyle(sidebar).width,
        10
      );
      sidebar.classList.add("resizing");

      document.addEventListener("touchmove", resizeTouchMove);
      document.addEventListener("touchend", resizeTouchEnd);

      e.preventDefault(); // Prevent scrolling
    }
  });

  function resizeMove(e) {
    const width = startWidth - (e.clientX - startX);
    setWidth(width);
  }

  function resizeTouchMove(e) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const width = startWidth - (touch.clientX - startX);
      setWidth(width);
    }
  }

  function setWidth(width) {
    // Enforce min and max constraints
    const minWidth = 300;
    const maxWidth = window.innerWidth * 0.9;

    if (width < minWidth) width = minWidth;
    if (width > maxWidth) width = maxWidth;

    sidebar.style.width = width + "px";
  }

  function resizeEnd() {
    document.removeEventListener("mousemove", resizeMove);
    document.removeEventListener("mouseup", resizeEnd);
    sidebar.classList.remove("resizing");
  }

  function resizeTouchEnd() {
    document.removeEventListener("touchmove", resizeTouchMove);
    document.removeEventListener("touchend", resizeTouchEnd);
    sidebar.classList.remove("resizing");
  }
}

// Remove old drag functions since we no longer need them
// dragStart and dragEnd functions can be removed

function sendMessage() {
  const input = document.getElementById("chatInput");
  const message = input.value.trim();
  if (!message) return;

  // Add user message with updated method
  addMessageToChat("user", message);
  input.value = "";

  // Use the unified sendToAI function (same as mobile)
  sendToAI(message, "desktop");
}

// Legacy function kept for compatibility
function addMessage(text, type) {
  addMessageToChat(type, text);
}

// New unified function for desktop chat messages (similar to mobile)
function addMessageToChat(sender, message) {
  const chatMessages = document.getElementById("chatMessages");
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${sender}-message`;
  messageDiv.innerHTML = `
    <div class="message-content">${message}</div>
    <div class="message-time">${new Date().toLocaleTimeString()}</div>
  `;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Dark Mode functions
// These should be kept if dark-mode.js isn't properly included yet
// If dark-mode.js is included, these act as fallbacks
if (typeof toggleDarkMode !== "function") {
  function toggleDarkMode() {
    document.documentElement.classList.toggle("dark-mode");
    document.body.classList.toggle("dark-mode");
    const isDarkMode = document.body.classList.contains("dark-mode");
    localStorage.setItem("darkMode", isDarkMode ? "enabled" : "disabled");

    // Update icon if it exists
    const icon = document.querySelector("#darkModeToggle i");
    if (icon) {
      icon.className = isDarkMode ? "fas fa-sun" : "fas fa-moon";
    }
  }
}

if (typeof initializeDarkMode !== "function") {
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
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Log the quiz title at load time
  const quizTitleElement = document.querySelector(".category-header h2");

  // Initialize dark mode regardless of authentication
  initializeDarkMode();

  // Ensure all carousel items have their question indices set
  ensureQuestionIndices();

  // Set up event listener for carousel slide events
  const quizCarousel = document.getElementById("quiz-carousel");
  if (quizCarousel) {
    quizCarousel.addEventListener("slide.bs.carousel", function (event) {
      // Update currentQuestionIndex based on the target slide
      // The event.to property contains the index of the target slide
      currentQuestionIndex = event.to;

      // Set up navigation buttons for the new question
      setTimeout(() => {
        setupNavigationButtons();
      }, 100); // Small delay to ensure carousel has completed the transition
    });
  }

  // Initialize progress checking - will use auth monitoring if available
  initializeProgress().then(() => {
    // Call ensureQuestionIndices again after progress is loaded
    ensureQuestionIndices();
    // Set up navigation buttons after progress is loaded
    setupNavigationButtons();
  });

  // Add event listener for chat toggle to initialize resize handle
  const chatBtn = document.querySelector(".chat-button");
  if (chatBtn) {
    chatBtn.addEventListener("click", function () {
      // Give the chat time to open before initializing the resize handle
      setTimeout(initResizeHandle, 100);
    });
  }
  initializeDarkMode();

  // Add event listener for close button
  const closeBtn = document.querySelector(".chat-header .btn-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", function (e) {
      e.preventDefault();
      closeChat();
    });
  }
});

function copyQuestionToChat(question) {
  // First check if user has AI access
  checkAIAccess().then((hasAccess) => {
    if (!hasAccess) {
      showPremiumRequiredMessage();
      return;
    }

    const isMobile = window.innerWidth < 576;

    if (isMobile) {
      // For mobile, open the modal and set the input value
      const mobileModal = new bootstrap.Modal(
        document.getElementById("mobileChatModal")
      );
      mobileModal.show();

      // Short delay to ensure modal is open
      setTimeout(() => {
        const mobileChatInput = document.getElementById("mobileChatInput");
        mobileChatInput.value = question;
        mobileChatInput.focus();
      }, 300);
    } else {
      // For desktop
      const chatInput = document.getElementById("chatInput");
      chatInput.value = question;

      // Open chat if it's closed
      const sidebar = document.querySelector(".chat-sidebar");
      if (!sidebar.classList.contains("open")) {
        // We need to open the sidebar first
        sidebar.classList.add("open");
        document.body.classList.add("chat-open");

        // Initialize resize handle after opening
        setTimeout(initResizeHandle, 100);
      }
      // Focus on the input
      chatInput.focus();
    }
  });
}

// Quit Quiz Functions
function showQuitConfirmation() {
  // Add a class to the quiz container to prevent blur effect
  document.querySelector(".quiz-container").classList.add("no-blur");

  const quitModal = new bootstrap.Modal(
    document.getElementById("quitQuizModal")
  );

  // Add an event listener to restore the original state when modal is hidden
  const quitModalEl = document.getElementById("quitQuizModal");
  quitModalEl.addEventListener(
    "hidden.bs.modal",
    function () {
      document.querySelector(".quiz-container").classList.remove("no-blur");
    },
    { once: true }
  );

  quitModal.show();
}

async function confirmQuitQuiz() {
  // Show loading overlay
  showLoadingOverlay("Saving your progress...");

  // Save progress if user is authenticated
  if (window.userSync && window.userSync.isAuthenticated) {
    // Get category from the header
    const categoryText = document.querySelector(
      ".category-header h2"
    ).textContent;
    const categoryName = categoryText.replace(" Quiz", "").trim();

    // Get the current question text
    const currentQuestion = getCurrentQuestionText(); // Get total number of questions from the DOM
    const totalQuestions = getTotalQuestionCount();

    const progressData = {
      category: categoryName,
      currentQuestion: currentQuestionIndex,
      questionText: currentQuestion,
      score: score,
      totalQuestions: totalQuestions,
      timestamp: new Date(),
      status: "cancelled",
      percentageCompleted:
        totalQuestions > 0
          ? Math.round((currentQuestionIndex / totalQuestions) * 100)
          : 0,
    };

    try {
      // First save the quiz progress to the user's quizHistory in MongoDB
      // This is critical for resuming the quiz later
      const saveResult = await saveQuizProgress();

      // Save the quiz status to quizStats as well to track history
      saveQuizStatus(progressData);

      // Send direct API call to ensure the cancelled quiz is saved properly
      const cancellationResult = await saveQuizCancellation(progressData);

      // Try to sync to server using the existing forcSync method
      if (window.userSync && window.userSync.forcSync) {
        await window.userSync.forcSync();
      }
    } catch (error) {
      console.error("Failed to save quiz cancellation:", error);
    }
  }

  // Progress clearing code removed as we no longer save progress

  // Hide loading overlay
  hideLoadingOverlay();

  // Redirect to homepage
  window.location.href = "/";
}

// Mobile Chat Functions
function toggleChat() {
  const isMobile = window.innerWidth < 576;

  if (isMobile) {
    // Check if user has premium access for AI chat
    checkAIAccess().then((hasAccess) => {
      if (hasAccess) {
        // Add no-blur class to prevent blur effect on mobile chat
        document.querySelector(".quiz-container").classList.add("no-blur");

        const mobileModal = new bootstrap.Modal(
          document.getElementById("mobileChatModal")
        );

        // Add event listener to restore state when modal is hidden
        const modalEl = document.getElementById("mobileChatModal");
        modalEl.addEventListener(
          "hidden.bs.modal",
          function () {
            document
              .querySelector(".quiz-container")
              .classList.remove("no-blur");
          },
          { once: true }
        );

        mobileModal.show();
      } else {
        showPremiumRequiredMessage();
      }
    });
  } else {
    // Desktop chat toggle
    checkAIAccess().then((hasAccess) => {
      if (hasAccess) {
        const sidebar = document.querySelector(".chat-sidebar");
        sidebar.classList.toggle("open");
        if (sidebar.classList.contains("open")) {
          setTimeout(initResizeHandle, 100);
        }
      } else {
        showPremiumRequiredMessage();
      }
    });
  }
}

function sendMobileMessage() {
  const input = document.getElementById("mobileChatInput");
  const message = input.value.trim();

  if (message) {
    // Add user message to mobile chat
    addMessageToMobileChat("user", message);
    input.value = "";

    // Send to AI (same logic as desktop)
    sendToAI(message, "mobile");
  }
}

function addMessageToMobileChat(sender, message) {
  const chatMessages = document.getElementById("mobileChatMessages");
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${sender}-message`;

  // Only add copy button for AI messages, not user messages
  const copyButton =
    sender === "ai"
      ? `<button class="copy-button" onclick="copyToClipboard(this)" aria-label="Copy to clipboard">
      <i class="fas fa-copy"></i>
    </button>`
      : "";

  messageDiv.innerHTML = `
    <div class="message-content">
      ${message}
      ${copyButton}
    </div>
    <div class="message-time">${new Date().toLocaleTimeString()}</div>
  `;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Function to copy AI message content to clipboard
function copyToClipboard(button) {
  // Get the message content container (parent of the button)
  const messageContent = button.closest(".message-content");

  // Create a temporary textarea to hold the text
  const textarea = document.createElement("textarea");

  // Get just the text content without the button HTML
  const contentWithoutButton = messageContent.innerHTML
    .replace(/<button.*?<\/button>/g, "") // Remove button HTML
    .trim();

  // Set the textarea value to the cleaned content
  textarea.value = messageContent.textContent.trim();

  // Make the textarea invisible
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";

  // Add to DOM, select all text, and copy
  document.body.appendChild(textarea);
  textarea.select();

  try {
    // Execute copy command
    const successful = document.execCommand("copy");

    // Show feedback by temporarily changing button icon
    if (successful) {
      const icon = button.querySelector("i");
      const originalClass = icon.className;

      // Change to checkmark
      icon.className = "fas fa-check";

      // Create and show a tooltip
      const tooltip = document.createElement("div");
      tooltip.className = "copy-tooltip";
      tooltip.textContent = "Copied!";
      button.appendChild(tooltip);

      // Reset icon and remove tooltip after delay
      setTimeout(() => {
        icon.className = originalClass;
        tooltip.remove();
      }, 1500);
    }
  } catch (err) {
    console.error("Failed to copy text: ", err);
  }

  // Clean up
  document.body.removeChild(textarea);
}

// AI Access Control
async function checkAIAccess() {
  try {
    const response = await fetch("/api/check-ai-access", {
      method: "GET",
      credentials: "include",
    });

    return response.ok;
  } catch (error) {
    console.error("Error checking AI access:", error);
    return false;
  }
}

function showPremiumRequiredMessage() {
  // Create and show alert
  const alertDiv = document.createElement("div");
  alertDiv.className =
    "alert alert-warning alert-dismissible fade show position-fixed";
  alertDiv.style.cssText =
    "top: 20px; right: 20px; z-index: 9999; max-width: 400px;";
  alertDiv.innerHTML = `
    <i class="fas fa-crown me-2"></i>
    <strong>Premium Feature!</strong> AI support is available for premium users only.
    <a href="/subscription" class="alert-link">Upgrade now</a> to unlock AI assistance.
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;

  document.body.appendChild(alertDiv);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (alertDiv.parentNode) {
      alertDiv.remove();
    }
  }, 5000);
}

// Update existing sendToAI function to handle mobile
function sendToAI(message, chatType = "desktop") {
  const chatMessages =
    chatType === "mobile"
      ? document.getElementById("mobileChatMessages")
      : document.getElementById("chatMessages");

  // Add loading message
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "message ai-message loading";
  loadingDiv.innerHTML = `
    <div class="message-content">
      <i class="fas fa-spinner fa-spin me-2"></i>Thinking...
    </div>
  `;
  chatMessages.appendChild(loadingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Send request to AI endpoint
  fetch("/api/ai-chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ message: message }),
  })
    .then((response) => {
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Premium subscription required for AI features");
        }
        throw new Error("Failed to get AI response");
      }
      return response.json();
    })
    .then((data) => {
      // Remove loading message
      loadingDiv.remove();

      // Add AI response
      if (chatType === "mobile") {
        addMessageToMobileChat("ai", data.response);
      } else {
        addMessageToChat("ai", data.response);
      }
    })
    .catch((error) => {
      // Remove loading message
      loadingDiv.remove();

      // Show error message
      const errorMessage = error.message.includes("Premium")
        ? "AI support is for premium users only. Please upgrade your subscription."
        : "Sorry, I encountered an error. Please try again.";

      if (chatType === "mobile") {
        addMessageToMobileChat("ai", errorMessage);
      } else {
        addMessageToChat("ai", errorMessage);
      }

      if (error.message.includes("Premium")) {
        showPremiumRequiredMessage();
      }
    });
}

// Add function to handle desktop chat messages if it doesn't exist
function addMessageToChat(sender, message) {
  const chatMessages = document.getElementById("chatMessages");
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${sender}-message`;

  // Only add copy button for AI messages, not user messages
  const copyButton =
    sender === "ai"
      ? `<button class="copy-button" onclick="copyToClipboard(this)" aria-label="Copy to clipboard">
      <i class="fas fa-copy"></i>
    </button>`
      : "";

  messageDiv.innerHTML = `
    <div class="message-content">
      ${message}
      ${copyButton}
    </div>
    <div class="message-time">${new Date().toLocaleTimeString()}</div>
  `;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function getCurrentQuestionText() {
  // Get the active carousel item
  const activeItem = document.querySelector(".carousel-item.active");
  if (!activeItem) return "";

  // Get the question text from the active item
  const questionElement = activeItem.querySelector(".card-title");
  return questionElement ? questionElement.textContent.trim() : "";
}

function saveQuizStatus(progressData) {
  // Get existing quiz stats or create new ones
  let quizStats = JSON.parse(
    localStorage.getItem("quizStats") || '{"quizzes":[], "totalQuizzes":0}'
  );

  // Add new quiz attempt with cancelled status
  quizStats.quizzes.push({
    id: Date.now(),
    category: progressData.category,
    status: "cancelled",
    score: progressData.score,
    totalQuestions: progressData.totalQuestions,
    completedQuestions: progressData.currentQuestion,
    percentageCompleted: progressData.percentageCompleted,
    date: new Date().toISOString(),
    lastQuestion: progressData.questionText,
  });

  // Update total quizzes
  quizStats.totalQuizzes = quizStats.quizzes.length;

  // Save back to localStorage
  localStorage.setItem("quizStats", JSON.stringify(quizStats));
}

function getTotalQuestionCount() {
  // First try to get it from the progress container text which shows "Question X of Y"
  const progressText = document.querySelector(".progress-container h4");
  if (progressText) {
    const match = progressText.textContent.match(/of\s+(\d+)/i);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
  }

  // Second, try counting carousel items (excluding the results slide)
  const carouselItems = document.querySelectorAll(".carousel-item");
  if (carouselItems.length > 0) {
    // Subtract 1 for the results slide if it exists
    const lastItem = carouselItems[carouselItems.length - 1];
    const isResultsSlide =
      lastItem.querySelector(".card-body.text-center") !== null;
    return isResultsSlide ? carouselItems.length - 1 : carouselItems.length;
  }

  // As a fallback, return a default
  return currentQuestionIndex + 1; // Assume we're at least on the current question
}

// Function to make a direct API call to save the quiz cancellation
async function saveQuizCancellation(progressData) {
  const response = await fetch("/api/save-quiz-cancellation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      quizData: {
        category: progressData.category,
        questions: [],
        currentQuestion: progressData.currentQuestion,
        totalQuestions: progressData.totalQuestions,
        score: progressData.score,
        status: "cancelled",
        percentageCompleted: progressData.percentageCompleted,
        timestamp: new Date().toISOString(),
        lastQuestion: progressData.questionText,
      },
      markedAnswers: userMarkedAnswers,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to save quiz cancellation");
  }

  return await response.json();
}

// Function to show loading overlay
function showLoadingOverlay(message = "Loading...") {
  // Check if overlay already exists
  let overlay = document.querySelector(".loading-overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "loading-overlay";

    const spinner = document.createElement("div");
    spinner.className = "loading-spinner";

    const messageElement = document.createElement("p");
    messageElement.className = "loading-message";

    overlay.appendChild(spinner);
    overlay.appendChild(messageElement);
    document.body.appendChild(overlay);
  }

  // Update message
  const messageElement = overlay.querySelector(".loading-message");
  messageElement.textContent = message;

  // Show overlay
  overlay.style.display = "flex";
}

// Function to hide loading overlay
function hideLoadingOverlay() {
  const overlay = document.querySelector(".loading-overlay");
  if (overlay) {
    overlay.style.display = "none";
  }
}
