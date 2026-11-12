// MarsL Routes: Static
// Extracted from server.js during Phase 4 modularization

// Route definitions for this module
// Handlers remain in server.js for now; routes are listed here for organization

const routes = [
  { method: "GET", path: "/fonts.css" },
  { method: "GET", path: "/server" },
  { method: "GET", path: "/legal" },
  { method: "GET", path: "/patch-notes" },
  { method: "GET", path: "/admin" },
  { method: "GET", path: "/" },
];

module.exports = { routes };