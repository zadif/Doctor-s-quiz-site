import express from "express";
import bcrypt from "bcryptjs";
import passport from "passport";
import { body, validationResult } from "express-validator";
import { userOperations } from "../mongo.js";

const router = express.Router();

// Middleware to check if user is authenticated
export const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/auth/login");
};

// Middleware to check if user is not authenticated
const requireGuest = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next();
  }
  res.redirect("/");
};

// Middleware to check subscription status
export const checkSubscription = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
      requiresAuth: true,
    });
  }

  try {
    const subscriptionStatus = await userOperations.checkSubscriptionExpiry(
      req.user._id
    );
    req.user.subscriptionStatus = subscriptionStatus;

    // If subscription expired, update user object
    if (subscriptionStatus.isExpired) {
      req.user.subscription.isPremium = false;
      req.user.subscription.maxQuizzes = 3;
    }

    next();
  } catch (error) {
    console.error("Error checking subscription:", error);
    next();
  }
};

// GET /auth/login
router.get("/login", requireGuest, (req, res) => {
  // Check if request is from AppInventor WebView
  const userAgent = req.headers["user-agent"] || "";
  const isInWebView = /AppInventor/i.test(userAgent);

  res.render("auth/login", {
    title: "Login - QuizMaster",
    error: req.flash("error"),
    success: req.flash("success"),
    csrfToken: req.csrfToken ? req.csrfToken() : null,
    isInWebView: isInWebView, // Pass the flag to the template
    layout: false,
  });
});

// POST /auth/login
router.post(
  "/login",
  [
    body("email")
      .isEmail()
      .normalizeEmail({
        gmail_remove_dots: false,
        gmail_remove_subaddress: false,
        gmail_convert_googlemaildotcom: false,
        outlookdotcom_remove_subaddress: false,
        yahoo_remove_subaddress: false,
        icloud_remove_subaddress: false,
      })
      .withMessage("Please enter a valid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
  ],
  async (req, res, next) => {
    // Handle CSRF errors
    if (req.csrfError) {
      return res.render("auth/login", {
        title: "Login - QuizMaster",
        error: "Invalid or missing CSRF token. Please try again.",
        success: null,
        email: req.body.email,
        csrfToken: req.csrfToken ? req.csrfToken() : null,
        layout: false,
      });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("auth/login", {
        title: "Login - QuizMaster",
        error: errors.array()[0].msg,
        success: null,
        email: req.body.email,
        layout: false,
      });
    }

    passport.authenticate("local", (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.render("auth/login", {
          title: "Login - QuizMaster",
          error: info.message,
          success: null,
          email: req.body.email,
          layout: false,
        });
      }

      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }

        req.flash("success", "Welcome back!");
        return res.redirect("/");
      });
    })(req, res, next);
  }
);

// GET /auth/signup
router.get("/signup", requireGuest, (req, res) => {
  // Check if request is from AppInventor WebView
  const userAgent = req.headers["user-agent"] || "";
  const isInWebView = /AppInventor/i.test(userAgent);

  res.render("auth/signup", {
    title: "Sign Up - QuizMaster",
    error: req.flash("error"),
    success: req.flash("success"),
    csrfToken: req.csrfToken ? req.csrfToken() : null,
    isInWebView: isInWebView, // Pass the flag to the template
    layout: false,
  });
});

