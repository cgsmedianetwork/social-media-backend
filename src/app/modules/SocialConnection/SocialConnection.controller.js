
const catchAsyncError = require("../../../ErrorHandler/catchAsyncError");
const sendResponse = require("../../../shared/sendResponse");
const oauth2Client = require("../../../Helper/oath2Client");
const ErrorHandler = require("../../../ErrorHandler/errorHandler");
const UserModel = require("../user/user.model");
const SocialConnectionServices = require("./SocialConnection.services");
const { google } = require("googleapis");
const httpStatus = require("http-status");

const youtubeConnect = catchAsyncError(async (req, res, next) => {
  const scopes = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
    state: req.id,
  });
  // console.log(url);
  // res.redirect(url);
  res.json({ url });
});

const youtubeCallback = catchAsyncError(async (req, res, next) => {
  // console.log("youtubeCallback");
  const code = req.query.code;
  console.log("code", code);
  if (!code) {
    throw new ErrorHandler("Code is required", httpStatus.BAD_REQUEST);
  }
  const { tokens } = await oauth2Client.getToken(code);
  console.log("tokens", tokens);
  const user = await UserModel.findById(req.id);
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
  res.redirect(`/dashboard`);
});

const fetchYoutubeInsights = catchAsyncError(async (req, res, next) => {
  // const user = req.user;
  const id = req.id;
  const insights = await SocialConnectionServices.fetchYoutubeInsights(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Youtube insights fetched successfully!",
    data: insights,
  });
});

const SocialConnectionController = {
  youtubeConnect,
  youtubeCallback,
  fetchYoutubeInsights,
};
module.exports = SocialConnectionController;
