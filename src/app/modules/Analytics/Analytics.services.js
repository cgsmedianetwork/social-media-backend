const ErrorHandler = require("../../../ErrorHandler/errorHandler");
const httpStatus = require("http-status");
const SocialConnectionServices = require("../SocialConnection/SocialConnection.services");
const { google } = require("googleapis");
const axios = require("axios");
const facebookClient = require("../../../Helper/facebookClient");
const {
  getUserInfo,
  getVideoEngagement,
} = require("../../../Helper/tiktokClient");
const AnalyticsModel = require("./Analytics.model");
const instagramClient = require("../../../Helper/instagramClient");
const UserModel = require("../user/user.model");
const config = require("../../../config/config");

const PROVIDER_COLORS = {
  youtube: "#FF0000",
  facebook: "#1877F2",
  instagram: "#C13584",
  tiktok: "#000000",
};

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const getMonthRange = (date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return { start, end };
};

const getLastSixMonths = () => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date(
      now.getFullYear(),
      now.getMonth() - (5 - index),
      1,
    );
    const { start, end } = getMonthRange(monthDate);
    return {
      label: monthNames[start.getMonth()],
      start,
      end: index === 5 ? now : end,
    };
  });
};

const formatDate = (date) => date.toISOString().split("T")[0];
const toTimestamp = (date) => Math.floor(date.getTime() / 1000);

const assertAdmin = (user) => {
  if (!["admin", "subAdmin"].includes(user?.role)) {
    throw new ErrorHandler(
      "Only admin can access analytics",
      httpStatus.FORBIDDEN,
    );
  }
};

const getTargetUserId = (adminUser, queryUserId) => {
  assertAdmin(adminUser);
  return queryUserId || adminUser._id;
};

const getNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const sumMetricValues = (insightsData, metricName) => {
  const metric = insightsData?.data?.find((item) => item.name === metricName);

  if (!metric) return null;
  if (!metric.values?.length) return 0;

  return metric.values.reduce(
    (sum, item) => sum + (Number(item.value) || 0),
    0,
  );
};
const buildEmptyMetrics = () => ({
  totalFollowers: null,
  followersGained: null,
  reach: null,
  impressions: null,
  views: null,
  likes: null,
  comments: null,
  shares: null,
  engagement: null,
});

const buildEmptyCapabilities = () => ({
  totalFollowers: false,
  followersGained: false,
  reach: false,
  impressions: false,
  engagement: false,
});

const getYoutubeMetrics = async (userId, account, month) => {
  const oauth2Client = await SocialConnectionServices.ensureYoutubeToken(
    userId,
    account.providerId,
  );
  const youtube = google.youtube({ version: "v3", auth: oauth2Client });
  const youtubeAnalytics = google.youtubeAnalytics({
    version: "v2",
    auth: oauth2Client,
  });
  const channelRes = await youtube.channels.list({
    mine: true,
    part: "snippet,statistics",
  });
  const channel = channelRes.data.items?.[0];
  const channelId = channel?.id;
  if (!channelId) {
    throw new Error("YouTube channel not found");
  }
  const [monthlyAnalytics, subscribersGained] = await Promise.all([
    youtubeAnalytics.reports.query({
      ids: `channel==${channelId}`,
      startDate: formatDate(month.start),
      endDate: formatDate(month.end),
      metrics: "views,likes,comments,shares",
    }),
    youtubeAnalytics.reports.query({
      ids: `channel==${channelId}`,
      startDate: formatDate(month.start),
      endDate: formatDate(month.end),
      metrics: "subscribersGained",
    }),
  ]);
  const row = monthlyAnalytics.data?.rows?.[0] || [];
  const followerRow = subscribersGained.data?.rows?.[0] || [];
  const views = getNumber(row[0]);
  const likes = getNumber(row[1]);
  const comments = getNumber(row[2]);
  const shares = getNumber(row[3]);
  return {
    accountName: channel.snippet?.title || account.title || "YouTube Channel",
    accountImage: channel.snippet?.thumbnails?.default?.url || account.image,
    metrics: {
      // eslint-disable-next-line node/no-unsupported-features/es-syntax
      ...buildEmptyMetrics(),
      totalFollowers: getNumber(channel.statistics?.subscriberCount),
      followersGained: getNumber(followerRow[0]),
      views,
      reach: views,
      likes,
      comments,
      shares,
      engagement: (likes || 0) + (comments || 0) + (shares || 0),
    },
    capabilities: {
      totalFollowers: true,
      followersGained: true,
      reach: true,
      impressions: false,
      engagement: true,
    },
  };
};

