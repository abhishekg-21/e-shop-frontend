// src/main/resources/static/js/admin-users.js

document.addEventListener("DOMContentLoaded", init);

// --- Constants and Global Variables ---
const API_BASE_URL = "/api";
const ADMIN_USERS_API_URL = `${API_BASE_URL}/admin/users`; // Admin-specific endpoint for users
const ROLES_API_URL = `${API_BASE_URL}/roles`; // Endpoint to fetch all roles
const LOGIN_PAGE_URL = "../login.html"; // Relative path to login page

let currentPage = 0; // Spring Data JPA pages are 0-indexed
const pageSize = 10; // Number of users per page in admin table
let totalPages = 0;
let currentSearchTerm = "";
let currentRoleFilter = "";
let currentSortOrder = "email_asc"; // Default sort order
let userIdToDelete = null; // Stores ID of user targeted for deletion

// DOM Elements - Main Page
const adminUserMessage = document.getElementById("adminUserMessage");
const searchUserInput = document.getElementById("searchUserInput");
const roleFilterSelect = document.getElementById("roleFilterSelect");
const sortOrderSelect = document.getElementById("sortOrderSelect");
const applyFilterSortBtn = document.getElementById("applyFilterSortBtn");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const userTableBody = document.getElementById("user-table-body");
const loadingSpinner = document.getElementById("loading-spinner");
const noUsersMessage = document.getElementById("no-users-message");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const currentPageInfo = document.getElementById("currentPageInfo");
const addNewUserBtn = document.getElementById("addNewUserBtn");
const authLink = document.getElementById("auth-link"); // From header nav

// DOM Elements - User Modal
const userModal = new bootstrap.Modal(document.getElementById("userModal"));
const userModalLabel = document.getElementById("userModalLabel");
const modalMessage = document.getElementById("modalMessage");
const userForm = document.getElementById("userForm");
const userIdInput = document.getElementById("userId"); // Hidden input for user ID
const userFirstNameInput = document.getElementById("userFirstName");
const userLastNameInput = document.getElementById("userLastName");
const userEmailInput = document.getElementById("userEmail");
const userPasswordInput = document.getElementById("userPassword");
const userPhoneNumberInput = document.getElementById("userPhoneNumber");
const userRolesSelect = document.getElementById("userRoles"); // Multi-select dropdown
const userEnabledCheckbox = document.getElementById("userEnabled");
const saveUserBtn = document.getElementById("saveUserBtn");

// DOM Elements - Delete Confirmation Modal
const confirmDeleteModal = new bootstrap.Modal(
  document.getElementById("confirmDeleteModal")
);
const userToDeleteNameSpan = document.getElementById("userToDeleteName");
const confirmDeleteButton = document.getElementById("confirmDeleteBtn"); // Renamed to avoid conflict

// --- Initialization ---
/**
 * Initializes the admin user management page.
 * Attaches event listeners and fetches initial data.
 */
function init() {
  // Check admin access immediately on page load
  checkAdminAccessAndLoadData(); // Event Listeners for main page actions

  applyFilterSortBtn.addEventListener("click", handleApplyFiltersAndSort);
  resetFiltersBtn.addEventListener("click", handleResetFilters);
  prevPageBtn.addEventListener("click", () => handlePagination("prev"));
  nextPageBtn.addEventListener("click", () => handlePagination("next"));
  addNewUserBtn.addEventListener("click", handleAddNewUserClick); // Event Listener for User Form submission (Add/Edit Modal)

  userForm.addEventListener("submit", handleUserFormSubmit); // Event Listener for Delete Confirmation Modal

  confirmDeleteButton.addEventListener("click", handleConfirmDelete); // Corrected to new name // Event listener for when user modal is hidden (to clear form)

  document
    .getElementById("userModal")
    .addEventListener("hidden.bs.modal", clearUserModal); // Event listener for 'enter' key on search input

  searchUserInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      handleApplyFiltersAndSort();
    }
  }); // Handle Logout Link

  authLink.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem("jwt_token");
    redirectToLogin("You have been logged out.");
  });
}

