import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import ejsLayouts from "express-ejs-layouts";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import fs from "fs/promises";
import session from "express-session";
import MongoStore from "connect-mongo";
import cookieParser from "cookie-parser"; // SECURITY: Cookie parser for CSRF
import helmet from "helmet"; // SECURITY: Add Helmet.js for security headers
import rateLimit from "express-rate-limit"; // SECURITY: Add rate limiting
import csrf from "csurf"; // SECURITY: Add CSRF protection
import xss from "xss"; // SECURITY: Add XSS protection
// We'll create our own MongoDB sanitization instead of using the problematic package
import passport from "./config/passport.js";
import authRoutes from "./routes/auth.js";
import subscriptionRoutes from "./routes/subscription.js";
import quizProgressRoutes from "./routes/quiz-progress.js";
import { requireAuth } from "./routes/auth.js";
import {
  checkSubscription,
  checkQuizAccess,
  checkAIAccess,
} from "./middleware/subscription.js";
import { initializeDatabase, testConnection, userOperations } from "./mongo.js";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

// SECURITY: Force HTTPS redirect in production only
app.use((req, res, next) => {
  if (
    process.env.NODE_ENV === "production" &&
    req.headers["x-forwarded-proto"] &&
    req.headers["x-forwarded-proto"] !== "https"
  ) {
    return res.redirect("https://" + req.headers.host + req.url);
  }
  next();
});

// SECURITY: Apply Helmet security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-hashes'", // Allow inline event handlers
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
        ],
        scriptSrcAttr: ["'unsafe-inline'"], // Explicitly allow inline event handlers
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
        ],
        styleSrcAttr: ["'unsafe-inline'"], // Allow inline styles
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
      useDefaults: false, // Don't use Helmet's default CSP
    },
    crossOriginEmbedderPolicy: false,
    // Disable HSTS in development
    hsts:
      process.env.NODE_ENV === "production"
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
  })
);
// SECURITY: Rate limiting - General site usage
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs (increased from 100)
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY: API-specific rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 API requests per windowMs (increased from 50)
  message: {
    error: "Too many API requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY: AI chat rate limiting (stricter as AI calls are expensive)
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // limit each IP to 100 AI requests per 10min (increased from 20)
  message: {
    error: "Too many AI requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite-preview-06-17",
});

// Quiz categories (removed biology)
const quizCategories = [
  // Define any remaining categories here
  // Biology has been completely removed
];

// Function to scan the data directory for custom question files
async function getCustomDataFiles() {
  try {
    const dataPath = join(__dirname, "data");
    const files = await fs.readdir(dataPath);

    // Filter for JSON files only (include ALL JSON files)
    const customFiles = files.filter((file) => file.endsWith(".json"));

    // Create category objects for each custom file
    return customFiles.map((file) => ({
      id: `custom-${file.replace(".json", "")}`,
      title: `${file
        .replace(".json", "")
        .replace(/-/g, " ")
        .replace(/_/g, " ")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")}`,
      description: "Custom quiz questions",
      icon: "fa-file-alt",
      color: "info",
      filename: file,
    }));
  } catch (error) {
    console.error("Error scanning data directory:", error);
    return [];
  }
}

// Flash messages middleware
app.use((req, res, next) => {
  req.flash = (type, message) => {
    if (!req.session.flash) req.session.flash = {};
    if (!req.session.flash[type]) req.session.flash[type] = [];
    req.session.flash[type].push(message);
  };
  next();
});

app.use((req, res, next) => {
  res.locals.flash = (type) => {
    if (!req.session.flash || !req.session.flash[type]) return [];
    const messages = req.session.flash[type];
    delete req.session.flash[type];
    return messages;
  };
  next();
});

// Setup middleware
app.use(express.json({ limit: "1mb" })); // SECURITY: Limit request size
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser()); // SECURITY: Parse cookies for CSRF protection
app.set("trust proxy", 1);

// SECURITY: Apply general rate limiting to all routes
app.use(limiter);

