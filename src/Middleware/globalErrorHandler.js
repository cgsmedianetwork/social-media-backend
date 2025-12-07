/* eslint-disable no-unused-vars */
/* eslint-disable no-unused-expressions */

const { default: mongoose } = require("mongoose");
const ErrorHandler = require("../ErrorHandler/errorHandler");
const handleCastError = require("../ErrorHandler/handleCastError");
const handleValidationError = require("../ErrorHandler/handleValidationError");

const { errorLogger } = require("../shared/logger");
const config = require("../config/config");

const globalErrorHandler = (error, req, res, next) => {
  if (config.env === "development") {
    console.log("🐱‍🏍 globalErrorHandler ~~", { error });
  } else {
    errorLogger.error("🐱‍🏍 globalErrorHandler ~~", error);
  }

  let statusCode = 500;
  let message = "Something went wrong!";
  let errorMessages = [];

  if (error && error.name === "ValidationError") {
    const simplifiedError = handleValidationError(error);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
    errorMessages = simplifiedError.errorMessages;
  } else if (res.headersSent) {
    message = error
      ? error.message
      : "Error! Headers already sent to the client";
    errorMessages =
      error && error.message ? [{ path: "", message: error.message }] : [];
  } else if (error && error.name === "JsonWebTokenError") {
    const message = "Json Web Token is invalid, Try again ";
    errorMessages = error.message ? [{ path: "", message }] : [];
  } else if (error && error.name === "TokenExpiredError") {
    const message = "Json Web Token is Expired, Try again ";
    errorMessages = error.message ? [{ path: "", message }] : [];
  } else if (error && error.code === 11000) {
    const message = `Duplicate ${Object.keys(error.keyValue)} Entered`;
    errorMessages = error.message ? [{ path: "", message }] : [];
  } else if (error && error.name === "CastError") {
    const simplifiedError = handleCastError(error);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
    errorMessages = simplifiedError.errorMessages;
  } else if (error instanceof ErrorHandler) {
    statusCode = error.statusCode;
    message = error.message;
    errorMessages = error.message ? [{ path: "", message: error.message }] : [];
  } else if (error instanceof Error) {
    message = error.message;
    errorMessages = error.message ? [{ path: "", message: error.message }] : [];
  } else if (error instanceof mongoose.Error) {
    message = error.message;
    errorMessages = error.message ? [{ path: "", message: error.message }] : [];
  } else if (error && error.name === "Application exited with an error") {
    message = error.message;
    errorMessages = error.message ? [{ path: "", message: error.message }] : [];
  }

  res.status(statusCode).json({
    success: false,
    message,
    errorMessages,
    stack: config.env !== "production" ? error.stack : undefined,
  });
};

module.exports = globalErrorHandler;
