const { default: axios } = require("axios");
const config = require("../config/config");

const version = config.facebook.graph_api_version || "v18.0";
const graphBase = `https://graph.facebook.com/${version}`;

const authUrl = (state) => {
    const scopes = [
        "instagram_basic",
        "instagram_manage_insights",
        "pages_show_list",
        "pages_read_engagement",
        "instagram_manage_comments",
        "instagram_manage_messages",
        "business_management",
        "pages_manage_metadata"
    ]

    // eslint-disable-next-line node/no-unsupported-features/node-builtins
    const params = new URLSearchParams({
        client_id: config.facebook.app_id,
        redirect_uri: config.instagram.redirect_uri,
        state,
        scope: scopes.join(","),
        response_type: "code",
    })

    return `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`;

}

const exchangeCodeForToken = async(code)=> {
    // eslint-disable-next-line node/no-unsupported-features/node-builtins
    const params = new URLSearchParams({
        client_id: config.facebook.app_id,
        client_secret: config.facebook.app_secret,
        code,
        redirect_uri: config.instagram.redirect_uri,
    })

    const response = await axios.get(`${graphBase}/oauth/access_token?${params.toString()}`);
    return response.data;
}

const exchangeForLongLivedToken = async(shortToken)=> {
    // eslint-disable-next-line node/no-unsupported-features/node-builtins
    const params = new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: config.facebook.app_id,
        client_secret: config.facebook.app_secret,
        fb_exchange_token: shortToken
    })

    const response = await axios.get(`${graphBase}/oauth/access_token?${params.toString()}`);
    return response.data;
}

const getInstagramBusinessAccount = async({pageAccessToken, pageId})=> {
    try {
        const {data} = await axios.get(`${graphBase}/${pageId}`, {
            params: {
                fields: "instagram_business_account",
                access_token: pageAccessToken
            }
        })

        return data.instagram_business_account?.id || null;
    } catch (error) {
        console.error("Error getting Instagram Business Account:", error.message);
        return null;
    }

}

const getPagesWithInstagram = async(userAccessToken)=> {
    try {
        const {data} = await axios.get(`${graphBase}/me/accounts`, {
            params: {
                access_token: userAccessToken,
                fields: "id,name,access_token,instagram_business_account{id,username,profile_picture_url,followers_count}"
            }
        })

        // Filter only pages that have Instagram business accounts connected
        const pagesWithInstagram = data.data.filter(
         (page) => page.instagram_business_account
         );
      return pagesWithInstagram;
    } catch (error) {
        console.error("Error getting Pages with Instagram:", error.message);
        return [];
    }
}

const getInstagramProfile = async (instagramAccountId, accessToken) => {
    try {
      const { data } = await axios.get(`${graphBase}/${instagramAccountId}`, {
        params: {
          fields: "id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website",
          access_token: accessToken,
        },
      });
      return data;
    } catch (error) {
      console.error("Error getting Instagram profile:", error.message);
      return null;
    }
  };

  const getInstagramAccountInsights = async (
    instagramAccountId,
    accessToken,
    metrics,
    since,
    until,
    period = "day"
  ) => {
    try {
      const { data } = await axios.get(
        `${graphBase}/${instagramAccountId}/insights`,
        {
          params: {
            metric: metrics.join(","),
            period,
            since,
            until,
            access_token: accessToken,
          },
        }
      );
      return data;
    } catch (error) {
      console.error("Instagram insights error:", error.response?.data || error.message);
      return { data: [] };
    }
  };


  const instagramClient = {
    authUrl,
    exchangeCodeForToken,
    exchangeForLongLivedToken,
    getInstagramBusinessAccount,
    getPagesWithInstagram,
    getInstagramProfile,
    getInstagramAccountInsights,
  }

  module.exports = instagramClient;