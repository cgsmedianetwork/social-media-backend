const { default: mongoose } = require("mongoose");

const pendingUserSchema = new mongoose.Schema(
  {
    email: { type: String, trim: true },
    phone: { type: String, required: true },
    passwordHash: { type: String, required: true },
    terms: { type: Boolean, default: false },
    sessionId: { type: String, required: true },
  },
  { timestamps: true },
);

const PendingUserModel = mongoose.model("PendingUser", pendingUserSchema);

module.exports = PendingUserModel;
