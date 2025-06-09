// Local Storage Keys
const PROGRESS_KEY = "quizProgress";
const CURRENT_SCORE_KEY = "currentScore";

let currentQuestionIndex = 0;
let score = 0;
let userSubscription = null;
const carousel = new bootstrap.Carousel(
  document.getElementById("quiz-carousel"),
  {
    interval: false,
    wrap: false,
  }
);

// Check user subscription status
async function checkSubscriptionStatus() {
  try {
    const response = await fetch("/auth/subscription-status");
    if (response.ok) {
      const data = await response.json();
      userSubscription = data.subscription;
      return data.subscription;
    }
  } catch (error) {
    console.error("Error checking subscription:", error);
  }
  return null;
}

// Show subscription modal
function showSubscriptionModal() {
  const modal = document.createElement("div");
  modal.className = "subscription-modal";
  modal.innerHTML = `
    <div class="subscription-content">
      <h3><i class="fas fa-crown me-2"></i>Upgrade to Premium</h3>
      <p>Unlock unlimited quizzes and AI support!</p>
      
      <ul class="subscription-features">
        <li><i class="fas fa-check"></i> Unlimited quiz access</li>
        <li><i class="fas fa-check"></i> AI chat support</li>
        <li><i class="fas fa-check"></i> Detailed progress tracking</li>
        <li><i class="fas fa-check"></i> Priority customer support</li>
        <li><i class="fas fa-check"></i> Monthly subscription - PKR 1000</li>
      </ul>

      <div class="payment-options">
        <button class="payment-btn" data-method="jazzcash">
          <i class="fas fa-mobile-alt me-2"></i>JazzCash
        </button>
        <button class="payment-btn" data-method="easypaisa">
          <i class="fas fa-mobile-alt me-2"></i>EasyPaisa
        </button>
      </div>

      <div class="phone-input" style="display: none;">
        <input type="tel" id="phoneNumber" class="form-control mb-3" 
               placeholder="Enter your phone number (03XXXXXXXXX)" 
               pattern="^(\\+92|0)?3[0-9]{9}$">
      </div>

      <div class="d-flex gap-2 justify-content-center">
        <button class="btn btn-primary" id="proceedPayment" style="display: none;">
          <i class="fas fa-credit-card me-2"></i>Pay PKR 1000
        </button>
        <button class="btn btn-secondary" onclick="closeSubscriptionModal()">
          <i class="fas fa-times me-2"></i>Cancel
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.body.classList.add("modal-open");

  // Handle payment method selection
  const paymentBtns = modal.querySelectorAll(".payment-btn");
  const phoneInput = modal.querySelector(".phone-input");
  const proceedBtn = modal.querySelector("#proceedPayment");
  let selectedMethod = null;

  paymentBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      paymentBtns.forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedMethod = btn.dataset.method;
      phoneInput.style.display = "block";
      proceedBtn.style.display = "inline-block";
    });
  });

  // Handle payment processing
  proceedBtn.addEventListener("click", async () => {
    const phoneNumber = modal.querySelector("#phoneNumber").value;
    
    if (!phoneNumber || !phoneNumber.match(/^(\+92|0)?3[0-9]{9}$/)) {
      alert("Please enter a valid Pakistani phone number");
      return;
    }

    proceedBtn.disabled = true;
    proceedBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';

    try {
      const response = await fetch("/auth/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentMethod: selectedMethod,
          phoneNumber: phoneNumber,
        }),
      });

      const data = await response.json();

      if (data.success) {
        closeSubscriptionModal();
        alert("🎉 Subscription activated successfully! You now have unlimited access to all quizzes and AI support.");
        // Refresh subscription status
        await checkSubscriptionStatus();
        // Reload page to update UI
        window.location.reload();
      } else {
        alert("Payment failed: " + data.error);
        proceedBtn.disabled = false;
        proceedBtn.innerHTML = '<i class="fas fa-credit-card me-2"></i>Pay PKR 1000';
      }
    } catch (error) {
      console.error("Payment error:", error);
      alert("Payment processing failed. Please try again.");
      proceedBtn.disabled = false;
      proceedBtn.innerHTML = '<i class="fas fa-credit-card me-2"></i>Pay PKR 1000';
    }
  });
}

function closeSubscriptionModal() {
  const modal = document.querySelector(".subscription-modal");
  if (modal) {
    modal.remove();
    document.body.classList.remove("modal-open");
  }
}

// Show quit confirmation modal
function showQuitModal() {
  const isAuthenticated = window.userSync && window.userSync.isAuthenticated;
  
  const modal = document.createElement("div");
  modal.className = "quit-modal";
  modal.innerHTML = `
    <div class="quit-content">
      <h4><i class="fas fa-exclamation-triangle me-2"></i>Quit Quiz?</h4>
      <p>Are you sure you want to quit this quiz?</p>
      ${!isAuthenticated ? 
        '<p class="text-warning"><i class="fas fa-info-circle me-2"></i>Your progress will not be saved. Sign up or login to save your progress!</p>' : 
        '<p class="text-info"><i class="fas fa-save me-2"></i>Your progress will be saved.</p>'
      }
      <div class="quit-buttons">
        <button class="btn btn-danger" onclick="confirmQuit()">
          <i class="fas fa-check me-2"></i>Yes, Quit
        </button>
        <button class="btn btn-secondary" onclick="closeQuitModal()">
          <i class="fas fa-times me-2"></i>Continue Quiz
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.body.classList.add("modal-open");
}

