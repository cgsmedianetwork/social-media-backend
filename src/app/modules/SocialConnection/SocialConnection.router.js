const express = require("express");
const SocialConnectionController = require("./SocialConnection.controller");
const authVerification = require("../../../Middleware/authVarification");

const router = express.Router();

// Youtube connection routes
router.get(
  "/youtube/connect",
  authVerification,
  SocialConnectionController.youtubeConnect
);
router.get("/youtube/callback", SocialConnectionController.youtubeCallback);
router.get(
  "/youtube/insights",
  authVerification,
  SocialConnectionController.fetchYoutubeInsights
);

// facebook connection routes
router.get(
  "/facebook/connect",
  authVerification,
  SocialConnectionController.facebookConnect
);

const SocialConnectionRouter = router;
module.exports = SocialConnectionRouter;
