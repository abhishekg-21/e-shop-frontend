// src/main/resources/static/js/admin-products.js

document.addEventListener("DOMContentLoaded", init);

const API_BASE_URL = "https://e-shop-backend-8ouh.onrender.com/api"; // Your DEPLOYED Render backend URL
const ADMIN_PRODUCTS_API_URL = `${API_BASE_URL}/admin/products`; // Admin-specific endpoint for products
const CATEGORIES_API_URL = `${API_BASE_URL}/categories`; // Re-use public category endpoint
// FIX: Corrected the URL to match backend AuthController's @RequestMapping and @GetMapping
const VALIDATE_ADMIN_URL = `${API_BASE_URL}/auth/admin/validate`; // This line should be updated in your file
const LOGIN_PAGE_URL = "../login.html"; // Relative path to login page

let currentPage = 0; // Spring Data JPA pages are 0-indexed
const pageSize = 10; // Number of products per page in admin table
let totalPages = 0;
let currentSearchTerm = "";
let currentCategoryFilter = "";
let currentSortOrder = ""; // e.g., "name_asc", "price_desc", "stock_asc"
let productIdToDelete = null; // Stores ID of product targeted for deletion

// DOM Elements - Main Page
const adminProductMessage = document.getElementById("adminProductMessage");
const searchProductInput = document.getElementById("searchProductInput");
const categoryFilterSelect = document.getElementById("categoryFilterSelect");
const sortOrderSelect = document.getElementById("sortOrderSelect");
const applyFilterSortBtn = document.getElementById("applyFilterSortBtn");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const productTableBody = document.getElementById("product-table-body");
const loadingSpinner = document.getElementById("loading-spinner");
const noProductsMessage = document.getElementById("no-products-message");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = (document = document.getElementById("nextPageBtn")); // Corrected typo here
const currentPageInfo = document.getElementById("currentPageInfo");
const addNewProductBtn = document.getElementById("addNewProductBtn");

// DOM Elements - Product Modal
const productModal = new bootstrap.Modal(
  document.getElementById("productModal")
);
const productModalLabel = document.getElementById("productModalLabel");
const modalMessage = document.getElementById("modalMessage");
const productForm = document.getElementById("productForm");
const productIdInput = document.getElementById("productId"); // Hidden input for product ID
const productNameInput = document.getElementById("productName");
const productCategoryInput = document.getElementById("productCategory"); // Dropdown in modal
const productPriceInput = document.getElementById("productPrice");
const productStockInput = document.getElementById("productStock"); // This input maps to stockQuantity in backend
const productImageUrlInput = document.getElementById("productImageUrl");
const productDescriptionInput = document.getElementById("productDescription");
const saveProductBtn = document.getElementById("saveProductBtn");

// DOM Elements - Delete Confirmation Modal
const confirmDeleteModal = new bootstrap.Modal(
  document.getElementById("confirmDeleteModal")
);
const productToDeleteNameSpan = document.getElementById("productToDeleteName");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

// --- Initialization ---
/**
 * Initializes the admin product management page.
 * Attaches event listeners and fetches initial data.
 */
function init() {
  // Check admin access immediately on page load
  checkAdminAccessAndLoadData(); // Event Listeners for main page actions

  applyFilterSortBtn.addEventListener("click", handleApplyFiltersAndSort);
  resetFiltersBtn.addEventListener("click", handleResetFilters);
  prevPageBtn.addEventListener("click", () => handlePagination("prev"));
  nextPageBtn.addEventListener("click", () => handlePagination("next"));
  addNewProductBtn.addEventListener("click", handleAddNewProductClick); // Event Listener for Product Form submission (Add/Edit Modal)

  productForm.addEventListener("submit", handleProductFormSubmit); // Event Listener for Delete Confirmation Modal

  confirmDeleteBtn.addEventListener("click", handleConfirmDelete); // Event listener for when product modal is hidden (to clear form)

  document
    .getElementById("productModal")
    .addEventListener("hidden.bs.modal", clearProductModal); // Event listener for 'enter' key on search input

  searchProductInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      handleApplyFiltersAndSort();
    }
  }); // Handle Logout Link in header (assuming it exists and has an ID)

  const authLink = document.getElementById("auth-link");
  if (authLink) {
    authLink.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem("jwt_token");
      redirectToLogin("You have been logged out.");
    });
  }
}

