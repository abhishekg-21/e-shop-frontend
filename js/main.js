// js/main.js

document.addEventListener("DOMContentLoaded", init);

// --- DOM Elements ---
const themeToggleBtn = document.getElementById("theme-toggle");
const body = document.body; // Reference to the <body> tag
const authLink = document.getElementById("auth-link"); // Auth link in header

// --- Initialization ---
function init() {
  // Set initial theme based on user preference or local storage
  applySavedTheme();

  // Attach event listener for theme toggle button
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", toggleTheme);
  }

  // Common header authentication link logic
  updateHeaderAuthLink();

  // Optional: Intersection Observer for fade-in effect
  // This is a visual enhancement and doesn't affect core functionality
  const fadeIns = document.querySelectorAll(".fade-in");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 } // Trigger when 10% of item is visible
    );

    fadeIns.forEach((el) => observer.observe(el));
  } else {
    // Fallback for browsers that don't support Intersection Observer
    fadeIns.forEach((el) => el.classList.add("visible"));
  }
}

// --- Theme Toggling Logic ---

/**
 * Toggles between light and dark themes.
 * Saves the preference to local storage.
 */
function toggleTheme() {
  if (body.classList.contains("dark-mode")) {
    body.classList.remove("dark-mode");
    localStorage.setItem("theme", "light");
    console.log("Switched to Light Mode");
  } else {
    body.classList.add("dark-mode");
    localStorage.setItem("theme", "dark");
    console.log("Switched to Dark Mode");
  }
}

/**
 * Applies the theme saved in local storage, or defaults to light mode.
 * Checks for user's system preference if no theme is explicitly saved.
 */
function applySavedTheme() {
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme) {
    if (savedTheme === "dark") {
      body.classList.add("dark-mode");
    } else {
      body.classList.remove("dark-mode");
    }
  } else {
    // If no theme saved, check system preference (prefers-color-scheme)
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      body.classList.add("dark-mode");
      // Optionally save this preference for future visits
      // localStorage.setItem("theme", "dark");
    } else {
      // Default to light mode if no saved preference and no dark system preference
      body.classList.remove("dark-mode");
      // Optionally save this preference for future visits
      // localStorage.setItem("theme", "light");
    }
  }
}

// --- Header Authentication Link Logic (Common part) ---

/**
 * Updates the "Login" / "Logout" link in the header based on JWT token presence.
 */
function updateHeaderAuthLink() {
  if (!authLink) return; // Exit if authLink element is not found

  const token = localStorage.getItem("jwt_token");

  if (token) {
    authLink.textContent = "Logout";
    authLink.href = "#"; // Make logout link non-navigable directly

    // Remove any existing listener to prevent duplicates
    const existingListener = authLink._logoutListener;
    if (existingListener) {
      authLink.removeEventListener("click", existingListener);
    }

    // Add new click listener for logout
    const newListener = (e) => {
      e.preventDefault();
      localStorage.removeItem("jwt_token"); // Clear token
      alert("You have been logged out."); // Simple alert
      window.location.href = "/login.html"; // Redirect to login page
    };
    authLink.addEventListener("click", newListener);
    authLink._logoutListener = newListener; // Store listener reference
  } else {
    authLink.textContent = "Login";
    authLink.href = "/login.html";
    // Remove logout listener if it was previously set
    const existingListener = authLink._logoutListener;
    if (existingListener) {
      authLink.removeEventListener("click", existingListener);
      authLink._logoutListener = null; // Clear stored reference
    }
  }
}
