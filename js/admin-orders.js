// src/main/resources/static/js/admin-orders.js

document.addEventListener("DOMContentLoaded", init);

// --- Constants and Global Variables ---
const API_BASE_URL = "/api";
const ADMIN_ORDERS_API_URL = `${API_BASE_URL}/admin/orders`; // Admin-specific endpoint for orders
// FIX: Corrected the URL to match backend AuthController's @RequestMapping("/api/auth") and @GetMapping("/admin/validate")
const AUTH_VALIDATE_ADMIN_URL = `${API_BASE_URL}/auth/admin/validate`; // Corrected Endpoint to validate admin role
const LOGIN_PAGE_URL = "../login.html"; // Relative path to login page

let currentPage = 0; // Spring Data JPA pages are 0-indexed
const pageSize = 10; // Number of orders per page in admin table
let totalPages = 0;
let currentSearchTerm = ""; // For user email or order ID
let currentStatusFilter = ""; // For order status
let currentSortOrder = "orderDate_desc"; // Default sort order

// DOM Elements - Main Page
const adminOrderMessage = document.getElementById("adminOrderMessage");
const searchOrderInput = document.getElementById("searchOrderInput");
const statusFilterSelect = document.getElementById("statusFilterSelect");
const sortOrderSelect = document.getElementById("sortOrderSelect");
const applyFilterSortBtn = document.getElementById("applyFilterSortBtn");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const orderTableBody = document.getElementById("order-table-body");
const loadingSpinner = document.getElementById("loading-spinner");
const noOrdersMessage = document.getElementById("no-orders-message");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const currentPageInfo = document.getElementById("currentPageInfo");
const authLink = document.getElementById("auth-link"); // From header nav

// DOM Elements - Order Status Update Modal
const orderStatusModal = new bootstrap.Modal(
  document.getElementById("orderStatusModal")
);
const orderStatusModalLabel = document.getElementById("orderStatusModalLabel");
const orderStatusModalMessage = document.getElementById(
  "orderStatusModalMessage"
);
const orderStatusForm = document.getElementById("orderStatusForm");
const orderIdToUpdateInput = document.getElementById("orderIdToUpdate"); // Hidden input for order ID
const displayOrderId = document.getElementById("displayOrderId"); // Span to display order ID
const newOrderStatusSelect = document.getElementById("newOrderStatusSelect");
const saveOrderStatusBtn = document.getElementById("saveOrderStatusBtn");

// --- Initialization ---
/**
 * Initializes the admin order management page.
 * Attaches event listeners and fetches initial data.
 */
