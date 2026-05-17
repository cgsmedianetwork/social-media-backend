const cron = require("node-cron");
const UserModel = require("../app/modules/user/user.model");
const analyticsServices = require("../app/modules/Analytics/Analytics.services");

const startAnalyticsCron = () => {
  cron.schedule("0 */3 * * *", async () => {
    try {
      const users = await UserModel.find({
        "socialAccounts.linked": true,
      }).select("_id");
      for (const user of users) {
        try {
          await analyticsServices.refreshUserAccountAnalytics(user._id);
        } catch (error) {
          console.error(
            `Analytics refresh failed for user ${user._id}:`,
            error.message,
          );
        }
      }
    } catch (error) {
      console.error("Admin analytics cron failed:", error.message);
    }
  });
};

module.exports = startAnalyticsCron;
