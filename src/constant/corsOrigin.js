const config = require("../config/config");

const allowedOrigins = [
  config.origin,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:3000",
  "http://localhost:3001",
];

module.exports = allowedOrigins;
