const { default: mongoose } = require("mongoose");

const config = require("./src/config/config");
const app = require("./index");
const startAnalyticsCron = require("./src/jobs/AnalyticsCron");

// Vercel runs this file as a serverless function. It sets the VERCEL variable.
const isServerless = Boolean(process.env.VERCEL);

// Hold one connection promise, so a warm function reuses the open connection.
let connection = null;
const connectDatabase = () => {
  if (!connection) {
    connection = mongoose
      .connect(config.database_url, { serverSelectionTimeoutMS: 20000 })
      .catch((error) => {
        // Drop the failed promise, so the next request tries again.
        connection = null;
        throw error;
      });
  }
  return connection;
};

async function main() {
  try {
    await connectDatabase();
    console.log("Database connected Successfully!!");

    startAnalyticsCron();

    const server = app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });

    const exitHandler = () => {
      if (server) {
        server.close(() => {
          console.log("Server closed");
        });
      }
      throw new Error("Application exited with an error"); // Throw an error instead
    };

    const unexpectedErrorHandler = (error) => {
      console.log(error);
      exitHandler();
    };

    process.on("uncaughtException", unexpectedErrorHandler);
    process.on("unhandledRejection", unexpectedErrorHandler);

    process.on("SIGTERM", () => {
      console.log("SIGTERM received");
      if (server) {
        server.close();
      }
    });
  } catch (error) {
    console.log(`Database connected Failed!! the issue is ${error}`);
  }
}

if (isServerless) {
  // Open the connection as the function starts, to shorten the first request.
  connectDatabase().catch((error) => {
    console.log(`Database connected Failed!! the issue is ${error}`);
  });
} else {
  main();
}

// Vercel calls this handler for every request. Wait for the database first,
// because a query that starts too early sits in a queue and times out.
const handler = async (req, res) => {
  try {
    await connectDatabase();
  } catch (error) {
    console.log(`Database connected Failed!! the issue is ${error}`);
    return res.status(503).json({
      success: false,
      message: "The database is unavailable. Please try again.",
    });
  }
  return app(req, res);
};

module.exports = isServerless ? handler : app;
