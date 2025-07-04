// src/main/resources/static/js/product-detail.js

document.addEventListener("DOMContentLoaded", init);

const API_BASE_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:8080/api" // For local backend development
    : "https://e-shop-backend-5qmu.onrender.com/api"; // Your DEPLOYED Render backend URL
const PRODUCTS_API_URL = `${API_BASE_URL}/products`;
const CART_API_ADD_ITEM_URL = `${API_BASE_URL}/cart/add`;
const LOGIN_PAGE_URL = "/login.html";
const PRODUCTS_PAGE_URL = "/products.html"; // For "Back to Products" button

let currentProduct = null; // Stores the fetched product object

// DOM Elements (initialized later in init to ensure they exist)
let productDetailLoading;
let productNotFound;
let productDetailContainer;
let productMessage; // For alerts like "Added to cart!"

let productImageMain;
let productName;
let productCategory;
let productPrice;
let productDescription;
let productStock;

let quantityMinusBtn;
let quantityInput;
let quantityPlusBtn;
let addToCartBtn;

// --- Helper Functions (Moved to global scope for accessibility) ---

/**
 * Extracts the product ID from the current URL's query parameters.
 * Assumes URL format: product-detail.html?id=123
 * @returns {string|null} The product ID or null if not found.
 */
function getProductIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("id");
}

/**
 * Retrieves the JWT token from local storage.
 * @returns {string|null} The JWT token or null if not found.
 */
function getAuthToken() {
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
    // Add null check for safety
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
    // Add null check for safety
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
  // (e.g., Toastify JS, SweetAlert, or a custom floating div) for a better user experience.
  alert(`${type.toUpperCase()}: ${message}`);
}

/**
 * Shows the loading spinner and hides other product detail content.
 */
function showLoadingState() {
  if (productDetailLoading) productDetailLoading.style.display = "flex"; // Use flex for centering spinner
  if (productNotFound) productNotFound.style.display = "none";
  if (productDetailContainer) productDetailContainer.style.display = "none";
}

/**
 * Hides the loading spinner.
 */
function hideLoadingState() {
  if (productDetailLoading) productDetailLoading.style.display = "none";
}

/**
 * Shows the "Product Not Found" message and hides other content.
 */
function showProductNotFoundState() {
  if (productDetailLoading) productDetailLoading.style.display = "none";
  if (productDetailContainer) productDetailContainer.style.display = "none";
  if (productNotFound) productNotFound.style.display = "flex"; // Use flex for centering content
}

/**
 * Renders the fetched product details into the HTML elements.
 * @param {Object} product The product object to render.
 */
function renderProductDetails(product) {
  // Hide loading/not found messages and show the container
  hideLoadingState();
  if (productNotFound) productNotFound.style.display = "none";
  if (productDetailContainer) productDetailContainer.style.display = "block";
  hideMessage(productMessage); // Clear any previous messages

  // Populate product data
  if (productImageMain)
    productImageMain.src =
      product.imageUrl ||
      `https://placehold.co/600x400/cccccc/000000?text=${encodeURIComponent(
        product.name || "Product"
      )}`;
  if (productImageMain) productImageMain.alt = product.name;
  if (productName) productName.textContent = product.name;
  if (productCategory) productCategory.textContent = product.category || "N/A";
  if (productPrice)
    productPrice.textContent = `$${
      product.price ? product.price.toFixed(2) : "0.00"
    }`;
  if (productDescription) productDescription.textContent = product.description;
  if (productStock) productStock.textContent = product.stockQuantity; // Corrected to stockQuantity

  // Set initial quantity to 1 or current stock if less than 1 (if desired logic)
  if (quantityInput) quantityInput.value = 1;
  // Disable add to cart if out of stock
  if (product.stockQuantity <= 0) {
    // Corrected to stockQuantity
    if (addToCartBtn) {
      addToCartBtn.disabled = true;
      addToCartBtn.textContent = "Out of Stock";
      addToCartBtn.classList.remove("btn-success");
      addToCartBtn.classList.add("btn-secondary"); // Change color for out of stock
    }
    showMessage(
      productMessage,
      "This product is currently out of stock.",
      "warning"
    );
  } else {
    if (addToCartBtn) {
      addToCartBtn.disabled = false;
      addToCartBtn.innerHTML =
        '<i class="fas fa-cart-plus me-2"></i>Add to Cart';
      addToCartBtn.classList.remove("btn-secondary");
      addToCartBtn.classList.add("btn-success");
    }
  }

  // Set max attribute for quantity input based on stock
  if (product.stockQuantity !== undefined && quantityInput) {
    // Corrected to stockQuantity
    quantityInput.max = product.stockQuantity;
  }
}

