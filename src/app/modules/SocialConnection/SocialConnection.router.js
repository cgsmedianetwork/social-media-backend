const express = require("express");
const SocialConnectionController = require("./SocialConnection.controller");

const router = express.Router();

router.get("/youtube/connect", SocialConnectionController.youtubeConnect);
router.get("/youtube/callback", SocialConnectionController.youtubeCallback);
router.get(
  "/youtube/insights",
  SocialConnectionController.fetchYoutubeInsights
);

const SocialConnectionRouter = router;
module.exports = SocialConnectionRouter;
