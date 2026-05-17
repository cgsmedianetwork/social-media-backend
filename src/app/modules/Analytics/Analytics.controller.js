const httpStatus = require("http-status");
const catchAsyncError = require("../../../ErrorHandler/catchAsyncError");
const sendResponse = require("../../../shared/sendResponse");
const analyticsServices = require("./Analytics.services");

const getAccountAnalytics = catchAsyncError(async (req, res) => {
  const targetUserId = analyticsServices.getTargetUserId(
    req.user,
    req.query.userId,
  );
  const result = await analyticsServices.getUserAccountAnalytics(targetUserId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Admin account analytics fetched successfully",
    data: result,
  });
});

const refreshAccountAnalytics = catchAsyncError(async (req, res) => {
  const targetUserId = analyticsServices.getTargetUserId(
    req.user,
    req.query.userId,
  );
  const result =
    await analyticsServices.refreshUserAccountAnalytics(targetUserId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Admin account analytics refreshed successfully",
    data: result,
  });
});

const analyticsController = {
  getAccountAnalytics,
  refreshAccountAnalytics,
};

module.exports = analyticsController;
