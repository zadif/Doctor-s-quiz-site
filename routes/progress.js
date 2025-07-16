import express from "express";
import { ObjectId } from "mongodb";
import { getDatabase } from "../mongo.js";
import { quizProgressOperations } from "../config/database.js";
import { ensureAuthenticated } from "../middleware/subscription.js";

const router = express.Router();

// Save quiz progress - functionality removed
router.post("/save-quiz-progress", ensureAuthenticated, async (req, res) => {
  // Progress saving feature has been removed
  // Just return success without saving anything
  res
    .status(200)
    .json({ success: true, message: "Progress saving has been disabled" });
});

// Get quiz progress - functionality removed
router.get(
  "/quiz-progress/:categoryId",
  ensureAuthenticated,
  async (req, res) => {
    // Progress retrieval feature has been removed
    // Always return no progress
    res.json({ hasProgress: false });
  }
);

// Reset quiz progress - functionality removed
router.post("/quiz-progress/reset", ensureAuthenticated, async (req, res) => {
  // Progress reset feature has been removed
  // Just return success
  res.json({ success: true, message: "Progress saving has been disabled" });
});

export default router;