// Custom MongoDB injection prevention and session debugging
app.use((req, res, next) => {
  // Function to sanitize input by replacing MongoDB operators
  const sanitizeInput = (obj) => {
    if (!obj) return obj;

    // If it's a string, check for MongoDB operators
    if (typeof obj === "string") {
      // Replace MongoDB operators with a safe character
      return obj.replace(/\$|\./g, "_");
    }

    // If it's an array, sanitize each element
    if (Array.isArray(obj)) {
      return obj.map(sanitizeInput);
    }

    // If it's an object, sanitize each property
    if (typeof obj === "object") {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        // Sanitize keys and values
        const sanitizedKey = key.replace(/\$|\./g, "_");
        result[sanitizedKey] = sanitizeInput(value);
      }
      return result;
    }

    return obj;
  };

  // Create clean copies of request body, params, and query
  if (req.body) {
    const sanitizedBody = sanitizeInput(JSON.parse(JSON.stringify(req.body)));
    Object.assign(req.body, sanitizedBody);
  }

  if (req.params) {
    const sanitizedParams = sanitizeInput(
      JSON.parse(JSON.stringify(req.params))
    );
    Object.assign(req.params, sanitizedParams);
  }

  // For query, we'll use a safe approach that doesn't modify the original object
  if (req.query) {
    try {
      // Store sanitized query as a separate property
      req.sanitizedQuery = sanitizeInput(JSON.parse(JSON.stringify(req.query)));
    } catch (e) {
      console.warn("Error sanitizing query:", e);
    }
  }

  next();
});

// SECURITY: Check for session secret
if (
  !process.env.SESSION_SECRET ||
  process.env.SESSION_SECRET === "your-secret-key-change-this-in-production"
) {
  console.warn(
    "WARNING: Using insecure SESSION_SECRET. Set a strong SESSION_SECRET in production!"
  );
}

