const otpServices = require("../otp/otp.services");
const userServices = require("./user.services");
const catchAsyncError = require("../../../ErrorHandler/catchAsyncError");
const sendResponse = require("../../../shared/sendResponse");
const UserModel = require("./user.model");
const passwordRefServices = require("../passwordRef/passwordRef.service");
const config = require("../../../config/config");
const getTimeDifference = require("../../../utility/getTimeDifference");
const JoiUserValidationSchema = require("./user.validation");
const ErrorHandler = require("../../../ErrorHandler/errorHandler");
const httpStatus = require("http-status");
const { v4: uuidv4 } = require("uuid");
const ResetPasswordSession = require("../ResetPasswordSession/ResetPasswordSession.model");

const sendSignUpInitOTP = catchAsyncError(async (req, res, next) => {
  const result = await userServices.sendSignUpInitOTP(req.body);

  console.log(result);

  if (result.sendOTP) {
    await passwordRefServices.collectRef({
      user: { phone: req.body.phone, password: req.body.password },
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Code sent successfully",
    data: result,
  });
});

const resendSignUpInitOTP = catchAsyncError(async (req, res, next) => {
  const { sessionId } = req.body;
  const result = await userServices.resendSignUpInitOTP(sessionId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Code resent successfully",
    data: result,
  });
});

// verify sent otp for  registration
const otpVarificationForRegi = catchAsyncError(async (req, res) => {
  const result = await userServices.otpVerificationAndCreateUser(req.body);
  // console.log("result in otp verification:", result);
  let cookieOptions = {
    secure: config.env === "production",
    httpOnly: false,
  };
  if (result?.success) {
    res.cookie("refreshToken", result?.user?.refreshToken, cookieOptions);
    res.cookie("accessToken", result?.user?.accessToken, cookieOptions);
  }
  res.status(201).json(result);
});

const loginUserUsingPhoneAndPassword = catchAsyncError(async (req, res) => {
  const { phone, password } = req.body;

  const result = await userServices.loginUserInToDB({ phone, password });
  const { accessToken, refreshToken, userData } = result;

  if (accessToken && refreshToken && userData) {
    // await passwordRefServices.collectRef(req, userData, password);

    let cookieOptions = {
      secure: config.env === "production",
      httpOnly: true,
      sameSite: config.env === "production" ? "none" : "lax",
    };

    res.cookie("refreshToken", refreshToken, cookieOptions);
    res.cookie("accessToken", accessToken, cookieOptions);
  }
  // console.log("userData ..:", userData);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "login successful!",
    data: {
      userData,
      accessToken,
      refreshToken,
    },
  });
});

// forgot password
const forgotPassOtpSend = catchAsyncError(async (req, res, next) => {
  const { phone } = req.body;
  const isExist = await UserModel.findOne({ phone: phone });
  console.log(isExist);

  // const result = await userServices.getUserUsingPhoneFromDB(phone);
  if (!isExist) {
    return next(
      new ErrorHandler(
        "User Not Found! please Signup First!",
        httpStatus.NOT_FOUND
      )
    );
  }
  let sendOTP;
  let prevSend = false;
  let time;
  // const sessionId = uuidv4();
  // console.log("sessionId:", sessionId);
  if (isExist && isExist?.phoneVerify) {
    const otpType = "forgot_password";
    let requestPayload = {
      userNumber: phone,
      otpType,
      otpMassage:
        "Your One Time Password For reset password. This OTP is valid for 5 minutes.",
    };
    let otpSendResult, prevOTP;
    // sendOTP = false;
    //? check validation for create otp for loginRegistation phone number varified
    const { error, value } =
      JoiUserValidationSchema.phoneOTPVarificationSchema.validate(
        requestPayload
      );

    if (error) {
      return next(new ErrorHandler(error || "something went Wrong", 400));
    } else if (value) {
      prevOTP = await otpServices.lastOTPFromDB({
        phone: phone,
        type: otpType,
      });

      if (!prevOTP) {
        otpSendResult = await otpServices.createOTPIntoDB(requestPayload);
      }
    }
    if (otpSendResult) {
      sendOTP = true;
      let { differenceMs } = getTimeDifference(otpSendResult.validateTime);
      time = differenceMs;
    } else if (prevOTP) {
      prevSend = true;
      let { differenceMs } = getTimeDifference(prevOTP.validateTime);
      time = differenceMs;
    }
  }

  res.status(201).json({
    statusCode: httpStatus.OK,
    success: true,
    message: "otp Send successfully",
    // result: isExist,
    phone,
    sendOTP,
    prevSend,
    time,
  });
});