/**
 * Updates the quantity input field and handles basic validation.
 * @param {number} newQuantity The new value for the quantity input.
 */
function updateQuantityInput(newQuantity) {
  const maxStock = currentProduct ? currentProduct.stockQuantity : Infinity; // Corrected to stockQuantity
  let validatedQuantity = Math.max(1, newQuantity); // Minimum 1

  if (maxStock !== Infinity && validatedQuantity > maxStock) {
    validatedQuantity = maxStock; // Don't exceed stock
    showToastMessage(`Maximum stock available: ${maxStock}`, "info");
  }

  if (quantityInput) quantityInput.value = validatedQuantity;
}

// --- Initialization ---
/**
 * Initializes the product detail page.
 * Parses the product ID from the URL and fetches product details.
 */
function init() {
  // Initialize DOM elements
  productDetailLoading = document.getElementById("product-detail-loading");
  productNotFound = document.getElementById("product-not-found");
  productDetailContainer = document.getElementById("product-detail-container");
  productMessage = document.getElementById("product-message"); // For alerts like "Added to cart!"

  productImageMain = document.getElementById("product-image-main");
  productName = document.getElementById("product-name");
  productCategory = document.getElementById("product-category");
  productPrice = document.getElementById("product-price");
  productDescription = document.getElementById("product-description");
  productStock = document.getElementById("product-stock");

  quantityMinusBtn = document.getElementById("quantity-minus-btn");
  quantityInput = document.getElementById("quantity-input");
  quantityPlusBtn = document.getElementById("quantity-plus-btn");
  addToCartBtn = document.getElementById("add-to-cart-btn");

  const productId = getProductIdFromUrl();

  if (productId) {
    fetchProductDetails(productId);
  } else {
    // If no product ID in URL, show product not found message
    showProductNotFoundState();
  }

  // Attach Event Listeners
  if (quantityMinusBtn)
    quantityMinusBtn.addEventListener("click", () =>
      handleQuantityChange("minus")
    );
  if (quantityPlusBtn)
    quantityPlusBtn.addEventListener("click", () =>
      handleQuantityChange("plus")
    );
  if (quantityInput)
    quantityInput.addEventListener("change", handleQuantityInputChange); // For direct input changes
  if (addToCartBtn) addToCartBtn.addEventListener("click", handleAddToCart);
}

// --- API Calls ---

/**
 * Fetches product details from the backend API for a given product ID.
 * @param {string} productId The ID of the product to fetch.
 */