async function checkAdminAccessAndLoadData() {
  const token = getAuthToken();
  if (!token) {
    redirectToLogin("You are not logged in or your session has expired.");
    return;
  }

  try {
    // *** THIS IS THE CRITICAL LINE TO CHANGE ***
    // It must be `/api/auth/admin/validate` to match your backend AuthController
    const response = await fetch(`${API_BASE_URL}/auth/admin/validate`, {
      // <-- ENSURE THIS IS THE URL
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      // Admin access confirmed, proceed to load data
      fetchUsers(
        currentPage,
        pageSize,
        currentSearchTerm,
        currentRoleFilter,
        currentSortOrder
      );
      fetchRoles(roleFilterSelect); // Populate filter dropdown
      fetchRoles(userRolesSelect); // Populate modal multi-select
    } else if (response.status === 401 || response.status === 403) {
      redirectToLogin(
        "Access Denied: You do not have administrator privileges."
      );
    } else {
      const errorData = await response.json();
      console.error("Admin validation error:", errorData.message);
      redirectToLogin(
        "An error occurred during admin validation. Please log in again."
      );
    }
  } catch (error) {
    console.error("Network or parsing error during admin validation:", error);
    redirectToLogin(
      "Could not connect to the server for admin validation. Please check your connection."
    );
  }
}

// --- API Calls ---

/**
 * Fetches users from the backend API for admin view, with authentication.
 * @param {number} page The 0-indexed page number.
 * @param {number} size The number of items per page.
 * @param {string} searchTerm Search query for user names or emails.
 * @param {string} roleFilter Role name to filter by.
 * @param {string} sortOrder Sorting criteria (e.g., "email_asc", "lastName_desc").
 */
async function fetchUsers(page, size, searchTerm, roleFilter, sortOrder) {
  showLoadingState();
  hideMessage(adminUserMessage); // Clear any previous page messages

  const token = getAuthToken();
  if (!token) {
    redirectToLogin("Authentication required for user management.");
    return;
  }

  let url = `${ADMIN_USERS_API_URL}?page=${page}&size=${size}`;
  if (searchTerm) {
    url += `&search=${encodeURIComponent(searchTerm)}`;
  }
  if (roleFilter) {
    url += `&role=${encodeURIComponent(roleFilter)}`;
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
      throw new Error(errorData.message || "Failed to fetch users.");
    }

    const data = await response.json(); // Assuming API returns a Page object
    const users = data.content || [];
    totalPages = data.totalPages || 0;

    renderUsers(users);
    updatePaginationControls(
      data.number + 1,
      data.totalPages,
      data.first,
      data.last
    );
  } catch (error) {
    console.error("Error fetching admin users:", error);
    showMessage(
      adminUserMessage,
      `Error loading users: ${error.message}`,
      "danger"
    );
    renderUsers([]); // Clear users on error
  } finally {
    hideLoadingState();
  }
}

/**
 * Fetches all available roles from the backend and populates a select element.
 * @param {HTMLElement} selectElement The <select> element to populate.
 * @param {Array<string>} [selectedValues=[]] Optional array of role names to pre-select.
 */
async function fetchRoles(selectElement, selectedValues = []) {
  const token = getAuthToken();
  if (!token) {
    // Roles API might be protected, so ensure token is present
    return;
  }

  try {
    const response = await fetch(ROLES_API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // Authenticated call
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch roles.");
      return;
    }

    const roles = await response.json();
    selectElement.innerHTML = ""; // Clear existing options // Add "All Roles" option only for the filter select

    if (selectElement.id === "roleFilterSelect") {
      const allOption = document.createElement("option");
      allOption.value = "";
      allOption.textContent = "All Roles";
      selectElement.appendChild(allOption);
    }

    roles.forEach((role) => {
      const option = document.createElement("option");
      option.value = role.name; // Assuming role object has a 'name' field (e.g., "ROLE_ADMIN")
      option.textContent = role.name;
      if (selectedValues.includes(role.name)) {
        option.selected = true; // Pre-select if in selectedValues
      }
      selectElement.appendChild(option);
    });
  } catch (error) {
    console.error("Error fetching roles:", error);
  }
}

/**
 * Fetches a single user by ID for editing.
 * @param {string} userId The ID of the user to fetch.
 */
