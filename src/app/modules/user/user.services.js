/* eslint-disable node/no-unsupported-features/es-syntax */
const httpStatus = require("http-status");
const bcrypt = require("bcrypt");
const moment = require("moment");
const { paginationHelpers } = require("../../../Helper/paginationHelper");
const { filteringHelper } = require("../../../Helper/filteringHelper");
const userConstant = require("./user.constant");
const { sortingHelper } = require("../../../Helper/sortingHelper");
const { default: mongoose } = require("mongoose");
const JoiUserValidationSchema = require("./user.validation");
const otpServices = require("../otp/otp.services");
const getTimeDifference = require("../../../utility/getTimeDifference");
const jwtHandle = require("../../../shared/createToken");
const config = require("../../../config/config");
const ErrorHandler = require("../../../ErrorHandler/errorHandler");

const UserModel = require("./user.model");
const PendingUserModel = require("../PendingUser/PendingUser.model");
const { v4: uuidv4 } = require("uuid");
const ResetPasswordSession = require("../ResetPasswordSession/ResetPasswordSession.model");
const jwt = require("jsonwebtoken");
const calculateTrend = require("../../../Helper/calculateTrends");

const sendSignUpInitOTP = async (payload) => {
  const { phone, email, password, terms } = payload;
  //want to check is exist both with phone and email
  // const isExist = await UserModel.findOne({ phone });
  const phoneUser = await UserModel.findOne({ phone });
  if (phoneUser) {
    throw new ErrorHandler(
      "Account with this Phone Number is Already Exist!",
      httpStatus.CONFLICT,
    );
  }

  if (email) {
    const emailUser = await UserModel.findOne({ email });
    if (emailUser) {
      throw new ErrorHandler(
        "Account with this Email is Already Exist!",
        httpStatus.CONFLICT,
      );
    }
  }

  const isExistPendingUser = await PendingUserModel.findOne({ phone });
  const passwordHash = await bcrypt.hash(password, 10);
  const code = await uuidv4();
  let sendOTP;
  let prevSend = false;
  let time;
  let otpSendResult, prevOTP;
  const otpType = "signup";
  const requestPayload = {
    userNumber: phone,
    otpType,
    // otpMassage: `This OTP is valid for 5 minutes.`,
  };

  // checking payload validation
  const { error, value } =
    JoiUserValidationSchema.phoneOTPVarificationSchema.validate(requestPayload);

  if (error) {
    throw new ErrorHandler(
      error || "something went Wrong",
      httpStatus.BAD_REQUEST,
    );
  } else if (value) {
    //logging the value
    console.log("value :");
    // checking previous OTP
    prevOTP = await otpServices.lastOTPFromDB({
      phone: phone,
      type: otpType,
    });

    // if no previous OTP then create new OTP
    if (!prevOTP) {
      otpSendResult = await otpServices.createOTPIntoDB(requestPayload);
    }
  }

  if (otpSendResult) {
    sendOTP = true;
    let { differenceMs } = getTimeDifference(otpSendResult.validateTime);
    time = differenceMs;
    if (!isExistPendingUser) {
      const pendingUser = new PendingUserModel({
        phone,
        email,
        passwordHash,
        sessionId: code,
        terms,
      });
      await pendingUser.save();
    } else {
      isExistPendingUser.sessionId = code;
      isExistPendingUser.email = email;
      isExistPendingUser.passwordHash = passwordHash;
      isExistPendingUser.phone = phone;
      isExistPendingUser.terms = terms;
      await isExistPendingUser.save();
    }
  } else if (prevOTP) {
    prevSend = true;
    sendOTP = true;
    let { differenceMs } = getTimeDifference(prevOTP.validateTime);
    time = differenceMs;
    isExistPendingUser.sessionId = code;
    isExistPendingUser.email = email;
    isExistPendingUser.passwordHash = passwordHash;
    isExistPendingUser.phone = phone;
    isExistPendingUser.terms = terms;
    await isExistPendingUser.save();
  }

  return {
    sendOTP,
    prevSend,
    time,
    sessionId: code,
  };
};

