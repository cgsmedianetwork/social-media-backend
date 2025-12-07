const mongoose = require("mongoose");

const resetPasswordSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    phone: {
      type: String,
      required: true,
    },
    sessionId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const ResetPasswordSession = mongoose.model(
  "ResetPasswordSession",
  resetPasswordSessionSchema
);

module.exports = ResetPasswordSession;
