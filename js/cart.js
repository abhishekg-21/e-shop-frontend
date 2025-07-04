// src/main/resources/static/js/cart.js

document.addEventListener("DOMContentLoaded", init);

// --- Constants and Global Variables ---
// IMPORTANT: Update this to your deployed Render backend URL when deploying frontend
const API_BASE_URL = "https://e-shop-backend-8ouh.onrender.com/api"; // For deployed frontend

const CART_API_URL = `${API_BASE_URL}/cart`;
const CART_API_UPDATE_QUANTITY_URL = `${CART_API_URL}/update-quantity`; // Example endpoint
const CART_API_REMOVE_ITEM_URL = `${CART_API_URL}/remove`; // Example endpoint
const LOGIN_PAGE_URL = "/login.html"; // Assuming your login page is here
const PRODUCTS_PAGE_URL = "/products.html"; // For "Continue Shopping"

let cartItems = []; // Array to hold current cart items fetched from backend

// DOM Elements
const cartTableBody = document.getElementById("cart-table-body");
const emptyCartMessage = document.getElementById("empty-cart-message");
const cartTableContainer = document.getElementById("cart-table-container");
const cartSummaryActions = document.getElementById("cart-summary-actions");
const cartSubtotalSpan = document.getElementById("cart-subtotal");
const cartShippingSpan = document.getElementById("cart-shipping");
const cartTotalSpan = document.getElementById("cart-total");
const cartMessage = document.getElementById("cartMessage"); // For general alerts on the page
const checkoutBtn = document.getElementById("checkoutBtn");
// The 'Continue Shopping' button within the empty cart message also points to products.html directly via its href.

// --- Initialization ---
/**
 * Initializes the cart page: checks authentication, fetches cart items, and attaches event listeners.
 */
function init() {
  // 1. Check for authentication token. Cart operations require a logged-in user.
  const token = getAuthToken();
  if (!token) {
    redirectToLogin("You must be logged in to view your cart.");
    return;
  }

  // 2. Fetch cart items from the backend API.
  fetchCartItems();

  // 3. Attach Event Listeners to static elements.
  checkoutBtn.addEventListener("click", handleCheckout);

  // Note: Event listeners for dynamically created cart item elements (quantity controls, remove buttons)
  // are attached after the cart is rendered in `renderCart()` via `attachCartItemEventListeners()`.
}

// --- API Calls ---

/**
 * Fetches the current user's cart items from the backend API.
 * The Authorization header with the JWT token is sent for authentication.
 */
async function fetchCartItems() {
  const token = getAuthToken();
  if (!token) {
    redirectToLogin("Your session has expired. Please log in again.");
    return;
  }

  try {
    const response = await fetch(CART_API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // Include JWT token for authenticated request
      },
    });

    // Handle authentication/authorization errors gracefully
    if (response.status === 401 || response.status === 403) {
      redirectToLogin("Your session has expired. Please log in again.");
      return;
    }
    // Handle other HTTP errors
    if (!response.ok) {
      const errorData = await response.json(); // Attempt to parse error message from backend
      throw new Error(errorData.message || "Failed to fetch cart items.");
    }

    const cartData = await response.json(); // Get the entire Cart object

    // Check if cartData is an object and has a cartItems property
    if (
      cartData &&
      typeof cartData === "object" &&
      Array.isArray(cartData.cartItems)
    ) {
      cartItems = cartData.cartItems; // <--- FIX: Assign the array from the Cart object
      console.log("PRODUCTS: Cart data received:", cartItems); // Log the actual array
    } else if (
      cartData &&
      typeof cartData === "object" &&
      cartData.id &&
      !cartData.cartItems
    ) {
      // This case might happen if the backend returns an empty Cart object without cartItems property
      // or if the cart is newly created and has no items yet.
      cartItems = [];
      console.log(
        "PRODUCTS: Received an empty cart object or cart without items property."
      );
    } else {
      // Handle unexpected response structure
      console.warn("PRODUCTS: Unexpected cart data structure:", cartData);
      cartItems = []; // Default to empty array to prevent further errors
    }

    renderCart(); // Call function to render the fetched cart items in the UI
  } catch (error) {
    // Log and display error if fetching fails
    console.error("Error fetching cart items:", error);
    showMessage(cartMessage, `Error loading cart: ${error.message}`, "danger");
    renderCart([]); // Render an empty cart state on error to clear previous content
  }
}

/**
 * Updates the quantity of a specific product in the cart via a backend API call.
 * If newQuantity is 0 or less, it prompts the user to confirm removal.
 * @param {string} productId The ID of the product whose quantity is to be updated.
 * @param {number} newQuantity The new quantity for the product.
 */
