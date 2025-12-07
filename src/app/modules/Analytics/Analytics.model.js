const mongoose = require("mongoose");

const analyticsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  provider: { type: String },
  data: { type: mongoose.Schema.Types.Mixed },
  fetchedAt: { type: Date, default: Date.now },
});

const AnalyticsModel = mongoose.model("Analytics", analyticsSchema);

module.exports = AnalyticsModel;
