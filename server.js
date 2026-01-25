const { default: mongoose } = require("mongoose");

const config = require("./src/config/config");
const app = require("./index");
async function main() {
  try {
    await mongoose.connect(config.database_url);
    console.log("Database connected Successfully!!");
    console.log("Database connected Successfully!!");

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
    console.log(`Database connected Failed!! the issue is ${error}`);
  }
}

main();