function init() {
  // Check admin access immediately on page load
  checkAdminAccessAndLoadData(); // Event Listeners for main page actions

  applyFilterSortBtn.addEventListener("click", handleApplyFiltersAndSort);
  resetFiltersBtn.addEventListener("click", handleResetFilters);
  prevPageBtn.addEventListener("click", () => handlePagination("prev"));
  nextPageBtn.addEventListener("click", () => handlePagination("next")); // Event Listener for Order Status Form submission

  orderStatusForm.addEventListener("submit", handleOrderStatusFormSubmit); // Event listener for 'enter' key on search input

  searchOrderInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      handleApplyFiltersAndSort();
    }
  }); // Handle Logout Link in header

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
      "ADMIN_ORDERS: Attempting to validate admin access to:",
      AUTH_VALIDATE_ADMIN_URL
    ); // DEBUG
    const response = await fetch(AUTH_VALIDATE_ADMIN_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    console.log(
      "ADMIN_ORDERS: Admin validation response status:",
      response.status
    ); // DEBUG

    if (response.ok) {
      const userData = await response.json(); // Backend sends back user details including name and roles
      console.log(
        "ADMIN_ORDERS: Admin validation successful. User data:",
        userData
      ); // DEBUG
      if (userData.roles && userData.roles.includes("ROLE_ADMIN")) {
        // Admin access confirmed, proceed to load data
        fetchOrders(
          currentPage,
          pageSize,
          currentSearchTerm,
          currentStatusFilter,
          currentSortOrder
        );
      } else {
        console.warn(
          "ADMIN_ORDERS: Admin validation successful, but user does not have ROLE_ADMIN:",
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
      console.error("ADMIN_ORDERS: Admin validation error:", errorData.message); // DEBUG
      redirectToLogin(
        "An error occurred during admin validation. Please log in again."
      );
    }
  } catch (error) {
    console.error(
      "ADMIN_ORDERS: Network or parsing error during admin validation:",
      error
    ); // DEBUG
    if (response && !response.ok) {
      // Check if response object exists and is not ok
      try {
        const errorText = await response.text();
        console.error("ADMIN_ORDERS: Raw error response text:", errorText);
      } catch (textError) {
        console.error(
          "ADMIN_ORDERS: Could not read response as text either:",
          textError
        );
      }
    } else if (
      error instanceof TypeError &&
      error.message.includes("Failed to fetch")
    ) {
      console.error(
        "ADMIN_ORDERS: Possible network error or CORS issue. Check server status."
      );
    } else if (error instanceof SyntaxError && error.message.includes("JSON")) {
      console.error(
        "ADMIN_ORDERS: Response was not valid JSON. Backend might be returning HTML/plain text for error."
      );
    }
    redirectToLogin(
      "Could not connect to the server for admin validation. Please check your connection."
    );
  }
}

// --- API Calls ---

/**
 * Fetches orders from the backend API for admin view, with authentication.
 * @param {number} page The 0-indexed page number.
 * @param {number} size The number of items per page.
 * @param {string} searchTerm Search query for user email or order ID.
 * @param {string} statusFilter Order status to filter by.
 * @param {string} sortOrder Sorting criteria (e.g., "orderDate_desc", "totalAmount_asc").
 */
async function fetchOrders(page, size, searchTerm, statusFilter, sortOrder) {
  showLoadingState();
  hideMessage(adminOrderMessage); // Clear any previous page messages

  const token = getAuthToken();
  if (!token) {
    redirectToLogin("Authentication required for order management.");
    return;
  }

  let url = `${ADMIN_ORDERS_API_URL}?page=${page}&size=${size}`;
  if (searchTerm) {
    url += `&search=${encodeURIComponent(searchTerm)}`;
  }
  if (statusFilter) {
    url += `&status=${encodeURIComponent(statusFilter)}`;
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
      return;
    }
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to fetch orders.");
    }

    const data = await response.json(); // Assuming API returns a Page object
    const orders = data.content || [];
    totalPages = data.totalPages || 0;

    renderOrders(orders);
    updatePaginationControls(
      data.number + 1,
      data.totalPages,
      data.first,
      data.last
    );
  } catch (error) {
    console.error("Error fetching admin orders:", error);
    showMessage(
      adminOrderMessage,
      `Error loading orders: ${error.message}`,
      "danger"
    );
    renderOrders([]); // Clear orders on error
  } finally {
    hideLoadingState();
  }
}

/**
 * Updates the status of an existing order via the backend API.
 * @param {string} orderId The ID of the order to update.
 * @param {string} newStatus The new status (e.g., "SHIPPED").
 */
