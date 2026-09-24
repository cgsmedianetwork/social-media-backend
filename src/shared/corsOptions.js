const createCorsOptions = (allowedOrigins) => {
  return {
    origin: function (origin, callback) {
      if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
        callback(null, true);
      } else {
        // Print the blocked origin, so the runtime log names the domain to add.
        console.log(
          `CORS blocked origin: ${origin}. Allowed: ${allowedOrigins.join(", ")}`,
        );
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // Allow credentials (cookies)
  };
};

module.exports = createCorsOptions;