// POST /auth/signup
router.post(
  "/signup",
  [
    body("name")
      .trim()
      .isLength({ min: 2 })
      .withMessage("Name must be at least 2 characters long"),
    body("email")
      .isEmail()
      .normalizeEmail({
        gmail_remove_dots: false, // Keep dots in gmail addresses
        gmail_remove_subaddress: false, // Keep everything after +
        gmail_convert_googlemaildotcom: false, // Don't convert googlemail.com to gmail.com
        outlookdotcom_remove_subaddress: false, // Keep everything after +
        yahoo_remove_subaddress: false, // Keep everything after -
        icloud_remove_subaddress: false, // Keep everything after +
      })
      .withMessage("Please enter a valid email"),
    body("password")
      .isLength({ min: 8, max: 128 })
      .withMessage("Password must be between 8 and 128 characters long")
      .matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
      )
      .withMessage(
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
      ),
    body("confirmPassword").custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),
  ],
  async (req, res) => {
    // Handle CSRF errors
    if (req.csrfError) {
      return res.render("auth/signup", {
        title: "Sign Up - QuizMaster",
        error: "Invalid or missing CSRF token. Please try again.",
        success: null,
        name: req.body.name,
        email: req.body.email,
        csrfToken: req.csrfToken ? req.csrfToken() : null,
        layout: false,
      });
    }
    // Log original email for debugging

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.render("auth/signup", {
        title: "Sign Up - QuizMaster",
        error: errors.array()[0].msg,
        success: null,
        name: req.body.name,
        email: req.body.email,
        layout: false,
      });
    }

    try {
      const { name, email, password } = req.body;

      // Check if user already exists
      const existingUser = await userOperations.findUserByEmail(email);
      if (existingUser) {
        return res.render("auth/signup", {
          title: "Sign Up - QuizMaster",
          error: "User with this email already exists",
          success: null,
          name: name,
          email: email,
          layout: false,
        });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user - make sure the email is properly formatted
      const originalEmail = email.toLowerCase(); // Store the original email

      const result = await userOperations.createUser({
        name: name.trim(),
        email: originalEmail, // Use the original email with @ intact
        password: hashedPassword,
        authMethod: "local",
      });

      if (result.success) {
        req.flash("success", "Account created successfully! Please log in.");
        res.redirect("/auth/login");
      } else {
        res.render("auth/signup", {
          title: "Sign Up - QuizMaster",
          error: "Failed to create account. Please try again.",
          success: null,
          name: name,
          email: email,
          layout: false,
        });
      }
    } catch (error) {
      console.error("Signup error:", error);
      res.render("auth/signup", {
        title: "Sign Up - QuizMaster",
        error: "An error occurred. Please try again.",
        success: null,
        name: req.body.name,
        email: req.body.email,
        layout: false,
      });
    }
  }
);

// Google OAuth routes with automatic mobile detection
router.get("/google", (req, res, next) => {
  // Store mobile flag in session for redirect handling
  if (req.isMobile) {
    req.session.isMobile = true;
  }

  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: req.isMobile ? "select_account" : undefined, // Force account selection for mobile
  })(req, res, next);
});

// Keep mobile route for backward compatibility but redirect to main route
router.get("/google/mobile", (req, res) => {
  res.redirect("/auth/google");
});

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/auth/login?error=auth_failed",
  }),
  (req, res) => {
    const isMobile = req.session.isMobile;
    delete req.session.isMobile; // Clean up

    req.flash("success", "Welcome to QuizMaster!");

    if (isMobile) {
      // Mobile-specific redirect with verification parameter
      res.redirect("/?mobile_login=success");
    } else {
      res.redirect("/");
    }
  }
);

// GET /auth/logout
router.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.flash("success", "You have been logged out successfully");
    res.redirect("/");
  });
});

// API route to sync user data
router.post("/sync-data", requireAuth, async (req, res) => {
  // Prevent multiple responses
  if (res.headersSent) {
    console.log("Headers already sent, skipping response");
    return;
  }

  try {
    // Check if body exists and is properly parsed
    if (!req.body || typeof req.body !== "object") {
      console.error("Request body is missing or not properly parsed");
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
      });
    }

    const { quizStats, preferences } = req.body;
    const userId = req.user._id;

    // Update quiz stats if provided
    if (quizStats) {
      await userOperations.updateUser(userId, { quizStats });
    }

    // Update preferences if provided
    if (preferences) {
      await userOperations.updatePreferences(userId, preferences);
    }

    if (!res.headersSent) {
      res.json({ success: true });
    }
  } catch (error) {
    console.error("Sync data error:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Failed to sync data" });
    }
  }
});

