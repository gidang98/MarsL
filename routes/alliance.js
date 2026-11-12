// MarsL Routes: Alliance
// Extracted from server.js during Phase 4 modularization

// Route definitions for this module
// Handlers remain in server.js for now; routes are listed here for organization

const routes = [
  { method: "GET", path: "/api/alliance" },
  { method: "POST", path: "/api/alliance/create" },
  { method: "POST", path: "/api/alliance/invite" },
  { method: "POST", path: "/api/alliance/cancel-invite" },
  { method: "POST", path: "/api/alliance/answer" },
  { method: "POST", path: "/api/alliance/leave" },
  { method: "POST", path: "/api/alliance/kick" },
  { method: "POST", path: "/api/alliance/lead" },
  { method: "POST", path: "/api/alliance/post" },
  { method: "POST", path: "/api/alliance/about" },
  { method: "POST", path: "/api/alliance/bank/deposit" },
  { method: "POST", path: "/api/alliance/bank/give" },
  { method: "POST", path: "/api/alliance/project" },
  { method: "POST", path: "/api/alliance/plan" },
  { method: "POST", path: "/api/alliance/diplo" },
  { method: "POST", path: "/api/alliance/role" },
  { method: "GET", path: "/api/alliance/shared" },
  { method: "POST", path: "/api/alliance/shared/remove" },
  { method: "POST", path: "/api/alliance/ask-join" },
  { method: "POST", path: "/api/alliance/recruit" },
];

module.exports = { routes };