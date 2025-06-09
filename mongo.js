import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const uri =
  process.env.MONGODB_URI ||
  `mongodb+srv://zadifmustafa93:${process.env.MONGODB_PASSWORD}@doctorsdb.kxr9scf.mongodb.net/?retryWrites=true&w=majority&appName=doctorsDB`;

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
        },
        quizStats: {
          quizzes: [],
          totalQuizzes: 0,
          averageScore: 0,
          bestScore: 0,
        },
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
      if (!user.subscription.isPremium && user.subscription.quizzesCompleted >= user.subscription.maxQuizzes) {
        return { success: false, error: "Quiz limit exceeded. Please upgrade to premium." };
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

      return { success: true, stats: updatedStats, subscription: updatedSubscription };
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
      expiryDate.setMonth(expiryDate.getMonth() + 1); // 1 month subscription

      const updatedSubscription = {
        isPremium: true,
        subscriptionDate: subscriptionDate,
        expiryDate: expiryDate,
        quizzesCompleted: user.subscription.quizzesCompleted || 0,
        maxQuizzes: -1, // Unlimited for premium users
        paymentMethod: subscriptionData.paymentMethod,
        paymentId: subscriptionData.paymentId,
        amount: subscriptionData.amount,
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
          }
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
  async saveQuizProgress(userId, progressData) {
    try {
      const collection = await getCollection();
      const result = await collection.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            currentQuizProgress: progressData,
            updatedAt: new Date(),
          },
        }
      );
      return { success: true };
    } catch (error) {
      console.error("Error saving quiz progress:", error);
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

// Close database connection
export async function closeConnection() {
  try {
    await client.close();
    console.log("Database connection closed");
  } catch (error) {
    console.error("Error closing database connection:", error);
  }
}

export { testConnection, ObjectId };