const getFacebookMetrics = async (account, month) => {
  const since = toTimestamp(month.start);
  const until = toTimestamp(month.end);
  const [{ data: page }, mediaViewInsights, uniqueViewInsights, posts] =
    await Promise.all([
      axios.get(
        `https://graph.facebook.com/${config.facebook.graph_api_version}/${account.providerId}`,
        {
          params: {
            fields: "name,followers_count,fan_count",
            access_token: account.accessToken,
          },
        },
      ),
      // facebookClient.getPageInsights(
      //   account.providerId,
      //   account.accessToken,
      //   ["page_impressions", "page_impressions_unique", "page_fan_adds"],
      //   since,
      //   until,
      //   "day",
      // ),

      facebookClient.getPageInsights(
        account.providerId,
        account.accessToken,
        ["page_media_view"],
        since,
        until,
        "day",
      ),
      facebookClient.getPageInsights(
        account.providerId,
        account.accessToken,
        ["page_total_media_view_unique"],
        since,
        until,
        "day",
      ),

      facebookClient.fetchFacebookPostsEngagement(
        account.providerId,
        account.accessToken,
        since,
        until,
      ),
    ]);

  const impressions = sumMetricValues(mediaViewInsights, "page_media_view");
  const uniqueViews = sumMetricValues(
    uniqueViewInsights,
    "page_total_media_view_unique",
  );
  const reach = uniqueViews ?? impressions;
  const followersGained = null;
  const likes = getNumber(posts?.likes);
  const comments = getNumber(posts?.comments);
  return {
    accountName:
      page?.name || account.title || account.meta?.pageName || "Facebook Page",
    accountImage: account.image,
    metrics: {
      // eslint-disable-next-line node/no-unsupported-features/es-syntax
      ...buildEmptyMetrics(),
      totalFollowers: getNumber(page?.followers_count || page?.fan_count),
      followersGained,
      reach,
      impressions,
      likes,
      comments,
      engagement: (likes || 0) + (comments || 0),
    },
    capabilities: {
      totalFollowers: true,
      followersGained: followersGained !== null,
      reach: reach !== null,
      impressions: reach !== null,
      engagement: true,
    },
  };
};

const getInstagramMetrics = async (account, month) => {
  const since = toTimestamp(month.start);
  const until = toTimestamp(month.end);
  const [profile, insights, media] = await Promise.all([
    instagramClient.getInstagramProfile(
      account.providerId,
      account.accessToken,
    ),
    instagramClient.getInstagramAccountInsights(
      account.providerId,
      account.accessToken,
      ["reach", "impressions", "follower_count"],
      since,
      until,
      "day",
    ),
    instagramClient.getInstagramMediaEngagement(
      account.providerId,
      account.accessToken,
      since,
      until,
    ),
  ]);
  const reach = sumMetricValues(insights, "reach");
  const impressions = sumMetricValues(insights, "impressions");
  const followersGained = sumMetricValues(insights, "follower_count");
  const likes = getNumber(media?.likes);
  const comments = getNumber(media?.comments);
  return {
    accountName:
      profile?.username ||
      profile?.name ||
      account.title ||
      "Instagram Account",
    accountImage: account.image,
    metrics: {
      // eslint-disable-next-line node/no-unsupported-features/es-syntax
      ...buildEmptyMetrics(),
      totalFollowers: getNumber(profile?.followers_count),
      followersGained,
      reach,
      impressions,
      likes,
      comments,
      engagement: (likes || 0) + (comments || 0),
    },
    capabilities: {
      totalFollowers: true,
      followersGained: followersGained !== null,
      reach: reach !== null,
      impressions: impressions !== null,
      engagement: true,
    },
  };
};

const getTiktokMetrics = async (account, month) => {
  const [userInfo, engagement] = await Promise.all([
    getUserInfo(account.accessToken),
    getVideoEngagement(account.accessToken, month.start, month.end),
  ]);
  const views = getNumber(engagement?.views);
  const likes = getNumber(engagement?.likes);
  const comments = getNumber(engagement?.comments);
  const shares = getNumber(engagement?.shares);
  return {
    accountName: userInfo?.display_name || account.title || "TikTok Account",
    accountImage: account.image,
    metrics: {
      // eslint-disable-next-line node/no-unsupported-features/es-syntax
      ...buildEmptyMetrics(),
      totalFollowers: getNumber(
        userInfo?.follower_count || account.meta?.followerCount,
      ),
      followersGained: null,
      views,
      reach: views,
      likes,
      comments,
      shares,
      engagement: (likes || 0) + (comments || 0) + (shares || 0),
    },
    capabilities: {
      totalFollowers: true,
      followersGained: false,
      reach: views !== null,
      impressions: false,
      engagement: true,
    },
  };
};

const fetchAccountMonthMetrics = async (userId, account, month) => {
  if (account.provider === "youtube") {
    return getYoutubeMetrics(userId, account, month);
  }
  if (account.provider === "facebook") {
    return getFacebookMetrics(account, month);
  }
  if (account.provider === "instagram") {
    return getInstagramMetrics(account, month);
  }
  if (account.provider === "tiktok") {
    return getTiktokMetrics(account, month);
  }
  throw new Error(`Unsupported provider: ${account.provider}`);
};

