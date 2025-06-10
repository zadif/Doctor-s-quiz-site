import express from "express";
import { userOperations } from "../mongo.js";
import { requireAuth } from "./auth.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

// Subscription page
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = await userOperations.findUserById(req.user._id);
    const isPremium = user.subscription && user.subscription.isPremium;
    const accessedQuizzes = user.subscription
      ? user.subscription.quizzesAccessed || []
      : [];
    const remainingQuizzes = 3 - accessedQuizzes.length;

    res.render("subscription/index", {
      title: "Premium Subscription - QuizMaster",
      isPremium,
      accessedQuizzes,
      remainingQuizzes: remainingQuizzes > 0 ? remainingQuizzes : 0,
      error: req.query.error,
      success: req.query.success,
      layout: false,
    });
  } catch (error) {
    console.error("Error getting subscription page:", error);
    res.status(500).send("Something went wrong. Please try again.");
  }
});

// Process payment page
router.get("/checkout", requireAuth, (req, res) => {
  res.render("subscription/checkout", {
    title: "Checkout - QuizMaster",
    layout: false,
  });
});

// Process payment
router.post("/process-payment", requireAuth, async (req, res) => {
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
});

// Cancel subscription
router.post("/cancel", requireAuth, async (req, res) => {
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