async function fetchUserById(userId) {
  hideMessage(modalMessage); // Clear previous messages in modal

  const token = getAuthToken();
  if (!token) {
    redirectToLogin("Authentication required to edit user.");
    return;
  }

  try {
    const response = await fetch(`${ADMIN_USERS_API_URL}/${userId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      redirectToLogin("Your session has expired or you are not authorized.");
      return null;
    }
    if (response.status === 404) {
      showMessage(modalMessage, "User not found.", "danger");
      return null;
    }
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message || "Failed to fetch user details for editing."
      );
    }

    const user = await response.json();
    populateUserModal(user); // Fill the form with user data
    userModal.show(); // Show the modal
  } catch (error) {
    console.error("Error fetching user for edit:", error);
    showMessage(
      adminUserMessage,
      `Error loading user for edit: ${error.message}`,
      "danger"
    );
  }
}

/**
 * Saves (adds or updates) a user via the backend API.
 * @param {Object} userData The user data to save.
 * @param {boolean} isEdit True if updating an existing user, false for adding new.
 */
async function saveUser(userData, isEdit) {
  hideMessage(modalMessage); // Clear previous messages in modal
  saveUserBtn.disabled = true; // Disable button to prevent double submission

  const token = getAuthToken();
  if (!token) {
    redirectToLogin("Authentication required to save user.");
    saveUserBtn.disabled = false;
    return;
  }

  const method = isEdit ? "PUT" : "POST";
  const url = isEdit
    ? `${ADMIN_USERS_API_URL}/${userData.id}`
    : ADMIN_USERS_API_URL;

  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(userData),
    });

    if (response.status === 401 || response.status === 403) {
      redirectToLogin("Your session has expired or you are not authorized.");
      return;
    }
    if (!response.ok) {
      const errorData = await response.json();
      let errorMessage =
        errorData.message || `Failed to ${isEdit ? "update" : "add"} user.`;
      if (errorData.errors && Array.isArray(errorData.errors)) {
        errorMessage +=
          "\n" +
          errorData.errors
            .map((err) => err.defaultMessage || err.message)
            .join("\n");
      }
      throw new Error(errorMessage);
    } // Success

    const savedUser = await response.json();
    showMessage(
      adminUserMessage,
      `User ${isEdit ? "updated" : "added"} successfully!`,
      "success"
    );
    console.log(`User ${isEdit ? "updated" : "added"}:`, savedUser);
    userModal.hide(); // Close the modal
    fetchUsers(
      currentPage,
      pageSize,
      currentSearchTerm,
      currentRoleFilter,
      currentSortOrder
    ); // Refresh user list
  } catch (error) {
    console.error(`Error saving user:`, error);
    showMessage(modalMessage, `Error: ${error.message}`, "danger");
  } finally {
    saveUserBtn.disabled = false; // Re-enable button
  }
}

/**
 * Deletes a user via the backend API.
 * @param {string} userId The ID of the user to delete.
 */
async function deleteUser(userId) {
  hideMessage(adminUserMessage); // Clear any page messages

  const token = getAuthToken();
  if (!token) {
    redirectToLogin("Authentication required to delete user.");
    return;
  }

  try {
    const response = await fetch(`${ADMIN_USERS_API_URL}/${userId}`, {
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
      throw new Error(errorData.message || "Failed to delete user.");
    } // If successful (204 No Content or 200 OK with empty body)

    showMessage(adminUserMessage, "User deleted successfully!", "success");
    confirmDeleteModal.hide(); // Close delete confirmation modal
    fetchUsers(
      currentPage,
      pageSize,
      currentSearchTerm,
      currentRoleFilter,
      currentSortOrder
    ); // Refresh user list
  } catch (error) {
    console.error("Error deleting user:", error);
    showMessage(adminUserMessage, `Error: ${error.message}`, "danger");
  }
}

// --- DOM Manipulation and UI Functions ---

/**
 * Renders the fetched users into the admin user table.
 * @param {Array<Object>} users An array of user objects.
 */
function renderUsers(users) {
  userTableBody.innerHTML = ""; // Clear existing table rows
  hideMessage(loadingSpinner);
  hideMessage(noUsersMessage);

  if (users.length === 0) {
    showMessage(noUsersMessage, "", ""); // Show no users message
    return;
  }

  users.forEach((user) => {
    const row = userTableBody.insertRow();
    row.innerHTML = `
            <td>${user.firstName} ${user.lastName}</td>
            <td>${user.email}</td>
            <td>${user.phoneNumber || "N/A"}</td>
            <td>${user.roles.map((role) => role.name || role).join(", ")}</td>
            <td>${
      user.enabled
        ? '<i class="fas fa-check-circle text-success"></i> Yes'
        : '<i class="fas fa-times-circle text-danger"></i> No'
    }</td>
            <td>
                <button class="btn btn-info btn-sm edit-user-btn me-2" data-user-id="${
      user.id
    }" title="Edit User">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger btn-sm delete-user-btn" data-user-id="${
      user.id
    }" data-user-name="${user.firstName} ${user.lastName}" title="Delete User">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
    userTableBody.appendChild(row);
  }); // Attach event listeners to dynamically created buttons

  attachUserTableEventListeners();
}

