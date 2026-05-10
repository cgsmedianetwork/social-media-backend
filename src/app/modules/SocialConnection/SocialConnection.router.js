const express = require("express");
const SocialConnectionController = require("./SocialConnection.controller");
const authVerification = require("../../../Middleware/authVarification");

const router = express.Router();

router.get(
  "/list-of-accounts",
  authVerification,
  SocialConnectionController.listOfAccounts,
);

// Youtube connection routes
router.post(
  "/youtube/connect",
  authVerification,
  SocialConnectionController.youtubeConnect,
);

router.get("/youtube/callback", SocialConnectionController.youtubeCallback);

router.get(
  "/youtube/insights",
  authVerification,
  SocialConnectionController.fetchYoutubeInsights,
);

// facebook connection routes
router.post(
  "/facebook/connect",
  authVerification,
  SocialConnectionController.facebookConnect,
);

router.get("/facebook/callback", SocialConnectionController.facebookCallback);
router.get(
  "/facebook/insights",
  authVerification,
  SocialConnectionController.fetchFacebookInsights,
);

// instagram connection routes
router.post(
  "/instagram/connect",
  authVerification,
  SocialConnectionController.instagramConnect,
);
router.get("/instagram/callback", SocialConnectionController.instagramCallback);

// tiktok connection routes
router.post(
  "/tiktok/connect",
  authVerification,
  SocialConnectionController.tiktokConnect,
);
router.get("/tiktok/callback", SocialConnectionController.tiktokCallback);

// common routes
router.get(
  "/reach-like-comment-last-two-months-data",
  authVerification,
  SocialConnectionController.fetchReachLikeCommentLastTwoMonthsData,
);

router.get(
  "/last-12-months-chart-data",
  authVerification,
  SocialConnectionController.fetchLast12MonthsChartData,
);

router.get(
  "/followers-per-account",
  authVerification,
  SocialConnectionController.fetchFollowersLast12Months,
);

router.get(
  "/total-followers-by-account",
  authVerification,
  SocialConnectionController.fetchTotalFollowersByAccount,
);

router.delete(
  "/disconnect-account/:provider/:providerId",
  authVerification,
  SocialConnectionController.disconnectAccount,
);

const SocialConnectionRouter = router;
module.exports = SocialConnectionRouter;
