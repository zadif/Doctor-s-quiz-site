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

    // Filter for JSON files, excluding known files
    const customFiles = files.filter(
      (file) =>
        file.endsWith(".json") &&
        file !== "450singlebest.json" &&
        file !== "sample-biology.json"
    );

    // Create category objects for each custom file
    return customFiles.map((file) => ({
      id: `custom-${file.replace(".json", "")}`,
      title: `${file
        .replace(".json", "")
        .replace(/-/g, " ")
        .replace(/_/g, " ")}`,
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

// SECURITY: Custom MongoDB injection prevention
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

// Session configuration
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
      secure: process.env.NODE_ENV === "production", // Only secure in production
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // Less strict in development
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// SECURITY: CSRF Protection setup - Use session-based CSRF instead of cookie-based
const csrfProtection = csrf({
  cookie: false, // Use session instead of cookies for CSRF token storage
  sessionKey: "session", // Use session for storage
  value: (req) => {
    // Try multiple sources for CSRF token
    return (
      req.body._csrf ||
      req.query._csrf ||
      req.headers["x-csrf-token"] ||
      req.headers["x-xsrf-token"]
    );
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

// Make user available in all templates
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.isAuthenticated = req.isAuthenticated();
  next();
});

// SECURITY: CSRF token middleware for forms - simplified approach
app.use((req, res, next) => {
  // Skip CSRF for GET requests, API endpoints, static files, auth endpoints, and background operations
  if (
    req.method === "GET" ||
    req.path.startsWith("/api/") ||
    req.path.startsWith("/public/") ||
    req.path === "/auth/sync-data" || // Skip CSRF for background sync
    req.path === "/auth/user-data" || // Skip CSRF for data fetching
    req.path === "/auth/logout" || // Skip CSRF for logout
    req.path === "/auth/login" || // Skip CSRF for login
    req.path === "/auth/register" || // Skip CSRF for registration
    req.path === "/auth/subscribe" || // Skip CSRF for subscription
    req.path === "/auth/save-progress" || // Skip CSRF for progress saving
    req.path === "/subscription/process-payment" || // Skip CSRF for payment processing
    req.path === "/subscription/cancel" || // Skip CSRF for subscription cancellation
    req.path === "/quiz-progress/save" || // Skip CSRF for quiz progress saving
    req.path.startsWith("/quiz-progress/") || // Skip CSRF for all quiz progress operations
    req.path === "/chat" || // Skip CSRF for chat endpoint
    req.path.startsWith("/auth/google") || // Skip CSRF for OAuth
    req.path === "/health" // Skip CSRF for health check
  ) {
    // For GET requests, try to generate CSRF token if session exists
    if (req.session && req.method === "GET") {
      try {
        csrfProtection(req, res, (err) => {
          if (!err && req.csrfToken) {
            res.locals.csrfToken = req.csrfToken();
          } else {
            res.locals.csrfToken = ""; // Fallback for when CSRF fails
          }
          next();
        });
      } catch (error) {
        console.warn(
          "CSRF token generation failed for GET request:",
          error.message
        );
        res.locals.csrfToken = "";
        next();
      }
    } else {
      res.locals.csrfToken = "";
      next();
    }
  } else {
    // For POST/PUT/DELETE requests, apply CSRF protection
    csrfProtection(req, res, next);
  }
});

app.set("view engine", "ejs");
app.set("views", join(__dirname, "views"));
app.use(ejsLayouts);
app.use(express.static("public"));

// Auth routes
app.use("/auth", authRoutes);

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
      const { quizData, markedAnswers } = req.body;

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
          markedAnswers: markedAnswers || [],
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

  res.render("landing", {
    title: "QuizMaster - Test Your Knowledge",
    categories: quizCategories,
    customCategories: customCategories,
    layout: false,
  });
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

      return res.render("quiz", {
        title: `${categoryDetails.title} Quiz`,
        questions: questions,
        category: categoryDetails,
        layout: false,
      });
    }
  }
);

// Add a route for custom quizzes
app.get(
  "/quiz/custom/:filename",
  checkSubscription,
  checkQuizAccess,
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

      res.render("quiz", {
        title: `${categoryDetails.title} Quiz`,
        questions: processedQuestions,
        category: categoryDetails,
        layout: false,
      });
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
    const systemPrompt = `You are an AI for QuizMaster, a medical quiz app. Help users with quiz questions, explain topics, and guide study. Focus only on medical topics.

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
          text: "I understand. I'm your QuizMaster AI assistant, ready to help with medical quiz questions and topics with concise, clear answers.",
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
    title: "Additional Quizzes - QuizMaster",
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
    // Add debugging info to identify which endpoint is causing issues
    console.error(`CSRF Error on ${req.method} ${req.path}`, {
      headers: req.headers,
      body: req.body,
      query: req.query,
    });

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