async function fetchProductDetails(productId) {
  showLoadingState(); // Show loading spinner

  console.log(
    "PRODUCT_DETAIL: Attempting to fetch product details for ID:",
    productId
  ); // DEBUG

  try {
    const response = await fetch(`${PRODUCTS_API_URL}/${productId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log(
      "PRODUCT_DETAIL: Fetch product details response status:",
      response.status
    ); // DEBUG

    if (response.status === 404) {
      // Product not found
      hideLoadingState();
      showProductNotFoundState();
      console.warn(
        "PRODUCT_DETAIL: Product with ID",
        productId,
        "not found (404)."
      ); // DEBUG
      return;
    }

    if (!response.ok) {
      let errorText = "Unknown error";
      try {
        errorText = await response.text();
        console.error("PRODUCT_DETAIL: Raw error response text:", errorText); // DEBUG
      } catch (e) {
        console.error("PRODUCT_DETAIL: Could not read error response text:", e);
      }
      throw new Error(
        `Failed to fetch product details: ${
          response.status
        } - ${errorText.substring(0, 100)}...`
      );
    }

    currentProduct = await response.json(); // Store the fetched product
    console.log("PRODUCT_DETAIL: Product data received:", currentProduct); // DEBUG
    renderProductDetails(currentProduct); // Render details in UI
  } catch (error) {
    console.error("PRODUCT_DETAIL: Error fetching product details:", error); // DEBUG
    hideLoadingState();
    showMessage(
      productMessage,
      `Error loading product: ${error.message}`,
      "danger"
    );
    // Optionally redirect or show a generic error state if product data cannot be loaded at all
  } finally {
    hideLoadingState(); // Ensure loading state is hidden
  }
}

/**
 * Adds the current product to the user's shopping cart.
 * Requires user to be authenticated.
 */
async function addToCart() {
  const token = getAuthToken();
  if (!token) {
    redirectToLogin("Please log in to add items to your cart.");
    return;
  }

  if (!currentProduct) {
    showMessage(
      productMessage,
      "Cannot add to cart: Product data not loaded.",
      "danger"
    );
    return;
  }

  const quantity = parseInt(quantityInput.value);
  if (isNaN(quantity) || quantity < 1) {
    showMessage(productMessage, "Please enter a valid quantity.", "danger");
    return;
  }

  // Check if quantity exceeds stock
  if (
    currentProduct.stockQuantity !== undefined &&
    quantity > currentProduct.stockQuantity
  ) {
    // Corrected to stockQuantity
    showMessage(
      productMessage,
      `Only ${currentProduct.stockQuantity} units are available.`, // Corrected to stockQuantity
      "warning"
    );
    return;
  }
  // Check if product is out of stock completely
  if (
    currentProduct.stockQuantity !== undefined &&
    currentProduct.stockQuantity <= 0
  ) {
    // Corrected to stockQuantity
    showMessage(
      productMessage,
      `This product is currently out of stock.`,
      "warning"
    );
    if (addToCartBtn) {
      // Add null check
      addToCartBtn.disabled = true; // Disable button if stock is 0
    }
    return;
  }

  console.log(
    "PRODUCT_DETAIL: Attempting to add to cart. Product ID:",
    currentProduct.id,
    "Quantity:",
    quantity
  ); // DEBUG

  try {
    const response = await fetch(CART_API_ADD_ITEM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // Include JWT token
      },
      body: JSON.stringify({
        productId: currentProduct.id,
        quantity: quantity,
      }),
    });

    console.log(
      "PRODUCT_DETAIL: Add to cart response status:",
      response.status
    ); // DEBUG

    if (response.status === 401 || response.status === 403) {
      redirectToLogin("Your session has expired. Please log in again.");
      return;
    }

    if (!response.ok) {
      const errorData = await response.json();
      console.error(
        "PRODUCT_DETAIL: Error response data for add to cart:",
        errorData
      ); // DEBUG
      throw new Error(errorData.message || "Failed to add product to cart.");
    }

    const result = await response.json();
    showToastMessage("Product added to cart successfully!", "success");
    showMessage(productMessage, "Product added to cart!", "success");
    // Optionally update cart icon count in header here
    console.log("PRODUCT_DETAIL: Add to cart successful:", result);

    // After adding to cart, refresh product details to reflect updated stock if necessary
    // This depends on your backend's stock management - if it decrements immediately.
    // fetchProductDetails(currentProduct.id); // Uncomment if stock should update instantly on UI
  } catch (error) {
    console.error("PRODUCT_DETAIL: Error adding to cart:", error); // DEBUG
    showMessage(
      productMessage,
      `Error adding to cart: ${error.message}`,
      "danger"
    );
  }
}

/**
 * Handles clicks on the quantity plus/minus buttons.
 * @param {string} direction "plus" or "minus".
 */
function handleQuantityChange(direction) {
  let currentQuantity = parseInt(quantityInput.value);
  if (isNaN(currentQuantity)) currentQuantity = 1; // Default if invalid

  if (direction === "plus") {
    updateQuantityInput(currentQuantity + 1);
  } else if (direction === "minus") {
    updateQuantityInput(currentQuantity - 1);
  }
}

/**
 * Handles changes to the quantity input field directly.
 * Ensures the value is a valid number and within stock limits.
 */
function handleQuantityInputChange() {
  let newQuantity = parseInt(quantityInput.value);
  if (isNaN(newQuantity)) newQuantity = 1; // Default to 1 if not a number
  updateQuantityInput(newQuantity);
}
