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

// GET /auth/login
router.get("/login", requireGuest, (req, res) => {
  res.render("auth/login", {
    title: "Login - QuizMaster",
    error: req.flash("error"),
    success: req.flash("success"),
    layout: false,
  });
});

// POST /auth/login
router.post(
  "/login",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please enter a valid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
  ],
  async (req, res, next) => {
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
  res.render("auth/signup", {
    title: "Sign Up - QuizMaster",
    error: req.flash("error"),
    success: req.flash("success"),
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
      .normalizeEmail()
      .withMessage("Please enter a valid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long")
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage(
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
    body("confirmPassword").custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),
  ],
  async (req, res) => {
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

      // Create user
      const result = await userOperations.createUser({
        name: name.trim(),
        email: email.toLowerCase(),
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

// Google OAuth routes
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/login" }),
  (req, res) => {
    req.flash("success", "Welcome to QuizMaster!");
    res.redirect("/");
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
      res.json({
        success: true,
        data: {
          quizStats: user.quizStats || { quizzes: [], totalQuizzes: 0 },
          preferences: user.preferences || { darkMode: false },
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

export default router;