const resendSignUpInitOTP = async (sessionId) => {
  if (!sessionId) {
    throw new ErrorHandler(
      "Internal Server Error!",
      httpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  const isExistSession = await PendingUserModel.findOne({ sessionId });
  if (!isExistSession) {
    throw new ErrorHandler(
      "Internal Server Error!",
      httpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  const { phone } = isExistSession;
  let sendOTP;
  let prevSend = false;
  let time;
  let otpSendResult, prevOTP;
  const otpType = "signup";
  const requestPayload = {
    userNumber: phone,
    otpType,
    otpMassage: "",
  };

  // checking payload validation
  const { error, value } =
    JoiUserValidationSchema.phoneOTPVarificationSchema.validate(requestPayload);

  if (error) {
    throw new ErrorHandler(
      error || "something went Wrong",
      httpStatus.BAD_REQUEST,
    );
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
    sendOTP = true;
    let { differenceMs } = getTimeDifference(prevOTP.validateTime);
    time = differenceMs;
  }

  return {
    sendOTP,
    prevSend,
    time,
    sessionId,
  };
};

const otpVerificationAndCreateUser = async (payload) => {
  const { otpCode, sessionId } = payload;
  // console.log(otpCode);
  let validation = false;
  let accessToken, refreshToken;
  let userData;

  const pendingUser = await PendingUserModel.findOne({ sessionId });
  if (!pendingUser) {
    throw new ErrorHandler("Failed to verify OTP", httpStatus.BAD_REQUEST);
  }
  // let user;
  const result = await otpServices.recentOTPFromDB({ otpCode });
  if (result) {
    validation = true;
    const newUserData = new UserModel({
      phone: pendingUser.phone,
      email: pendingUser.email,
      password: pendingUser.passwordHash,
      phoneVerify: true,
    });
    userData = await newUserData.save();
    await PendingUserModel.deleteOne({ sessionId });

    accessToken = await jwtHandle(
      { _id: userData?._id },
      config.jwt_key,
      config.jwt_token_expire,
    );
    refreshToken = await jwtHandle(
      { _id: userData?._id },
      config.jwt_refresh_key,
      config.jwt_refresh_token_expire,
    );
  }

  return {
    success: true,
    message: `OTP verification successful!`,
    validation,
    verifiedPhoneNumber: result?.userNumber,
    user: {
      phone: userData?.phone,
      email: userData?.email,
      name: userData?.name,
      badge: userData?.badge,
      role: userData?.role,
      accessToken,
      refreshToken,
    },
  };
};

// login user using passwordand phone
const loginUserInToDB = async (payload) => {
  const { phone, password } = payload;

  const isExistUser = await UserModel.findOne({
    phone,
  });

  // console.log("isExist user in login: ", isExistUser);

  if (!isExistUser) {
    throw new ErrorHandler("User does not exist", httpStatus.NOT_FOUND);
  }

  const {
    _id,
    phone: existUserPhone,

    password: existUserPassword,
  } = isExistUser;

  const isValidPassword = await bcrypt.compare(password, existUserPassword);

  if (!isValidPassword) {
    throw new ErrorHandler("Wrong Credentials!", httpStatus.BAD_REQUEST);
  }

  const accessToken = await jwtHandle(
    { _id: _id },
    config.jwt_key,
    config.jwt_token_expire,
  );
  const refreshToken = await jwtHandle(
    { _id: _id },
    config.jwt_refresh_key,
    config.jwt_refresh_token_expire,
  );
  //did this for not getting user image to set in navbar

  // console.log("combined data:: ", combinedUserData);

  return {
    userData: {
      phone: isExistUser?.phone,
      email: isExistUser?.email,
      name: isExistUser?.name,
      badge: isExistUser?.badge,
      role: isExistUser?.role,
      image: isExistUser?.image,
    },
    accessToken,
    refreshToken,
  };
};

// after otp varification's varified user profile status update
const updateUserPassword = async (payload) => {
  const { password, confirmPassword, sessionId } = payload;
  if (password !== confirmPassword) {
    throw new ErrorHandler(
      "Password and confirm password do not match",
      httpStatus.BAD_REQUEST,
    );
  }

  const checkSession = await ResetPasswordSession.findOne({ sessionId });
  if (!checkSession) {
    throw new ErrorHandler("Session Expired!", httpStatus.BAD_REQUEST);
  }
  const { phone, userId: checkUserId } = checkSession;

  const hashPassword = await bcrypt.hash(password, 10);
  const result = await UserModel.findOneAndUpdate(
    { phone: phone },
    { $set: { password: hashPassword } },
    { new: true },
  );

  if (!result) {
    throw new ErrorHandler(
      "Failed to update user password",
      httpStatus.BAD_REQUEST,
    );
  }
  // let access_token, refresh_token;

  // // const candidateProfileData = await CandidateProfileModel.findOne({
  // //   candidateId: result?._id,
  // // });

  // if (result) {
  //   access_token = await jwtHandle(
  //     { _id: result._id, phone: result.phone },
  //     config.jwt_key,
  //     config.jwt_token_expire
  //   );
  //   refresh_token = await jwtHandle(
  //     { _id: result._id, phone: result.phone },
  //     config.jwt_refresh_key,
  //     config.jwt_refresh_token_expire
  //   );
  // }

  // const combinedUserData = {
  //   ...result.toObject(),
  //   // candidateProfileInfo: candidateProfileData || null,
  // };

  return {
    // user: combinedUserData,
    // access_token,
    // refresh_token,
    success: true,
    message: "Password updated successfully",
  };
};

const refreshTokenFromDB = async (token) => {
  try {
    const decoded = jwt.verify(token, config.jwt_refresh_key);

    const { userId } = decoded;

    const isUserExist = await UserModel.findById(userId);

    if (!isUserExist) {
      throw new ErrorHandler("User does not exist", httpStatus.NOT_FOUND);
    }

    const accessToken = await jwtHandle(
      { _id: isUserExist?._id },
      config.jwt_key,
      config.jwt_token_expire,
    );

    return {
      accessToken,
    };
  } catch (error) {
    throw new ErrorHandler("Invalid Refresh Token", httpStatus.FORBIDDEN);
  }
};

const updateUserIntoDB = async (userId, payload) => {
  const isUserExist = await UserModel.findById(userId);
  if (!isUserExist) {
    throw new ErrorHandler("User not found", httpStatus.NOT_FOUND);
  }

  if (payload.email) {
    const existingEmail = await UserModel.findOne({
      email: payload.email,
      _id: { $ne: userId },
    });
    if (existingEmail) {
      throw new ErrorHandler("Email already exists", httpStatus.CONFLICT);
    }
  }

  const result = await UserModel.findByIdAndUpdate(userId, payload, {
    new: true,
  });
  const updatedUser = {
    phone: result?.phone,
    email: result?.email,
    name: result?.name,
    image: result?.image,
    badge: result?.badge,
    role: result?.role,
    userStatus: result?.userStatus,
  };

  return updatedUser;
};

const verifyRefreshTokenFromDB = async (token) => {
  try {
    if (!token) {
      throw new ErrorHandler(
        "Refresh Token is required",
        httpStatus.BAD_REQUEST,
      );
    }
    const decoded = jwt.verify(token, config.jwt_refresh_key);
    const { userId } = decoded;
    const isUserExist = await UserModel.findById(userId);
    if (!isUserExist) {
      throw new ErrorHandler("User does not exist", httpStatus.NOT_FOUND);
    }
    return {
      isExist: true,
      name: isUserExist?.name,
      role: isUserExist?.role,
      phone: isUserExist?.phone,
    };
  } catch (error) {
    throw new ErrorHandler("Invalid Refresh Token", httpStatus.FORBIDDEN);
  }
};

const getAdminAndSubAdminFromDB = async () => {
  const admins = await UserModel.find({ role: { $in: ["admin", "subAdmin"] } });
  // console.log("admins: ", admins);
  if (!admins) {
    throw new ErrorHandler(
      "No admins or subadmins found",
      httpStatus.NOT_FOUND,
    );
  }
  const adminsData = admins.map((admin) => {
    return {
      id: admin?._id,
      name: admin?.name,
      // phone: admin?.phone,
      // email: admin?.email,
      // role: admin?.role,
      image: admin?.image,
    };
  });
  return adminsData;
};

const getUserUsingPhoneFromDB = async (phone) => {
  const isExist = await UserModel.findOne({ phone: phone });

  if (isExist) {
    throw new ErrorHandler(
      `${isExist.phone} This Phone Number is Exist! please use another!`,
      httpStatus.CONFLICT,
    );
  }

  let sendOTP;
  let prevSend = false;
  let time;

  const otpType = "registation_number_varification";
  let requestPayload = {
    userNumber: phone,
    otpType,
    otpMassage:
      "Your One Time Password For Signup or Login .This OTP is valid for 5 minutes. Talently ltd",
  };
  let otpSendResult, prevOTP;
  sendOTP = false;

  //? check validation for create otp for loginRegistation phone number varified
  const { error, value } =
    JoiUserValidationSchema.phoneOTPVarificationSchema.validate(requestPayload);

  if (error) {
    throw new ErrorHandler(
      `${error}` || "something went Wrong",
      httpStatus[400],
    );
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
  return {
    phone,
    sendOTP,
    prevSend,
    time,
  };
};

const isSingleExistUserFromDB = async (phone) => {
  // console.log("phone: ", phone);
  const isExist = await UserModel.findOne({ phone: phone });

  if (!isExist) {
    throw new ErrorHandler(`${phone} was not found!`, httpStatus.NOT_FOUND);
  }

  return {
    isExist,
  };
};

// after otp varification's create and update user
const createUserIntoDB = async (payload) => {
  const { verifiedphone: phone, email } = payload || {};

  const isExist = await UserModel.findOne({ phone, email });
  // console.log("isExist: ", isExist);
  if (isExist) {
    // console.log("first");
    throw new ErrorHandler(
      `${isExist.phone} and ${isExist.email}   is Exist! please use another!`,
      httpStatus.CONFLICT,
    );
  }
  const hashPassword = await bcrypt.hash(payload.password, 10);
  payload.password = hashPassword;

  payload.phoneVerify = true;

  payload.phone = phone;
  const newUser = new UserModel(payload);
  const userData = await newUser.save();

  // console.log("user data from create user service ...:", userData);
  let accessToken, refreshToken;
  if (userData) {
    accessToken = await jwtHandle(
      { _id: userData?._id, phone: userData?.phone },
      config.jwt_key,
      config.jwt_token_expire,
    );

    refreshToken = await jwtHandle(
      { _id: userData?._id, phone: userData?.phone },
      config.jwt_refresh_key,
      config.jwt_refresh_token_expire,
    );
  }
  // console.log(refreshToken);
  // console.log(accessToken);
  return { userData, accessToken, refreshToken };
};

const getUserHourlyFromDB = async () => {
  const date = "2023-12-21";
  const startHour = "3:20 pm";
  const endHour = "4:30 pm";
  // Combine date and startHour/endHour to create moment objects
  const startDate = moment(`${date} ${startHour}`, "YYYY-MM-DD hh:mm a");
  const endDate = moment(`${date} ${endHour}`, "YYYY-MM-DD hh:mm a");

  let startOfTime = startDate.toDate();
  let endOfTime = endDate.toDate();

  const result = await UserModel.aggregate([
    { $match: { createdAt: { $gte: startOfTime, $lte: endOfTime } } },
    {
      $project: {
        fullname: 1,
        phone: 1,
        email: 1,
      },
    },
  ]);
  return result;
};

// user details for management dashboard
// const userReportFromDB = async (req, filters, paginationOptions) => {
//   const { searchTerm, ...filtersData } = filters;
//   const { page, limit, skip, sortBy, sortOrder } =
//     paginationHelpers.calculatePagination(paginationOptions);
//   const query = req.query;
//   const pipeline = [];
//   const totalPipeline = [{ $count: "count" }];
//   let matchAnd = [];

//   // ? Dynamic filtering added
//   const dynamicFilter = filteringHelper.getDynamicQueryFields(filtersData);

//   // get date from query
//   const { startOfDay } = startOfDayEndOfDay(query.startOfDay);
//   const { endOfDay } = startOfDayEndOfDay(query.endOfDay);

//   const { startOfMonth, endOfMonth } = getMonth();

//   //?Dynamic search added
//   const dynamicSearchQuery = searchHelper.createSearchQuery(
//     searchTerm,
//     userConstant.userSearchableFields
//   );

//   if (Object.keys(dynamicSearchQuery).length > 0) {
//     // matchAnd = [];

//     matchAnd.push(dynamicSearchQuery);
//   } else if (query.startOfDay && query.endOfDay) {
//     matchAnd.push({ createdAt: { $gte: startOfDay, $lte: endOfDay } });
//   } else {
//     matchAnd.push({ createdAt: { $gte: startOfMonth, $lte: endOfMonth } });
//   }

//   if (dynamicFilter && dynamicFilter.length !== 0) {
//     dynamicFilter.forEach((element) => {
//       matchAnd.push(element);
//     });
//   }

//   // Dynamic $lookup for user
//   let joinQueryForOrderDetails = {
//     $lookup: {
//       from: "clientorders",
//       localField: "email",
//       foreignField: "userEmail",
//       as: "orderDetails",
//     },
//   };

//   pipeline.push(
//     joinQueryForOrderDetails,
//     { $unwind: "$orderDetails" },
//     {
//       $group: {
//         _id: "$_id",
//         userDetails: { $first: "$$ROOT" },

//         totalPurchaseAmount: { $sum: "$orderDetails.totalAmount" },
//         TotalOrders: { $sum: 1 },
//       },
//     },
//     {
//       $project: {
//         _id: "$userDetails._id",
//         fullname: "$userDetails.fullname",
//         phone: "$userDetails.phone",
//         email: "$userDetails.email",
//         paymentMethod: "$userDetails.paymentMethod",
//         bkashno: "$userDetails.bkashno",
//         nagadno: "$userDetails.nagadno",
//         accountnumber: "$userDetails.accountnumber",
//         accountname: "$userDetails.accountname",
//         bankname: "$userDetails.bankname",
//         branchname: "$userDetails.branchname",
//         districtname: "$userDetails.districtname",
//         userStatus: "$userDetails.userStatus",
//         createdAt: "$userDetails.createdAt",
//         address: "$userDetails.address",
//         routingno: "$userDetails.routingno",
//         TotalOrders: 1,
//         totalPurchaseAmount: 1,
//       },
//     }
//   );
//   const dynamicSorting = sortingHelper.createDynamicSorting(sortBy, sortOrder);

//   if (dynamicSorting) {
//     pipeline.push({
//       $sort: dynamicSorting,
//     });
//   }
//   if (skip) {
//     pipeline.push({ $skip: skip });
//   }

//   if (limit) {
//     pipeline.push({ $limit: limit });
//   }

//   // sorting

//   // if join projection and otherneeded for before match ar unshift then write here

//   if (matchAnd.length) {
//     pipeline.unshift({
//       $match: { $and: matchAnd },
//     });
//     totalPipeline.unshift({
//       $match: { $and: matchAnd },
//     });
//   }

//   const result = await UserModel.aggregate(pipeline);
//   const total = await UserModel.aggregate(totalPipeline);

//   return {
//     meta: {
//       page,
//       limit,
//       total: total[0]?.count,
//     },
//     data: result,
//   };
// };
const loggedInUserFromDB = async (userID) => {
  const user = await UserModel.findById(userID);
  if (!user) {
    throw new ErrorHandler("User not found", httpStatus.NOT_FOUND);
  }
  return user;
};

const userReportFromDB = async (req, filters, paginationOptions) => {
  const { searchTerm, ...filtersData } = filters;
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(paginationOptions);
  const query = req.query;
  const pipeline = [];
  const totalPipeline = [];
  let matchAnd = [];

  // Dynamic filtering added
  const dynamicFilter = filteringHelper.getDynamicQueryFields(filtersData);

  // Get date from query
  const { startOfDay } = startOfDayEndOfDay(query.startOfDay);
  const { endOfDay } = startOfDayEndOfDay(query.endOfDay);

  const { startOfMonth, endOfMonth } = getMonth();

  // Dynamic search added
  const dynamicSearchQuery = searchHelper.createSearchQuery(
    searchTerm,
    userConstant.userSearchableFields,
  );
  if (Object.keys(dynamicSearchQuery).length > 0) {
    matchAnd.push(dynamicSearchQuery);
  } else if (query.startOfDay && query.endOfDay) {
    matchAnd.push({ createdAt: { $gte: startOfDay, $lte: endOfDay } });
  } else {
    matchAnd.push({ createdAt: { $gte: startOfMonth, $lte: endOfMonth } });
  }

  if (dynamicFilter && dynamicFilter.length !== 0) {
    dynamicFilter.forEach((element) => {
      matchAnd.push(element);
    });
  }

  // Dynamic $lookup for user with left outer join
  let joinQueryForOrderDetails = {
    $lookup: {
      from: "clientorders",
      localField: "email",
      foreignField: "userEmail",
      as: "orderDetails",
    },
  };
  pipeline.push(
    joinQueryForOrderDetails,
    {
      $project: {
        userDetails: "$$ROOT",
        orderDetails: {
          $cond: {
            if: { $isArray: "$orderDetails" },
            then: "$orderDetails",
            else: [],
          },
        },
      },
    },
    {
      $group: {
        _id: "$_id",
        userDetails: { $first: "$userDetails" },
        totalPurchaseAmount: {
          $sum: {
            $cond: {
              if: { $gt: [{ $size: "$orderDetails" }, 0] },
              then: {
                $reduce: {
                  input: "$orderDetails",
                  initialValue: 0,
                  in: { $add: ["$$value", "$$this.totalAmount"] },
                },
              },
              else: 0,
            },
          },
        },
        TotalOrders: {
          $sum: {
            $cond: {
              if: { $gt: [{ $size: "$orderDetails" }, 0] },
              then: { $size: "$orderDetails" },
              else: 0,
            },
          },
        },
      },
    },
    {
      $project: {
        _id: "$userDetails._id",
        fullname: "$userDetails.fullname",
        phone: "$userDetails.phone",
        email: "$userDetails.email",
        paymentMethod: "$userDetails.paymentMethod",
        bkashno: "$userDetails.bkashno",
        nagadno: "$userDetails.nagadno",
        accountnumber: "$userDetails.accountnumber",
        accountname: "$userDetails.accountname",
        bankname: "$userDetails.bankname",
        branchname: "$userDetails.branchname",
        districtname: "$userDetails.districtname",
        userStatus: "$userDetails.userStatus",
        createdAt: "$userDetails.createdAt",
        address: "$userDetails.address",
        routingno: "$userDetails.routingno",
        TotalOrders: 1,
        totalPurchaseAmount: 1,
      },
    },
  );
  totalPipeline.push(
    joinQueryForOrderDetails,
    {
      $project: {
        userDetails: "$$ROOT",
        orderDetails: {
          $cond: {
            if: { $isArray: "$orderDetails" },
            then: "$orderDetails",
            else: [],
          },
        },
      },
    },
    {
      $group: {
        _id: "$_id",
        userDetails: { $first: "$userDetails" },
        totalPurchaseAmount: {
          $sum: {
            $cond: {
              if: { $gt: [{ $size: "$orderDetails" }, 0] },
              then: "$orderDetails.totalAmount",
              else: 0,
            },
          },
        },
        TotalOrders: {
          $sum: {
            $cond: {
              if: { $gt: [{ $size: "$orderDetails" }, 0] },
              then: { $size: "$orderDetails" },
              else: 0,
            },
          },
        },
      },
    },
    {
      $project: {
        _id: "$userDetails._id",
        fullname: "$userDetails.fullname",
        phone: "$userDetails.phone",
        email: "$userDetails.email",
        paymentMethod: "$userDetails.paymentMethod",
        bkashno: "$userDetails.bkashno",
        nagadno: "$userDetails.nagadno",
        accountnumber: "$userDetails.accountnumber",
        accountname: "$userDetails.accountname",
        bankname: "$userDetails.bankname",
        branchname: "$userDetails.branchname",
        districtname: "$userDetails.districtname",
        userStatus: "$userDetails.userStatus",
        createdAt: "$userDetails.createdAt",
        address: "$userDetails.address",
        routingno: "$userDetails.routingno",
        TotalOrders: 1,
        totalPurchaseAmount: 1,
      },
    },
    { $count: "count" },
  );

  const dynamicSorting = sortingHelper.createDynamicSorting(sortBy, sortOrder);
  if (dynamicSorting) {
    pipeline.push({
      $sort: dynamicSorting,
    });
  }
  if (skip) {
    pipeline.push({ $skip: skip });
  }

  if (limit) {
    pipeline.push({ $limit: limit });
  }

  if (matchAnd.length) {
    pipeline.unshift({
      $match: { $and: matchAnd },
    });
    totalPipeline.unshift({
      $match: { $and: matchAnd },
    });
  }

  // ... (remaining pipeline stages)
  const result = await UserModel.aggregate(pipeline);
  const total = await UserModel.aggregate(totalPipeline);

  return {
    meta: {
      page,
      limit,
      total: total[0]?.count,
    },
    data: result,
  };
};

// single user details from database
const singleUserFromDB = async (id) => {
  let pipeline = [];
  const object = new mongoose.Types.ObjectId(id);

  pipeline.push({
    $lookup: {
      from: "candidateprofiles", // Collection name for candidate profiles
      localField: "_id",
      foreignField: "candidateId",
      as: "candidateProfileInfo",
    },
  });

  pipeline.push({
    $unwind: {
      path: "$candidateProfileInfo",
      preserveNullAndEmptyArrays: true, // Keeps users without a candidateProfile
    },
  });

  if (object) {
    pipeline.unshift({
      $match: { _id: object },
    });
  }

  const result = await UserModel.aggregate(pipeline);
  // const result = await UserModel.findById(id);

  return {
    data: result,
  };
};

//  total signUp user number for analytics
const totalSignUpFromDB = async ({ startDate, endDate }, deviceLog) => {
  // Get date from query

  // console.log("startDate:", startDate);
  // console.log("endDate:", endDate);
  let matchAnd = [];
  if (startDate && endDate) {
    matchAnd.push({ createdAt: { $gte: startDate, $lte: endDate } });
  }
  if (deviceLog) {
    matchAnd.push({
      $and: [{ device: { $exists: true } }, { device: deviceLog }],
    });
    // matchConditions.push({
    //   device: "app",
    // });
  }
  let pipeline = [{ $count: "count" }];
  if (matchAnd?.length) {
    pipeline.unshift({ $match: { $and: matchAnd } });
  }
  // console.log("matchAnd:", matchAnd);
  const result = await UserModel.aggregate(pipeline);

  // console.log(result);
  return {
    total: result[0]?.count,
  };
};

// used user profile data and rusume data
const updateUserProfileIntoDB = async (userId, payload) => {
  // Start a MongoDB session for transaction
  const session = await mongoose.startSession();
  // console.log("Session started for transaction.");

  try {
    session.startTransaction();

    // Verify user exists
    const existingUser = await UserModel.findById(userId).session(session);

    if (!existingUser) {
      throw new ErrorHandler("User not found", httpStatus.NOT_FOUND);
    }
    const existingProfile = await CandidateProfileModel.findOne({
      candidateId: userId,
    }).session(session);
    // Separate user and candidate profile fields
    const userFields = {};
    const candidateProfileFields = {};
    // console.log("Payload received:", payload);

    // Extract user fields (firstname, lastname, email)
    const userFieldsList = ["firstname", "lastname", "email"];
    userFieldsList.forEach((field) => {
      if (payload[field] !== undefined) {
        userFields[field] = payload[field];
      }
    });

    // Define mapping for personalDetails fields to candidateProfile fields
    const personalDetailsMapping = {
      phone: "phone",
      category: "category",
      languages: "languages",
      nationality: "nationality",
      passport_number: "passportNumber",
      linkedin: "linkedIn",
      github: "github",
      portfolio: "portfolio",
      phone_number: "phoneNumber",
      email: "alternateEmail",
      address: "permanentAddress",
      gender: "gender",
      differently_abled: "differently_abled",
      profile_summary: "profileSummary",
      career_objective: "careerObjective",
      salary: "salary",
      job_type_looking_for: "jobTypeLookingFor",
      availability: "availability",
      blood_group: "bloodGroup",
      marital_status: "maritalStatus",
      workSchedulePreference: "workSchedulePreference",
      religion: "religion",
      experience: "experience",
      location: "location",
      nid: "nid",
    };

    // First, map fields directly from payload that aren't in personalDetails
    Object.keys(payload).forEach((key) => {
      if (!userFieldsList.includes(key) && key !== "personalDetails") {
        // Use mapping if available, otherwise use the key as is
        const mappedKey = personalDetailsMapping[key] || key;
        candidateProfileFields[mappedKey] = payload[key];
      }
    });

    // Then, if personalDetails exists, map those fields
    if (payload.personalDetails) {
      Object.entries(payload.personalDetails).forEach(([key, value]) => {
        if (personalDetailsMapping[key]) {
          candidateProfileFields[personalDetailsMapping[key]] = value;
        } else {
          // For any unmapped fields, store them as is
          candidateProfileFields[key] = value;
        }
      });
    }

    // Handle arrays and objects
    const arrayFields = [
      "skills",
      "preferredJobCategories",
      "extracurricularActivities",
      "savedCompany",
      "savedJobs",
      "workExperiences",
      "projects",
      "education",
      "certifications",
    ];

    arrayFields.forEach((field) => {
      if (payload[field]) {
        candidateProfileFields[field] = Array.isArray(payload[field])
          ? payload[field]
          : [payload[field]];
      }
    });

    // Handle resume deletion
    if (payload.deleteResume) {
      if (existingProfile?.resumeLink) {
        // await deleteResumeFromDrive(existingProfile.resumeLink);
        await resumeDeleteMiddleware(existingProfile?.resumeLink);
        candidateProfileFields.resumeLink = null;
      }
    }
    // Handle new resume upload
    else if (payload.resumeLink) {
      if (existingProfile?.resumeLink) {
        // await deleteResumeFromDrive(existingProfile.resumeLink);
        await resumeDeleteMiddleware(existingProfile?.resumeLink);
      }
      candidateProfileFields.resumeLink = payload.resumeLink;
    }

    if (payload.icon && payload.icon.link) {
      candidateProfileFields.userImage = payload.icon.link;
    }

    // Calculate profile completion score
    const calculateProfileComplete = (existingProfile = {}, payload = {}) => {
      // Define section weights
      const weights = {
        personalDetails: 5,
        profileSummary: 10,
        skills: 15,
        workExperiences: 25,
        projects: 20,
        education: 15,
        certifications: 3,
        extracurricularActivities: 2,
      };

      const baseScore = 5;
      let score = baseScore;

      const currentProfile = {
        ...existingProfile,
        ...payload,
      };

      const isEmptyField = (field) => {
        if (field === undefined || field === null) return true;
        if (Array.isArray(field)) return field.length === 0;
        if (typeof field === "string") return field.trim() === "";
        if (typeof field === "object") return Object.keys(field).length === 0;
        return false;
      };

      const calculateSectionScore = (key, value) => {
        let sectionScore = 0;
        // console.log(`\nCalculating score for ${key}:`);
        // console.log("Value:", JSON.stringify(value, null, 2));

        switch (key) {
          case "personalDetails":
            const personalFields = [
              "gender",
              "languages",
              "location",
              "permanentAddress",
              "nationality",
              "alternateEmail",
              "bloodGroup",
              "maritalStatus",
            ];

            const filledFields = personalFields.filter(
              (field) => !isEmptyField(currentProfile[field]),
            ).length;

            if (filledFields > 0) {
              sectionScore = Math.max(
                weights[key] / 2,
                Math.min(
                  weights[key] * (filledFields / personalFields.length),
                  weights[key],
                ),
              );
            }
            break;

          case "profileSummary":
            sectionScore = !isEmptyField(value) ? weights[key] : 0;
            break;

          case "skills":
            if (Array.isArray(value) && value.length > 0) {
              const skillCount = value.filter(
                (skill) => !isEmptyField(skill),
              ).length;
              const minSkillsForFullScore = 3;
              sectionScore = Math.min(
                weights[key] * (skillCount / minSkillsForFullScore),
                weights[key],
              );
            }
            break;

          case "workExperiences":
            if (Array.isArray(value)) {
              const validExperiences = value.filter(
                (exp) => exp?.title && (exp?.description || exp?.company),
              );

              // Modified scoring for work experiences
              if (validExperiences.length === 1) {
                // Half score for 1 experience
                sectionScore = weights[key] / 2;
              } else if (validExperiences.length >= 2) {
                // Full score for 2 or more experiences
                sectionScore = weights[key];
              }
            }
            break;

          case "projects":
            if (Array.isArray(value)) {
              const validProjects = value.filter(
                (proj) =>
                  (proj?.title || proj?.project_title || proj?.project_name) &&
                  (proj?.description || proj?.github_url || proj?.project_url),
              );

              // Modified scoring for projects
              if (validProjects.length === 1) {
                // Half score for 1 project
                sectionScore = weights[key] / 2;
              } else if (validProjects.length >= 2) {
                // Full score for 2 or more projects
                sectionScore = weights[key];
              }
            }
            break;

          case "education":
            if (Array.isArray(value)) {
              const validEducation = value.filter(
                (edu) => edu?.institution || edu?.degree || edu?.field,
              );
              sectionScore = validEducation.length > 0 ? weights[key] : 0;
            }
            break;

          case "certifications":
            if (Array.isArray(value)) {
              const validCerts = value.filter(
                (cert) => cert?.name || cert?.issuer || cert?.issueDate,
              );
              sectionScore = validCerts.length > 0 ? weights[key] : 0;
            }
            break;

          case "extracurricularActivities":
            if (Array.isArray(value)) {
              const validActivities = value.filter(
                (activity) =>
                  activity?.name || activity?.description || activity?.title,
              );
              sectionScore = validActivities.length > 0 ? weights[key] : 0;
            }
            break;
        }

        // console.log(`${key} score: ${sectionScore}`);
        return sectionScore;
      };

      Object.keys(weights).forEach((key) => {
        const sectionScore = calculateSectionScore(key, currentProfile[key]);
        score += sectionScore;
        // console.log(`Running total after ${key}: ${score}`);
      });

      const finalScore = Math.min(Math.max(score, baseScore), 100);
      // console.log(`Final profile completion score: ${finalScore}`);

      return finalScore;
    };

    // Update profile completion score if needed
    if (Object.keys(candidateProfileFields).length > 0) {
      const relevantFields = [
        "profileSummary",
        "skills",
        "workExperiences",
        "projects",
        "education",
        "certifications",
        "extracurricularActivities",
      ];

      const isUpdatingRelevantFields = Object.keys(candidateProfileFields).some(
        (key) => relevantFields.includes(key),
      );

      if (isUpdatingRelevantFields || !existingProfile) {
        const existingData = existingProfile?.toObject
          ? existingProfile.toObject()
          : existingProfile || {};
        // console.log("Calculating profile score with:");
        // console.log("Existing data:", JSON.stringify(existingData, null, 2));
        // console.log(
        //   "New data:",
        //   JSON.stringify(candidateProfileFields, null, 2)
        // );

        const profileScore = calculateProfileComplete(
          existingData,
          candidateProfileFields,
        );
        // console.log("Calculated profile score:", profileScore);

        if (profileScore !== undefined) {
          candidateProfileFields.profile_complete = profileScore;
        }
      }
    }

    // main function to update user profile
    let updatedUser = null;
    if (Object.keys(userFields).length > 0) {
      // Check for email uniqueness if email is being updated
      if (userFields.email) {
        const emailExists = await UserModel.findOne({
          email: userFields.email,
          _id: { $ne: userId },
        }).session(session);

        if (emailExists) {
          // console.log("Email already in use:", userFields.email);
          throw new ErrorHandler("Email already in use", httpStatus.CONFLICT);
        }
      }

      // Update user document
      updatedUser = await UserModel.findByIdAndUpdate(
        userId,
        { $set: userFields },
        { new: true, runValidators: true, session },
      );
      // console.log("User document updated:", updatedUser);
    }

    // Handle candidate profile updates
    let updatedProfile = null;
    if (Object.keys(candidateProfileFields).length > 0) {
      // Find existing candidate profile
      const existingProfile = await CandidateProfileModel.findOne({
        candidateId: userId,
      }).session(session);
      // console.log("Existing candidate profile:", existingProfile);

      if (existingProfile) {
        // Update existing profile
        updatedProfile = await CandidateProfileModel.findOneAndUpdate(
          { candidateId: userId },
          { $set: candidateProfileFields },
          { new: true, runValidators: true, session },
        );
        // console.log("Existing profile updated:", updatedProfile);
      } else {
        // Create new profile if it doesn't exist
        const newProfile = new CandidateProfileModel({
          candidateId: userId,
          ...candidateProfileFields,
          isActive: true, // Set default value for new profiles
          cvVersion: 0, // Set default value for new profiles
          cv: "", // Set default value for new profiles
        });
        updatedProfile = await newProfile.save({ session });
      }
    }

    // Commit transaction
    await session.commitTransaction();
    // console.log("Transaction committed successfully.");

    // Return updated data
    return {
      user: updatedUser || existingUser,
      profile: updatedProfile,
    };
  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    console.error("Transaction aborted due to error:", error);
    throw error;
  } finally {
    // End session
    session.endSession();
    // console.log("Session ended.");
  }
};

const signUpFromDBUsingDate = async ({ startDate, endDate }) => {
  let matchAnd = [];
  if (startDate && endDate) {
    const { startOfDay } = startOfDayEndOfDay(startDate);
    const { endOfDay } = startOfDayEndOfDay(endDate);
    matchAnd.push({ createdAt: { $gte: startOfDay, $lte: endOfDay } });
  } else {
    const { startOfMonth, endOfMonth } = getMonth();
    matchAnd.push({ createdAt: { $gte: startOfMonth, $lte: endOfMonth } });
  }
  // if (deviceLog) {
  //   matchAnd.push({
  //     $and: [{ device: { $exists: true } }, { device: deviceLog }],
  //   });
  //   // matchConditions.push({
  //   //   device: "app",
  //   // });
  // }
  let totalPipeline = [{ $count: "count" }];
  let pipeline = [
    {
      $project: {
        email: 1,
        fullname: 1,
        phone: 1,
        tagName: "New User",
        _id: 0,
      },
    },
    {
      $sort: {
        createdAt: 1,
      },
    },
  ];
  if (matchAnd?.length) {
    pipeline.unshift({ $match: { $and: matchAnd } });
  }
  // console.log("matchAnd:", matchAnd);
  const result = await UserModel.aggregate(pipeline);

  // console.log(result.length);
  return result;
};

const totalUserSummaryFromDB = async () => {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59,
    999,
  );

  const [userCounts] = await UserModel.aggregate([
    {
      $facet: {
        total: [{ $count: "count" }],
        currentMonth: [
          { $match: { createdAt: { $gte: currentMonthStart, $lte: now } } },
          { $count: "count" },
        ],
        lastMonth: [
          {
            $match: { createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } },
          },
          { $count: "count" },
        ],
      },
    },
  ]);

  const accountCounts = await UserModel.aggregate([
    { $unwind: "$socialAccounts" },
    {
      $match: {
        "socialAccounts.linked": true,
        "socialAccounts.provider": {
          $in: ["facebook", "youtube", "instagram", "tiktok"],
        },
      },
    },
    {
      $addFields: {
        accountConnectedAt: {
          $ifNull: ["$socialAccounts.connectedAt", "$createdAt"],
        },
      },
    },
    {
      $group: {
        _id: "$socialAccounts.provider",
        total: { $sum: 1 },
        currentMonth: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$accountConnectedAt", currentMonthStart] },
                  { $lte: ["$accountConnectedAt", now] },
                ],
              },
              1,
              0,
            ],
          },
        },
        lastMonth: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$accountConnectedAt", lastMonthStart] },
                  { $lte: ["$accountConnectedAt", lastMonthEnd] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const formatMetric = (total, currentMonth, lastMonth) => ({
    total: total || 0,
    trend: calculateTrend(currentMonth || 0, lastMonth || 0),
  });

  const accountsByProvider = accountCounts.reduce((acc, item) => {
    acc[item._id] = formatMetric(item.total, item.currentMonth, item.lastMonth);
    return acc;
  }, {});

  const totalUser = userCounts?.total?.[0]?.count || 0;
  const currentMonthUsers = userCounts?.currentMonth?.[0]?.count || 0;
  const lastMonthUsers = userCounts?.lastMonth?.[0]?.count || 0;

  return {
    totalUser: formatMetric(totalUser, currentMonthUsers, lastMonthUsers),
    facebook: accountsByProvider.facebook || formatMetric(0, 0, 0),
    youtube: accountsByProvider.youtube || formatMetric(0, 0, 0),
    instagram: accountsByProvider.instagram || formatMetric(0, 0, 0),
    tiktok: accountsByProvider.tiktok || formatMetric(0, 0, 0),
  };
};

const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getUserListForAdminFromDB = async (query, adminId) => {
  const { searchTerm = "", badge = "", page = 1, limit = 10 } = query;

  const pageNumber = Number(page) || 1;
  const limitNumber = Number(limit) || 15;
  const skip = (pageNumber - 1) * limitNumber;

  const match = { _id: { $ne: new mongoose.Types.ObjectId(adminId) } };

  if (searchTerm) {
    const regex = new RegExp(escapeRegex(searchTerm), "i");

    match.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }

  if (badge && badge !== "all") {
    match.badge = badge;
  }

  const [result] = await UserModel.aggregate([
    { $match: match },
    {
      $facet: {
        data: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limitNumber },
          {
            $project: {
              name: 1,
              email: 1,
              phone: 1,
              image: 1,
              badge: 1,
              userStatus: 1,
              createdAt: 1,
              socialAccounts: {
                $map: {
                  input: {
                    $filter: {
                      input: "$socialAccounts",
                      as: "account",
                      cond: { $eq: ["$$account.linked", true] },
                    },
                  },
                  as: "account",
                  in: {
                    provider: "$$account.provider",
                  },
                },
              },
            },
          },
        ],
        meta: [{ $count: "total" }],
      },
    },
  ]);

  return {
    meta: {
      page: pageNumber,
      limit: limitNumber,
      total: result?.meta?.[0]?.total || 0,
    },
    data: result?.data || [],
  };
};

const getSubAdminListFromDB = async (query) => {
  const { searchTerm = "", page = 1, limit = 10 } = query;

  const pageNumber = Number(page) || 1;
  const limitNumber = Number(limit) || 10;
  const skip = (pageNumber - 1) * limitNumber;

  const match = { role: "subAdmin" };

  if (searchTerm) {
    const regex = new RegExp(escapeRegex(searchTerm), "i");
    match.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }

  const [result] = await UserModel.aggregate([
    { $match: match },
    {
      $facet: {
        data: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limitNumber },
          {
            $project: {
              name: 1,
              email: 1,
              phone: 1,
              image: 1,
              role: 1,
              createdAt: 1,
            },
          },
        ],
        meta: [{ $count: "total" }],
      },
    },
  ]);

  return {
    meta: {
      page: pageNumber,
      limit: limitNumber,
      total: result?.meta?.[0]?.total || 0,
    },
    data: result?.data || [],
  };
};

