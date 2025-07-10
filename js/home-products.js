// js/home-products.js

document.addEventListener("DOMContentLoaded", initHomeProducts);

// --- Constants and Global Variables ---
// IMPORTANT: Update this to your deployed Render backend URL
const API_BASE_URL = "https://e-shop-backend-8ouh.onrender.com/api"; // Your DEPLOYED Render backend URL

const PRODUCTS_API_URL = `${API_BASE_URL}/products`;
const CART_API_ADD_URL = `${API_BASE_URL}/cart/add`;
const LOGIN_PAGE_URL = "/login.html";

const PRODUCTS_TO_SHOW_ON_HOME = 4; // Number of products to display on the home page

// DOM Elements
const dynamicProductList = document.getElementById("dynamic-product-list");
const homeLoadingSpinner = document.getElementById("home-loading-spinner");
const homeNoProductsMessage = document.getElementById(
  "home-no-products-message"
);
const homeProductsMessage = document.getElementById("home-products-message"); // For general alerts on this section

// --- Initialization ---
/**
 * Initializes the home page product section: fetches and renders products.
 */
function initHomeProducts() {
  fetchHomeProducts();
}

// --- API Calls ---

/**
 * Fetches a limited number of products from the backend API for the home page.
 * Shows loading state during fetch and handles errors.
 */
async function fetchHomeProducts() {
  showHomeLoadingState(); // Show loading spinner and hide content
  hideMessage(homeProductsMessage); // Hide any previous messages

  // Fetch only the first page with a limited size
  const queryParams = new URLSearchParams({
    page: 0, // Always fetch the first page
    size: PRODUCTS_TO_SHOW_ON_HOME,
    // No search, category, or sort filters for home page featured products
  }).toString();

  try {
    const response = await fetch(`${PRODUCTS_API_URL}?${queryParams}`);

    // Handle authentication/authorization errors gracefully if this becomes a protected endpoint
    // For now, products are public, but good to keep in mind.
    if (response.status === 401 || response.status === 403) {
      // This case should ideally not happen for public product fetching,
      // but if it does, it indicates a security config issue.
      showMessage(
        homeProductsMessage,
        "Authentication error. Please try logging in.",
        "danger"
      );
      return;
    }

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Unknown error occurred." }));
      throw new Error(errorData.message || "Failed to fetch top products.");
    }

    const data = await response.json();
    console.log("HOME PRODUCTS: Products data received:", data);

    // Check if data.content exists and is an array
    if (data.content && Array.isArray(data.content)) {
      renderHomeProducts(data.content);
    } else {
      console.warn(
        "HOME PRODUCTS: Unexpected product data structure or empty content array:",
        data
      );
      renderHomeProducts([]); // Render empty if structure is unexpected
    }
  } catch (error) {
    console.error("HOME PRODUCTS: Error fetching products:", error);
    // Display user-friendly error message and a retry button
    showMessage(
      homeProductsMessage,
      `Failed to load top products: ${error.message}. The server might be starting up (cold start). Please try again.`,
      "danger"
    );
    // Add a retry button
    const retryBtn = document.createElement("button");
    retryBtn.className = "btn btn-primary mt-2";
    retryBtn.textContent = "Retry Loading Products";
    retryBtn.addEventListener("click", () => {
      fetchHomeProducts(); // Retries the fetch
    });
    // Clear existing content and append the message with the retry button
    if (homeProductsMessage) {
      homeProductsMessage.innerHTML = ""; // Clear previous message
      const p = document.createElement("p");
      p.textContent = `Failed to load top products: ${error.message}. The server might be starting up (cold start). Please try again.`;
      homeProductsMessage.appendChild(p);
      homeProductsMessage.appendChild(retryBtn);
      homeProductsMessage.classList.remove("d-none"); // Ensure it's visible
      homeProductsMessage.classList.add("alert-danger"); // Ensure it's red
    }

    renderHomeProducts([]); // Clear products on error
  } finally {
    hideHomeLoadingState(); // Always hide loading spinner
  }
}

/**
 * Adds a product to the user's cart via a backend API call.
 * @param {string} productId The ID of the product to add.
 * @param {number} quantity The quantity to add.
 */
async function addProductToCart(productId, quantity = 1) {
  const token = getAuthToken();
  if (!token) {
    // Use the site-wide redirectToLogin if it's available, otherwise a simple alert
    if (typeof redirectToLogin === "function") {
      redirectToLogin("You must be logged in to add items to your cart.");
    } else {
      alert("You must be logged in to add items to your cart.");
      window.location.href = LOGIN_PAGE_URL;
    }
    return;
  }

  try {
    const response = await fetch(CART_API_ADD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ productId, quantity }),
    });

    if (response.status === 401 || response.status === 403) {
      if (typeof redirectToLogin === "function") {
        redirectToLogin("Your session has expired. Please log in again.");
      } else {
        alert("Your session has expired. Please log in again.");
        localStorage.removeItem("jwt_token");
        window.location.href = LOGIN_PAGE_URL;
      }
      return;
    }

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Unknown error occurred." }));
      throw new Error(errorData.message || "Failed to add item to cart.");
    }

    const cartResponse = await response.json();
    // Use the site-wide showToastMessage if available
    if (typeof showToastMessage === "function") {
      showToastMessage("Product added to cart!", "success");
    } else {
      alert("Product added to cart!");
    }
    console.log("Product added to cart:", cartResponse);
  } catch (error) {
    console.error("Error adding to cart:", error);
    showMessage(
      homeProductsMessage,
      `Error adding to cart: ${error.message}`,
      "danger"
    );
  }
}

// --- DOM Manipulation and UI Functions ---

/**
 * Shows the loading spinner and hides the product grid and no products message.
 */