/**
 * Validates admin access and then proceeds to load page data.
 * Redirects to login if not authorized.
 */
async function checkAdminAccessAndLoadData() {
  const token = getAuthToken();
  if (!token) {
    redirectToLogin("You are not logged in or your session has expired.");
    return;
  }

  try {
    console.log(
      "ADMIN_PRODUCTS: Attempting to validate admin access to:",
      VALIDATE_ADMIN_URL
    ); // DEBUG
    const response = await fetch(VALIDATE_ADMIN_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    console.log(
      "ADMIN_PRODUCTS: Admin validation response status:",
      response.status
    ); // DEBUG

    if (response.ok) {
      const userData = await response.json(); // Backend sends back user details including name and roles
      console.log(
        "ADMIN_PRODUCTS: Admin validation successful. User data:",
        userData
      ); // DEBUG
      if (userData.roles && userData.roles.includes("ROLE_ADMIN")) {
        // Admin access confirmed, proceed to load data
        fetchProducts(
          currentPage,
          pageSize,
          currentSearchTerm,
          currentCategoryFilter,
          currentSortOrder
        );
        fetchCategories(productCategoryInput); // Populate modal category dropdown
        fetchCategories(categoryFilterSelect); // Populate filter category dropdown
      } else {
        console.warn(
          "ADMIN_PRODUCTS: Admin validation successful, but user does not have ROLE_ADMIN:",
          userData
        ); // DEBUG
        redirectToLogin(
          "Access Denied: You do not have administrator privileges."
        );
      }
    } else if (response.status === 401 || response.status === 403) {
      redirectToLogin(
        "Access Denied: You do not have administrator privileges."
      );
    } else {
      const errorData = await response.json();
      console.error(
        "ADMIN_PRODUCTS: Admin validation error:",
        errorData.message
      ); // DEBUG
      redirectToLogin(
        "An error occurred during admin validation. Please log in again."
      );
    }
  } catch (error) {
    console.error(
      "ADMIN_PRODUCTS: Network or parsing error during admin validation:",
      error
    ); // DEBUG
    if (response && !response.ok) {
      // Check if response object exists and is not ok
      try {
        const errorText = await response.text();
        console.error("ADMIN_PRODUCTS: Raw error response text:", errorText);
      } catch (textError) {
        console.error(
          "ADMIN_PRODUCTS: Could not read response as text either:",
          textError
        );
      }
    } else if (
      error instanceof TypeError &&
      error.message.includes("Failed to fetch")
    ) {
      console.error(
        "ADMIN_PRODUCTS: Possible network error or CORS issue. Check server status."
      );
    } else if (error instanceof SyntaxError && error.message.includes("JSON")) {
      console.error(
        "ADMIN_PRODUCTS: Response was not valid JSON. Backend might be returning HTML/plain text for error."
      );
    }
    redirectToLogin(
      "Could not connect to the server for admin validation. Please check your connection."
    );
  }
}

// --- API Calls ---

/**
 * Fetches products from the backend API for admin view, with authentication.
 * @param {number} page The 0-indexed page number.
 * @param {number} size The number of items per page.
 * @param {string} searchTerm Search query for product names.
 * @param {string} categoryFilter Category name to filter by.
 * @param {string} sortOrder Sorting criteria (e.g., "name_asc", "price_desc", "stock_asc").
 */
async function fetchProducts(
  page,
  size,
  searchTerm,
  categoryFilter,
  sortOrder
) {
  showLoadingState();
  hideMessage(adminProductMessage); // Clear any previous page messages

  const token = getAuthToken(); // Use the robust helper function
  if (!token) {
    redirectToLogin("Authentication required for product management.");
    return;
  }

  let url = `${ADMIN_PRODUCTS_API_URL}?page=${page}&size=${size}`;
  if (searchTerm) {
    url += `&search=${encodeURIComponent(searchTerm)}`;
  }
  if (categoryFilter) {
    url += `&category=${encodeURIComponent(categoryFilter)}`;
  }
  if (sortOrder) {
    url += `&sort=${encodeURIComponent(sortOrder)}`;
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // Include JWT token
      },
    });

    if (response.status === 401 || response.status === 403) {
      redirectToLogin("Your session has expired or you are not authorized.");
      return; // Exit after redirection
    }
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to fetch products.");
    }

    const data = await response.json(); // Assuming API returns a Page object
    const products = data.content || [];
    totalPages = data.totalPages || 0;

    renderProducts(products);
    updatePaginationControls(
      data.number + 1,
      data.totalPages,
      data.first,
      data.last
    );
  } catch (error) {
    console.error("Error fetching admin products:", error);
    showMessage(
      adminProductMessage,
      `Error loading products: ${error.message}`,
      "danger"
    );
    renderProducts([]); // Clear products on error
  } finally {
    hideLoadingState();
  }
}

