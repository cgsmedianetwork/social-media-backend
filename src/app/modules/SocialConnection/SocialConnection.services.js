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

async function ensureYoutubeToken(userId, providerId = null) {
  const userAccount = await UserModel.findById(userId);
 // Find specific account by providerId, or first one if not specified
 const acc = providerId 
 ? userAccount.socialAccounts.find((s) => s.provider === "youtube" && s.providerId === providerId)
 : userAccount.socialAccounts.find((s) => s.provider === "youtube");

  if (!acc){
    return null;
  }
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
    basicStats: channel.statistics,
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
async function getFacebookAccount(userId, providerId = null) {
  const user = await UserModel.findById(userId);
  // const acc = user?.socialAccounts?.find((s) => s.provider === "facebook");
  const acc = providerId
    ? user.socialAccounts.find((s) => s.provider === "facebook" && s.providerId === providerId)
    : user.socialAccounts.find((s) => s.provider === "facebook");
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
  console.log("acc", acc);
  const pageFanCount = await getPageFanCount(userId);
  console.log("pageFanCount", pageFanCount);
  
  const pageImpressions = await getPageImpressionsLast60Days(userId);
  console.log("pageImpressions", pageImpressions);
  return 
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

const fetchReachLikeCommentLastTwoMonthsData = async (userId) => {
  const userAccount = await UserModel.findById(userId);

  
    // Calculate date ranges for current month and last month
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = now;
  const facebookInsightsEndDate = new Date(now.getTime())
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); 
  const formatDate = (date) => date.toISOString().split("T")[0];
  const toTimestamp = (date) => Math.floor(date.getTime() / 1000);

    // Initialize combined totals
  const combinedTotals = {
      currentMonth: { views: 0, likes: 0, comments: 0 },
      lastMonth: { views: 0, likes: 0, comments: 0 },
   };

  // YouTube
   const youtubeAccounts = userAccount.socialAccounts.filter(
    (s) => s.provider === "youtube"
  );

  const extractYoutubeTotals = (data) => {
    const rows = data?.data?.rows;
    if (rows && rows.length > 0) {
      return {
        views: rows[0][0] || 0,
        likes: rows[0][1] || 0,
        comments: rows[0][2] || 0,
      };
    }
    return { views: 0, likes: 0, comments: 0 };
  };

  const youtubeData = await Promise.all(youtubeAccounts.map(async(acc)=> {
    try {
      const oauth2Client = await ensureYoutubeToken(userId, acc.providerId);
      if (!oauth2Client)  return null;

      const youtube = google.youtube({version: "v3", auth: oauth2Client})
      const youtubeAnalytics = google.youtubeAnalytics({version: "v2", auth: oauth2Client})
      const channelRes = await youtube.channels.list({mine: true, part: "id, snippet"})
      const channel = channelRes.data.items && channelRes.data.items[0];
      const channelId = channel?.id;
      if (!channelId) return null;

      // Fetch youtube data
      const [currentMonthData, lastMonthData] = await Promise.all([
          youtubeAnalytics.reports.query({
            ids: `channel==${channelId}`,
            startDate: formatDate(currentMonthStart),
            endDate: formatDate(currentMonthEnd),
            metrics: "views,likes,comments",
          }),
          youtubeAnalytics.reports.query({
            ids: `channel==${channelId}`,
            startDate: formatDate(lastMonthStart),
            endDate: formatDate(lastMonthEnd),
            metrics: "views,likes,comments",
          }),
        ]);

        return {
          provider: "youtube",
          name: channel?.snippet?.title || acc.meta?.channelTitle || "Unknown",
          currentMonth: extractYoutubeTotals(currentMonthData),
          lastMonth: extractYoutubeTotals(lastMonthData),
        };

    } catch (error) {
      console.error("YouTube error:", error.message);
        return null;
    }
  }))

  // facebook 
  const facebookAccounts = userAccount.socialAccounts.filter(
    (s) => s.provider === "facebook"
  );

  const extractFacebookMetricTotal = (insightsData, metricName) => {
    const metric = insightsData?.data?.find((m) => m.name === metricName);
    if (!metric?.values) return 0;
    // Sum all daily values
    return metric.values.reduce((sum, v) => sum + (v.value || 0), 0);
  };

  const facebookData = await Promise.all(
    facebookAccounts.map(async (acc) => {
      try {
        // Current month timestamps
        const currentSince = toTimestamp(currentMonthStart);
        const currentUntil = toTimestamp(facebookInsightsEndDate);
        // Last month timestamps
        const lastSince = toTimestamp(lastMonthStart);
        const lastUntil = toTimestamp(lastMonthEnd);

        // Fetch page insights for both periods
        // Metrics: page_impressions (reach), page_post_engagements (total engagement)
        const [currentInsights, lastInsights] = await Promise.all([
          facebookClient.getPageInsights(
            acc.providerId,
            acc.accessToken,
            ["page_posts_impressions"],
            currentSince,
            currentUntil,           
            "day"
          ),
          facebookClient.getPageInsights(
            acc.providerId,
            acc.accessToken,
            ["page_posts_impressions"],
            lastSince,
            lastUntil,
            "day"
          ),
        ]);
        // console.log("currentInsights", currentInsights);
        // console.log("lastInsights", lastInsights);
        // Fetch posts to get likes and comments for each period
        const [currentPosts, lastPosts] = await Promise.all([
          facebookClient.fetchFacebookPostsEngagement(acc.providerId, acc.accessToken, currentSince, currentUntil),
          facebookClient.fetchFacebookPostsEngagement(acc.providerId, acc.accessToken, lastSince, lastUntil),
        ]);
              

        return {
          provider: "facebook",
          name: acc.meta?.pageName || "Unknown Page",
          currentMonth: {
            views: extractFacebookMetricTotal(currentInsights, "page_impressions"),
            likes: currentPosts.likes,
            comments: currentPosts.comments,
          },
          lastMonth: {
            views: extractFacebookMetricTotal(lastInsights, "page_impressions"),
            likes: lastPosts.likes,
            comments: lastPosts.comments,
          },
        };
      } catch (error) {
        console.error("Facebook error:", error.message);
        return null;
      }
    })
  );
  // console.log("facebookData", facebookData);

  // combine all platform data
  const allPlatformData = [...youtubeData, ...facebookData].filter(Boolean);

  allPlatformData.forEach((platform) => {
    if (platform.currentMonth) {
      combinedTotals.currentMonth.views += platform.currentMonth.views;
      combinedTotals.currentMonth.likes += platform.currentMonth.likes;
      combinedTotals.currentMonth.comments += platform.currentMonth.comments;
    }
    if (platform.lastMonth) {
      combinedTotals.lastMonth.views += platform.lastMonth.views;
      combinedTotals.lastMonth.likes += platform.lastMonth.likes;
      combinedTotals.lastMonth.comments += platform.lastMonth.comments;
    }
  });


  return {
    platforms: allPlatformData, // Individual platform breakdown (optional)
    combined: {
      currentMonth: {
        period: {
          start: formatDate(currentMonthStart),
          end: formatDate(currentMonthEnd),
        },
        // eslint-disable-next-line node/no-unsupported-features/es-syntax
        ...combinedTotals.currentMonth,
      },
      lastMonth: {
        period: {
          start: formatDate(lastMonthStart),
          end: formatDate(lastMonthEnd),
        },
        // eslint-disable-next-line node/no-unsupported-features/es-syntax
        ...combinedTotals.lastMonth,
      },
    },
  };

}

const SocialConnectionServices = {
  fetchYoutubeInsights,
  ensureYoutubeToken,
  fetchFacebookInsights,
  fetchReachLikeCommentLastTwoMonthsData,
};

module.exports = SocialConnectionServices;
