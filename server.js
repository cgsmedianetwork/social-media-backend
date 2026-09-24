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
    connection = mongoose.connect(config.database_url);
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
  // Do not listen on a port. Vercel passes each request to the exported app.
  // Mongoose queues queries until the connection opens, so no await is needed.
  connectDatabase().catch((error) => {
    console.log(`Database connected Failed!! the issue is ${error}`);
  });
} else {
  main();
}

module.exports = app;
