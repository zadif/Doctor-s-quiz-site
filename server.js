import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import ejsLayouts from "express-ejs-layouts";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import fs from "fs/promises";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

// Setup middleware
app.use(express.json());
app.set("view engine", "ejs");
app.set("views", join(__dirname, "views"));
app.use(ejsLayouts);
app.use(express.static("public"));

// Routes
app.get("/", async (req, res) => {
  // Get custom data files and add them to categories
  const customCategories = await getCustomDataFiles();

  res.render("landing", {
    title: "QuizMaster - Test Your Knowledge",
    categories: quizCategories,
    customCategories: customCategories,
  });
});

app.get("/stats", (req, res) => {
  res.render("stats", { title: "Statistics" });
});

app.get("/quiz/:category", async (req, res) => {
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
    });
  }
});

// Add a route for custom quizzes
app.get("/quiz/custom/:filename", async (req, res) => {
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
    });
  } catch (error) {
    console.error(`Error loading custom quiz ${filename}:`, error);
    res.redirect("/");
  }
});

// Chat endpoint
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const result = await model.generateContent(message);
    const response = await result.response;
    res.json({ response: response.text() });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Failed to get response" });
  }
});

// New route for additional quizzes
app.get("/additional-quizzes", async (req, res) => {
  // Get custom data files
  const customCategories = await getCustomDataFiles();

  res.render("additional-quizzes", {
    title: "Additional Quizzes - QuizMaster",
    customCategories: customCategories,
  });
});

app.listen(port, () => {
  console.log(`Quiz app listening at http://localhost:${port}`);
});
