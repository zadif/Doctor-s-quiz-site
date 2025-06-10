import { userOperations } from "../mongo.js";

// Middleware to check if user can access premium content
export const checkSubscription = async (req, res, next) => {
  // If not authenticated, redirect to login
  if (!req.isAuthenticated()) {
    return res.redirect("/auth/login");
  }

  try {
    const user = await userOperations.findUserById(req.user._id);

    // Make subscription status available in templates
    res.locals.isPremium = user.subscription && user.subscription.isPremium;
    res.locals.accessedQuizzes = user.subscription
      ? user.subscription.quizzesAccessed || []
      : [];

    next();
  } catch (error) {
    console.error("Error checking subscription:", error);
    next(error);
  }
};

// Middleware to check if user can access a specific quiz
export const checkQuizAccess = async (req, res, next) => {
  // If not authenticated, redirect to login
  if (!req.isAuthenticated()) {
    return res.redirect("/auth/login");
  }

  const quizId = req.params.category || req.params.filename;

  try {
    const accessResult = await userOperations.canAccessQuiz(
      req.user._id,
      quizId
    );

    if (!accessResult.canAccess) {
      // Get user to display their accessed quizzes
      const user = await userOperations.findUserById(req.user._id);
      const accessedQuizzes = user.subscription?.quizzesAccessed || [];

      // Render premium required page with accessed quizzes
      return res.render("premium-required", {
        title: "Premium Required - QuizMaster",
        accessedQuizzes: accessedQuizzes,
        isPremium: false,
        layout: false,
      });
    }

    // If they can access it, record the access if needed
    if (
      accessResult.reason !== "premium" &&
      accessResult.reason !== "alreadyAccessed"
    ) {
      await userOperations.recordQuizAccess(req.user._id, quizId);
    }

    next();
  } catch (error) {
    console.error("Error checking quiz access:", error);
    next(error);
  }
};

// Middleware to check AI chat access (premium only)
export const checkAIAccess = async (req, res, next) => {
  // If not authenticated, redirect to login
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Please login to access AI chat" });
  }

  try {
    const user = await userOperations.findUserById(req.user._id);

    // Check subscription expiry
    const expiryCheck = await userOperations.checkSubscriptionExpiry(
      req.user._id
    );

    if (!expiryCheck.isPremium || expiryCheck.isExpired) {
      return res.status(403).json({
        error:
          "AI support is for premium users only. Please upgrade your subscription.",
        premiumRequired: true,
      });
    }

    next();
  } catch (error) {
    console.error("Error checking AI access:", error);
    res.status(500).json({ error: "Server error" });
  }
};
