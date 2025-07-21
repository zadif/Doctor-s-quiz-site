/**
 * Form protection script - Ensures all forms have CSRF tokens
 * This script is loaded on every page and automatically adds CSRF tokens to forms
 */

document.addEventListener("DOMContentLoaded", function () {
  // Wait a moment to make sure all forms are loaded
  setTimeout(function () {
    // Get the CSRF token
    const token = getCsrfToken();

    if (!token) {
      console.warn("[Form Protection] No CSRF token available");
      return;
    }

    // Find all POST forms without CSRF tokens
    const forms = document.querySelectorAll(
      'form[method="POST"], form[method="post"]'
    );

    forms.forEach((form) => {
      // Check if form already has a CSRF token
      if (!form.querySelector('input[name="_csrf"]')) {
        console.log(
          "[Form Protection] Adding CSRF token to form:",
          form.action
        );

        // Create and add token input
        const csrfInput = document.createElement("input");
        csrfInput.type = "hidden";
        csrfInput.name = "_csrf";
        csrfInput.value = token;

        form.appendChild(csrfInput);
      }
    });

    console.log("[Form Protection] Checked and fixed", forms.length, "forms");
  }, 500); // Wait half a second to ensure all DOM elements are loaded
});

// Add event listener for dynamically added forms
const observer = new MutationObserver(function (mutations) {
  mutations.forEach(function (mutation) {
    if (mutation.addedNodes && mutation.addedNodes.length > 0) {
      // Check for new forms in the added nodes
      for (let i = 0; i < mutation.addedNodes.length; i++) {
        const node = mutation.addedNodes[i];

        if (node.nodeType === Node.ELEMENT_NODE) {
          // If the added node is a form
          if (
            node.tagName === "FORM" &&
            node.method.toLowerCase() === "post" &&
            !node.querySelector('input[name="_csrf"]')
          ) {
            const token = getCsrfToken();
            if (token) {
              console.log(
                "[Form Protection] Adding CSRF token to dynamically added form"
              );
              const csrfInput = document.createElement("input");
              csrfInput.type = "hidden";
              csrfInput.name = "_csrf";
              csrfInput.value = token;
              node.appendChild(csrfInput);
            }
          }

          // Check for forms inside the added node
          const forms = node.querySelectorAll(
            'form[method="POST"], form[method="post"]'
          );
          if (forms.length > 0) {
            const token = getCsrfToken();
            if (token) {
              forms.forEach((form) => {
                if (!form.querySelector('input[name="_csrf"]')) {
                  console.log(
                    "[Form Protection] Adding CSRF token to nested form in dynamic content"
                  );
                  const csrfInput = document.createElement("input");
                  csrfInput.type = "hidden";
                  csrfInput.name = "_csrf";
                  csrfInput.value = token;
                  form.appendChild(csrfInput);
                }
              });
            }
          }
        }
      }
    }
  });
});

// Observe the entire document for changes
observer.observe(document.body, {
  childList: true,
  subtree: true,
});