function showHomeLoadingState() {
  if (homeLoadingSpinner) homeLoadingSpinner.style.display = "block";
  if (dynamicProductList) dynamicProductList.style.display = "none";
  if (homeNoProductsMessage) homeNoProductsMessage.style.display = "none";
  if (homeProductsMessage) homeProductsMessage.classList.add("d-none"); // Hide general message
}

/**
 * Hides the loading spinner and shows the product grid or no products message based on content.
 */
function hideHomeLoadingState() {
  if (homeLoadingSpinner) homeLoadingSpinner.style.display = "none";
  if (dynamicProductList) dynamicProductList.style.display = "flex"; // Use flex for grid layout
}

/**
 * Renders the fetched products into the dynamic product list grid.
 * @param {Array} products An array of product objects to render.
 */
function renderHomeProducts(products) {
  dynamicProductList.innerHTML = ""; // Clear existing products

  if (!products || products.length === 0) {
    if (homeNoProductsMessage) homeNoProductsMessage.style.display = "block"; // Show "no products" message
    if (dynamicProductList) dynamicProductList.style.display = "none"; // Hide grid
    return;
  }

  if (homeNoProductsMessage) homeNoProductsMessage.style.display = "none"; // Hide "no products" message
  if (dynamicProductList) dynamicProductList.style.display = "flex"; // Show grid

  products.forEach((product) => {
    const productCard = document.createElement("div");
    productCard.className = "col-md-3 col-sm-6 mb-4 fade-in"; // Bootstrap column classes for responsiveness
    productCard.innerHTML = `
            <div class="product-card">
                <img src="${
                  product.imageUrl ||
                  `https://placehold.co/300x150/cccccc/000000?text=${encodeURIComponent(
                    product.name
                  )}`
                }"
                    alt="${product.name}"
                    onerror="this.onerror=null;this.src='https://placehold.co/300x150/cccccc/000000?text=Image+Error';"
                    class="card-img-top" />
                <div class="card-body">
                    <h5 class="card-title">${product.name}</h5>
                    <p class="price">$${
                      product.price ? product.price.toFixed(2) : "0.00"
                    }</p>
                    <a href="product-detail.html?id=${
                      product.id
                    }" class="btn btn-primary w-100 mb-2">View Product</a>
                    <button class="btn btn-success w-100 add-to-cart-btn" data-product-id="${
                      product.id
                    }" ${product.stockQuantity > 0 ? "" : "disabled"}>
                      ${
                        product.stockQuantity > 0
                          ? '<i class="fas fa-cart-plus me-2"></i>Add to Cart'
                          : "Out of Stock"
                      }
                    </button>
                </div>
            </div>
        `;
    dynamicProductList.appendChild(productCard);
  });

  // Attach event listeners to the new "Add to Cart" buttons
  attachAddToCartListeners();
}

/**
 * Attaches click listeners to all "Add to Cart" buttons.
 */
function attachAddToCartListeners() {
  document.querySelectorAll(".add-to-cart-btn").forEach((button) => {
    // Remove existing listener to prevent duplicates on re-render
    const oldListener = button._addToCartListener;
    if (oldListener) {
      button.removeEventListener("click", oldListener);
    }

    const newListener = (event) => {
      const productId = event.currentTarget.dataset.productId;
      addProductToCart(productId);
    };
    button.addEventListener("click", newListener);
    button._addToCartListener = newListener; // Store reference
  });
}

// --- Helper Functions (Duplicated from main.js/products.js for simplicity without modules) ---
// In a real project, these would ideally be in a shared utility file or main.js
// if main.js was designed as a module.

/**
 * Retrieves the JWT token from local storage.
 * @returns {string|null} The JWT token or null if not found.
 */
function getAuthToken() {
  // Ensure consistency with other JS files
  const token = localStorage.getItem("jwt_token");
  if (token && typeof token === "string" && token.trim() !== "") {
    return token;
  }
  return null;
}

/**
 * Redirects the user to the login page after an optional alert message.
 * Also clears the invalid JWT token from local storage.
 * @param {string} message Optional message to display to the user.
 */
function redirectToLogin(
  message = "Session expired or unauthorized. Please log in."
) {
  // IMPORTANT: For better UX, replace alert() with a custom modal or toast notification.
  alert(message);
  localStorage.removeItem("jwt_token"); // Clear any potentially invalid/expired token
  window.location.href = LOGIN_PAGE_URL;
}

/**
 * Displays a message within a specified HTML element.
 * @param {HTMLElement} element The DOM element (e.g., a div) where the message will be displayed.
 * @param {string} message The text content of the message.
 * @param {string} type The type of message (e.g., "success", "danger", "info", "warning")
 * which will be appended to "alert alert-" for Bootstrap styling.
 */
function showMessage(element, message, type) {
  if (element) {
    element.textContent = message;
    element.className = `alert alert-${type}`; // Applies Bootstrap alert classes (e.g., 'alert alert-danger')
    element.style.display = "block"; // Make the element visible
  }
}

/**
 * Hides a specified HTML message element and clears its content.
 * @param {HTMLElement} element The DOM element to hide.
 */
function hideMessage(element) {
  if (element) {
    element.style.display = "none"; // Hide the element
    element.textContent = ""; // Clear its text content
  }
}

/**
 * Displays a temporary toast/notification message to the user.
 * Currently uses a simple alert, but should be replaced with a non-blocking UI component.
 * @param {string} message The text content of the toast message.
 * @param {string} type The type of message (e.g., "success", "danger", "info").
 */
function showToastMessage(message, type) {
  // IMPORTANT: For production apps, replace this with a custom toast/notification library
  // (e.g., Toastify JS, SweetAlert, or a custom floating div) for a better user experience).
  alert(`${type.toUpperCase()}: ${message}`);
}
