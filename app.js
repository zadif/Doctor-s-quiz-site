const express = require("express");
const app = express();
const path = require("path");
const fs = require("fs");

// Set view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Quiz categories
const quizCategories = [
  { id: "general", name: "General Knowledge" },
  { id: "science", name: "Science & Technology" },
  { id: "history", name: "History" },
  { id: "sports", name: "Sports" },
  { id: "biology", name: "Biology" },
];

// Routes
app.get("/", (req, res) => {
  res.render("index", { categories: quizCategories });
});

app.get("/quiz/:category", (req, res) => {
  const category = req.params.category;
  // Fetch questions based on category
  const questions = getQuestionsByCategory(category);
  res.render("quiz", { category, questions });
});

app.get("/stats", (req, res) => {
  res.render("stats", { title: "Statistics" });
});

// Handle 404 errors
app.use((req, res, next) => {
  res.status(404).render("404");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

function getQuestionsByCategory(category) {
  // Check if the category is biology
  if (category === "biology") {
    try {
      // Check multiple possible file paths
      let filePath = path.join(__dirname, "data", "450singlebest.json");
      if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, "data", "sample-biology.json");

        if (!fs.existsSync(filePath)) {
          // Create data directory if it doesn't exist
          if (!fs.existsSync(path.join(__dirname, "data"))) {
            fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
          }

          // Create sample file with fallback questions
          const sampleQuestions = [
            {
              question: "Which of the following is the powerhouse of the cell?",
              A: "Nucleus",
              B: "Mitochondria",
              C: "Golgi Apparatus",
              D: "Endoplasmic Reticulum",
              answer: "B",
              explanation:
                "Mitochondria are referred to as the powerhouse of the cell.",
              subject: "Biology",
            },
            {
              question:
                "What is the process by which plants make their own food using sunlight?",
              A: "Respiration",
              B: "Photosynthesis",
              C: "Transpiration",
              D: "Germination",
              answer: "B",
              explanation:
                "Photosynthesis is the process used by plants to create food.",
              subject: "Biology",
            },
          ];

          fs.writeFileSync(
            path.join(__dirname, "data", "sample-biology.json"),
            JSON.stringify(sampleQuestions, null, 2)
          );

          // Use the new path
          filePath = path.join(__dirname, "data", "sample-biology.json");
        }
      }

      // Load questions from file
      const data = fs.readFileSync(filePath, "utf8");
      const allQuestions = JSON.parse(data);

      // Process all questions - assuming all are biology questions
      const biologyQuestions = [];

      for (const q of allQuestions) {
        // Check if it uses the new format with "options" array
        const isNewFormat = Array.isArray(q.options);

        // Process questions based on the format
        if (
          isNewFormat &&
          Array.isArray(q.options) &&
          q.options.length >= 2 &&
          q.answer
        ) {
          // Handle new format with options array
          // Extract the letter index (A=0, B=1, etc.) from the answer
          const correctAnswerIndex = q.answer.charCodeAt(0) - "A".charCodeAt(0);

          biologyQuestions.push({
            question: q.question,
            options: q.options.map((opt) => {
              // Remove the letter prefix if present (e.g., "A. Option" -> "Option")
              const match = opt.match(/^[A-E]\.\s*(.*)/);
              return match ? match[1] : opt;
            }),
            correctAnswer: correctAnswerIndex,
            explanation: q.explanation || `The correct answer is ${q.answer}.`,
          });
        } else if (q.A && q.B && q.C && q.D && q.answer) {
          // Handle old format with A, B, C, D properties
          biologyQuestions.push({
            question: q.question,
            options: [q.A, q.B, q.C, q.D],
            correctAnswer: ["A", "B", "C", "D"].indexOf(q.answer),
            explanation: q.explanation || `The correct answer is ${q.answer}.`,
          });
        }
      }

      // If no biology questions were found, use sample file
      if (biologyQuestions.length === 0) {
        try {
          const samplePath = path.join(
            __dirname,
            "data",
            "sample-biology.json"
          );
          if (fs.existsSync(samplePath)) {
            const sampleData = fs.readFileSync(samplePath, "utf8");
            const sampleQuestions = JSON.parse(sampleData);

            return sampleQuestions.map((q) => ({
              question: q.question,
              options: [q.A, q.B, q.C, q.D],
              correctAnswer: ["A", "B", "C", "D"].indexOf(q.answer),
              explanation:
                q.explanation || `The correct answer is ${q.answer}.`,
            }));
          }
        } catch (error) {
          console.error("Error loading sample biology questions:", error);
        }

        // Fallback to hardcoded questions if needed
        return [
          {
            question: "Which of the following is the powerhouse of the cell?",
            options: [
              "Nucleus",
              "Mitochondria",
              "Golgi Apparatus",
              "Endoplasmic Reticulum",
            ],
            correctAnswer: 1,
            explanation:
              "Mitochondria are often referred to as the powerhouse of the cell.",
          },
          {
            question:
              "What is the process by which plants make their own food using sunlight?",
            options: [
              "Respiration",
              "Photosynthesis",
              "Transpiration",
              "Germination",
            ],
            correctAnswer: 1,
            explanation:
              "Photosynthesis is the process used by plants to create food.",
          },
        ];
      }

      // Return all questions in their original order (no randomizing or limiting)
      return biologyQuestions;
    } catch (error) {
      console.error("Error loading biology questions:", error);
      // Fallback to static questions if there's an error
      return [
        {
          question: "Which of the following is the powerhouse of the cell?",
          options: [
            "Nucleus",
            "Mitochondria",
            "Golgi Apparatus",
            "Endoplasmic Reticulum",
          ],
          correctAnswer: 1,
          explanation:
            "Mitochondria are often referred to as the powerhouse of the cell.",
        },
      ];
    }
  }

  // Return existing mock data for other categories
  const questions = [
    {
      question: "What is the capital of France?",
      options: ["Paris", "London", "Berlin", "Madrid"],
      correctAnswer: 0,
      explanation: "Paris is the capital and most populous city of France.",
    },
    {
      question: "Which planet is known as the Red Planet?",
      options: ["Earth", "Mars", "Jupiter", "Saturn"],
      correctAnswer: 1,
      explanation:
        'Mars is often called the "Red Planet" because of its reddish appearance.',
    },
  ];
  return questions;
}