const updateUserBadgeIntoDB = async (userId, badge) => {
  const allowedBadges = ["bronze", "silver", "gold", "diamond"];

  if (!allowedBadges.includes(badge)) {
    throw new ErrorHandler("Invalid badge", httpStatus.BAD_REQUEST);
  }

  const user = await UserModel.findByIdAndUpdate(
    userId,
    { badge },
    { new: true, runValidators: true },
  ).select("name email phone image badge");

  if (!user) {
    throw new ErrorHandler("User not found", httpStatus.NOT_FOUND);
  }

  return user;
};

const assignSubAdminIntoDB = async (userId) => {
  if (!userId) {
    throw new ErrorHandler("User not found!", httpStatus.BAD_REQUEST);
  }
  const user = await UserModel.findById(userId);

  if (!user) {
    throw new ErrorHandler("User not found", httpStatus.NOT_FOUND);
  }
  if (user.role === "admin") {
    throw new ErrorHandler(
      "Admin account cannot be assigned as sub-admin",
      httpStatus.BAD_REQUEST,
    );
  }
  if (user.role === "subAdmin") {
    throw new ErrorHandler(
      "This account is already a sub-admin",
      httpStatus.CONFLICT,
    );
  }
  user.role = "subAdmin";
  await user.save();
  return user;
};

