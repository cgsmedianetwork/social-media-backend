const mongoose = require("mongoose");

const socialAccountSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["youtube", "facebook", "instagram", "tiktok"],
    },
    providerId: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String },
    expiresAt: { type: Date }, 
    scope: { type: [String] },
    tokenType: { type: String },
    title: { type: String },
    image: { type: String },
    linked: { type: Boolean, default: false },
    meta: { type: mongoose.Schema.Types.Mixed }, // any platform-specific data
  },
);
const userModelSchema = mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      // length: [11, "Phone number must be 11 digits"],
      trim: true,
    },
    image: {
      type: String,
    },
    title: {
      type: String,
    },
    location: {
      type: String,
    },
    phoneVerify: {
      type: Boolean,
      default: false,
    },
    emailVerify: {
      type: Boolean,
      default: false,
    },
    userStatus: {
      type: String,
      enum: ["Active", "Block", "Restricted"],
      default: "Active",
    },
    badge: {
      type: String,
      // enum: ["bronze", "silver", "gold", "diamond"],
      // default: null,
    },
    role: {
      type: String,
      enum: ["user", "subAdmin", "admin"],
      default: "user",
    },
    socialAccounts: [socialAccountSchema],
  },
  { timestamps: true, versionKey: false }
);

const UserModel = mongoose.model("User", userModelSchema);

module.exports = UserModel;
