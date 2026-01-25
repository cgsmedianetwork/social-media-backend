const express = require("express");

const JoiUserValidationSchema = require("./user.validation");
const validateRequest = require("../../../Middleware/validateRequest");
const userController = require("./user.controller");
const authVerification = require("../../../Middleware/authVarification");
const UploadToImageServerMiddleware = require("../../../Middleware/UploadToImageServerMiddleware");


const {
  uploadImgbb,
  uploadToImgbb,
} = require("../../../Middleware/upload.imgbb");

const router = express.Router();

router.post(
  "/signup/init",
  validateRequest(JoiUserValidationSchema.signupInitSchema),
  userController.sendSignUpInitOTP
);

router.post(
  "/signup/resend-otp",
  validateRequest(JoiUserValidationSchema.otpResendSchema),
  userController.resendSignUpInitOTP
);

router.post(
  "/verify-otp",
  validateRequest(JoiUserValidationSchema.otpVarificationSchema),
  userController.otpVarificationForRegi
);

router.post(
  "/login",
  validateRequest(JoiUserValidationSchema.loginSchema),
  userController.loginUserUsingPhoneAndPassword
);

router.post(
  "/forgot-password/init",
  // originMiddleware,
  // verifyApiKey,
  validateRequest(JoiUserValidationSchema.phoneNumberOTPSchema),
  userController.forgotPassOtpSend
);

router.post(
  "/reset-password-otp-verification",
  // originMiddleware,
  // verifyApiKey,
  validateRequest(JoiUserValidationSchema.otpVerificationPassswordSchema),
  userController.resetPasswordOtpVarification
);

router.post(
  "/reset-user-password",
  // originMiddleware,
  // verifyApiKey,
  validateRequest(JoiUserValidationSchema.resetPasswordSchema),
  userController.setNewPasswordAndLogin
);

router.post(
  "/refresh-token",
  // authVerification,
  userController.refreshToken
);

router.post(
  "/logout",
  // authVerification,
  userController.logout
);

router.patch(
  "/update-user",
  authVerification,
  uploadImgbb.single("image"),
  uploadToImgbb,
  validateRequest(JoiUserValidationSchema.userUpdateSchema),
  userController.updateUser
);

router.get("/verify-token", userController.verifyRefreshToken);

router.get(
  "/admin-and-subadmin",
  authVerification,
  userController.getAdminAndSubAdmin
);

router.post(
  "/create",
  validateRequest(JoiUserValidationSchema.userCreateSchema),
  userController.createUser
);

router.post(
  "/exist-user",
  // originMiddleware,
  // verifyApiKey,
  validateRequest(JoiUserValidationSchema.phoneNumberRequiredSchema),
  userController.checkUserExistusingPhone
);

router.patch(
  "/img-upload",
  authVerification,
  UploadToImageServerMiddleware("profile_image"),
  userController.updateUserProfile
);



router.post(
  "/isExistSingleUser",
  // validateRequest(JoiUserValidationSchema.phoneNumberRequiredSchema),
  userController.isSingleExistUser
);
// router.get("/hourly-signup-user", userController.getSignUpUserForHourly);
// router.get("/user-report", userController.allUserReportForDashboard);
router.get("/my-profile", authVerification, userController.myProfileUsingToken);

// router.get(
//   "/user-report",

//   userController.allUserReportForDashboard
// );

// router.get("/signup-user-number", userController.getSignUpUserNumber);

// router.get("/signup-user-for-dod", userController.getSignUpUserForDate);

const userRouter = router;
module.exports = userRouter;