// Session configuration with mobile-friendly settings
app.use(
  session({
    secret:
      process.env.SESSION_SECRET || "temporary-dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      dbName: "doctorsDB",
      touchAfter: 24 * 3600, // lazy session update
    }),
    cookie: {
      secure:
        process.env.NODE_ENV === "production" &&
        process.env.FORCE_HTTPS === "true", // Only require HTTPS if explicitly set
      httpOnly: true,
      sameSite: "lax", // Changed to 'lax' for mobile compatibility in all environments
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      domain:
        process.env.NODE_ENV === "production"
          ? process.env.COOKIE_DOMAIN
          : undefined, // Allow setting domain for production
    },
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// SECURITY: CSRF Protection setup - Use both cookie and session-based CSRF for better compatibility
const csrfProtection = csrf({
  cookie: {
    key: "_csrf",
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 3600, // 1 hour in seconds
  },
  sessionKey: "session", // Use session for storage
  value: (req) => {
    // Try multiple sources for CSRF token
    const token =
      req.body._csrf ||
      req.query._csrf ||
      req.headers["x-csrf-token"] ||
      req.headers["csrf-token"] ||
      req.headers["x-xsrf-token"];

    return token;
  },
});

// SECURITY: XSS sanitization middleware
app.use((req, res, next) => {
  // Sanitize all string inputs
  const sanitizeObject = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === "string") {
        obj[key] = xss(obj[key]);
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  // req.query sanitization is already handled by our custom middleware
  // Use req.sanitizedQuery instead
  if (req.params) sanitizeObject(req.params);

  next();
});

// Make user available in all templates + mobile detection
app.use((req, res, next) => {
  // Mobile detection
  const userAgent = req.headers["user-agent"] || "";
  req.isMobile =
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  req.isTablet = /iPad|Android.*Tablet/i.test(userAgent);

  res.locals.user = req.user || null;
  res.locals.isAuthenticated = req.isAuthenticated();
  res.locals.isMobile = req.isMobile;
  next();
});

// SECURITY: CSRF token middleware for forms - Mobile-friendly approach
app.use((req, res, next) => {
  // Define paths that should be CSRF protected even on GET requests (to ensure token availability)
  const csrfGenerationPaths = [
    "/subscription/checkout",
    "/auth/login",
    "/auth/signup",
    "/profile",
    "/subscription",
  ];

  const needsExplicitCsrf = csrfGenerationPaths.some((path) =>
    req.path.startsWith(path)
  );

  // Skip CSRF for GET requests (unless explicitly needed), API endpoints, static files
  if (
    (req.method === "GET" && !needsExplicitCsrf) ||
    req.url.startsWith("/api/") ||
    req.url.startsWith("/public/") ||
    req.url.startsWith("/css/") ||
    req.url.startsWith("/js/") ||
    req.url.includes("beacon") ||
    req.url.includes("sync") ||
    req.path === "/chat" ||
    req.path === "/health" ||
    (req.isMobile && !req.path.includes("/subscription")) // Only skip CSRF for mobile if not subscription
  ) {
    // For GET requests that might need CSRF tokens for forms, generate them if session exists
    if (req.session && (req.method === "GET" || needsExplicitCsrf)) {
      try {
        csrfProtection(req, res, (err) => {
          if (!err && req.csrfToken) {
            res.locals.csrfToken = req.csrfToken();
          } else if (err) {
            console.warn(
              `[CSRF] Error generating token for ${req.path}:`,
              err.message
            );
            // Don't set res.locals.csrfToken to empty string - just leave it undefined
          }
          next();
        });
      } catch (error) {
        console.warn(
          `[CSRF] Exception generating token for ${req.path}:`,
          error.message
        );
        // Don't set res.locals.csrfToken to empty string - just leave it undefined
        next();
      }
    } else {
      // No need to set csrfToken to empty string - just leave it undefined
      next();
    }
  } else {
    // For POST/PUT/DELETE requests, apply CSRF protection
    if (req.isMobile && !req.path.includes("/subscription")) {
      // No need to set csrfToken to empty string for mobile paths - just leave it undefined
      return next();
    }

    // Apply CSRF protection with proper error handling
    csrfProtection(req, res, (err) => {
      if (err) {
        console.error(
          `[CSRF] Validation failed for ${req.method} ${req.path}:`,
          err.message
        );
        return res.status(403).render("error", {
          title: "Security Error",
          message: "Invalid security token. Please try again.",
          layout: false,
        });
      }
      next();
    });
  }
});

app.set("view engine", "ejs");
app.set("views", join(__dirname, "views"));
app.use(ejsLayouts);
app.use(express.static("public"));

// Add session verification endpoint for mobile debugging (after Passport middleware)
app.get("/api/verify-session", (req, res) => {
  res.json({
    authenticated: req.isAuthenticated(),
    user: req.user
      ? { id: req.user._id, email: req.user.email, name: req.user.name }
      : null,
    sessionID: req.sessionID,
    cookies: req.headers.cookie ? "Present" : "None",
    userAgent: req.headers["user-agent"],
    isMobile: req.isMobile,
    sessionData: {
      exists: !!req.session,
      passport: !!req.session.passport,
    },
  });
});

// Add mobile-specific login verification endpoint
app.post("/api/mobile-login-verify", (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
      },
      message: "Login verified successfully",
    });
  } else {
    res.status(401).json({
      success: false,
      message: "Not authenticated",
      debug: {
        sessionExists: !!req.session,
        sessionID: req.sessionID,
        cookies: req.headers.cookie ? "Present" : "None",
        userAgent: req.headers["user-agent"],
      },
    });
  }
});

// Auth routes
app.use("/auth", authRoutes);

// Custom logout route with CSRF protection explicitly applied
app.post("/auth/logout", csrfProtection, (req, res, next) => {
  // Log the CSRF token for debugging

  // Handle logout
  req.logout(function (err) {
    if (err) {
      console.error("[Logout] Error during logout:", err);
      return next(err);
    }
    console.log("[Logout] User logged out successfully");
    req.session.destroy(() => {
      res.redirect("/");
    });
  });
});

// Subscription routes
app.use("/subscription", subscriptionRoutes);

// Quiz progress routes
app.use("/quiz-progress", quizProgressRoutes);

// API route for saving quiz cancellations
app.post(
  "/api/save-quiz-cancellation",
  apiLimiter,
  requireAuth,
  async (req, res) => {
    try {
      const { quizData } = req.body;

      if (!quizData) {
        return res
          .status(400)
          .json({ success: false, error: "Quiz data is required" });
      }

      // Save to both stats and quizHistory
      await userOperations.updateQuizStats(req.user._id, quizData);

      // Save to quizHistory array (most important for progress tracking)
      const progressResult = await userOperations.saveQuizProgress(
        req.user._id,
        {
          title: quizData.category || "Unknown Quiz",
          questions: quizData.questions || [],
          answers: quizData.answers || [],
          lastQuestion: quizData.currentQuestion || 0,
        }
      );

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving quiz cancellation:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to save quiz cancellation" });
    }
  }
);