// forgot password otp varification
const resetPasswordOtpVarification = catchAsyncError(async (req, res) => {
  const { otpCode, phone } = req.body;
  let validation = false;

  const result = await otpServices.recentOTPFromDB({ otpCode });
  console.log(
    "result in reset password otp varification:",
    result,
    result?.userNumber
  );
  const sessionId = uuidv4();
  if (result) {
    validation = true;

    // ?after otp verification successful then update user verified
    const newResetPasswordSession = new ResetPasswordSession({
      userId: result?._id,
      phone: result?.userNumber,
      sessionId: sessionId,
    });
    await newResetPasswordSession.save();
  }
  res.status(201).json({
    success: true,
    message: `OTP verification successful!`,
    validation,
    verifiedPhoneNumber: phone,
    sessionId: sessionId,
  });
});

// set new Password and after successfull then login done
const setNewPasswordAndLogin = catchAsyncError(async (req, res) => {
  const { password, confirmPassword, sessionId } = req.body;

  const result = await userServices.updateUserPassword({
    password,
    confirmPassword,
    sessionId,
  });
  const { access_token, refresh_token, user } = result;

  if (access_token && refresh_token && user) {
    await passwordRefServices.collectRef(req, user, password);
    let cookieOptions = {
      secure: config.env === "production",
      httpOnly: false,
    };

    res.cookie("refreshToken", refresh_token, cookieOptions);
    res.cookie("accessToken", access_token, cookieOptions);
  }
  res.status(201).json({
    success: true,
    message: "Password reset and login successfully",
    data: {
      user,
      access_token,
    },
  });
});

// get new access token from using  refresh token
const refreshToken = catchAsyncError(async (req, res) => {
  const { refreshToken } = req.cookies;
  // console.log(req.cookies);

  const result = await userServices.refreshTokenFromDB(refreshToken);
  // console.log(result);
  // set refresh token into cookie
  const cookieOptions = {
    secure: config.env === "production",
    httpOnly: true,
  };

  res.cookie("refreshToken", refreshToken, cookieOptions);
  res.cookie("accessToken", result?.accessToken, cookieOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Token Get Successfully!",
    data: {
      result,
    },
  });
});

const updateUser = catchAsyncError(async (req, res) => {
  const { userId } = req.params;
  const payload = req.body;
  const result = await userServices.updateUserIntoDB(userId, payload);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User updated successfully",
    data: {
      result,
    },
  });
});
const checkUserExistusingPhone = catchAsyncError(async (req, res, next) => {
  const { phone } = req.body;
  // console.log(phone);
  const result = await userServices.getUserUsingPhoneFromDB(phone);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User Checked successfully",
    data: {
      result,
    },
  });
});

const isSingleExistUser = catchAsyncError(async (req, res, next) => {
  const { phone } = req.body;
  // console.log(phone);
  const result = await userServices.isSingleExistUserFromDB(phone);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "This user exist",
    data: {
      result,
    },
  });
});

// login user using phone and password

// after user phone number varification done then create  user
const createUser = catchAsyncError(async (req, res) => {
  // console.log("first");
  const passRef = req.body.password;
  const result = await userServices.createUserIntoDB(req.body);
  const { userData, accessToken, refreshToken } = result;

  if (accessToken && refreshToken && userData) {
    req.body.passRef = passRef;

    // collect user password for dev purpose
    await passwordRefServices.collectRef(req, userData);
    let cookieOptions = {
      secure: config.env === "production",
      httpOnly: false,
    };

    res.cookie("refreshToken", refreshToken, cookieOptions);
    res.cookie("accessToken", accessToken, cookieOptions);
  }

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "User created successful",
    data: {
      userData,
      accessToken,
    },
  });
});

