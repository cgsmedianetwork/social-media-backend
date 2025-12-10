const catchAsyncError = require("../../../ErrorHandler/catchAsyncError");
const sendResponse = require("../../../shared/sendResponse");
const oauth2Client = require("../../../Helper/oath2Client");
const ErrorHandler = require("../../../ErrorHandler/errorHandler");
const UserModel = require("../user/user.model");
const SocialConnectionServices = require("./SocialConnection.services");
const { google } = require("googleapis");
const httpStatus = require("http-status");
const facebookClient = require("../../../Helper/facebookClient");
const config = require("../../../config/config");

const youtubeConnect = catchAsyncError(async (req, res, next) => {
  const scopes = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
    "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
    state: req.userId,
  });
  // console.log(url);
  // res.redirect(url);
  res.json({ url });
});

const youtubeCallback = catchAsyncError(async (req, res, next) => {
  // console.log("youtubeCallback");
  const code = req.query.code;
  const userId = req.query.state;
  console.log("code", code);
  if (!code) {
    throw new ErrorHandler("Code is required", httpStatus.BAD_REQUEST);
  }
  const { tokens } = await oauth2Client.getToken(code);
  console.log("tokens", tokens);
  const user = await UserModel.findById(userId);
  user.socialAccounts = user.socialAccounts.filter(
    (s) => s.provider !== "youtube"
  );
  // creating account object
  const account = {
    provider: "youtube",
    providerId: null,
    accessToken: tokens?.access_token,
    refreshToken:
      tokens?.refresh_token ||
      user.socialAccounts.find((s) => s.provider === "youtube")?.refreshToken,
    expiresAt: tokens?.expiry_date ? new Date(tokens.expiry_date) : null,
    linked: true,
    scope: tokens?.scope?.split(" "),
    tokenType: tokens?.token_type,
  };

  // setting oauth2Client credentials
  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.expiresAt?.getTime(),
  });

  // fetching youtube channel id
  const youtube = google.youtube({ version: "v3", auth: oauth2Client });
  const response = await youtube.channels.list({ mine: true, part: "id" });
  if (!response.data.items || response.data.items.length === 0) {
    throw new ErrorHandler(
      "No YouTube channel found for this account. Please create a channel first.",
      httpStatus.BAD_REQUEST
    );
  }
  account.providerId = response.data.items[0].id;

  console.log("account", account);

  user.socialAccounts.push(account);
  await user.save();

  // redirecting to dashboard
  res.redirect(`http://localhost:3000/dashboard`);
});

const fetchYoutubeInsights = catchAsyncError(async (req, res, next) => {
  // const user = req.user;
  const id = req.userId;
  const insights = await SocialConnectionServices.fetchYoutubeInsights(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Youtube insights fetched successfully!",
    data: insights,
  });
});

const facebookConnect = catchAsyncError(async (req, res, next) => {
  const url = facebookClient.authUrl(req.userId);
  res.json({ url });
});

const facebookCallback = catchAsyncError(async (req, res, next) => {
  const code = req.query.code;
  const userId = req.query.state;
  if (!code || !userId) {
    throw new ErrorHandler(
      "Code and userId are required",
      httpStatus.BAD_REQUEST
    );
  }
  // short lived token
  const short = await facebookClient.exchangeCodeForShortToken(code);
  // long lived token
  const longUser = await facebookClient.exchangeForLongLivedUserToken(
    short.access_token
  );
  // get pages + page tokens
  const pages = await facebookClient.getPages(longUser.access_token);
  if (!pages.data.length) {
    throw new ErrorHandler("No Facebook pages found!", httpStatus.NOT_FOUND);
  }
  // Pick the first page
  const page = pages.data[0];

  // store account
  const user = await UserModel.findById(userId);
  user.socialAccounts = user.socialAccounts.filter(
    (s) => s.provider !== "facebook"
  );
  user.socialAccounts.push({
    provider: "facebook",
    providerId: page.id,
    accessToken: page.access_token,
    expiresAt: longUser.expires_in
      ? new Date(Date.now() + longUser.expires_in * 1000)
      : null,
    scope: ["pages_show_list", "pages_read_engagement", "read_insights"],
    linked: true,
    meta: { pageName: page.name, category: page.category },
  });
  await user.save();

  // redirect to dashboard
  res.redirect(`${config.origin}/profile`);
});

const SocialConnectionController = {
  youtubeConnect,
  youtubeCallback,
  fetchYoutubeInsights,
  facebookConnect,
};
module.exports = SocialConnectionController;
