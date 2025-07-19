// User data synchronization functionality

class UserSync {
  constructor() {
    this.isAuthenticated = false;
    this.syncInterval = null;
    this.isSyncing = false; // Add flag to prevent concurrent syncs
    this.init();
  }

  async init() {
    // Check if user is authenticated
    this.isAuthenticated = await this.checkAuthStatus();

    if (this.isAuthenticated) {
      // Load user data from server
      await this.loadUserData();

      // Start periodic sync
      this.startPeriodicSync();

      // Override localStorage methods to sync with server
      this.overrideLocalStorage();

      // Set up activity tracking to prevent zombie syncing
      this.setupActivityTracking();
    }
  }

  // Set up user activity tracking
  setupActivityTracking() {
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];

    // Throttle activity tracking to avoid excessive calls
    let activityThrottle = false;
    const trackActivity = () => {
      if (!activityThrottle) {
        this.trackUserActivity();
        activityThrottle = true;
        setTimeout(() => {
          activityThrottle = false;
        }, 30000); // Throttle for 30 seconds
      }
    };

    // Add event listeners for user activity
    events.forEach((event) => {
      document.addEventListener(event, trackActivity, { passive: true });
    });

    // Track initial activity
    this.trackUserActivity();
  }

  async checkAuthStatus() {
    try {
      const response = await fetch("/auth/user-data", {
        method: "GET",
        credentials: "include", // Ensure cookies are included
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      // Enhanced mobile debugging
      if (!response.ok) {
        console.log("Auth check failed, verifying session...");
        const verifyResponse = await fetch("/api/verify-session", {
          credentials: "include",
        });

        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.json();
          console.log("Session verification data:", verifyData);
          return verifyData.authenticated;
        }
        return false; // Add explicit return for failed verification
      }

      return response.ok;
    } catch (error) {
      console.error("Auth status check error:", error);
      return false;
    }
  }

  async loadUserData() {
    try {
      const response = await fetch("/auth/user-data");

      if (response.ok) {
        const data = await response.json();

        // Update localStorage with server data
        if (data.data.quizStats) {
          localStorage.setItem(
            "quizStats",
            JSON.stringify(data.data.quizStats)
          );
        }

        if (data.data.preferences) {
          // Apply dark mode preference
          if (data.data.preferences.darkMode) {
            localStorage.setItem("darkMode", "enabled");
            document.documentElement.classList.add("dark-mode");
            document.body.classList.add("dark-mode");
          } else {
            localStorage.setItem("darkMode", "disabled");
            document.documentElement.classList.remove("dark-mode");
            document.body.classList.remove("dark-mode");
          }
        }
      }
    } catch (error) {
      console.error("Failed to load user data:");
    }
  }
  async syncToServer() {
    if (!this.isAuthenticated || this.isSyncing) return;

    this.isSyncing = true;

    try {
      const quizStats = JSON.parse(
        localStorage.getItem("quizStats") || '{"quizzes":[], "totalQuizzes":0}'
      );
      const darkMode = localStorage.getItem("darkMode") === "enabled";

      const response = await fetch("/auth/sync-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quizStats: quizStats,
          preferences: {
            darkMode: darkMode,
            notifications: true,
          },
        }),
      });

      if (!response.ok) {
        console.error("Failed to sync data to server");
      }
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      this.isSyncing = false;
    }
  }

  startPeriodicSync() {
    // Only start periodic sync if user is actually active on the page
    // Check if page is visible and user has made changes
    this.syncInterval = setInterval(() => {
      // Multiple conditions to prevent zombie syncing:
      // 1. Must have pending changes
      // 2. Page must be visible (not hidden/minimized)
      // 3. User must not be idle
      if (
        this.hasPendingChanges &&
        !this.isSyncing &&
        !document.hidden &&
        this.isUserActive()
      ) {
        console.log("Periodic sync: Active user with changes, syncing...");
        this.syncToServer();
        this.hasPendingChanges = false;
      } else {
        console.log("Periodic sync: Skipping - inactive user or no changes");
      }
    }, 5 * 60 * 1000); // 5 minutes = 300,000ms
  }

  // Track user activity to prevent syncing for inactive users
  isUserActive() {
    // If no last activity recorded, assume active
    if (!this.lastActivity) {
      this.lastActivity = Date.now();
      return true;
    }

    // Consider user inactive after 10 minutes of no interaction
    const tenMinutes = 10 * 60 * 1000;
    return Date.now() - this.lastActivity < tenMinutes;
  }

  // Track user activity
  trackUserActivity() {
    this.lastActivity = Date.now();
  }

  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
  overrideLocalStorage() {
    const originalSetItem = localStorage.setItem.bind(localStorage);

    localStorage.setItem = (key, value) => {
      originalSetItem(key, value);

      // Sync relevant data to server with rate limiting
      if ((key === "quizStats" || key === "darkMode") && !this.isSyncing) {
        // Mark that we have pending changes
        this.hasPendingChanges = true;

        // Debounce sync calls - increased to 5 seconds for better batching
        clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(() => {
          this.syncToServer();
          this.hasPendingChanges = false; // Reset flag after sync
        }, 5000); // 5 seconds instead of 2
      }
    };
  }

  // Method to manually trigger sync
  async forcSync() {
    await this.syncToServer();
  }
}

// Initialize user sync when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.userSync = new UserSync();
});

// Sync before page unload
window.addEventListener("beforeunload", () => {
  if (
    window.userSync &&
    window.userSync.isAuthenticated &&
    !window.userSync.isSyncing
  ) {
    try {
      // Use sendBeacon for reliable sync on page unload
      const quizStats = JSON.parse(
        localStorage.getItem("quizStats") || '{"quizzes":[], "totalQuizzes":0}'
      );
      const darkMode = localStorage.getItem("darkMode") === "enabled";

      const data = JSON.stringify({
        quizStats: quizStats,
        preferences: {
          darkMode: darkMode,
          notifications: true,
        },
      });

      // Create a Blob with proper content type for sendBeacon
      const blob = new Blob([data], { type: "application/json" });
      navigator.sendBeacon("/auth/sync-data", blob);
    } catch (error) {
      console.error("Error during beforeunload sync:", error);
    }
  }
});

// Enhanced mobile authentication checking
async function checkMobileAuth() {
  try {
    const response = await fetch("/api/verify-session", {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    });

    const data = await response.json();

    if (data.authenticated && data.user) {
      // Update global auth state
      if (window.userSync) {
        window.userSync.isAuthenticated = true;
      }
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error("Mobile auth check error:", error);
    return false;
  }
}

// Mobile authentication initialization
function initMobileAuth() {
  const isMobile =
    window.innerWidth <= 768 ||
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  if (isMobile) {
    // Check for mobile login success parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("mobile_login") === "success") {
      console.log("Mobile login success detected, verifying auth...");
      setTimeout(() => {
        checkMobileAuth().then((isAuthenticated) => {
          if (isAuthenticated) {
            // Clean up URL and reload user data
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname
            );
            if (window.userSync) {
              window.userSync.loadUserData();
            }
            // Trigger any auth-dependent UI updates
            if (window.authEvents) {
              window.authEvents.notifyAuthReady(true);
            }
          }
        });
      }, 500);
    } else {
      // Regular mobile auth check with delay
      setTimeout(() => {
        checkMobileAuth();
      }, 1000);
    }
  }
}

// Initialize mobile auth on page load
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", initMobileAuth);
}
