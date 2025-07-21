import express from "express";
import { ObjectId } from "mongodb";
import { userOperations } from "../mongo.js";
import { requireAuth } from "./auth.js";
import csrf from "csurf";

const router = express.Router();

// Initialize CSRF protection
const csrfProtection = csrf({
  cookie: {
    key: "_csrf",
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 3600, // 1 hour in seconds
  },
});

// Save quiz progress for authenticated users with CSRF protection
router.post("/save", requireAuth, csrfProtection, async (req, res) => {
  try {
    // Log debug info for CSRF troubleshooting

    const { title, questions, markedAnswers, lastQuestion } = req.body;
    const userId = req.user._id;

    if (!title) {
      console.log("Error: Quiz title is required");
      return res
        .status(400)
        .json({ success: false, error: "Quiz title is required" });
    }

    const result = await userOperations.saveQuizProgress(userId, {
      title,
      questions,
      markedAnswers,
      lastQuestion,
    });

    if (result.success) {
      res.status(200).json({
        success: true,
        message: "Quiz progress saved successfully",
      });
    } else {
      console.log("Error saving quiz progress:", result.error);
      res.status(500).json({
        success: false,
        error: result.error || "Failed to save quiz progress",
      });
    }
  } catch (error) {
    console.error("Error saving quiz progress:", error);
    res.status(500).json({ success: false, error: "Failed to save progress" });
  }
});

// Get quiz progress for a specific quiz
router.get("/:title", requireAuth, async (req, res) => {
  try {
    const { title } = req.params;
    const userId = req.user._id;

    const result = await userOperations.getQuizProgress(userId, title);

    if (result.success) {
      res.json(result);
    } else {
      console.log(`[Route] Quiz progress failed: ${result.error}`);
      res.status(500).json({
        success: false,
        error: result.error || "Failed to get quiz progress",
      });
    }
  } catch (error) {
    console.error("Error getting quiz progress:", error);
    res.status(500).json({ success: false, error: "Failed to fetch progress" });
  }
});

// Remove quiz progress with CSRF protection
router.delete("/:title", requireAuth, csrfProtection, async (req, res) => {
  try {
    // Log debug info for CSRF troubleshooting

    const { title } = req.params;
    const userId = req.user._id;

    const result = await userOperations.removeQuizProgress(userId, title);

    if (result.success) {
      res.json({
        success: true,
        message: "Quiz progress removed successfully",
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || "Failed to remove quiz progress",
      });
    }
  } catch (error) {
    console.error("Error removing quiz progress:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to remove progress" });
  }
});

export default router;
