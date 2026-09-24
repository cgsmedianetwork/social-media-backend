const config = require("../config/config");

// ORIGIN holds one domain, or several domains separated by commas.
const originsFromEnv = (config.origin || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const allowedOrigins = [
  ...originsFromEnv,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:3000",
  "http://localhost:3001",
];

module.exports = allowedOrigins;
