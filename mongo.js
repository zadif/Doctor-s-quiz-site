import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// SECURITY FIX: Remove hardcoded credentials from code
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error(
    "ERROR: MongoDB URI not set! Please set MONGODB_URI environment variable"
  );
  // Don't exit process to allow server to start in development mode with warnings
}

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const DB_NAME = "doctorsDB";
const COLLECTION_NAME = "doctors";

// Test connection function
async function testConnection() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    return true;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    return false;
  } finally {
    await client.close();
  }
}

// Get database instance
async function getDatabase() {
  await client.connect();
  return client.db(DB_NAME);
}

// Get collection instance
async function getCollection() {
  const db = await getDatabase();
  return db.collection(COLLECTION_NAME);
}

// User operations
export const userOperations = {
  // Quiz progress operations
  async saveQuizProgress(userId, quizData) {
    try {
      const { title, questions, answers, lastQuestion } = quizData;

      const collection = await getCollection();
      const user = await this.findUserById(userId);

      if (!user) {
        console.error(`[DB] User not found: ${userId}`);
        return { success: false, error: "User not found" };
      }

      // Check if this quiz exists in user's history
      const quizHistoryIndex =
        user.quizHistory?.findIndex((q) => q.title === title) ?? -1;

      let updatedQuizHistory = user.quizHistory || [];

      if (quizHistoryIndex >= 0) {
        // Update existing quiz progress
        updatedQuizHistory[quizHistoryIndex] = {
          title,
          questions: questions || [],
          answers: answers || [],
          lastQuestion,
          updatedAt: new Date(),
          // Preserve creation date
          createdAt:
            updatedQuizHistory[quizHistoryIndex].createdAt || new Date(),
        };
      } else {
        // Add new quiz progress
        updatedQuizHistory.push({
          title,
          questions: questions || [],
          answers: answers || [],
          lastQuestion,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const result = await collection.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            quizHistory: updatedQuizHistory,
            updatedAt: new Date(),
          },
        }
      );

      return {
        success: true,
        modifiedCount: result.modifiedCount,
        quizHistory: updatedQuizHistory,
        updated: quizHistoryIndex >= 0,
        added: quizHistoryIndex < 0,
      };
    } catch (error) {
      console.error("Error saving quiz progress:", error);
      return { success: false, error: error.message };
    }
  },

  async getQuizProgress(userId, title) {
    try {
      const user = await this.findUserById(userId);

      if (!user) {
        console.log(`[DB] User not found: ${userId}`);
        return { success: false, hasProgress: false, error: "User not found" };
      }

      if (!user.quizHistory) {
        console.log(`[DB] No quiz history for user ${userId}`);
        return { success: true, hasProgress: false };
      }

      // Check all titles in quiz history for debugging
      if (user.quizHistory.length > 0) {
        user.quizHistory.forEach((q, i) => {
          // Also check if the title might have " Quiz" suffix
          if (title.endsWith(" Quiz")) {
            const titleWithoutSuffix = title.replace(" Quiz", "");
          }
        });
      }

      // First try exact match
      let quizProgress = user.quizHistory.find((q) => q.title === title);

      // If not found and title ends with " Quiz", try without the suffix
      if (!quizProgress && title.endsWith(" Quiz")) {
        const titleWithoutSuffix = title.replace(" Quiz", "");

        quizProgress = user.quizHistory.find(
          (q) => q.title === titleWithoutSuffix
        );
      }

      if (quizProgress) {
        return {
          success: true,
          hasProgress: true,
          progress: quizProgress,
        };
      } else {
        return { success: true, hasProgress: false };
      }
    } catch (error) {
      console.error("Error getting quiz progress:", error);
      return { success: false, error: error.message };
    }
  },

  async removeQuizProgress(userId, title) {
    try {
      const collection = await getCollection();
      const user = await this.findUserById(userId);

      if (!user || !user.quizHistory) {
        return { success: false, error: "User or quiz history not found" };
      }

      const updatedQuizHistory = user.quizHistory.filter(
        (q) => q.title !== title
      );

      const result = await collection.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            quizHistory: updatedQuizHistory,
            updatedAt: new Date(),
          },
        }
      );

      return {
        success: true,
        modifiedCount: result.modifiedCount,
        quizHistory: updatedQuizHistory,
      };
    } catch (error) {
      console.error("Error removing quiz progress:", error);
      return { success: false, error: error.message };
    }
  },

  // Create a new user
  async createUser(userData) {
    try {
      const collection = await getCollection();
      const user = {
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
        subscription: {
          isPremium: false,
          subscriptionDate: null,
          expiryDate: null,
          quizzesCompleted: 0,
          maxQuizzes: 3, // Free users can take 3 quizzes
          quizzesAccessed: [], // Track which quizzes were accessed
          paymentHistory: [], // Store payment records
        },
        quizStats: {
          quizzes: [],
          totalQuizzes: 0,
          averageScore: 0,
          bestScore: 0,
        },
        quizHistory: [], // Array to store quiz progress
        preferences: {
          darkMode: false,
          notifications: true,
        },
      };

      const result = await collection.insertOne(user);
      return { success: true, userId: result.insertedId };
    } catch (error) {
      console.error("Error creating user:", error);
      return { success: false, error: error.message };
    }
  },

  // Find user by email
  async findUserByEmail(email) {
    try {
      const collection = await getCollection();
      const user = await collection.findOne({ email: email.toLowerCase() });
      return user;
    } catch (error) {
      console.error("Error finding user by email:", error);
      return null;
    }
  },

  // Find user by ID
  async findUserById(userId) {
    try {
      const collection = await getCollection();
      const user = await collection.findOne({ _id: new ObjectId(userId) });
      return user;
    } catch (error) {
      console.error("Error finding user by ID:", error);
      return null;
    }
  },

  // Find user by Google ID
  async findUserByGoogleId(googleId) {
    try {
      const collection = await getCollection();
      const user = await collection.findOne({ googleId: googleId });
      return user;
    } catch (error) {
      console.error("Error finding user by Google ID:", error);
      return null;
    }
  },

  // Update user
  async updateUser(userId, updateData) {
    try {
      const collection = await getCollection();
      const result = await collection.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            ...updateData,
            updatedAt: new Date(),
          },
        }
      );
      return { success: true, modifiedCount: result.modifiedCount };
    } catch (error) {
      console.error("Error updating user:", error);
      return { success: false, error: error.message };
    }
  },

  // Update user quiz stats and check subscription limits
  async updateQuizStats(userId, quizData) {
    try {
      const collection = await getCollection();
      const user = await this.findUserById(userId);

      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Check if user has exceeded quiz limit
      if (
        !user.subscription.isPremium &&
        user.subscription.quizzesCompleted >= user.subscription.maxQuizzes
      ) {
        return {
          success: false,
          error: "Quiz limit exceeded. Please upgrade to premium.",
        };
      }

      const updatedStats = {
        ...user.quizStats,
        quizzes: [...(user.quizStats?.quizzes || []), quizData],
        totalQuizzes: (user.quizStats?.totalQuizzes || 0) + 1,
      };

      // Calculate new average and best score
      const scores = updatedStats.quizzes.map((quiz) => quiz.score);
      updatedStats.averageScore = Math.round(
        scores.reduce((a, b) => a + b, 0) / scores.length
      );
      updatedStats.bestScore = Math.max(...scores);

      // Update subscription quiz count
      const updatedSubscription = {
        ...user.subscription,
        quizzesCompleted: user.subscription.quizzesCompleted + 1,
      };

      const result = await collection.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            quizStats: updatedStats,
            subscription: updatedSubscription,
            updatedAt: new Date(),
          },
        }
      );

      return {
        success: true,
        stats: updatedStats,
        subscription: updatedSubscription,
      };
    } catch (error) {
      console.error("Error updating quiz stats:", error);
      return { success: false, error: error.message };
    }
  },

  // Update subscription status
  async updateSubscription(userId, subscriptionData) {
    try {
      const collection = await getCollection();
      const user = await this.findUserById(userId);

      if (!user) {
        return { success: false, error: "User not found" };
      }
      const subscriptionDate = new Date();
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 6); // 6 month subscription

      const updatedSubscription = {
        isPremium: true,
        subscriptionDate: subscriptionDate,
        expiryDate: expiryDate,
        quizzesCompleted: user.subscription.quizzesCompleted || 0,
        maxQuizzes: -1, // Unlimited for premium users
        quizzesAccessed: user.subscription.quizzesAccessed || [],
        paymentHistory: [
          ...(user.subscription.paymentHistory || []),
          {
            paymentId: subscriptionData.paymentId,
            paymentMethod: subscriptionData.paymentMethod,
            amount: subscriptionData.amount,
            phoneNumber: subscriptionData.phoneNumber,
            transactionId: subscriptionData.transactionId,
            date: subscriptionDate,
            status: "completed",
          },
        ],
      };

      const result = await collection.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            subscription: updatedSubscription,
            updatedAt: new Date(),
          },
        }
      );

      return { success: true, subscription: updatedSubscription };
    } catch (error) {
      console.error("Error updating subscription:", error);
      return { success: false, error: error.message };
    }
  },

  // Check if subscription is expired
  async checkSubscriptionExpiry(userId) {
    try {
      const user = await this.findUserById(userId);

      if (!user || !user.subscription.isPremium) {
        return { isExpired: false, isPremium: false };
      }

      const now = new Date();
      const expiryDate = new Date(user.subscription.expiryDate);

      if (now > expiryDate) {
        // Subscription expired, downgrade to free
        await this.updateUser(userId, {
          subscription: {
            ...user.subscription,
            isPremium: false,
            maxQuizzes: 3,
          },
        });
        return { isExpired: true, isPremium: false };
      }

      return { isExpired: false, isPremium: true };
    } catch (error) {
      console.error("Error checking subscription expiry:", error);
      return { isExpired: false, isPremium: false };
    }
  },

  // Update user preferences
  async updatePreferences(userId, preferences) {
    try {
      const collection = await getCollection();
      const result = await collection.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            preferences: preferences,
            updatedAt: new Date(),
          },
        }
      );
      return { success: true, modifiedCount: result.modifiedCount };
    } catch (error) {
      console.error("Error updating preferences:", error);
      return { success: false, error: error.message };
    }
  },
  // Save incomplete quiz progress
  // Use the first implementation for saveQuizProgress instead of this one
  // This redirects to the implementation that uses quizHistory array
  async saveQuizProgressLegacy(userId, progressData) {
    console.log(
      "Legacy quiz progress function called - redirecting to new implementation"
    );

    // Convert legacy format to new format
    return this.saveQuizProgress(userId, {
      title: progressData.category || "Unknown Quiz",
      questions: [],
      markedAnswers: [],
      lastQuestion: progressData.currentQuestion || 0,
    });
  },

  // Check if user can access a specific quiz
  async canAccessQuiz(userId, quizId) {
    try {
      const user = await this.findUserById(userId);

      if (!user) {
        return { canAccess: false, reason: "User not found" };
      }

      // Check subscription expiry first
      const expiryCheck = await this.checkSubscriptionExpiry(userId);

      // Premium users with valid subscription can access all quizzes
      if (expiryCheck.isPremium && !expiryCheck.isExpired) {
        return { canAccess: true, reason: "premium" };
      }

      // Check if quiz was already accessed
      const accessedQuizzes = user.subscription.quizzesAccessed || [];
      if (accessedQuizzes.includes(quizId)) {
        return { canAccess: true, reason: "alreadyAccessed" };
      }

      // Check if user has reached free quiz limit
      if (accessedQuizzes.length >= 3) {
        return { canAccess: false, reason: "limitExceeded" };
      }

      // User can access this quiz (within free limit)
      return { canAccess: true, reason: "withinLimit" };
    } catch (error) {
      console.error("Error checking quiz access:", error);
      return { canAccess: false, reason: "error" };
    }
  },

  // Record quiz access
  async recordQuizAccess(userId, quizId) {
    try {
      const collection = await getCollection();
      const user = await this.findUserById(userId);

      if (!user) {
        return { success: false, error: "User not found" };
      }

      const accessedQuizzes = user.subscription.quizzesAccessed || [];

      // Don't record if already accessed
      if (accessedQuizzes.includes(quizId)) {
        return { success: true, message: "Quiz already accessed" };
      }

      // Add to accessed quizzes
      const updatedQuizzes = [...accessedQuizzes, quizId];

      const result = await collection.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            "subscription.quizzesAccessed": updatedQuizzes,
            updatedAt: new Date(),
          },
        }
      );

      return { success: true, accessedQuizzes: updatedQuizzes };
    } catch (error) {
      console.error("Error recording quiz access:", error);
      return { success: false, error: error.message };
    }
  },

  // Cancel subscription
  async cancelSubscription(userId) {
    try {
      const collection = await getCollection();
      const user = await this.findUserById(userId);

      if (!user) {
        return { success: false, error: "User not found" };
      }

      const updatedSubscription = {
        ...user.subscription,
        isPremium: false,
        expiryDate: null,
        maxQuizzes: 3,
      };

      const result = await collection.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            subscription: updatedSubscription,
            updatedAt: new Date(),
          },
        }
      );

      return { success: true, subscription: updatedSubscription };
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      return { success: false, error: error.message };
    }
  },

  // Delete user
  async deleteUser(userId) {
    try {
      const collection = await getCollection();
      const result = await collection.deleteOne({ _id: new ObjectId(userId) });
      return { success: true, deletedCount: result.deletedCount };
    } catch (error) {
      console.error("Error deleting user:", error);
      return { success: false, error: error.message };
    }
  },
};

// Initialize database and create indexes
export async function initializeDatabase() {
  try {
    const collection = await getCollection();

    // Create indexes for better performance
    await collection.createIndex({ email: 1 }, { unique: true });
    await collection.createIndex({ googleId: 1 }, { sparse: true });
    await collection.createIndex({ "subscription.expiryDate": 1 });

    console.log("Database initialized successfully");
    return true;
  } catch (error) {
    console.error("Error initializing database:", error);
    return false;
  }
}
async function getInstances(filter = {}) {
  try {
    const collection = await getCollection();
    return await collection.find(filter).toArray();
  } catch (error) {
    console.error("Error fetching instances from mongodb:", error);
    throw error;
  }
}

// Close database connection
export async function closeConnection() {
  try {
    await client.close();
    console.log("Database connection closed");
  } catch (error) {
    console.error("Error closing database connection:", error);
  }
}

export { testConnection, ObjectId, getInstances, closeConnection };
