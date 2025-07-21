/**
 * CSRF protection utilities for client-side JavaScript
 *
 * This file provides helper functions to add CSRF protection to AJAX requests
 */

/**
 * Gets the CSRF token from various sources
 * 1. Meta tag (preferred)
 * 2. Hidden form input
 * 3. Cookie (fallback)
 * @returns {string|null} The CSRF token or null if not found
 */
function getCsrfToken() {
  // Try meta tag first (recommended)
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  if (metaTag && metaTag.getAttribute("content")) {
    return metaTag.getAttribute("content");
  }

  // Try hidden input as fallback
  const csrfInput = document.querySelector('input[name="_csrf"]');
  if (csrfInput && csrfInput.value) {
    return csrfInput.value;
  }

  // Try cookie as last resort (if cookie is not HttpOnly)
  try {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.startsWith("_csrf=")) {
        return decodeURIComponent(
          cookie.substring("_csrf=".length, cookie.length)
        );
      }
    }
  } catch (e) {
    console.warn("Error reading CSRF from cookie:", e);
  }

  console.warn("CSRF token not found in document");
  return null;
}

/**
 * Adds the CSRF token to request headers
 * @param {Object} headers - The headers object to add the token to
 * @returns {Object} The updated headers object with CSRF token
 */
function addCsrfHeader(headers = {}) {
  const token = getCsrfToken();
  if (!token) {
    console.warn("No CSRF token available for request");
    return headers;
  }

  return {
    ...headers,
    "X-CSRF-Token": token,
    "CSRF-Token": token, // Add both header formats for better compatibility
  };
}

/**
 * Ensures all forms have CSRF token inputs
 * Call this on DOMContentLoaded to add CSRF tokens to forms
 */
function ensureFormCsrfTokens() {
  const token = getCsrfToken();
  if (!token) {
    console.warn("No CSRF token available for forms");
    return;
  }

  document.querySelectorAll('form[method="post"]').forEach((form) => {
    // Skip if form already has a CSRF token
    if (form.querySelector('input[name="_csrf"]')) {
      return;
    }

    // Add CSRF token input
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "_csrf";
    input.value = token;
    form.appendChild(input);

    console.log(`Added CSRF token to form: ${form.action || "unknown"}`);
  });
}

// Auto-add CSRF tokens to forms when page loads
document.addEventListener("DOMContentLoaded", ensureFormCsrfTokens);