// Routes
app.get("/", checkSubscription, async (req, res) => {
  // Get custom data files and add them to categories
  const customCategories = await getCustomDataFiles();

  // Prepare user data for templates to prevent undefined errors
  const userData = {
    title: "MediQuest - Test Your Knowledge",
    categories: quizCategories,
    customCategories: customCategories,
    layout: false,
    isAuthenticated: req.isAuthenticated(),
    user: req.user || { name: "Guest" },
    locals: {
      isPremium:
        (req.user &&
          req.user.subscription &&
          req.user.subscription.isPremium) ||
        false,
      accessedQuizzes:
        req.user && req.user.subscription
          ? req.user.subscription.quizzesAccessed || []
          : [],
    },
    csrfToken: res.locals.csrfToken || null,
  };

  res.render("landing", userData);
});

app.get("/stats", (req, res) => {
  res.render("stats", {
    title: "Statistics",
    layout: false,
  });
});

app.get(
  "/quiz/:category",
  checkSubscription,
  checkQuizAccess,
  csrfProtection,
  async (req, res) => {
    const category = req.params.category;

    // Previously had biology-specific handling here
    // That code has been removed

    // Handle custom quizzes
    if (category.startsWith("custom-")) {
      // ...existing custom quiz handling...
    } else {
      // For other categories
      const questions = []; // Get questions from other sources
      const categoryDetails = quizCategories.find((cat) => cat.id === category);

      if (!categoryDetails) {
        return res.redirect("/");
      }

      try {
        // Generate a fresh CSRF token for this quiz page
        const token = req.csrfToken();
        console.log("[Quiz] Generated new CSRF token for quiz page");

        return res.render("quiz", {
          title: `${categoryDetails.title} Quiz`,
          questions: questions,
          category: categoryDetails,
          csrfToken: token, // Add CSRF token
          layout: false,
        });
      } catch (error) {
        console.error("[Quiz] Error generating CSRF token:", error);
        // Fall back to rendering without token
        return res.render("quiz", {
          title: `${categoryDetails.title} Quiz`,
          questions: questions,
          category: categoryDetails,
          layout: false,
        });
      }
    }
  }
);

// Add a route for custom quizzes with CSRF protection
app.get(
  "/quiz/custom/:filename",
  checkSubscription,
  checkQuizAccess,
  csrfProtection,
  async (req, res) => {
    const filename = req.params.filename;

    try {
      // Load custom questions from file
      const filePath = join(__dirname, "data", `${filename}.json`);
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);

      if (!fileExists) {
        return res.redirect("/");
      }

      const data = await fs.readFile(filePath, "utf8");
      const questions = JSON.parse(data);

      // Process the questions - assuming a format similar to other questions
      const processedQuestions = questions.map((q) => {
        // If the question has options array
        if (Array.isArray(q.options)) {
          return {
            question: q.question,
            options: q.options,
            correctAnswer:
              typeof q.correctAnswer === "number"
                ? q.correctAnswer
                : q.answer
                ? q.answer.charCodeAt(0) - "A".charCodeAt(0)
                : 0,
            explanation: q.explanation || "No explanation provided.",
          };
        }
        // If the question has A, B, C, D format
        else if (q.A && q.B) {
          return {
            question: q.question,
            options: [q.A, q.B, q.C || "", q.D || ""],
            correctAnswer: ["A", "B", "C", "D"].indexOf(q.answer),
            explanation: q.explanation || `The correct answer is ${q.answer}.`,
          };
        }
        // Default format
        return q;
      });

      const categoryDetails = {
        title: filename.replace(/-/g, " ").replace(/_/g, " "),
        icon: "fa-file-alt",
        id: `custom-${filename}`,
      };

      try {
        // Generate a fresh CSRF token for this custom quiz page
        const token = req.csrfToken();

        res.render("quiz", {
          title: `${categoryDetails.title} Quiz`,
          questions: processedQuestions,
          category: categoryDetails,
          csrfToken: token, // Add CSRF token
          layout: false,
        });
      } catch (error) {
        console.error("[Custom Quiz] Error generating CSRF token:", error);
        // Fall back to rendering without token
        res.render("quiz", {
          title: `${categoryDetails.title} Quiz`,
          questions: processedQuestions,
          category: categoryDetails,
          layout: false,
        });
      }
    } catch (error) {
      console.error(`Error loading custom quiz ${filename}:`, error);
      res.redirect("/");
    }
  }
);