/**
 * Fetches product categories from the backend and populates specified dropdowns.
 * @param {HTMLElement} selectElement The <select> element to populate.
 * @param {string} [selectedValue=''] Optional value to pre-select.
 */
async function fetchCategories(selectElement, selectedValue = "") {
  const token = getAuthToken(); // Use the robust helper function
  if (!token) {
    // Categories API might be protected in admin context, so ensure token is present
    return; // Exit if no token
  }

  try {
    const response = await fetch(CATEGORIES_API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // Authenticated call
      },
    });

    if (!response.ok) {
      // Don't block if categories fail, just log error
      console.error("Failed to fetch categories.");
      return;
    }

    const categories = await response.json(); // Clear existing options
    selectElement.innerHTML = ""; // Add "All Categories" option only for the filter select

    if (selectElement.id === "categoryFilterSelect") {
      const allOption = document.createElement("option");
      allOption.value = "";
      allOption.textContent = "All Categories";
      selectElement.appendChild(allOption);
    } else {
      // For the modal's category select, add a default prompt
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "Select a Category";
      defaultOption.disabled = true;
      defaultOption.selected = true; // Make it selected by default
      selectElement.appendChild(defaultOption);
    }

    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.name; // Assuming category object has a 'name' field
      option.textContent = category.name;
      selectElement.appendChild(option);
    }); // Pre-select value if provided (must happen after options are added)

    if (selectedValue) {
      selectElement.value = selectedValue;
    }
  } catch (error) {
    console.error("Error fetching categories:", error);
  }
}

/**
 * Fetches a single product by ID for editing.
 * @param {string} productId The ID of the product to fetch.
 */
