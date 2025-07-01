// src/main/resources/static/js/products.js

document.addEventListener("DOMContentLoaded", init);

// --- Constants and Global Variables ---
const API_BASE_URL = "/api";
const PRODUCTS_API_URL = `${API_BASE_URL}/products`;
const CATEGORIES_API_URL = `${API_BASE_URL}/categories`;
const CART_API_ADD_ITEM_URL = `${API_BASE_URL}/cart/add`; // Endpoint to add item to cart
const LOGIN_PAGE_URL = "/login.html"; // Assuming your login page is here

let currentPage = 0; // Spring Data JPA pages are 0-indexed
const pageSize = 8; // Number of products per page
let totalPages = 0;
let currentSearchTerm = "";
let currentCategoryFilter = "";
let currentSortOrder = ""; // e.g., "name_asc", "price_desc"

// DOM Elements (initialized later in init to ensure they exist)
let productGrid;
let searchProductInput;
let categoryFilterSelect;
let sortOrderSelect;
let applyFilterSortBtn;
let resetFiltersBtn;
let prevPageBtn;
let nextPageBtn;
let currentPageInfo;
let loadingSpinner;
let noProductsMessage;

// --- Helper Functions (Moved to global scope for accessibility) ---

/**
 * Retrieves the JWT token from local storage.
 * @returns {string|null} The JWT token or null if not found or is an empty string.
 */
function getAuthToken() {
  const token = localStorage.getItem("jwt_token");
  if (token && typeof token === "string" && token.trim() !== "") {
    return token;
  }
  return null;
}

/**
 * Redirects the user to the login page after an optional alert.
 * Also clears the invalid JWT token from local storage.
 * @param {string} message Optional message to display before redirecting.
 */
function redirectToLogin(
  message = "Session expired or unauthorized. Please log in."
) {
  alert(message); // IMPORTANT: Replace with a custom modal or toast notification.
  localStorage.removeItem("jwt_token");
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
    element.className = `alert alert-${type}`;
    element.style.display = "block";
  }
}

/**
 * Hides a specified HTML message element and clears its content.
 * @param {HTMLElement} element The DOM element to hide.
 */
function hideMessage(element) {
  if (element) {
    // Add null check for safety
    element.style.display = "none";
    element.textContent = "";
  }
}

/**
 * Displays a temporary toast/notification message to the user.
 * Currently uses a simple alert, but should be replaced with a non-blocking UI component.
 * @param {string} message The text content of the toast message.
 * @param {string} type The type of message (e.g., "success", "danger", "info").
 */
function showToastMessage(message, type) {
  alert(`${type.toUpperCase()}: ${message}`);
}

/**
 * Displays an error message when products fail to load.
 * @param {string} message The error message.
 */
function showErrorMessage(message) {
  if (productGrid) {
    // Add null check for safety
    productGrid.innerHTML = `
            <div class="col-12 text-center py-5">
                <p class="lead text-danger"><i class="fas fa-exclamation-circle me-2"></i>${message}</p>
            </div>
        `;
  }
  hideMessage(loadingSpinner);
  hideMessage(noProductsMessage);
  updatePaginationControls(0, 0, true, true); // Disable pagination fully
}

/**
 * Shows the loading spinner and hides other content.
 */
function showLoadingState() {
  if (productGrid) productGrid.innerHTML = ""; // Clear existing products
  if (loadingSpinner) loadingSpinner.style.display = "flex"; // Show spinner (flex for centering)
  if (noProductsMessage) noProductsMessage.style.display = "none"; // Hide no products message
  updatePaginationControls(currentPage + 1, 1, true, true); // Temporarily disable pagination
}

/**
 * Hides the loading spinner.
 */
function hideLoadingState() {
  if (loadingSpinner) loadingSpinner.style.display = "none";
}

/**
 * Updates the state of pagination buttons and current page info.
 * @param {number} currentPageNum The current page number (1-indexed).
 * @param {number} totalPagesCount The total number of pages.
 * @param {boolean} isFirstPage True if current page is the first.
 * @param {boolean} isLastPage True if current page is the last.
 */
function updatePaginationControls(
  currentPageNum,
  totalPagesCount,
  isFirstPage,
  isLastPage
) {
  if (currentPageInfo)
    currentPageInfo.textContent = `Page ${currentPageNum} of ${
      totalPagesCount === 0 ? 1 : totalPagesCount
    }`;
  if (prevPageBtn) prevPageBtn.disabled = isFirstPage;
  if (nextPageBtn) nextPageBtn.disabled = isLastPage;
  // If no products, disable both buttons
  if (totalPagesCount === 0 || totalPagesCount === 1) {
    if (prevPageBtn) prevPageBtn.disabled = true;
    if (nextPageBtn) nextPageBtn.disabled = true;
  }
}

