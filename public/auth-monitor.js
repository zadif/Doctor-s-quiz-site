// Auth Monitor - Helper script to monitor authentication status changes

// Create a global event to notify when authentication is ready
window.authEvents = {
  authReady: false,
  authCallbacks: [],

  // Function to register callbacks for when auth is ready
  onAuthReady: function (callback) {
    if (this.authReady) {
      // Auth is already ready, call the callback immediately
      callback(window.userSync?.isAuthenticated || false);
    } else {
      // Auth not ready yet, store the callback
      this.authCallbacks.push(callback);
    }
  },

  // Function to notify all callbacks that auth is ready
  notifyAuthReady: function (isAuthenticated) {
    this.authReady = true;
    this.authCallbacks.forEach((callback) => callback(isAuthenticated));
    this.authCallbacks = []; // Clear the callbacks after calling them
  },
};

// Set up a polling mechanism to detect when UserSync is authenticated
const checkAuth = () => {
  if (window.userSync) {
    if (window.userSync.isAuthenticated) {
      console.log("Auth monitor: User is authenticated");
      window.authEvents.notifyAuthReady(true);
      return;
    }

    // If UserSync exists but user is not authenticated, watch for changes
    let previousState = window.userSync.isAuthenticated;

    const authWatcher = setInterval(() => {
      if (window.userSync.isAuthenticated !== previousState) {
        previousState = window.userSync.isAuthenticated;

        if (previousState) {
          window.authEvents.notifyAuthReady(true);
          clearInterval(authWatcher);
        }
      }
    }, 200);

    // Add a timeout to prevent indefinite watching
    setTimeout(() => {
      clearInterval(authWatcher);
      if (!window.authEvents.authReady) {
        console.log(
          "Auth monitor: Timeout reached, notifying with current state"
        );
        window.authEvents.notifyAuthReady(window.userSync.isAuthenticated);
      }
    }, 5000);
  } else {
    // If UserSync doesn't exist yet, wait and retry
    setTimeout(checkAuth, 200);
  }
};

// Start the authentication monitoring
document.addEventListener("DOMContentLoaded", () => {
  checkAuth();
});
