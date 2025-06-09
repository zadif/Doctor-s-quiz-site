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
    }
  }

  async checkAuthStatus() {
    try {
      const response = await fetch("/auth/user-data");
      return response.ok;
    } catch (error) {
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
      console.error("Failed to load user data:", error);
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
    // Sync every 30 seconds
    this.syncInterval = setInterval(() => {
      this.syncToServer();
    }, 30000);
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
        // Debounce sync calls
        clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(() => {
          this.syncToServer();
        }, 2000); // Increased debounce time to 2 seconds
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
