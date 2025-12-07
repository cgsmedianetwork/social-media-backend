const { google } = require("googleapis");
const config = require("../config/config");

const oauth2Client = new google.auth.OAuth2(
  config.googleClientID,
  config.googleClientSecret,
  config.googleCallbackURL
);

module.exports = oauth2Client;
