const { google } = require("googleapis");
const config = require("../../../config/config");
const ErrorHandler = require("../../../ErrorHandler/errorHandler");
const httpStatus = require("http-status");
const AnalyticsModel = require("../Analytics/Analytics.model");
const UserModel = require("../user/user.model");

function createClient(tokens) {
  const oauth2Client = new google.auth.OAuth2(
    config.googleClientID,
    config.googleClientSecret
  );
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

async function ensureYoutubeToken(userId) {
  const userAccount = await UserModel.findById(userId);
  const acc = userAccount.socialAccounts.find((s) => s.provider === "youtube");
  if (!acc)
    throw new ErrorHandler(
      "No youtube account connected found!",
      httpStatus.BAD_REQUEST
    );
  const oauth2Client = createClient({
    access_token: acc.accessToken,
    refresh_token: acc.refreshToken,
    expiry_date: acc.expiresAt ? new Date(acc.expiresAt).getTime() : undefined,
  });
  // google client auto-refreshes when calling APIs if refresh_token exists
  // but we might force refresh:
  try {
    const newToken = await oauth2Client.getAccessToken();
    const tokenStr = newToken?.token;
    if (tokenStr !== acc.accessToken) {
      acc.accessToken = tokenStr;
      acc.expiresAt = oauth2Client?.credentials?.expiry_date
        ? new Date(oauth2Client.credentials.expiry_date)
        : null;
      await userAccount.save();
    }

    return oauth2Client;
  } catch (error) {
    console.log(error);
    throw new ErrorHandler(
      "Failed to refresh YouTube token. Please reconnect your account.",
      httpStatus.UNAUTHORIZED
    );
  }
}

async function fetchYoutubeInsights(userId) {
  const oauth2Client = await ensureYoutubeToken(userId);
  const youtube = google.youtube({ version: "v3", auth: oauth2Client });
  //   get channel id
  const res = await youtube.channels.list({
    mine: true,
    part: "id, snippet, statistics",
  });
  const channel = res.data.items && res.data.items[0];
  const metrics = {
    id: channel.id,
    title: channel.snippet.title,
    stats: channel.statistics,
  };

  await AnalyticsModel.create({
    userId,
    provider: "youtube",
    data: metrics,
  });

  return metrics;
}

const SocialConnectionServices = {
  fetchYoutubeInsights,
  ensureYoutubeToken,
};

module.exports = SocialConnectionServices;
