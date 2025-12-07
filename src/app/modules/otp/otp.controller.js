const httpStatus = require("http-status");
const catchAsyncError = require("../../../ErrorHandler/catchAsyncError");
const sendResponse = require("../../../shared/sendResponse");
const otpServices = require("./otp.services");

const sendOTP = catchAsyncError(async (req, res) => {
  const { userEmail, userNumber, otpType } = req.body;

  const result = await otpServices.createOTPIntoDB({
    userEmail,
    userNumber,
    otpType,
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "OTP created successfully",
    data: {
      result,
    },
  });
});

const otpVarifiction = catchAsyncError(async (req, res) => {
  const { otpCode } = req.body;

  let validation = false;
  const result = await otpServices.recentOTPFromDB({ otpCode });

  if (result) {
    validation = true;
  }

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "OTP Varify successful",
    data: {
      validation,
    },
  });
});

const otpController = {
  sendOTP,
  otpVarifiction,
};
module.exports = otpController;
