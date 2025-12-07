const otpGenerator = require("otp-generator");
const httpStatus = require("http-status");
const OtpModel = require("./otp.model");
const ErrorHandler = require("../../../ErrorHandler/errorHandler");

// const createOTPIntoDB = async (payload) => {
//   let otp;
//   let result;
//   // Try to generate unique OTP with a maximum retry limit
//   let attempts = 0;
//   const maxAttempts = 10;

//   do {
//     otp = otpGenerator.generate(4, {
//       upperCaseAlphabets: false,
//       lowerCaseAlphabets: false,
//       specialChars: false,
//     });
//     result = await OtpModel.findOne({
//       otpCode: otp,
//       validateTime: { $gt: new Date() },
//     });
//     attempts++;

//     if (attempts >= maxAttempts) {
//       throw new ErrorHandler(
//         "Internal Server Error!",
//         httpStatus.INTERNAL_SERVER_ERROR
//       );
//     }
//   } while (result);

//   payload.otpCode = otp;
//   console.log("new otp: ", otp);

//   const otpBody = await OtpModel.create(payload);
//   return otpBody;
// };

// recent otp get for varification

const createOTPIntoDB = async (payload) => {
  let otp = otpGenerator.generate(4, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });

  let result = await OtpModel.findOne({ otpCode: otp });

  while (result) {
    otp = otpGenerator.generate(4, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });
    result = await OtpModel.findOne({
      otpCode: otp,
      validateTime: { $gt: new Date() },
    });
  }
  payload.otpCode = otp;
  console.log("new otp: ", otp);

  const otpBody = await OtpModel.create(payload);
  return otpBody;
};

const recentOTPFromDB = async (payload) => {
  const otp = await OtpModel.findOne({
    otpCode: payload?.otpCode,
    otpUseStatus: false,
    validateTime: { $gte: new Date(Date.now() - 5 * 60 * 1000) }, // Check if validateTime is within the last 5 minutes
  });

  if (!otp) {
    throw new ErrorHandler(`Invalid OTP!`, httpStatus.BAD_REQUEST);
  }

  if (otp) {
    // otp useSatus true again
    await OtpModel.findOneAndUpdate(
      { otpCode: payload?.otpCode, otpUseStatus: false },
      { otpUseStatus: true }
    );
  }
  return otp;
};

const lastOTPFromDB = async (payload) => {
  const { phone, type } = payload;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  // console.log(oneHourAgo);
  const total = await OtpModel.aggregate([
    {
      $match: {
        userNumber: phone,
        otpType: type,
        otpUseStatus: false,
        createdAt: { $gte: oneHourAgo },
      },
    },
    { $count: "count" },
  ]);
  // console.log(total);
  if (total[0]?.count > 10) {
    throw new ErrorHandler(
      "Your number has been temporarily locked due to too many attempts.Try Again Later ",
      httpStatus.NOT_FOUND
    );
  }
  // console.log(total);
  const otp = await OtpModel.findOne({
    userNumber: phone,
    otpUseStatus: false,
    otpType: type,
    validateTime: { $gt: new Date() },
  });
  console.log("last otp: ", otp?.otpCode);
  return otp;
};

const otpServices = {
  createOTPIntoDB,
  recentOTPFromDB,
  lastOTPFromDB,
};

module.exports = otpServices;