async function fetchProductById(productId) {
  hideMessage(modalMessage); // Clear previous messages in modal

  const token = getAuthToken(); // Use the robust helper function
  if (!token) {
    redirectToLogin("Authentication required to edit product.");
    return;
  }

  try {
    const response = await fetch(`${ADMIN_PRODUCTS_API_URL}/${productId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      redirectToLogin("Your session has expired or you are not authorized.");
      return null; // Return null after redirection
    }
    if (response.status === 404) {
      showMessage(modalMessage, "Product not found.", "danger");
      return null;
    }
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message || "Failed to fetch product details for editing."
      );
    }

    const product = await response.json();
    populateProductModal(product); // Fill the form with product data
    productModal.show(); // Show the modal
  } catch (error) {
    console.error("Error fetching product for edit:", error);
    showMessage(
      adminProductMessage,
      `Error loading product for edit: ${error.message}`,
      "danger"
    );
  }
}

/**
 * Saves (adds or updates) a product via the backend API.
 * @param {Object} productData The product data to save.
 * @param {boolean} isEdit True if updating an existing product, false for adding new.
 */
async function saveProduct(productData, isEdit) {
  hideMessage(modalMessage); // Clear previous messages in modal
  saveProductBtn.disabled = true; // Disable button to prevent double submission

  const token = getAuthToken(); // Use the robust helper function
  if (!token) {
    redirectToLogin("Authentication required to save product.");
    saveProductBtn.disabled = false;
    return;
  }

  const method = isEdit ? "PUT" : "POST";
  const url = isEdit
    ? `${ADMIN_PRODUCTS_API_URL}/${productData.id}`
    : ADMIN_PRODUCTS_API_URL;

  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(productData),
    });

    if (response.status === 401 || response.status === 403) {
      redirectToLogin("Your session has expired or you are not authorized.");
      return; // Exit after redirection
    }
    if (!response.ok) {
      const errorData = await response.json(); // Backend might return validation errors in a specific format
      let errorMessage =
        errorData.message || `Failed to ${isEdit ? "update" : "add"} product.`;
      if (errorData.errors && Array.isArray(errorData.errors)) {
        errorMessage +=
          "\n" +
          errorData.errors
            .map((err) => err.defaultMessage || err.message)
            .join("\n");
      }
      throw new Error(errorMessage);
    } // Success

    const savedProduct = await response.json();
    showMessage(
      adminProductMessage,
      `Product ${isEdit ? "updated" : "added"} successfully!`,
      "success"
    );
    console.log(`Product ${isEdit ? "updated" : "added"}:`, savedProduct);
    productModal.hide(); // Close the modal
    fetchProducts(
      currentPage,
      pageSize,
      currentSearchTerm,
      currentCategoryFilter,
      currentSortOrder
    ); // Refresh product list
  } catch (error) {
    console.error(`Error saving product:`, error);
    showMessage(modalMessage, `Error: ${error.message}`, "danger");
  } finally {
    saveProductBtn.disabled = false; // Re-enable button
  }
}

/**
 * Deletes a product via the backend API.
 * @param {string} productId The ID of the product to delete.
 */
async function deleteProduct(productId) {
  hideMessage(adminProductMessage); // Clear any page messages

  const token = getAuthToken(); // Use the robust helper function
  if (!token) {
    redirectToLogin("Authentication required to delete product.");
    return;
  }

  try {
    const response = await fetch(`${ADMIN_PRODUCTS_API_URL}/${productId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      redirectToLogin("Your session has expired or you are not authorized.");
      return;
    }
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to delete product.");
    } // If successful (204 No Content or 200 OK with empty body)

    showMessage(
      adminProductMessage,
      "Product deleted successfully!",
      "success"
    );
    confirmDeleteModal.hide(); // Close delete confirmation modal
    fetchProducts(
      currentPage,
      pageSize,
      currentSearchTerm,
      currentCategoryFilter,
      currentSortOrder
    ); // Refresh product list
  } catch (error) {
    console.error("Error deleting product:", error);
    showMessage(adminProductMessage, `Error: ${error.message}`, "danger");
  }
}

// --- DOM Manipulation and UI Functions ---

/**
 * Renders the fetched products into the admin product table.
 * @param {Array<Object>} products An array of product objects.
 */