const removeSubAdminIntoDB = async (adminUser, userId) => {
  // assertAdmin(adminUser);
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new ErrorHandler("User not found", httpStatus.NOT_FOUND);
  }
  if (user.role !== "subAdmin") {
    throw new ErrorHandler(
      "This user is not a sub-admin",
      httpStatus.BAD_REQUEST,
    );
  }
  user.role = "user";
  await user.save();
  return user;
};

const userServices = {
  getUserUsingPhoneFromDB,
  updateUserProfileIntoDB,
  loginUserInToDB,
  createUserIntoDB,
  updateUserPassword,
  getUserHourlyFromDB,
  userReportFromDB,
  singleUserFromDB,
  totalSignUpFromDB,
  signUpFromDBUsingDate,
  isSingleExistUserFromDB,
  sendSignUpInitOTP,
  otpVerificationAndCreateUser,
  resendSignUpInitOTP,
  refreshTokenFromDB,
  updateUserIntoDB,
  loggedInUserFromDB,
  getAdminAndSubAdminFromDB,
  verifyRefreshTokenFromDB,
  totalUserSummaryFromDB,
  getUserListForAdminFromDB,
  updateUserBadgeIntoDB,
  getSubAdminListFromDB,
  assignSubAdminIntoDB,
  removeSubAdminIntoDB,
};

module.exports = userServices;