const upsertSnapshot = async ({
  userId,
  account,
  month,
  accountName,
  accountImage,
  metrics,
  capabilities,
  status,
  errorMessage,
}) => {
  return AnalyticsModel.findOneAndUpdate(
    {
      userId,
      provider: account.provider,
      providerId: account.providerId,
      periodType: "month",
      periodStart: month.start,
    },
    {
      $set: {
        userId,
        provider: account.provider,
        providerId: account.providerId,
        accountName,
        accountImage,
        periodType: "month",
        periodStart: month.start,
        periodEnd: month.end,
        metrics,
        capabilities,
        status,
        errorMessage,
        fetchedAt: new Date(),
      },
    },
    { upsert: true, new: true, runValidators: true },
  );
};

const refreshUserAccountAnalytics = async (userId) => {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new ErrorHandler("User not found", httpStatus.NOT_FOUND);
  }
  const accounts = user.socialAccounts.filter(
    (account) => account.linked && account.provider && account.providerId,
  );
  const months = getLastSixMonths();
  for (const account of accounts) {
    for (const month of months) {
      try {
        const result = await fetchAccountMonthMetrics(userId, account, month);
        await upsertSnapshot({
          userId,
          account,
          month,
          accountName: result.accountName,
          accountImage: result.accountImage,
          metrics: result.metrics,
          capabilities: result.capabilities,
          status: "success",
          errorMessage: null,
        });
      } catch (error) {
        await upsertSnapshot({
          userId,
          account,
          month,
          accountName:
            account.title || account.meta?.pageName || "Unknown Account",
          accountImage: account.image,
          metrics: buildEmptyMetrics(),
          capabilities: buildEmptyCapabilities(),
          status: "failed",
          errorMessage: error.message,
        });
      }
    }
  }
  return getUserAccountAnalytics(userId);
};

const getUserAccountAnalytics = async (userId) => {
  const user = await UserModel.findById(userId).select("socialAccounts");
  if (!user) {
    throw new ErrorHandler("User not found", httpStatus.NOT_FOUND);
  }
  const accounts = user.socialAccounts.filter(
    (account) => account.linked && account.provider && account.providerId,
  );
  const months = getLastSixMonths();
  const startDate = months[0].start;
  const snapshots = await AnalyticsModel.find({
    userId,
    periodType: "month",
    periodStart: { $gte: startDate },
  }).lean();
  const snapshotMap = new Map();
  snapshots.forEach((snapshot) => {
    const key = `${snapshot.provider}:${
      snapshot.providerId
    }:${snapshot.periodStart.toISOString()}`;
    snapshotMap.set(key, snapshot);
  });
  const resultAccounts = accounts.map((account) => {
    const accountSnapshots = snapshots
      .filter(
        (snapshot) =>
          snapshot.provider === account.provider &&
          snapshot.providerId === account.providerId,
      )
      .sort((a, b) => new Date(b.fetchedAt) - new Date(a.fetchedAt));
    const latest = accountSnapshots[0];
    const chartData = months.map((month) => {
      const key = `${account.provider}:${
        account.providerId
      }:${month.start.toISOString()}`;
      const snapshot = snapshotMap.get(key);
      return {
        month: month.label,
        reach: snapshot?.metrics?.reach ?? snapshot?.metrics?.views ?? null,
        engagement: snapshot?.metrics?.engagement ?? null,
        followersGained: snapshot?.metrics?.followersGained ?? null,
      };
    });
    return {
      provider: account.provider,
      providerId: account.providerId,
      accountName:
        latest?.accountName ||
        account.title ||
        account.meta?.pageName ||
        "Unknown Account",
      accountImage: latest?.accountImage || account.image,
      color: PROVIDER_COLORS[account.provider] || "#111827",
      latest: latest
        ? {
            totalFollowers: latest.metrics?.totalFollowers ?? null,
            reach: latest.metrics?.reach ?? latest.metrics?.views ?? null,
            impressions: latest.metrics?.impressions ?? null,
            engagement: latest.metrics?.engagement ?? null,
            status: latest.status,
            errorMessage: latest.errorMessage,
            fetchedAt: latest.fetchedAt,
          }
        : {
            totalFollowers: null,
            reach: null,
            impressions: null,
            engagement: null,
            status: "failed",
            errorMessage: "No snapshot found",
            fetchedAt: null,
          },
      chartData,
    };
  });
  return {
    accounts: resultAccounts,
    lastUpdated:
      snapshots.length > 0
        ? snapshots.sort(
            (a, b) => new Date(b.fetchedAt) - new Date(a.fetchedAt),
          )[0].fetchedAt
        : null,
  };
};

const analyticsServices = {
  getTargetUserId,
  getUserAccountAnalytics,
  refreshUserAccountAnalytics,
};

module.exports = analyticsServices;
