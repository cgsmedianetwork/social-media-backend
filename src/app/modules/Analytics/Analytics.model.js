const mongoose = require("mongoose");

const analyticsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["youtube", "facebook", "instagram", "tiktok"],
      required: true,
    },
    providerId: { type: String, required: true },
    accountName: { type: String, default: "" },
    accountImage: { type: String, default: "" },

    periodType: {
      type: String,
      enum: ["month"],
      default: "month",
    },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    metrics: {
      totalFollowers: { type: Number, default: null },
      followersGained: { type: Number, default: null },
      reach: { type: Number, default: null },
      impressions: { type: Number, default: null },
      views: { type: Number, default: null },
      likes: { type: Number, default: null },
      comments: { type: Number, default: null },
      shares: { type: Number, default: null },
      engagement: { type: Number, default: null },
    },

    capabilities: {
      totalFollowers: { type: Boolean, default: false },
      followersGained: { type: Boolean, default: false },
      reach: { type: Boolean, default: false },
      impressions: { type: Boolean, default: false },
      engagement: { type: Boolean, default: false },
    },

    status: {
      type: String,
      enum: ["success", "partial", "failed"],
      default: "success",
    },
    errorMessage: { type: String, default: null },
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

analyticsSchema.index(
  {
    userId: 1,
    provider: 1,
    providerId: 1,
    periodType: 1,
    periodStart: 1,
  },
  { unique: true },
);

const AnalyticsModel = mongoose.model("Analytics", analyticsSchema);
module.exports = AnalyticsModel;