function renderProducts(products) {
  productTableBody.innerHTML = ""; // Clear existing table rows
  hideMessage(loadingSpinner);
  hideMessage(noProductsMessage);

  if (products.length === 0) {
    showMessage(noProductsMessage, "", ""); // Show no products message
    return;
  }

  products.forEach((product) => {
    const row = productTableBody.insertRow();
    row.innerHTML = `
            <td>
                <img src="${
      product.imageUrl ||
      `https://placehold.co/60x60/cccccc/000000?text=${encodeURIComponent(
        product.name
      )}`
    }"
                     alt="${product.name}"
                     onerror="this.onerror=null;this.src='https://placehold.co/60x60/cccccc/000000?text=Img+Error';"
                     class="product-thumbnail-sm rounded" />
            </td>
            <td>${product.name}</td>
            <td>${product.category || "N/A"}</td>
            <td>$${product.price.toFixed(2)}</td>
            <td>${
      product.stockQuantity
    }</td> <!-- Corrected from product.stock -->
            <td>
                <button class="btn btn-info btn-sm edit-product-btn me-2" data-product-id="${
      product.id
    }" title="Edit Product">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger btn-sm delete-product-btn" data-product-id="${
      product.id
    }" data-product-name="${product.name}" title="Delete Product">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
    productTableBody.appendChild(row); // Append the row to the tbody
  }); // Attach event listeners to dynamically created buttons

  attachProductTableEventListeners();
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
  currentPageInfo.textContent = `Page ${currentPageNum} of ${
    totalPagesCount === 0 ? 1 : totalPagesCount
  }`;
  prevPageBtn.disabled = isFirstPage;
  nextPageBtn.disabled = isLastPage;
  if (totalPagesCount === 0 || totalPagesCount === 1) {
    prevPageBtn.disabled = true;
    nextPageBtn.disabled = true;
  }
}

/**
 * Shows the loading spinner and hides other content.
 */
function showLoadingState() {
  productTableBody.innerHTML = ""; // Clear table content
  loadingSpinner.style.display = "flex";
  noProductsMessage.style.display = "none";
  updatePaginationControls(currentPage + 1, 1, true, true); // Temporarily disable pagination
}

/**
 * Hides the loading spinner.
 */
function hideLoadingState() {
  loadingSpinner.style.display = "none";
}

/**
 * Populates the product modal form with existing product data for editing.
 * @param {Object} product The product object to populate the form with.
 */
function populateProductModal(product) {
  productModalLabel.textContent = "Edit Product";
  productIdInput.value = product.id;
  productNameInput.value = product.name;
  productPriceInput.value = product.price;
  productStockInput.value = product.stockQuantity; // Corrected from product.stock
  productImageUrlInput.value = product.imageUrl || "";
  productDescriptionInput.value = product.description; // Re-fetch and pre-select category

  fetchCategories(productCategoryInput, product.category);
}

/**
 * Clears the product modal form and resets it for adding a new product.
 */
function clearProductModal() {
  productModalLabel.textContent = "Add New Product";
  productForm.reset(); // Resets all form fields
  productIdInput.value = ""; // Clear hidden ID
  hideMessage(modalMessage); // Clear any modal messages // Ensure category dropdown is reset to "Select a Category" for add mode

  fetchCategories(productCategoryInput, ""); // Pass empty string to select default
}

// --- Event Handlers ---

/**
 * Handles clicks on the "Add New Product" button.
 * Clears the modal form and shows it.
 */
function handleAddNewProductClick() {
  clearProductModal();
  productModal.show();
}

/**
 * Handles clicks on "Delete" buttons in the product table.
 * Shows the confirmation modal.
 * @param {string} productId The ID of the product to delete.
 * @param {string} productName The name of the product to display in the modal.
 */
function handleDeleteProductClick(productId, productName) {
  productIdToDelete = productId; // Store ID for confirmation
  productToDeleteNameSpan.textContent = productName;
  confirmDeleteModal.show();
}

/**
 * Handles the submission of the product form (Add/Edit).
 * Gathers data and calls `saveProduct`.
 * @param {Event} event The form submit event.
 */
function handleProductFormSubmit(event) {
  event.preventDefault(); // Prevent default form submission

  const isEdit = !!productIdInput.value; // If productId has a value, it's an edit operation

  const productData = {
    id: isEdit ? productIdInput.value : null,
    name: productNameInput.value.trim(),
    category: productCategoryInput.value, // This sends the category name string
    price: parseFloat(productPriceInput.value),
    stockQuantity: parseInt(productStockInput.value), // Corrected to stockQuantity
    imageUrl: productImageUrlInput.value.trim(),
    description: productDescriptionInput.value.trim(),
  }; // Basic client-side validation

  if (
    !productData.name ||
    !productData.category ||
    productData.category === "" || // Ensure category is selected
    isNaN(productData.price) ||
    isNaN(productData.stockQuantity) || // Corrected to stockQuantity
    !productData.description
  ) {
    showMessage(
      modalMessage,
      "Please fill in all required fields (Name, Category, Price, Stock Quantity, Description) and ensure price/stock are numbers.",
      "danger"
    );
    return;
  }
  if (productData.price < 0 || productData.stockQuantity < 0) {
    // Corrected to stockQuantity
    showMessage(
      modalMessage,
      "Price and Stock Quantity cannot be negative.",
      "danger"
    );
    return;
  }
  if (
    productData.imageUrl &&
    !productData.imageUrl.match(/^(ftp|http|https):\/\/[^ "]+$/)
  ) {
    showMessage(modalMessage, "Please enter a valid image URL.", "danger");
    return;
  }

  saveProduct(productData, isEdit);
}

/**
 * Handles the click on the "Delete" button inside the confirmation modal.
 * Calls the `deleteProduct` function.
 */
function handleConfirmDelete() {
  if (productIdToDelete) {
    deleteProduct(productIdToDelete);
    productIdToDelete = null; // Clear stored ID after action
  }
}

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

// --- Helper Functions (reused from other JS files) ---

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
  element.className = `alert alert-${type}`;
  element.style.display = "block";
}

/**
 * Hides a specified HTML message element and clears its content.
 * @param {HTMLElement} element The DOM element to hide.
 */
function hideMessage(element) {
  element.style.display = "none";
  element.textContent = "";
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
