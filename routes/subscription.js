import express from "express";
import { userOperations } from "../mongo.js";
import { requireAuth } from "./auth.js";
import { v4 as uuidv4 } from "uuid";
import csrf from "csurf";

const router = express.Router();

// Initialize CSRF protection - moved to the top of the file
const csrfProtection = csrf({
  cookie: {
    key: "_csrf",
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 3600, // 1 hour in seconds
  },
});

// Subscription page with CSRF protection
router.get("/", requireAuth, csrfProtection, async (req, res) => {
  try {
    // Generate a fresh CSRF token for this subscription page
    const token = req.csrfToken();

    const user = await userOperations.findUserById(req.user._id);
    const isPremium = user.subscription && user.subscription.isPremium;
    const accessedQuizzes = user.subscription
      ? user.subscription.quizzesAccessed || []
      : [];
    const remainingQuizzes = 3 - accessedQuizzes.length;

    res.render("subscription/index", {
      title: "Premium Subscription - MediQuest",
      isPremium,
      accessedQuizzes,
      remainingQuizzes: remainingQuizzes > 0 ? remainingQuizzes : 0,
      error: req.sanitizedQuery ? req.sanitizedQuery.error : req.query.error,
      success: req.sanitizedQuery
        ? req.sanitizedQuery.success
        : req.query.success,
      csrfToken: token, // Always include the CSRF token
      layout: false,
    });
  } catch (error) {
    console.error("Error getting subscription page:", error);
    res.status(500).send("Something went wrong. Please try again.");
  }
});

// Process payment page with explicit CSRF token generation
router.get("/checkout", requireAuth, csrfProtection, (req, res) => {
  try {
    // Generate a fresh CSRF token for this checkout page
    const token = req.csrfToken();

    const renderOptions = {
      title: "Checkout - MediQuest",
      layout: false,
      csrfToken: token, // Always include the token
    };

    res.render("subscription/checkout", renderOptions);
  } catch (error) {
    console.error("[Checkout] Error generating CSRF token:", error);
    // Fallback without token if something went wrong
    res.render("subscription/checkout", {
      title: "Checkout - MediQuest",
      layout: false,
      csrfError: "Failed to generate security token. Please try again.",
    });
  }
});

// Process payment with explicit CSRF protection
router.post(
  "/process-payment",
  requireAuth,
  csrfProtection,
  async (req, res) => {
    try {
      const { paymentMethod, phoneNumber } = req.body;

      // Validate phone number for Pakistani payment methods
      if (
        (paymentMethod === "jazzcash" || paymentMethod === "easypaisa") &&
        !phoneNumber
      ) {
        return res.redirect("/subscription/checkout?error=phone_required");
      }

      // Generate transaction ID
      const transactionId = uuidv4();
      const paymentId = `PMT_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Update the user's subscription status
      const subscriptionData = {
        paymentMethod: paymentMethod,
        paymentId: paymentId,
        transactionId: transactionId,
        amount: 1000, // PKR 1000
        phoneNumber: phoneNumber || null,
      };

      const result = await userOperations.updateSubscription(
        req.user._id,
        subscriptionData
      );

      if (result.success) {
        res.redirect("/subscription?success=payment_successful");
      } else {
        res.redirect("/subscription?error=payment_failed");
      }
    } catch (error) {
      console.error("Error processing payment:", error);
      res.redirect("/subscription?error=system_error");
    }
  }
);

// Cancel subscription with explicit CSRF protection
router.post("/cancel", requireAuth, csrfProtection, async (req, res) => {
  // Log debug info

  try {
    const result = await userOperations.cancelSubscription(req.user._id);

    if (result.success) {
      res.redirect("/subscription?success=cancellation_successful");
    } else {
      res.redirect("/subscription?error=cancellation_failed");
    }
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    res.redirect("/subscription?error=system_error");
  }
});

export default router;