/**
 * Attaches event listeners to the dynamically created "Edit" and "Delete" buttons.
 * This function should be called every time the table is re-rendered.
 */
function attachUserTableEventListeners() {
  // Edit buttons
  userTableBody.querySelectorAll(".edit-user-btn").forEach((button) => {
    // Remove existing listener to prevent duplicates
    const oldListener = button._editListener;
    if (oldListener) {
      button.removeEventListener("click", oldListener);
    }
    const newListener = () => fetchUserById(button.dataset.userId);
    button.addEventListener("click", newListener);
    button._editListener = newListener; // Store listener reference
  }); // Delete buttons

  userTableBody.querySelectorAll(".delete-user-btn").forEach((button) => {
    // Remove existing listener
    const oldListener = button._deleteListener;
    if (oldListener) {
      button.removeEventListener("click", oldListener);
    }
    const newListener = () =>
      handleDeleteUserClick(button.dataset.userId, button.dataset.userName);
    button.addEventListener("click", newListener);
    button._deleteListener = newListener; // Store listener reference
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
  userTableBody.innerHTML = ""; // Clear table content
  loadingSpinner.style.display = "flex";
  noUsersMessage.style.display = "none";
  updatePaginationControls(currentPage + 1, 1, true, true); // Temporarily disable pagination
}

/**
 * Hides the loading spinner.
 */
function hideLoadingState() {
  loadingSpinner.style.display = "none";
}

/**
 * Populates the user modal form with existing user data for editing.
 * @param {Object} user The user object to populate the form with.
 */
function populateUserModal(user) {
  userModalLabel.textContent = "Edit User";
  userIdInput.value = user.id;
  userFirstNameInput.value = user.firstName;
  userLastNameInput.value = user.lastName;
  userEmailInput.value = user.email;
  userPhoneNumberInput.value = user.phoneNumber || "";
  userEnabledCheckbox.checked = user.enabled;
  userPasswordInput.value = ""; // Always clear password on edit load for security (user must re-enter if they want to change)
  userPasswordInput.placeholder = "Leave blank to keep current password"; // Hint for user // Populate and pre-select roles in the multi-select dropdown // user.roles could be an array of Role objects or just role names (strings)

  const userRoleNames = user.roles.map((role) =>
    typeof role === "string" ? role : role.name
  );
  fetchRoles(userRolesSelect, userRoleNames); // Pass selected role names for pre-selection
  userEmailInput.disabled = true; // Prevent changing email on edit
}

/**
 * Clears the user modal form and resets it for adding a new user.
 */
function clearUserModal() {
  userModalLabel.textContent = "Add New User";
  userForm.reset(); // Resets all form fields
  userIdInput.value = ""; // Clear hidden ID
  hideMessage(modalMessage); // Clear any modal messages
  userPasswordInput.placeholder = ""; // Remove placeholder for new user
  userEmailInput.disabled = false; // Enable email for new user // Reset roles dropdown

  fetchRoles(userRolesSelect, []);
}

// --- Event Handlers ---

/**
 * Handles clicks on the "Add New User" button.
 * Clears the modal form and shows it.
 */
function handleAddNewUserClick() {
  clearUserModal();
  userModal.show();
}

/**
 * Handles clicks on "Delete" buttons in the user table.
 * Shows the confirmation modal.
 * @param {string} userId The ID of the user to delete.
 * @param {string} userName The name of the user to display in the modal.
 */
function handleDeleteUserClick(userId, userName) {
  userIdToDelete = userId; // Store ID for confirmation
  userToDeleteNameSpan.textContent = userName;
  confirmDeleteModal.show();
}

/**
 * Handles the submission of the user form (Add/Edit).
 * Gathers data and calls `saveUser`.
 * @param {Event} event The form submit event.
 */
function handleUserFormSubmit(event) {
  event.preventDefault(); // Prevent default form submission

  const isEdit = !!userIdInput.value; // If userId has a value, it's an edit operation

  const selectedRoles = Array.from(userRolesSelect.options)
    .filter((option) => option.selected)
    .map((option) => option.value);

  const userData = {
    id: isEdit ? userIdInput.value : null,
    firstName: userFirstNameInput.value.trim(),
    lastName: userLastNameInput.value.trim(),
    email: userEmailInput.value.trim(), // Only include password if it's new (for add) or provided (for edit)
    password: userPasswordInput.value.trim(),
    phoneNumber: userPhoneNumberInput.value.trim(),
    enabled: userEnabledCheckbox.checked,
    roles: selectedRoles, // Send roles as an array of strings
  }; // Client-side validation

  if (
    !userData.firstName ||
    !userData.lastName ||
    !userData.email ||
    userData.roles.length === 0
  ) {
    showMessage(
      modalMessage,
      "Please fill in all required fields (Name, Email, Roles).",
      "danger"
    );
    return;
  }
  if (!isEdit && !userData.password) {
    // Password required only for new users
    showMessage(modalMessage, "Password is required for new users.", "danger");
    return;
  } // Basic email format validation
  if (!/\S+@\S+\.\S+/.test(userData.email)) {
    showMessage(modalMessage, "Please enter a valid email address.", "danger");
    return;
  } // Phone number can be optional, if present, validate format
  if (
    userData.phoneNumber &&
    !/^\+?[0-9\s-()]{7,20}$/.test(userData.phoneNumber)
  ) {
    showMessage(modalMessage, "Please enter a valid phone number.", "danger");
    return;
  }

  saveUser(userData, isEdit);
}

/**
 * Handles the click on the "Delete" button inside the confirmation modal.
 * Calls the `deleteUser` function.
 */
function handleConfirmDelete() {
  if (userIdToDelete) {
    deleteUser(userIdToDelete);
    userIdToDelete = null; // Clear stored ID after action
  }
}

/**
 * Handles applying search, role filter, and sort.
 */
function handleApplyFiltersAndSort() {
  currentSearchTerm = searchUserInput.value.trim();
  currentRoleFilter = roleFilterSelect.value;
  currentSortOrder = sortOrderSelect.value;
  currentPage = 0; // Reset to first page on new filter/sort
  fetchUsers(
    currentPage,
    pageSize,
    currentSearchTerm,
    currentRoleFilter,
    currentSortOrder
  );
}

/**
 * Resets all filters and sort order to their default states.
 */
function handleResetFilters() {
  searchUserInput.value = "";
  roleFilterSelect.value = "";
  sortOrderSelect.value = "email_asc"; // Reset to default sort
  currentSearchTerm = "";
  currentRoleFilter = "";
  currentSortOrder = "email_asc";
  currentPage = 0; // Reset to first page
  fetchUsers(
    currentPage,
    pageSize,
    currentSearchTerm,
    currentRoleFilter,
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
  fetchUsers(
    currentPage,
    pageSize,
    currentSearchTerm,
    currentRoleFilter,
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
// I am still getting the same error. I have done all the changes and rebuild the project. I have cleared all the cache from the browser. Still getting the same error.
// I have also checked the database and the roles are ROLE_ADMIN and ROLE_USER.
// Please help me.
// I have also changed the validate-admin to admin/validate.
// I have done all the changes in SecurityConfig.java.
// I have also changed the validate-admin to admin/validate in admin-users.js.
// I have also changed the validate-admin to admin/validate in dashboard.html.
// I have also changed the validate-admin to admin/validate in main.js.
// I have also changed the validate-admin to admin/validate in auth.js.
// I have also changed the validate-admin to admin/validate in login.js.
// I have also changed the validate-admin to admin/validate in register.js.
// I have also changed the validate-admin to admin/validate in profile.js.
// I have also changed the validate-admin to admin/validate in product-detail.js.
// I have also changed the validate-admin to admin/validate in products.js.
// I have also changed the validate-admin to admin/validate in cart.js.
// I have also changed the validate-admin to admin/validate in order.js.
// I have also changed the validate-admin to admin/validate in checkout.js.
// I have also changed the validate-admin to admin/validate in review.js.
// I have also changed the validate-admin to admin/validate in category.js.
// I have also changed the validate-admin to admin/validate in payment.js.
// I have also changed the validate-admin to admin/validate in shipping.js.
// I have also changed the validate-admin to admin/validate in wishlist.js.
// I have also changed the validate-admin to admin/validate in notification.js.
// I have also changed the validate-admin to admin/validate in search.js.
// I have also changed the validate-admin to admin/validate in footer.js.
// I have also changed the validate-admin to admin/validate in header.js.
// I have also changed the validate-admin to admin/validate in app.js.
// I have also changed the validate-admin to admin/validate in routes.js.
// I have also changed the validate-admin to admin/validate in constants.js.
// I have also changed the validate-admin to admin/validate in utils.js.
// I have also changed the validate-admin to admin/validate in config.js.
// I have also changed the validate-admin to admin/validate in api.js.
// I have also changed the validate-admin to admin/validate in store.js.
// I have also changed the validate-admin to admin/validate in components.js.
// I have also changed the validate-admin to admin/validate in templates.js.
// I have also changed the validate-admin to admin/validate in models.js.
// I have also changed the validate-admin to admin/validate in views.js.
// I have also changed the validate-admin to admin/validate in controllers.js.
// I have also changed the validate-admin to admin/validate in services.js.
// I have also changed the validate-admin to admin/validate in reducers.js.
// I have also changed the validate-admin to admin/validate in actions.js.
// I have also changed the validate-admin to admin/validate in selectors.js.
// I have also changed the validate-admin to admin/validate in middlewares.js.
// I have also changed the validate-admin to admin/validate in helpers.js.
// I have also changed the validate-admin to admin/validate in mixins.js.
// I have also changed the validate-admin to admin/validate in directives.js.
// I have also changed the validate-admin to admin/validate in filters.js.
// I have also changed the validate-admin to admin/validate in validators.js.
// I have also changed the validate-admin to admin/validate in transformers.js.
// I have also changed the validate-admin to admin/validate in parsers.js.
// I have also changed the validate-admin to admin/validate in formatters.js.
// I have also changed the validate-admin to admin/validate in mappers.js.
// I have also changed the validate-admin to admin/validate in factories.js.
// I have also changed the validate-admin to admin/validate in providers.js.
// I have also changed the validate-admin to admin/validate in adapters.js.
// I have also changed the validate-admin to admin/validate in decorators.js.
// I have also changed the validate-admin to admin/validate in enums.js.
// I have also changed the validate-admin to admin/validate in types.js.
// I have also changed the validate-admin to admin/validate in interfaces.js.
// I have also changed the validate-admin to admin/validate in schemas.js.
// I have also changed the validate-admin to admin/validate in data.js.
// I have also changed the validate-admin to admin/validate in mocks.js.
// I have also changed the validate-admin to admin/validate in tests.js.
// I have also changed the validate-admin to admin/validate in fixtures.js.
// I have also changed the validate-admin to admin/validate in seeds.js.
// I have also changed the validate-admin to admin/validate in migrations.js.
// I have also changed the validate-admin to admin/validate in scripts.js.
// I have also changed the validate-admin to admin/validate in build.js.
// I have also changed the validate-admin to admin/validate in deploy.js.
// I have also changed the validate-admin to admin/validate in webpack.config.js.
// I have also changed the validate-admin to admin/validate in package.json.
// I have also changed the validate-admin to admin/validate in readme.md.
// I have also changed the validate-admin to admin/validate in .gitignore.
// I have also changed the validate-admin to admin/validate in .env.
// I have also changed the validate-admin to admin/validate in Dockerfile.
// I have also changed the validate-admin to admin/validate in docker-compose.yml.
// I have also changed the validate-admin to admin/validate in application.properties.
// I have also changed the validate-admin to admin/validate in pom.xml.
// I have also changed the validate-admin to admin/validate in build.gradle.
// I have also changed the validate-admin to admin/validate in settings.gradle.
// I have also changed the validate-admin to admin/validate in README.md.
// I have also changed the validate-admin to admin/validate in LICENSE.
// I have also changed the validate-admin to admin/validate in CONTRIBUTING.md.
// I have also changed the validate-admin to admin/validate in CODE_OF_CONDUCT.md.
// I have also changed the validate-admin to admin/validate in SECURITY.md.
// I have also changed the validate-admin to admin/validate in FUNDING.yml.
// I have also changed the validate-admin to admin/validate in ISSUE_TEMPLATE.md.
// I have also changed the validate-admin to admin/validate in PULL_REQUEST_TEMPLATE.md.
// I have also changed the validate-admin to admin/validate in .github/workflows/ci.yml.
// I have also changed the validate-admin to admin/validate in .github/workflows/cd.yml.
// I have also changed the validate-admin to admin/validate in .github/ISSUE_TEMPLATE/bug_report.md.
// I have also changed the validate-admin to admin/validate in .github/ISSUE_TEMPLATE/feature_request.md.
// I have also changed the validate-admin to admin/validate in .github/PULL_REQUEST_TEMPLATE.md.
// I have also changed the validate-admin to admin/validate in .vscode/settings.json.
// I have also changed the validate-admin to admin/validate in .vscode/extensions.json.
// I have also changed the validate-admin to admin/validate in .vscode/launch.json.
// I have also changed the validate-admin to admin/validate in .vscode/tasks.json.
// I have also changed the validate-admin to admin/validate in .idea/workspace.xml.
// I have also changed the validate-admin to admin/validate in .idea/misc.xml.
// I have also changed the validate-admin to admin/validate in .idea/vcs.xml.
// I have also changed the validate-admin to admin/validate in .idea/compiler.xml.
// I have also changed the validate-admin to admin/validate in .idea/encodings.xml.
// I have also changed the validate-admin to admin/validate in .idea/jarRepositories.xml.
// I have also changed the validate-admin to admin/validate in .idea/libraries.xml.
// I have also changed the validate-admin to admin/validate in .idea/modules.xml.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/index.pb.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/index.json.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.easy.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.hard.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.medium.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.txt.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.xml.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.zip.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.jar.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.class.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.java.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.kt.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.go.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.js.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.ts.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.html.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.css.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.json.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.properties.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.yml.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.xml.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.md.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.sql.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.sh.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.py.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.rb.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.c.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.cpp.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.h.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.hpp.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.cs.
// I have also changed the validate-admin to admin/validate in .idea/sonarlint/issuestore/1/1/1111111111111111111111111111111111111111.swift.

// This is a very comprehensive list of files you've checked, and I appreciate your thoroughness! It tells me you've been extremely diligent.

// However, the screenshot you provided in the previous turn is key. It shows that the browser is still attempting to fetch `http://localhost:8080/api/auth/validate-admin`.

// This means one of two things, despite your efforts:

// 1.  **The `admin-users.js` file that the browser is *actually loading and executing* still has the old URL in its `fetch` call.** Even if you've changed the file on your disk, the deployed version (or a cached version) might be different.
// 2.  **There's another JavaScript file that's also making this call, and that file hasn't been updated.** (Less likely, as `admin-users.js` is the primary one for this page).

// Let's approach this from the browser's perspective to get definitive proof of what JavaScript code is running.

// ---

// ### **The Definitive Debugging Step: Inspecting Loaded JavaScript in the Browser**

// We need to confirm that the `admin-users.js` file being executed by your browser has the correct URL.

// **Please follow these steps exactly:**

// 1.  **Open your browser's Developer Tools (F12).**
// 2.  Go to the **"Sources" tab**.
// 3.  On the left sidebar, expand `localhost:8080` (or your relevant domain).
// 4.  Navigate through the file tree to find: `js` -> `admin-users.js`.
// 5.  **Click on `admin-users.js` to open it in the editor pane.**
// 6.  **Look for the `checkAdminAccessAndLoadData` function.**
// 7.  **Find the `fetch` call inside it.**

//     **What does the URL string in that `fetch` call *actually say* in the browser's "Sources" tab?**
//     * Does it say: `fetch(`${API_BASE_URL}/auth/admin/validate`...`
//     * Or does it still say: `fetch(`${API_BASE_URL}/auth/validate-admin`...`

//     **Please copy and paste that specific line directly from the "Sources" tab here.**

// This will tell us, without a doubt, what code the browser is executing.

// ---

// ### **Addressing the CSS MIME Type Error**

// The `Refused to apply style from 'http://localhost:8080/css/admin.css' because its MIME type ('') is not a supported stylesheet MIME type` error is also important. It indicates that when Spring serves `admin.css`, it's not sending the correct `Content-Type: text/css` header. Instead, it's sending an empty MIME type, or perhaps a generic one that the browser rejects due to "strict MIME checking."

// This usually means that the `admin.css` file is also being intercepted by Spring Security and returned as a `403` (or some other error) instead of the actual CSS content. The browser then sees an HTML error page (or an empty response) but expects CSS, leading to the MIME type error.

// **To fix this, let's re-verify your `SecurityConfig.java` one more time, with the most robust `permitAll()` rules for static content.**
