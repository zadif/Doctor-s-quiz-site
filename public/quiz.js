// Local Storage Keys
const PROGRESS_KEY = "quizProgress";
const CURRENT_SCORE_KEY = "currentScore";

let currentQuestionIndex = 0;
let score = 0;
const carousel = new bootstrap.Carousel(
  document.getElementById("quiz-carousel"),
  {
    interval: false,
    wrap: false,
  }
);

// Initialize progress from local storage
function initializeProgress() {
  const savedProgress = localStorage.getItem(PROGRESS_KEY);
  const savedScore = localStorage.getItem(CURRENT_SCORE_KEY);

  if (savedProgress) {
    showProgressModal(parseInt(savedProgress), parseInt(savedScore));
  }
}

function showProgressModal(savedProgress, savedScore) {
  const modal = document.createElement("div");
  modal.className = "progress-modal";
  modal.innerHTML = `
        <h3>Previous Progress Found</h3>
        <div class="progress-options">
            <button class="btn btn-primary" onclick="continueProgress(${savedProgress}, ${savedScore})">
                Continue
            </button>
            <button class="btn btn-outline-primary" onclick="startNew()">
                Start New
            </button>
        </div>
    `;
  document.body.appendChild(modal);
  document.body.classList.add("modal-open"); // Add blur effect
  document.querySelector(".chat-sidebar").classList.remove("open"); // Ensure chat box appears closed
  document.querySelector(".chat-sidebar").style.display = "none"; // Hide chat box
}

function continueProgress(savedProgress, savedScore) {
  currentQuestionIndex = savedProgress;
  score = savedScore;
  carousel.to(currentQuestionIndex);
  updateProgress();
  closeProgressModal();
}

function startNew() {
  localStorage.removeItem(PROGRESS_KEY);
  localStorage.removeItem(CURRENT_SCORE_KEY);
  closeProgressModal();
}

function closeProgressModal() {
  const modal = document.querySelector(".progress-modal");
  if (modal) {
    modal.remove();
    document.body.classList.remove("modal-open"); // Remove blur effect
    document.querySelector(".chat-sidebar").style.display = ""; // Reset chat box display
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

  // Save progress
  localStorage.setItem(PROGRESS_KEY, currentQuestionIndex);
  localStorage.setItem(CURRENT_SCORE_KEY, score);
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
      }

      carousel.next();
      document.getElementById("nextBtn").style.display = "none";
      document.getElementById("prevBtn").style.display = "none";
      // Clear progress on completion
      localStorage.removeItem(PROGRESS_KEY);
      localStorage.removeItem(CURRENT_SCORE_KEY);
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

  // Clear progress
  localStorage.removeItem(PROGRESS_KEY);
  localStorage.removeItem(CURRENT_SCORE_KEY);

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
  initializeProgress();
  initializeDarkMode();

  // Add event listener for chat toggle to initialize resize handle
  const chatBtn = document.querySelector(".chat-button");
  if (chatBtn) {
    chatBtn.addEventListener("click", function () {
      // Give the chat time to open before initializing the resize handle
      setTimeout(initResizeHandle, 100);
    });
  }

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

    // Save to localStorage first
    localStorage.setItem("incompleteQuiz", JSON.stringify(progressData));

    // Save the quiz status to quizStats as well to track history
    saveQuizStatus(progressData);

    try {
      // Send direct API call to ensure the cancelled quiz is saved properly
      await saveQuizCancellation(progressData);

      // Try to sync to server using the existing forcSync method
      await window.userSync.forcSync();
    } catch (error) {
      console.error("Failed to save quiz cancellation:", error);
    }
  }

  // Clear current progress
  localStorage.removeItem(PROGRESS_KEY);
  localStorage.removeItem(CURRENT_SCORE_KEY);

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
        currentQuestion: progressData.currentQuestion,
        totalQuestions: progressData.totalQuestions,
        score: progressData.score,
        status: "cancelled",
        percentageCompleted: progressData.percentageCompleted,
        timestamp: new Date().toISOString(),
        lastQuestion: progressData.questionText,
      },
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