async function updateOrderStatus(orderId, newStatus) {
  hideMessage(orderStatusModalMessage);
  saveOrderStatusBtn.disabled = true;

  const token = getAuthToken();
  if (!token) {
    redirectToLogin("Authentication required to update order status.");
    saveOrderStatusBtn.disabled = false;
    return;
  }

  try {
    const response = await fetch(`${ADMIN_ORDERS_API_URL}/${orderId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newStatus), // Send new status as plain string or simple object
    });

    if (response.status === 401 || response.status === 403) {
      redirectToLogin("Your session has expired or you are not authorized.");
      return;
    }
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to update order status.");
    }

    const updatedOrder = await response.json();
    showMessage(
      adminOrderMessage,
      `Order ${orderId} status updated to ${updatedOrder.status} successfully!`,
      "success"
    );
    console.log("Order status updated:", updatedOrder);
    orderStatusModal.hide(); // Close the modal
    fetchOrders(
      currentPage,
      pageSize,
      currentSearchTerm,
      currentStatusFilter,
      currentSortOrder
    ); // Refresh order list
  } catch (error) {
    console.error("Error updating order status:", error);
    showMessage(orderStatusModalMessage, `Error: ${error.message}`, "danger");
  } finally {
    saveOrderStatusBtn.disabled = false;
  }
}

// --- DOM Manipulation and UI Functions ---

/**
 * Renders the fetched orders into the admin order table.
 * @param {Array<Object>} orders An array of order objects.
 */
function renderOrders(orders) {
  orderTableBody.innerHTML = ""; // Clear existing table rows
  hideMessage(loadingSpinner);
  hideMessage(noOrdersMessage);

  if (orders.length === 0) {
    showMessage(noOrdersMessage, "", ""); // Show no orders message
    return;
  }

  orders.forEach((order) => {
    const row = orderTableBody.insertRow();
    row.innerHTML = `
            <td>${order.id}</td>
            <td>${order.user.email}</td>
            <td>${new Date(order.orderDate).toLocaleDateString()}</td>
            <td>$${order.totalAmount.toFixed(2)}</td>
            <td><span class="badge ${getStatusBadgeClass(order.status)}">${
      order.status
    }</span></td>
            <td>
                <button class="btn btn-info btn-sm update-status-btn" data-order-id="${
      order.id
    }" data-current-status="${order.status}" title="Update Status">
                    <i class="fas fa-sync-alt"></i> Update Status
                </button>
                <!-- Optionally, add a "View Details" button to open a more detailed order modal -->
            </td>
        `;
    orderTableBody.appendChild(row);
  }); // Attach event listeners to dynamically created buttons

  attachOrderTableEventListeners();
}

/**
 * Helper to get Bootstrap badge class based on order status.
 */
function getStatusBadgeClass(status) {
  switch (status) {
    case "PENDING":
      return "bg-warning text-dark";
    case "PROCESSING":
      return "bg-info text-dark";
    case "SHIPPED":
      return "bg-primary";
    case "DELIVERED":
      return "bg-success";
    case "CANCELLED":
      return "bg-danger";
    default:
      return "bg-secondary";
  }
}

/**
 * Attaches event listeners to the dynamically created "Update Status" buttons.
 * This function should be called every time the table is re-rendered.
 */
function attachOrderTableEventListeners() {
  orderTableBody.querySelectorAll(".update-status-btn").forEach((button) => {
    // Remove existing listener to prevent duplicates
    const oldListener = button._updateStatusListener;
    if (oldListener) {
      button.removeEventListener("click", oldListener);
    }
    const newListener = () =>
      handleUpdateStatusClick(
        button.dataset.orderId,
        button.dataset.currentStatus
      );
    button.addEventListener("click", newListener);
    button._updateStatusListener = newListener; // Store listener reference
  });
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
  orderTableBody.innerHTML = ""; // Clear table content
  loadingSpinner.style.display = "flex";
  noOrdersMessage.style.display = "none";
  updatePaginationControls(currentPage + 1, 1, true, true); // Temporarily disable pagination
}

/**
 * Hides the loading spinner.
 */
function hideLoadingState() {
  loadingSpinner.style.display = "none";
}

/**
 * Populates the order status modal with current order data.
 * @param {string} orderId The ID of the order being updated.
 * @param {string} currentStatus The current status of the order.
 */
function populateOrderStatusModal(orderId, currentStatus) {
  hideMessage(orderStatusModalMessage);
  orderIdToUpdateInput.value = orderId;
  displayOrderId.textContent = orderId;
  newOrderStatusSelect.value = currentStatus; // Set current status as default selected
  orderStatusModal.show();
}

// --- Event Handlers ---

/**
 * Handles clicks on "Update Status" buttons in the order table.
 * Shows the status update modal.
 * @param {string} orderId The ID of the order to update.
 * @param {string} currentStatus The current status of the order.
 */
function handleUpdateStatusClick(orderId, currentStatus) {
  populateOrderStatusModal(orderId, currentStatus);
}

/**
 * Handles the submission of the order status form.
 * Gathers data and calls `updateOrderStatus`.
 * @param {Event} event The form submit event.
 */
function handleOrderStatusFormSubmit(event) {
  event.preventDefault(); // Prevent default form submission

  const orderId = orderIdToUpdateInput.value;
  const newStatus = newOrderStatusSelect.value;

  if (!orderId || !newStatus) {
    showMessage(
      orderStatusModalMessage,
      "Order ID and New Status are required.",
      "danger"
    );
    return;
  }

  updateOrderStatus(orderId, newStatus);
}

/**
 * Handles applying search, status filter, and sort.
 */
function handleApplyFiltersAndSort() {
  currentSearchTerm = searchOrderInput.value.trim();
  currentStatusFilter = statusFilterSelect.value;
  currentSortOrder = sortOrderSelect.value;
  currentPage = 0; // Reset to first page on new filter/sort
  fetchOrders(
    currentPage,
    pageSize,
    currentSearchTerm,
    currentStatusFilter,
    currentSortOrder
  );
}

/**
 * Resets all filters and sort order to their default states.
 */
function handleResetFilters() {
  searchOrderInput.value = "";
  statusFilterSelect.value = "";
  sortOrderSelect.value = "orderDate_desc"; // Reset to default sort
  currentSearchTerm = "";
  currentStatusFilter = "";
  currentSortOrder = "orderDate_desc";
  currentPage = 0; // Reset to first page
  fetchOrders(
    currentPage,
    pageSize,
    currentSearchTerm,
    currentStatusFilter,
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
  fetchOrders(
    currentPage,
    pageSize,
    currentSearchTerm,
    currentStatusFilter,
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