// Chat endpoint - redirects to /api/ai-chat internally

// API route to check AI access for premium users
app.get("/api/check-ai-access", apiLimiter, checkAIAccess, (req, res) => {
  res.json({ hasAccess: true });
});

// API route for AI chat (with premium check)
app.post("/api/ai-chat", aiLimiter, checkAIAccess, async (req, res) => {
  try {
    const { message, chatHistory } = req.body;

    // Input validation
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Invalid message format" });
    }

    if (message.length > 1000) {
      return res.status(400).json({ error: "Message too long" });
    }

    // Sanitize the message
    const sanitizedMessage = xss(message);

    // System prompt for the AI
    const systemPrompt = `You are an AI for MediQuest, a medical quiz app. Help users with quiz questions, explain topics, and guide study. Focus only on medical topics.

Use simple English. Always give short, clear answers:
- Skip long intros or summaries
- Limit to key facts only
- Remember **concise answers only**
- Your answer should be of 4 lines max`;

    // Prepare chat history for the AI
    const history = [];

    // Add system message first
    history.push({
      role: "user",
      parts: [{ text: systemPrompt }],
    });
    history.push({
      role: "model",
      parts: [
        {
          text: "I understand. I'm your MediQuest AI assistant, ready to help with medical quiz questions and topics with concise, clear answers.",
        },
      ],
    });

    // Add previous chat history if provided
    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.forEach((msg) => {
        if (msg.user && msg.ai) {
          // Sanitize historical messages
          const sanitizedUser = xss(msg.user);
          const sanitizedAI = xss(msg.ai);

          history.push({
            role: "user",
            parts: [{ text: sanitizedUser }],
          });
          history.push({
            role: "model",
            parts: [{ text: sanitizedAI }],
          });
        }
      });
    }

    // Start chat with history
    const chat = model.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 200, // Keep responses short
        temperature: 0.7,
      },
    });

    // Send the new message
    const result = await chat.sendMessage(sanitizedMessage);
    const response = await result.response;

    // Sanitize AI response
    const sanitizedResponse = xss(response.text());

    res.json({ response: sanitizedResponse });
  } catch (error) {
    console.error("AI chat error:", error);
    res.status(500).json({ error: "Failed to get AI response" });
  }
});

// New route for additional quizzes
app.get("/additional-quizzes", checkSubscription, async (req, res) => {
  // Get custom data files
  const customCategories = await getCustomDataFiles();

  res.render("additional-quizzes", {
    title: "Additional Quizzes - MediQuest",
    customCategories: customCategories,
    layout: false,
  });
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// SECURITY: Error handling middleware with secure error messages
app.use((err, req, res, next) => {
  // Log full error for debugging but don't expose details to user
  console.error("Server Error:", err.stack);

  // Check for CSRF token errors
  if (err.code === "EBADCSRFTOKEN") {
    // Log basic info about CSRF errors
    console.error(`CSRF Error on ${req.method} ${req.path}`);

    return res.status(403).render("error", {
      title: "Security Error",
      message: "Form submission rejected. Please try again.",
      isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
      user: req.user || null,
      isPremium:
        (req.user &&
          req.user.subscription &&
          req.user.subscription.isPremium) ||
        false,
      layout: false,
    });
  }

  // Generic error for all other cases
  res.status(500).render("error", {
    title: "Error",
    message: "Something went wrong! Please try again later.",
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
    user: req.user || null,
    isPremium:
      (req.user && req.user.subscription && req.user.subscription.isPremium) ||
      false,
    layout: false,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render("404", {
    title: "Page Not Found",
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
    user: req.user || null,
    isPremium:
      (req.user && req.user.subscription && req.user.subscription.isPremium) ||
      false,
    layout: false,
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (dbConnected) {
      // Initialize database (create indexes)
      await initializeDatabase();
      console.log("Database initialized successfully");
    } else {
      console.warn("Database connection failed, but server will continue");
    }

    const PORT = process.env.PORT || 3000;
    if (process.env.PORT) {
      console.log(`Using PORT from environment: ${PORT}`);
    }
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Quiz app listening at http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
