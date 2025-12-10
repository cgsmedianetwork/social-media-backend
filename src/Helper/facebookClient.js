const { default: axios } = require("axios");
const config = require("../config/config");

const version = config.facebook.graph_api_version || "v18.0";
const graphBase = `https://graph.facebook.com/${version}`;

const authUrl = (state) => {
  const scopes = [
    "pages_show_list",
    "pages_read_engagement",
    "read_insights",
    "pages_read_user_content",
  ];
  // eslint-disable-next-line node/no-unsupported-features/node-builtins
  const params = new URLSearchParams({
    client_id: config.facebook.app_id,
    redirect_uri: config.facebook.redirect_uri,
    state,
    scope: scopes.join(","),
    response_type: "code",
  });
  return `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`;
};

const exchangeCodeForShortToken = async (code) => {
  // eslint-disable-next-line node/no-unsupported-features/node-builtins
  const params = new URLSearchParams({
    client_id: config.facebook.app_id,
    client_secret: config.facebook.app_secret,
    code,
    redirect_uri: config.facebook.redirect_uri,
  });
  const response = await axios.get(
    `${graphBase}/oauth/access_token?${params.toString()}`
  );
  return response.data;
};

const exchangeForLongLivedUserToken = async (shortToken) => {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: config.facebook.app_id,
    client_secret: config.facebook.app_secret,
    fb_exchange_token: shortToken,
  });
  const response = await axios.get(
    `${graphBase}/oauth/access_token?${params.toString()}`
  );
  return response.data;
};

const getPages = async (longUserToken) => {
  const { data } = await axios.get(`${graphBase}/me/accounts`, {
    params: { access_token: longUserToken },
  });
  return data;
};

const getPageInsights = async (
  pageId,
  pageToken,
  metrics,
  since,
  until,
  period = "day"
) => {
  const { data } = await axios.get(`${graphBase}/${pageId}/insights`, {
    params: {
      metric: metrics.join(","),
      period,
      since,
      until,
      access_token: pageToken,
    },
  });
};

const getPagePosts = async (pageId, pageToken, since, until, limit = 100) => {
  const { data } = await axios.get(`${graphBase}/${pageId}/posts`, {
    params: {
      access_token: pageToken,
      since,
      until,
      limit,
    },
  });
  return data;
};

const facebookClient = {
  authUrl,
  exchangeCodeForShortToken,
  exchangeForLongLivedUserToken,
  getPages,
  getPageInsights,
  getPagePosts,
};

module.exports = facebookClient;