async function updateCartItemQuantity(productId, newQuantity) {
  // Client-side check for removal intent
  if (newQuantity < 1) {
    if (
      confirm("Setting quantity to zero will remove this item. Are you sure?")
    ) {
      await removeCartItem(productId); // If confirmed, remove the item
    } else {
      // If user cancels, re-fetch cart to revert the UI to the last known state
      fetchCartItems();
    }
    return; // Exit function after handling 0 quantity
  }

  const token = getAuthToken();
  try {
    const response = await fetch(CART_API_UPDATE_QUANTITY_URL, {
      method: "PUT", // Use PUT or PATCH for updates, depending on your API design
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // Authenticate request
      },
      body: JSON.stringify({
        productId: productId, // Send product ID
        quantity: newQuantity, // Send new quantity
      }),
    });

    if (response.status === 401 || response.status === 403) {
      redirectToLogin("Your session has expired. Please log in again.");
      return;
    }
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message || "Failed to update cart item quantity."
      );
    }

    // If successful, show toast message and refresh cart to reflect changes
    showToastMessage("Cart quantity updated!", "success");
    fetchCartItems();
  } catch (error) {
    console.error("Error updating cart quantity:", error);
    showMessage(cartMessage, `Error: ${error.message}`, "danger");
    fetchCartItems(); // Re-fetch to ensure UI reflects backend state after an error
  }
}

/**
 * Removes a specific product from the cart via a backend API call.
 * @param {string} productId The ID of the product to remove.
 */
async function removeCartItem(productId) {
  const token = getAuthToken();
  try {
    const response = await fetch(`${CART_API_REMOVE_ITEM_URL}/${productId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`, // Authenticate request
      },
    });

    if (response.status === 401 || response.status === 403) {
      redirectToLogin("Your session has expired. Please log in again.");
      return;
    }
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to remove item from cart.");
    }

    showToastMessage("Item removed from cart!", "success");
    fetchCartItems(); // Refresh cart to update the UI
  } catch (error) {
    console.error("Error removing cart item:", error);
    showMessage(cartMessage, `Error: ${error.message}`, "danger");
  }
}

// --- DOM Manipulation and UI Functions ---

/**
 * Renders the fetched cart items into the HTML table and updates the cart summary.
 * It dynamically shows/hides the empty cart message, cart table, and summary sections.
 */
function renderCart() {
  cartTableBody.innerHTML = ""; // Clear any existing table rows
  hideMessage(cartMessage); // Hide any general page messages

  // Determine if cart is empty
  if (!cartItems || cartItems.length === 0) {
    // If cart is empty, show the empty cart message and hide other sections
    emptyCartMessage.style.display = "flex"; // Use flex to center its content
    cartTableContainer.style.display = "none";
    cartSummaryActions.style.display = "none";
    return;
  }

  // If cart has items, hide the empty cart message and show table/summary sections
  emptyCartMessage.style.display = "none";
  cartTableContainer.style.display = "block";
  cartSummaryActions.style.display = "flex"; // Use flex for summary alignment

  let subtotal = 0; // Initialize subtotal calculation

  // Iterate over each item in the cartItems array and create a table row
  cartItems.forEach((item) => {
    const row = cartTableBody.insertRow();
    const itemSubtotal = item.product.price * item.quantity;
    subtotal += itemSubtotal; // Accumulate subtotal

    // Populate the row with item details
    row.innerHTML = `
            <td>
                <img src="${
                  item.product.imageUrl ||
                  `https://placehold.co/80x80/cccccc/000000?text=${encodeURIComponent(
                    item.product.name
                  )}`
                }"
                    alt="${item.product.name}"
                    onerror="this.onerror=null;this.src='https://placehold.co/80x80/cccccc/000000?text=Image+Error';"
                    class="img-fluid me-3 product-thumbnail" />
                <a href="product-detail.html?id=${
                  item.product.id
                }" class="text-decoration-none text-reset">
                    <span>${item.product.name}</span>
                </a>
            </td>
            <td class="cart-item-price">$${item.product.price.toFixed(2)}</td>
            <td>
                <div class="cart-quantity-control">
                    <button class="btn btn-outline-secondary btn-sm" data-action="minus" data-product-id="${
                      item.product.id
                    }">
                        <i class="fas fa-minus"></i>
                    </button>
                    <input type="number" class="form-control text-center" value="${
                      item.quantity
                    }" min="1" data-product-id="${item.product.id}" />
                    <button class="btn btn-outline-secondary btn-sm" data-action="plus" data-product-id="${
                      item.product.id
                    }">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            </td>
            <td class="cart-item-subtotal">$${itemSubtotal.toFixed(2)}</td>
            <td>
                <button class="btn btn-danger btn-sm remove-item-btn" data-product-id="${
                  item.product.id
                }">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </td>
        `;
  });

  // Calculate and update the cart summary (subtotal, shipping, total)
  const shippingCost = 5.99; // Example static shipping cost. In a real app, this would be dynamic.
  const total = subtotal + shippingCost;

  cartSubtotalSpan.textContent = `$${subtotal.toFixed(2)}`;
  cartShippingSpan.textContent = `$${shippingCost.toFixed(2)}`;
  cartTotalSpan.textContent = `$${total.toFixed(2)}`;

  // After all dynamic elements are created, attach their event listeners
  attachCartItemEventListeners();
}