function closeQuitModal() {
  const modal = document.querySelector(".quit-modal");
  if (modal) {
    modal.remove();
    document.body.classList.remove("modal-open");
  }
}

async function confirmQuit() {
  const isAuthenticated = window.userSync && window.userSync.isAuthenticated;
  
  if (isAuthenticated) {
    // Save progress for authenticated users
    try {
      await fetch("/auth/save-progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quizData: {
            category: document.querySelector(".category-header h2")?.textContent || "Unknown",
            currentQuestion: currentQuestionIndex,
            score: score,
            totalQuestions: document.querySelectorAll(".carousel-item").length - 1,
          },
          currentQuestion: currentQuestionIndex,
          score: score,
        }),
      });
    } catch (error) {
      console.error("Error saving progress:", error);
    }
  }
  
  // Clear local storage
  localStorage.removeItem(PROGRESS_KEY);
  localStorage.removeItem(CURRENT_SCORE_KEY);
  
  closeQuitModal();
  
  // Redirect to home
  window.location.href = "/";
}

// Override browser back button and page refresh
window.addEventListener("beforeunload", function (e) {
  if (currentQuestionIndex > 0) {
    e.preventDefault();
    e.returnValue = "";
    return "";
  }
});

// Handle browser back button
window.addEventListener("popstate", function (e) {
  if (currentQuestionIndex > 0) {
    e.preventDefault();
    showQuitModal();
    // Push state back to prevent actual navigation
    history.pushState(null, null, window.location.pathname);
  }
});

// Push initial state to handle back button
history.pushState(null, null, window.location.pathname);

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
  document.body.classList.add("modal-open");
  document.querySelector(".chat-sidebar").classList.remove("open");
  document.querySelector(".chat-sidebar").style.display = "none";
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
    document.body.classList.remove("modal-open");
    document.querySelector(".chat-sidebar").style.display = "";
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
  // Check if user is authenticated and has premium access
  const isAuthenticated = window.userSync && window.userSync.isAuthenticated;
  
  if (!isAuthenticated) {
    alert("🔒 AI support is for premium users only. Please sign up or login and upgrade to premium!");
    return;
  }

  // Check subscription status
  if (userSubscription && !userSubscription.isPremium) {
    alert("🔒 AI support is for premium users only. Please upgrade to premium!");
    showSubscriptionModal();
    return;
  }

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

async function sendMessage() {
  const input = document.getElementById("chatInput");
  const message = input.value.trim();
  if (!message) return;

  // Add user message
  addMessage(message, "user");
  input.value = "";

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `An AI Assistant to solve quizzes and you are being used in a quiz website.So answer as precisely and as consicely as possible :   ${message}`,
      }),
    });

    const data = await response.json();
    addMessage(data.response, "ai");
  } catch (error) {
    addMessage("Sorry, I encountered an error. Please try again.", "ai");
  }
}

function addMessage(text, type) {
  const messages = document.getElementById("chatMessages");
  const message = document.createElement("div");
  message.className = `message ${type}-message`;
  message.textContent = text;
  messages.appendChild(message);
  messages.scrollTop = messages.scrollHeight;
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
document.addEventListener("DOMContentLoaded", async () => {
  initializeProgress();
  initializeDarkMode();
  
  // Check subscription status
  await checkSubscriptionStatus();

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
  // Check if user has premium access first
  const isAuthenticated = window.userSync && window.userSync.isAuthenticated;
  
  if (!isAuthenticated) {
    alert("🔒 AI support is for premium users only. Please sign up or login and upgrade to premium!");
    return;
  }

  if (userSubscription && !userSubscription.isPremium) {
    alert("🔒 AI support is for premium users only. Please upgrade to premium!");
    showSubscriptionModal();
    return;
  }

  const chatInput = document.getElementById("chatInput");
  chatInput.value = question;

  // Open chat if it's closed
  const sidebar = document.querySelector(".chat-sidebar");
  if (!sidebar.classList.contains("open")) {
    toggleChat();
    // Initialize resize handle after opening
    setTimeout(initResizeHandle, 100);
  }

  // Focus on the input
  chatInput.focus();
}