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

  // Update user quiz stats
  async updateQuizStats(userId, quizData) {
    try {
      const collection = await getCollection();
      const user = await this.findUserById(userId);

      if (!user) {
        return { success: false, error: "User not found" };
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

      const result = await collection.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            quizStats: updatedStats,
            updatedAt: new Date(),
          },
        }
      );

      return { success: true, stats: updatedStats };
    } catch (error) {
      console.error("Error updating quiz stats:", error);
      return { success: false, error: error.message };
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
