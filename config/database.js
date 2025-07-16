import { getDatabase } from "../mongo.js";
import { ObjectId } from "mongodb";

export const quizProgressOperations = {
  // Save quiz progress - functionality removed
  async saveQuizProgress(
    userId,
    categoryId,
    questionIndex,
    score,
    userAnswers
  ) {
    // Progress saving functionality has been disabled
    // Return mock result
    return { acknowledged: true };
  },

  // Get quiz progress - functionality removed
  async getQuizProgress(userId, categoryId) {
    // Progress retrieval functionality has been disabled
    // Return null to indicate no saved progress
    return null;
  },

  // Reset quiz progress - functionality removed
  async resetQuizProgress(userId, categoryId) {
    // Progress reset functionality has been disabled
    // Return mock result
    return { acknowledged: true, deletedCount: 0 };
  },

  // Get all quiz progress for a user - functionality removed
  async getAllQuizProgress(userId) {
    // Progress retrieval functionality has been disabled
    // Return empty array to indicate no saved progress
    return [];
  },
};

export default { quizProgressOperations };
