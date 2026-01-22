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

const listOfAccounts = catchAsyncError(async (req, res, next) => {
  const id = req.userId;
  const user = await UserModel.findById(id);

  // Group accounts by provider
  const groupedAccounts = {
    facebook: [],
    youtube: [],
    instagram: [],
    tiktok: []
  };

  // const accounts = user.socialAccounts.map((account) => {
  //   return {
  //     provider: account.provider,
  //     providerId: account.providerId,
  //     title: account.title,
  //     image: account.image,
  //   };
  // });

  user.socialAccounts.forEach((account) => {
    const accountData = {
      providerId: account.providerId,
      title: account.title,
      image: account.image,
    };

    // Add to the appropriate group if it exists
    if (Object.hasOwn(groupedAccounts, account.provider)) {
      groupedAccounts[account.provider].push(accountData);
    }
  });
  // console.log("groupedAccounts", groupedAccounts);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All accounts fetched successfully!",
    data: groupedAccounts
  });
});

// youtube 
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
  // console.log("code", code);
  if (!code) {
    throw new ErrorHandler("Code is required", httpStatus.BAD_REQUEST);
  }
  const { tokens } = await oauth2Client.getToken(code);
  // console.log("tokens", tokens);
  const user = await UserModel.findById(userId);

    // setting oauth2Client credentials
  oauth2Client.setCredentials({
      access_token: tokens?.access_token,
      refresh_token: tokens?.refresh_token,
      expiry_date: tokens?.expiry_date
  });

   // Fetch YouTube channel ID first
  const youtube = google.youtube({ version: "v3", auth: oauth2Client });
  const response = await youtube.channels.list({ mine: true, part: "id,snippet" });
  
  if (!response.data.items || response.data.items.length === 0) {
    throw new ErrorHandler(
      "No YouTube channel found for this account. Please create a channel first.",
      httpStatus.BAD_REQUEST
    );
  }

  const channelId = response.data.items[0].id;
  const channelTitle = response.data.items[0].snippet?.title;
  const channelImage = response.data.items[0].snippet?.thumbnails?.default?.url;

   // Check if this channel/account already exists (by providerId)
   const existingIndex = user.socialAccounts.findIndex(
    (s) => s.provider === "youtube" && s.providerId === channelId
  );

  // creating account object
  const account = {
    provider: "youtube",
    providerId: channelId,
    accessToken: tokens?.access_token,
    refreshToken: tokens?.refresh_token || 
    user.socialAccounts.find((s) => s.provider === "youtube" && s.providerId === channelId)?.refreshToken,
    expiresAt: tokens?.expiry_date ? new Date(tokens.expiry_date) : null,
    linked: true,
    scope: tokens?.scope?.split(" "),
    title: channelTitle,
    image: channelImage,
    tokenType: tokens?.token_type,
  };

  if (existingIndex !== -1) {
     // Update existing account
     user.socialAccounts[existingIndex] = {
      ...user.socialAccounts[existingIndex].toObject(),
      ...account,
    };
  }else{
    user.socialAccounts.push(account);
  }

  await user.save();
  res.redirect(`${config.origin}/profile`);

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

// facebook 
const facebookConnect = catchAsyncError(async (req, res, next) => {
  const url = facebookClient.authUrl(req.userId);
  res.json({ url });
});

const facebookCallback = catchAsyncError(async (req, res, next) => {
  const code = req.query.code;
  const userId = req.query.state;
  // console.log("code", code);
  // console.log("userId", userId);
  if (!code || !userId) {
   res.redirect(`${config.origin}/profile`);
   return;
  }
  // short lived token
  const short = await facebookClient.exchangeCodeForShortToken(code);
  // long lived token
  const longUser = await facebookClient.exchangeForLongLivedUserToken(
    short.access_token
  );
  // get pages + page tokens
  const pages = await facebookClient.getPages(longUser.access_token);
  // console.log("pages", pages);

  if (!pages.data.length) {
    throw new ErrorHandler("No Facebook pages found!", httpStatus.NOT_FOUND);
  }

  const user = await UserModel.findById(userId);

  // Add ALL pages (or you can let user choose which ones)
  for(const page of pages.data || []){
    // console.log("page", page);
    const existingIndex = user.socialAccounts.findIndex(
      (s) => s.provider === "facebook" && s.providerId === page.id
    );

    const account = {
      provider: "facebook",
      providerId: page.id,
      accessToken: page.access_token,
      refreshToken: longUser?.access_token,
      expiresAt: longUser.expires_in
        ? new Date(Date.now() + longUser.expires_in * 1000)
        : null,
      scope: ["pages_show_list", "pages_read_engagement", "read_insights"],
      linked: true,
      title: page.name,
      image: page.picture?.data?.url,
      meta: { pageName: page.name, category: page.category },
    }

    if(existingIndex !== -1){
      // Update existing
      user.socialAccounts[existingIndex] = {
        // eslint-disable-next-line node/no-unsupported-features/es-syntax
        ...user.socialAccounts[existingIndex].toObject(),
        // eslint-disable-next-line node/no-unsupported-features/es-syntax
        ...account,
      };
    }else{
      user.socialAccounts.push(account);
    }
  }

  await user.save();
  res.redirect(`${config.origin}/profile`);
  
});

const fetchFacebookInsights = catchAsyncError(async (req, res, next) => {
  const id = req.userId;
  const insights = await SocialConnectionServices.fetchFacebookInsights(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Facebook insights fetched successfully!",
    data: insights,
  });
});

const fetchReachLikeCommentLastTwoMonthsData = catchAsyncError(async (req, res, next) => {
  const id = req.userId;
  const data = await SocialConnectionServices.fetchReachLikeCommentLastTwoMonthsData(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Reach, like, comment last two months data fetched successfully!",
    data: data
  });
});

const disconnectAccount = catchAsyncError(async (req, res, next) => {
  const id = req.userId;
  const {provider, providerId} = req.params;

  const user = await UserModel.findById(id);
  if(!user){
    throw new ErrorHandler("User not found!", httpStatus.NOT_FOUND);
  }

  const account = user.socialAccounts.find(
    (s) => s.provider === provider && s.providerId === providerId
  );

  if(!account){
    throw new ErrorHandler("Account not found!", httpStatus.NOT_FOUND);
  }

  user.socialAccounts = user.socialAccounts.filter(
    (s) => !(s.provider === provider && s.providerId === providerId)
  );

  await user.save();
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    // delete with name 
    message: `Account disconnected successfully!`,
    data: user.socialAccounts
  });
});

const SocialConnectionController = {
  youtubeConnect,
  youtubeCallback,
  fetchYoutubeInsights,
  facebookConnect,
  fetchFacebookInsights,
  facebookCallback,
  fetchReachLikeCommentLastTwoMonthsData,
  listOfAccounts,
  disconnectAccount
};
module.exports = SocialConnectionController;
