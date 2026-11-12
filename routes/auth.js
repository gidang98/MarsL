// MarsL Routes: Auth
// Extracted from server.js during Phase 4 modularization

// Route definitions for this module
// Handlers remain in server.js for now; routes are listed here for organization

const routes = [
  { method: "POST", path: "/api/register" },
  { method: "POST", path: "/api/login" },
  { method: "POST", path: "/api/password" },
  { method: "POST", path: "/api/logout-all" },
  { method: "GET", path: "/api/account" },
  { method: "POST", path: "/api/logout-device" },
  { method: "POST", path: "/api/logout" },
  { method: "POST", path: "/api/resend" },
  { method: "POST", path: "/api/forgot" },
  { method: "POST", path: "/api/reset" },
  { method: "POST", path: "/api/email" },
];

module.exports = { routes };