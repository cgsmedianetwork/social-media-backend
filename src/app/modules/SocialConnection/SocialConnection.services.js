const { google } = require("googleapis");
const config = require("../../../config/config");
const ErrorHandler = require("../../../ErrorHandler/errorHandler");
const httpStatus = require("http-status");
const AnalyticsModel = require("../Analytics/Analytics.model");
const UserModel = require("../user/user.model");
const { default: axios } = require("axios");
const facebookClient = require("../../../Helper/facebookClient");

// youtube
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
  const youtubeAnalytics = google.youtubeAnalytics({
    version: "v2",
    auth: oauth2Client,
  });
  // console.log("youtube: ", youtube);
  //   get channel id
  const channelRes = await youtube.channels.list({
    mine: true,
    part: "id, snippet, statistics, brandingSettings",
  });
  // console.log("channelRes: ", channelRes);
  const channel = channelRes.data.items && channelRes.data.items[0];
  // console.log("channel: ", channel);
  // Get channel ID for analytics
  const channelId = channel?.id;

  // Get detailed analytics (last 30 days)
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  // console.log("startDate: ", startDate);
  // console.log("endDate: ", endDate);

  const analyticsData = await youtubeAnalytics?.reports?.query({
    ids: `channel==${channelId}`,
    startDate: startDate,
    endDate: endDate,
    metrics:
      "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,likes,comments,shares",
    dimensions: "day",
  });
  // console.log("analyticsData: ", analyticsData);

  const subscribersGained = await youtubeAnalytics.reports.query({
    ids: `channel==${channelId}`,
    startDate: startDate,
    endDate: endDate,
    metrics: "subscribersGained",
    dimensions: "day", // This gives you data by date
  });
  // console.log("subscribersGained: ", subscribersGained);

  // Get demographics and other metrics
  const demographics = await youtubeAnalytics.reports.query({
    ids: `channel==${channelId}`,
    startDate: startDate,
    endDate: endDate,
    metrics: "viewerPercentage",
    dimensions: "ageGroup,gender",
  });

  const metrics = {
    id: channel.id,
    title: channel.snippet.title,
    basicStats: channel.statistics, // subscriberCount, viewCount, videoCount
    analytics: {
      views: analyticsData.data,
      demographics: demographics.data,
      subscribersGained: subscribersGained.data,
      // Add more metrics as needed
    },
  };

  // await AnalyticsModel.create({
  //   userId,
  //   provider: "youtube",
  //   data: metrics,
  // });

  return metrics;
}

// facebook

async function getFacebookAccount(userId) {
  const user = await UserModel.findById(userId);
  const acc = user?.socialAccounts?.find((s) => s.provider === "facebook");
  if (!acc) {
    throw new ErrorHandler(
      "No Facebook account connected found!",
      httpStatus.BAD_REQUEST
    );
  }
  return { user, acc };
}
// date helper
function dateRange(days) {
  const end = new Date();
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const toTs = (d) => Math.floor(d.getTime() / 1000);
  return { since: toTs(start), until: toTs(end) };
}

async function getPageFanCount(userId) {
  const { acc } = await getFacebookAccount(userId);
  const { data } = await axios.get(
    `https://graph.facebook.com/${config.facebook.graph_api_version}/${acc.providerId}`,
    {
      params: {
        fields: "fan_count,name,followers_count",
        access_token: acc.accessToken,
      },
    }
  );

  return {
    pageId: acc?.providerId,
    name: data?.name,
    fanCount: data?.fan_count || 0,
    followersCount: data?.followers_count || 0,
  };
}

async function getPageImpressionsLast60Days(userId) {
  const { acc } = await getFacebookAccount(userId);
  const { since, until } = dateRange(60);
  const metrics = ["page_impressions", "page_impressions_unique"];
  const data = await facebookClient.getPageInsights(
    acc.providerId,
    acc.accessToken,
    metrics,
    since,
    until,
    "day"
  );
  return data;
}

async function getPageVideoViewsLast30Days(userId) {
  const { acc } = await getFacebookAccount(userId);
  const { since, until } = dateRange(30);
  const metrics = ["video_views"];
  const data = await facebookClient.getPageInsights(
    acc.providerId,
    acc.accessToken,
    metrics,
    since,
    until,
    "day"
  );
  return data;
}

async function getFollowersAddByLast30Days(userId) {
  const { acc } = await getFacebookAccount(userId);
  const { since, until } = dateRange(30);
  const metrics = ["page_fan_adds", "page_fan_removes"];
  const data = await facebookClient.getPageInsights(
    acc.providerId,
    acc.accessToken,
    metrics,
    since,
    until,
    "day"
  );
  return data;
}

async function fetchFacebookInsights(userId) {
  const userAccount = await UserModel.findById(userId);
  if (!userAccount) {
    throw new ErrorHandler("User not found!", httpStatus.NOT_FOUND);
  }
  const { acc } = await getFacebookAccount(userId);
  // console.log("acc", acc);
  const pageFanCount = await getPageFanCount(userId);
  // console.log("pageFanCount", pageFanCount);
  const pageImpressions = await getPageImpressionsLast60Days(userId);
  console.log("pageImpressions", pageImpressions);
  const pageVideoViews = await getPageVideoViewsLast30Days(userId);
  const followersAdd = await getFollowersAddByLast30Days(userId);

  const metrics = {
    acc,
    pageFanCount,
    pageImpressions,
    pageVideoViews,
    followersAdd,
  };
  return metrics;
}

const SocialConnectionServices = {
  fetchYoutubeInsights,
  ensureYoutubeToken,
  fetchFacebookInsights,
};

module.exports = SocialConnectionServices;