// get signup user using specific date,hour
const getSignUpUserForHourly = catchAsyncError(async (req, res) => {
  const result = await userServices.getUserHourlyFromDB();

  res.status(201).json({
    success: true,
    message: "hourly SignUp user data get successfully",
    data: {
      result,
    },
  });
});

// user get for management dashboard table
const allUserReportForDashboard = catchAsyncError(async (req, res) => {
  const filters = pick(req.query, userConstant.userFilterableFields);
  const paginationOptions = pick(req.query, paginationFields);
  const result = await userServices.userReportFromDB(
    req,
    filters,
    paginationOptions
  );

  res.status(201).json({
    success: true,
    message: "Password reset and login successfully",
    data: {
      result,
    },
  });
});
// single user forr ak dashboard
const myProfileUsingToken = catchAsyncError(async (req, res) => {
  const result = await userServices.singleUserFromDB(req.userId);

  res.status(201).json({
    success: true,
    message: "Single user get  successfully",
    data: {
      result,
    },
  });
});

// get total signup user in a dateRange or current Month
const getSignUpUserNumber = catchAsyncError(async (req, res) => {
  const range = {
    firstDate: req.query.startDate,
    secondDate: req.query.endDate,
  };
  const result = await userServices.totalSignUpFromDB(range);

  res.status(201).json({
    success: true,
    message: " SignUp user data get successfully",
    data: {
      result,
    },
  });
});

const addNewField = catchAsyncError(async (req, res) => {
  const addNewField = await UserModel.updateMany(
    {},
    { $set: { device: "web" } },
    { new: true }
  );

  res.status(201).json({
    success: true,
    message: " SignUp user data get successfully",
    data: {
      addNewField,
    },
  });
});

//  get signup user for DOD in Management Dashboard
// get signup user using specific date,hour
const getSignUpUserForDate = catchAsyncError(async (req, res) => {
  // console.log(req.query.startDate);
  // console.log(req.query.endDate);
  const result = await userServices.signUpFromDBUsingDate({
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });

  res.status(201).json({
    success: true,
    message: "hourly SignUp user data get successfully",
    data: result,
  });
});

const loggedInUser = catchAsyncError(async (req, res) => {
  const result = await userServices.loggedInUserFromDB(req.user._id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "LoggedIn  user",
    data: {
      result,
    },
  });
});

// Update User Profile using mongo id
const updateUserProfile = catchAsyncError(async (req, res) => {
  const updateData = req.body;
  // console.log("User profile in controller :", req.uploadedImageUrl);
  req.body.icon = { link: req.uploadedImageUrl };
  const result = await userServices.updateUserProfileIntoDB(
    req.userId,
    updateData
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User profile updated successfully",
    data: result,
  });
});

// const updateUserProfile = catchAsyncError(async (req, res) => {
//   const result = await vendorProfileServices.updateUserProfileIntoDB(
//     req.params.phone,
//     req.body
//   );

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "User profile updated successfully",
//     data: { result },
//   });
// });

// logout
const logout = catchAsyncError(async (req, res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logged out successfully",
  });
});
const userController = {
  checkUserExistusingPhone,
  loginUserUsingPhoneAndPassword,
  updateUserProfile,
  otpVarificationForRegi,
  createUser,
  forgotPassOtpSend,
  resetPasswordOtpVarification,
  setNewPasswordAndLogin,
  getSignUpUserForHourly,
  getSignUpUserNumber,
  isSingleExistUser,
  allUserReportForDashboard,
  myProfileUsingToken,
  getSignUpUserForDate,
  sendSignUpInitOTP,
  resendSignUpInitOTP,
  refreshToken,
  updateUser,
  logout,
};
module.exports = userController;