// API route to get user data
router.get("/user-data", requireAuth, async (req, res) => {
  try {
    const user = await userOperations.findUserById(req.user._id);
    if (user) {
      // Check subscription expiry
      const subscriptionStatus = await userOperations.checkSubscriptionExpiry(
        user._id
      );

      res.json({
        success: true,
        data: {
          quizStats: user.quizStats || { quizzes: [], totalQuizzes: 0 },
          preferences: user.preferences || { darkMode: false },
          subscription: {
            ...user.subscription,
            isPremium: subscriptionStatus.isPremium,
          },
        },
      });
    } else {
      res.status(404).json({ success: false, error: "User not found" });
    }
  } catch (error) {
    console.error("Get user data error:", error);
    res.status(500).json({ success: false, error: "Failed to get user data" });
  }
});

// API route to check subscription status
router.get("/subscription-status", requireAuth, async (req, res) => {
  try {
    const user = await userOperations.findUserById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const subscriptionStatus = await userOperations.checkSubscriptionExpiry(
      user._id
    );

    res.json({
      success: true,
      subscription: {
        isPremium: subscriptionStatus.isPremium,
        quizzesCompleted: user.subscription.quizzesCompleted || 0,
        maxQuizzes: subscriptionStatus.isPremium
          ? -1
          : user.subscription.maxQuizzes || 3,
        expiryDate: user.subscription.expiryDate,
      },
    });
  } catch (error) {
    console.error("Get subscription status error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to get subscription status" });
  }
});

// API route to process subscription payment
router.post("/subscribe", requireAuth, async (req, res) => {
  try {
    const { paymentMethod, phoneNumber } = req.body;

    // Validate payment method
    if (!paymentMethod || !["jazzcash", "easypaisa"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        error: "Invalid payment method",
      });
    }

    // Validate phone number (basic Pakistani number validation)
    const phoneRegex = /^(\+92|0)?3[0-9]{9}$/;
    if (!phoneNumber || !phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        error: "Invalid Pakistani phone number",
      });
    }

    // For demo purposes, we'll simulate payment processing
    // In production, you would integrate with actual payment gateways
    const paymentId = `PAY_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Update user subscription
    const result = await userOperations.updateSubscription(req.user._id, {
      paymentMethod: paymentMethod,
      paymentId: paymentId,
      amount: 1000, // PKR 1000
      phoneNumber: phoneNumber,
    });

    if (result.success) {
      res.json({
        success: true,
        message: "Subscription activated successfully!",
        subscription: result.subscription,
        paymentId: paymentId,
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to activate subscription",
      });
    }
  } catch (error) {
    console.error("Subscription error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process subscription",
    });
  }
});

// API route to save quiz progress for authenticated users
router.post("/save-progress", requireAuth, async (req, res) => {
  try {
    const { quizData, currentQuestion, score, markedAnswers } = req.body;

    console.log("Auth save-progress: Received request with data:", {
      quizTitle: quizData?.category || "Unknown Quiz",
      currentQuestion,
      markedAnswersCount: markedAnswers?.length || 0,
    });

    // Format data for new quizHistory array implementation
    const progressData = {
      title: quizData?.category || "Unknown Quiz",
      questions: quizData?.questions || [],
      markedAnswers: markedAnswers || [],
      lastQuestion: currentQuestion || 0,
    };

    const result = await userOperations.saveQuizProgress(
      req.user._id,
      progressData
    );
    console.log("Auth save-progress: Save result:", result);

    if (result.success) {
      res.json({ success: true });
    } else {
      res
        .status(500)
        .json({ success: false, error: "Failed to save progress" });
    }
  } catch (error) {
    console.error("Save progress error:", error);
    res.status(500).json({ success: false, error: "Failed to save progress" });
  }
});

export default router;