/**
 * Renders the fetched products into the product grid.
 * @param {Array<Object>} products An array of product objects.
 */
function renderProducts(products) {
  console.log(
    "RENDER_PRODUCTS: Starting rendering process. Products count:",
    products.length
  ); // DEBUG
  if (productGrid) {
    productGrid.innerHTML = ""; // Clear existing products
    console.log("RENDER_PRODUCTS: productGrid innerHTML cleared."); // DEBUG
  } else {
    console.error("RENDER_PRODUCTS: productGrid element not found!"); // CRITICAL DEBUG
    return; // Cannot render if productGrid is null
  }

  hideMessage(loadingSpinner); // Hide loading spinner
  hideMessage(noProductsMessage); // Hide no products message
  console.log(
    "RENDER_PRODUCTS: Loading spinner and no products message hidden."
  ); // DEBUG

  if (products.length === 0) {
    showMessage(
      noProductsMessage,
      "No products found matching your criteria.",
      "info"
    ); // Show no products message
    console.log(
      "RENDER_PRODUCTS: No products to render. Displaying 'no products' message."
    ); // DEBUG
    return;
  }

  products.forEach((product, index) => {
    console.log(
      `RENDER_PRODUCTS: Creating card for product ${index + 1}: ${product.name}`
    ); // DEBUG
    const productCard = document.createElement("div");
    productCard.classList.add(
      "col-lg-3",
      "col-md-4",
      "col-sm-6",
      "mb-4",
      "fade-in"
    ); // Add fade-in for animation
    productCard.innerHTML = `
                <div class="product-card">
                  <img
                    src="${
                      product.imageUrl ||
                      `https://placehold.co/300x150/cccccc/000000?text=${encodeURIComponent(
                        product.name
                      )}`
                    }"
                    class="card-img-top"
                    alt="${product.name}"
                    onerror="this.onerror=null;this.src='https://placehold.co/300x150/cccccc/000000?text=Image+Error';"
                  />
                  <div class="card-body">
                    <h5 class="card-title">${product.name}</h5>
                    <p class="product-category text-muted">${
                      product.category || "Uncategorized"
                    }</p> <!-- Added null check for category -->
                    <p class="price">$${
                      product.price ? product.price.toFixed(2) : "0.00"
                    }</p> <!-- Added null check for price -->
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
    if (productGrid) {
      productGrid.appendChild(productCard); // Add null check
      console.log(
        `RENDER_PRODUCTS: Appended product card for ${product.name}.`
      ); // DEBUG
    }

    // Attach event listener for "Add to Cart" button
    const addToCartBtn = productCard.querySelector(".add-to-cart-btn");
    if (addToCartBtn && !addToCartBtn.disabled) {
      addToCartBtn.addEventListener("click", () => addToCart(product.id, 1));
    }
  });

  // Trigger fade-in animation for newly added cards
  const newCards = productGrid ? productGrid.querySelectorAll(".fade-in") : []; // Add null check
  console.log(
    "RENDER_PRODUCTS: Found",
    newCards.length,
    "new cards for animation."
  ); // DEBUG
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
      { threshold: 0.1 }
    ); // Trigger when 10% of item is visible

    newCards.forEach((el) => observer.observe(el));
  } else {
    // Fallback for browsers that don't support Intersection Observer
    newCards.forEach((el) => el.classList.add("visible"));
  }
  console.log("RENDER_PRODUCTS: Finished rendering process."); // DEBUG
  console.log(
    "RENDER_PRODUCTS: Final productGrid innerHTML:",
    productGrid
      ? productGrid.innerHTML.substring(0, 500) + "..."
      : "productGrid is null"
  ); // DEBUG first 500 chars
}

// --- Initialization ---
function init() {
  // Initialize DOM elements after the DOM is loaded
  productGrid = document.getElementById("product-grid");
  searchProductInput = document.getElementById("searchProductInput");
  categoryFilterSelect = document.getElementById("categoryFilterSelect");
  sortOrderSelect = document.getElementById("sortOrderSelect");
  applyFilterSortBtn = document.getElementById("applyFilterSortBtn");
  resetFiltersBtn = document.getElementById("resetFiltersBtn");
  prevPageBtn = document.getElementById("prevPageBtn");
  nextPageBtn = document.getElementById("nextPageBtn");
  currentPageInfo = document.getElementById("currentPageInfo");
  loadingSpinner = document.getElementById("loading-spinner");
  noProductsMessage = document.getElementById("no-products-message");

  console.log("PRODUCTS page: Initializing..."); // DEBUG
  // Initial fetch of products
  fetchProducts(
    currentPage,
    pageSize,
    currentSearchTerm,
    currentCategoryFilter,
    currentSortOrder
  );

  // Load available categories for the filter dropdown
  fetchCategories();

  // Attach Event Listeners
  if (applyFilterSortBtn)
    applyFilterSortBtn.addEventListener("click", handleApplyFiltersAndSort);
  if (resetFiltersBtn)
    resetFiltersBtn.addEventListener("click", handleResetFilters);

  if (prevPageBtn)
    prevPageBtn.addEventListener("click", () => handlePagination("prev"));
  if (nextPageBtn)
    nextPageBtn.addEventListener("click", () => handlePagination("next"));

  // Optional: Add event listener for 'enter' key on search input
  if (searchProductInput) {
    searchProductInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        handleApplyFiltersAndSort();
      }
    });
  }
}

// --- API Calls ---

/**
 * Fetches products from the backend API based on current filters, sort, and pagination.
 * @param {number} page The 0-indexed page number.
 * @param {number} size The number of items per page.
 * @param {string} searchTerm Search query for product names.
 * @param {string} categoryFilter Category name to filter by.
 * @param {string} sortOrder Sorting criteria (e.g., "name_asc", "price_desc").
 */
async function fetchProducts(
  page,
  size,
  searchTerm,
  categoryFilter,
  sortOrder
) {
  showLoadingState(); // Show loading spinner

  let url = `${PRODUCTS_API_URL}?page=${page}&size=${size}`;
  if (searchTerm) {
    url += `&search=${encodeURIComponent(searchTerm)}`;
  }
  if (categoryFilter) {
    url += `&category=${encodeURIComponent(categoryFilter)}`;
  }
  if (sortOrder) {
    // Backend would parse this, e.g., "name_asc" -> "name,asc"
    // Assuming backend Spring Data JPA can handle "name_asc" directly or convert
    url += `&sort=${encodeURIComponent(sortOrder)}`;
  }

  console.log("PRODUCTS: Attempting to fetch products from:", url); // DEBUG

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        // No Authorization header needed for public product browsing
      },
    });

    console.log("PRODUCTS: Fetch products response status:", response.status); // DEBUG

    if (!response.ok) {
      // Attempt to read error response as text if JSON parsing fails
      let errorText = "Unknown error";
      try {
        errorText = await response.text();
        console.error(
          "PRODUCTS: Raw error response text for products:",
          errorText
        ); // DEBUG
      } catch (e) {
        console.error(
          "PRODUCTS: Could not read error response text for products:",
          e
        );
      }
      throw new Error(
        `Failed to fetch products: ${response.status} - ${errorText.substring(
          0,
          100
        )}...`
      );
    }

    const data = await response.json(); // Assuming API returns a Page object
    // Use JSON.stringify for clearer debug output of the data content
    console.log(
      "PRODUCTS: Products data received:",
      JSON.stringify(data, null, 2)
    ); // DEBUG
    const products = data.content || []; // THIS LINE WILL NOW BE CORRECT!
    totalPages = data.totalPages || 0; // Update global totalPages

    renderProducts(products);
    updatePaginationControls(
      data.number + 1,
      data.totalPages,
      data.first,
      data.last
    ); // Pass Spring Data JPA page info
  } catch (error) {
    console.error("PRODUCTS: Error fetching products:", error); // DEBUG
    showErrorMessage("Error loading products. Please try again later.");
    renderProducts([]); // Clear products on error
  } finally {
    hideLoadingState(); // Hide spinner regardless of success or failure
  }
}

/**
 * Fetches product categories from the backend and populates the filter dropdown.
 */
async function fetchCategories() {
  console.log(
    "PRODUCTS: Attempting to fetch categories from:",
    CATEGORIES_API_URL
  ); // DEBUG
  try {
    const response = await fetch(CATEGORIES_API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("PRODUCTS: Fetch categories response status:", response.status); // DEBUG

    if (!response.ok) {
      // Attempt to read error response as text if JSON parsing fails
      let errorText = "Unknown error";
      try {
        errorText = await response.text();
        console.error(
          "PRODUCTS: Raw error response text for categories:",
          errorText
        ); // DEBUG
      } catch (e) {
        console.error(
          "PRODUCTS: Could not read error response text for categories:",
          e
        );
      }
      throw new Error(
        `Failed to fetch categories: ${response.status} - ${errorText.substring(
          0,
          100
        )}...`
      );
    }

    const categories = await response.json();
    // Use JSON.stringify for clearer debug output of the data content
    console.log(
      "PRODUCTS: Categories data received:",
      JSON.stringify(categories, null, 2)
    ); // DEBUG
    // Clear existing options except "All Categories"
    if (categoryFilterSelect) {
      // Add null check
      categoryFilterSelect.innerHTML =
        '<option value="">All Categories</option>';
      categories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category.name; // Assuming category object has a 'name' field
        option.textContent = category.name;
        categoryFilterSelect.appendChild(option);
      });
    }

    // If a category was passed in the URL (e.g., from index.html), set it
    const urlParams = new URLSearchParams(window.location.search);
    const initialCategory = urlParams.get("category");
    if (initialCategory) {
      if (categoryFilterSelect) categoryFilterSelect.value = initialCategory; // Add null check
      currentCategoryFilter = initialCategory; // Update global state
      // Re-fetch products with the initial category filter
      fetchProducts(
        currentPage,
        pageSize,
        currentSearchTerm,
        currentCategoryFilter,
        currentSortOrder
      );
    }
  } catch (error) {
    console.error("PRODUCTS: Error fetching categories:", error); // DEBUG
    // Optionally show a message to the user
  }
}

/**
 * Adds a product to the user's shopping cart.
 * @param {string} productId The ID of the product to add.
 * @param {number} quantity The quantity to add (defaults to 1).
 */
async function addToCart(productId, quantity = 1) {
  const token = getAuthToken(); // Use the robust helper function
  if (!token) {
    // If not logged in, redirect to login page. User must be authenticated to add to cart.
    redirectToLogin("Please log in to add items to your cart.");
    return;
  }

  console.log("PRODUCTS: Attempting to add to cart. Product ID:", productId); // DEBUG

  try {
    const response = await fetch(CART_API_ADD_ITEM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // Include JWT token
      },
      body: JSON.stringify({
        productId: productId,
        quantity: quantity,
      }),
    });

    console.log("PRODUCTS: Add to cart response status:", response.status); // DEBUG

    if (response.status === 401 || response.status === 403) {
      redirectToLogin("Your session has expired. Please log in again.");
      return;
    }

    if (!response.ok) {
      const errorData = await response.json();
      console.error(
        "PRODUCTS: Error response data for add to cart:",
        errorData
      ); // DEBUG
      throw new Error(errorData.message || "Failed to add product to cart.");
    }

    const result = await response.json();
    console.log("PRODUCTS: Add to cart successful:", result); // DEBUG
    showToastMessage("Product added to cart successfully!", "success");
    // Optionally update cart icon count in header here
  } catch (error) {
    console.error("PRODUCTS: Error adding to cart:", error); // DEBUG
    showToastMessage(`Error adding to cart: ${error.message}`, "danger");
  }
}

// --- Event Handlers ---

/**
 * Handles applying search, category, and sort filters.
 */
function handleApplyFiltersAndSort() {
  currentSearchTerm = searchProductInput.value.trim();
  currentCategoryFilter = categoryFilterSelect.value;
  currentSortOrder = sortOrderSelect.value;
  currentPage = 0; // Reset to first page on new filter/sort
  fetchProducts(
    currentPage,
    pageSize,
    currentSearchTerm,
    currentCategoryFilter,
    currentSortOrder
  );
}

/**
 * Resets all filters and sort order to their default states.
 */
function handleResetFilters() {
  searchProductInput.value = "";
  categoryFilterSelect.value = "";
  sortOrderSelect.value = "";
  currentSearchTerm = "";
  currentCategoryFilter = "";
  currentSortOrder = "";
  currentPage = 0; // Reset to first page
  fetchProducts(
    currentPage,
    pageSize,
    currentSearchTerm,
    currentCategoryFilter,
    currentSortOrder
  );
}

/**
 * Handles pagination navigation (previous/next page).
 * @param {string} direction "prev" or "next".
 */
function handlePagination(direction) {
  if (direction === "prev" && currentPage > 0) {
    currentPage--;
  } else if (direction === "next" && currentPage < totalPages - 1) {
    currentPage++;
  }
  fetchProducts(
    currentPage,
    pageSize,
    currentSearchTerm,
    currentCategoryFilter,
    currentSortOrder
  );
}
