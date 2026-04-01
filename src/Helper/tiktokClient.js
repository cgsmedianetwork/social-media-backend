const { default: axios } = require("axios");
const config = require("../config/config");
const crypto = require("crypto");
const authBase = "https://www.tiktok.com/v2/auth/authorize";
const tokenBase = "https://open.tiktokapis.com/v2/oauth/token/";
const apiBase = "https://open.tiktokapis.com/v2";

const base64url = (buffer) =>
  buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const generatePKCE = () => {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(
    crypto.createHash("sha256").update(codeVerifier).digest(),
  );

  return { codeVerifier, codeChallenge };
};

const authUrl = (state) => {
  const { codeChallenge, codeVerifier } = generatePKCE();
  const scopes = [
    "user.info.basic",
    "user.info.profile",
    "user.info.stats",
    "video.list",
  ];
  const combineState = `${state}:${codeVerifier}`;
  // eslint-disable-next-line node/no-unsupported-features/node-builtins
  const params = new URLSearchParams({
    client_key: config.tiktok.client_key,
    redirect_uri: config.tiktok.redirect_uri,
    state: combineState,
    scope: scopes.join(","),
    response_type: "code",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${authBase}?${params.toString()}`;
};

const exchangeCodeForToken = async (code, codeVerifier) => {
  // eslint-disable-next-line node/no-unsupported-features/node-builtins
  const params = new URLSearchParams({
    client_key: config.tiktok.client_key,
    client_secret: config.tiktok.client_secret,
    code,
    grant_type: "authorization_code",
    redirect_uri: config.tiktok.redirect_uri,
    code_verifier: codeVerifier,
  });

  const response = await axios.post(tokenBase, params.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return response.data;
};

const refreshToken = async (refreshToken) => {
  // eslint-disable-next-line node/no-unsupported-features/node-builtins
  const params = new URLSearchParams({
    client_key: config.tiktok.client_key,
    client_secret: config.tiktok.client_secret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await axios.post(tokenBase, params.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return response.data;
};

const getUserInfo = async (accessToken) => {
  try {
    const { data } = await axios.get(`${apiBase}/user/info/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        fields:
          "open_id,union_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count",
      },
    });
    return data.data?.user || null;
  } catch (error) {
    console.error("Error getting TikTok user info:", error.message);
    return null;
  }
};

const getVideos = async (accessToken, cursor = null, maxCount = 20) => {
  try {
    const params = {
      fields:
        "id,title,create_time,share_url,video_description,duration,cover_image_url,like_count,comment_count,share_count,view_count",
      max_count: maxCount,
    };

    if (cursor) {
      params.cursor = cursor;
    }

    const { data } = await axios.post(`${apiBase}/video/list/`, params, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    return {
      videos: data.data?.videos || [],
      hasMore: data.data?.has_more || false,
      cursor: data.data?.cursor || null,
    };
  } catch (error) {
    console.error("Error getting TikTok videos:", error.message);
    return { videos: [], hasMore: false, cursor: null };
  }
};

const getVideoEngagement = async (accessToken, sinceDate, untilDate) => {
  try {
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let cursor = null;
    let hasMore = true;

    const since =
      sinceDate instanceof Date ? sinceDate : new Date(sinceDate * 1000);
    const until =
      untilDate instanceof Date ? untilDate : new Date(untilDate * 1000);

    while (hasMore) {
      const result = await getVideos(accessToken, cursor, 50);

      for (const video of result.videos) {
        // TikTok returns create_time as Unix timestamp
        const videoDate = new Date(video.create_time * 1000);

        // If video is older than our range, stop fetching
        if (videoDate < since) {
          return {
            views: totalViews,
            likes: totalLikes,
            comments: totalComments,
          };
        }

        // Only count if within range
        if (videoDate <= until) {
          totalViews += video.view_count || 0;
          totalLikes += video.like_count || 0;
          totalComments += video.comment_count || 0;
        }
      }

      cursor = result.cursor;
      hasMore = result.hasMore;
    }
    return { views: totalViews, likes: totalLikes, comments: totalComments };
  } catch (error) {
    console.error(
      "TikTok engagement error:",
      error.response?.data || error.message,
    );
    return { views: 0, likes: 0, comments: 0 };
  }
};

const tiktokClient = {
  authUrl,
  exchangeCodeForToken,
  refreshToken,
  getUserInfo,
  getVideos,
  getVideoEngagement,
};

module.exports = tiktokClient;