/**
 * Attaches event listeners to dynamically created elements within the cart table,
 * specifically for quantity control buttons, quantity input fields, and remove item buttons.
 * This function should be called every time the cart is re-rendered.
 */
function attachCartItemEventListeners() {
  // Listeners for quantity control buttons (plus/minus)
  cartTableBody
    .querySelectorAll(".cart-quantity-control button")
    .forEach((button) => {
      // Remove any existing listeners to prevent duplicates
      const oldListener = button._quantityListener; // Store listener reference
      if (oldListener) {
        button.removeEventListener("click", oldListener);
      }
      const newListener = (event) => {
        const productId = event.currentTarget.dataset.productId;
        const inputElement =
          event.currentTarget.parentNode.querySelector("input");
        let newQuantity = parseInt(inputElement.value);

        if (event.currentTarget.dataset.action === "plus") {
          newQuantity++;
        } else if (event.currentTarget.dataset.action === "minus") {
          newQuantity--;
        }
        // Update the input field value immediately for a responsive UI
        inputElement.value = newQuantity;
        updateCartItemQuantity(productId, newQuantity); // Call API to update backend
      };
      button.addEventListener("click", newListener);
      button._quantityListener = newListener; // Store reference for future removal
    });

  // Listener for direct input changes in the quantity field
  cartTableBody
    .querySelectorAll(".cart-quantity-control input")
    .forEach((input) => {
      // Remove any existing listeners
      const oldListener = input._inputChangeListener;
      if (oldListener) {
        input.removeEventListener("change", oldListener);
      }
      const newListener = (event) => {
        const productId = event.target.dataset.productId;
        let newQuantity = parseInt(event.target.value);
        // Basic validation for input: ensure it's a number and at least 1
        if (isNaN(newQuantity) || newQuantity < 0) {
          newQuantity = 1; // Default to 1 if invalid input
          event.target.value = 1; // Correct the input field in UI
        }
        updateCartItemQuantity(productId, newQuantity); // Call API to update backend
      };
      input.addEventListener("change", newListener);
      input._inputChangeListener = newListener; // Store reference
    });

  // Listeners for remove item buttons
  cartTableBody.querySelectorAll(".remove-item-btn").forEach((button) => {
    // Remove any existing listeners
    const oldListener = button._removeListener;
    if (oldListener) {
      button.removeEventListener("click", oldListener);
    }
    const newListener = (event) => {
      const productId = event.currentTarget.dataset.productId;
      // Confirmation before removal
      if (
        confirm("Are you sure you want to remove this item from your cart?")
      ) {
        removeCartItem(productId);
      }
    };
    button.addEventListener("click", newListener);
    button._removeListener = newListener; // Store reference
  });
}

/**
 * Handles the "Proceed to Checkout" button click.
 * This is currently a placeholder for actual checkout logic.
 */
function handleCheckout() {
  // In a real application, this would typically:
  // 1. Redirect to a dedicated checkout page (e.g., /checkout.html)
  // 2. Initiate a multi-step checkout process (address, payment, etc.)
  // 3. Potentially make a final API call to create an order.
  showToastMessage("Proceeding to checkout! (This is a placeholder)", "info");
  console.log("Proceeding to checkout with current cart:", cartItems);
  // Example redirection: window.location.href = "/checkout.html";
}

// --- Helper Functions (reused from other JS files for consistency) ---

/**
 * Retrieves the JWT token from local storage.
 * @returns {string|null} The JWT token or null if not found.
 */
function getAuthToken() {
  return localStorage.getItem("jwt_token");
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
  element.textContent = message;
  element.className = `alert alert-${type}`; // Applies Bootstrap alert classes (e.g., 'alert alert-danger')
  element.style.display = "block"; // Make the element visible
}

/**
 * Hides a specified HTML message element and clears its content.
 * @param {HTMLElement} element The DOM element to hide.
 */
function hideMessage(element) {
  element.style.display = "none"; // Hide the element
  element.textContent = ""; // Clear its text content
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
