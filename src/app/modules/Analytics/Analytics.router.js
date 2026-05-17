const express = require("express");
const authVerification = require("../../../Middleware/authVarification");
const analyticsController = require("./Analytics.controller");

const router = express.Router();

router.get(
  "/accounts",
  authVerification,
  //   authorizeRoles("admin", "subAdmin"),
  analyticsController.getAccountAnalytics,
);

router.post(
  "/accounts/refresh",
  authVerification,
  //   authorizeRoles("admin", "subAdmin"),
  analyticsController.refreshAccountAnalytics,
);

const analyticsRouter = router;

module.exports = analyticsRouter;
