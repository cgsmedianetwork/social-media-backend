const getProviderColor = (provider) => {
  if (provider === "facebook") return "#1877F2";
  if (provider === "youtube") return "#FF0000";
  if (provider === "instagram") return "#8a49a1";
  if (provider === "tiktok") return "#282C35";
  return "#737373";
};

module.exports = getProviderColor;
