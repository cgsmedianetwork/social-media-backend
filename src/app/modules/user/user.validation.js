const Joi = require("joi");
const bangladeshiPhoneNumberRegex = /^(?:\+88|88)?01[3-9]\d{8}$/;

const signupInitSchema = Joi.object({
  phone: Joi.string()
    .trim()
    .required()
    .custom((value, helpers) => {
      if (bangladeshiPhoneNumberRegex.test(value) && value.length >= 11) {
        return value;
      } else {
        return helpers.message(
          "Invalid Bangladeshi phone number format or length",
        );
      }
    }, "Phone Number Validation"),
  email: Joi.string().email().optional().allow("", null).messages({
    "string.email": "Please provide a valid email",
  }),
  terms: Joi.boolean().messages({
    "boolean.base": "Terms must be a boolean",
  }),
  password: Joi.string().required().messages({
    "string.empty": "Password is required",
    "any.required": "Password is required",
  }),
});

const loginSchema = Joi.object({
  phone: Joi.string()
    .trim()
    .required()
    .custom((value, helpers) => {
      if (bangladeshiPhoneNumberRegex.test(value) && value.length >= 11) {
        return value;
      } else {
        return helpers.message(
          "Invalid Bangladeshi phone number format or length",
        );
      }
    }, "Phone Number Validation"),
  password: Joi.string().required().messages({
    "string.empty": "Password is required",
    "any.required": "Password is required",
  }),
});

const phoneNumberOTPSchema = Joi.object({
  phone: Joi.string()
    .trim()
    .required()
    .custom((value, helpers) => {
      if (bangladeshiPhoneNumberRegex.test(value) && value.length >= 11) {
        return value;
      } else {
        return helpers.message(
          "Invalid Bangladeshi phone number format or length",
        );
      }
    }, "Phone Number Validation"),
});
const phoneNumberRequiredSchema = Joi.object({
  phone: Joi.string()
    .trim()
    .required()
    .custom((value, helpers) => {
      if (bangladeshiPhoneNumberRegex.test(value) && value.length >= 11) {
        return value;
      } else {
        return helpers.message(
          "Invalid Bangladeshi phone number format or length",
        );
      }
    }, "Phone Number Validation"),
});

const otpVarificationSchema = Joi.object({
  otpCode: Joi.string().required().messages({
    "string.empty": "otpCode is required",
    "any.required": "otpCode is required",
  }),
  sessionId: Joi.string().required().messages({
    "string.empty": "sessionId is required",
    "any.required": "sessionId is required",
  }),
});

const otpResendSchema = Joi.object({
  sessionId: Joi.string().required().messages({
    "string.empty": "sessionId is required",
    "any.required": "sessionId is required",
  }),
});

const otpVerificationPassswordSchema = Joi.object({
  otpCode: Joi.string().required().messages({
    "string.empty": "otpCode is required",
    "any.required": "otpCode is required",
  }),
});

const userCreateSchema = Joi.object({
  verifiedphone: Joi.string()
    .trim()
    .required()
    .custom((value, helpers) => {
      if (bangladeshiPhoneNumberRegex.test(value) && value.length >= 11) {
        return value;
      } else {
        return helpers.message(
          "Invalid Bangladeshi phone number format or length",
        );
      }
    }, "Phone Number Validation"),

  firstname: Joi.string().required().messages({
    "string.empty": "firstname is required",
    "any.required": "firstname is required",
  }),
  lastname: Joi.string().required().messages({
    "string.empty": "lastname is required",
    "any.required": "lastname is required",
  }),
  email: Joi.string().required().messages({
    "string.empty": "Email is required",
    "any.required": "Email is required",
  }),
  password: Joi.string().required().messages({
    "string.empty": "Password is required",
    "any.required": "Password is required",
  }),
  phoneVerify: Joi.boolean().messages({}),
  emailVerify: Joi.boolean().messages({}),
  userStatus: Joi.string().messages({}),
  role: Joi.string().messages({}),
});

const phoneOTPVarificationSchema = Joi.object({
  otpType: Joi.string().required().messages({
    "any.required": "OTP type is required.",
    "string.empty": "OTP type cannot be empty.",
  }),

  userNumber: Joi.string().messages({
    "string.empty": "User number cannot be empty.",
  }),
  userEmail: Joi.string().email().messages({
    "string.email": "User email must be a valid email address.",
  }),
  otpMassage: Joi.string().optional().allow("").messages({
    "string.empty": "otpMassage cannot be empty",
  }),
});

const resetPasswordSchema = Joi.object({
  password: Joi.string().required().messages({
    "any.required": "Password is required",
    "string.empty": "Password is required",
  }),
  confirmPassword: Joi.string().required().valid(Joi.ref("password")).messages({
    "any.required": "Confirm Password is required",
    "string.empty": "Confirm Password is required",
    "any.only": "Passwords do not match",
  }),
  // phone: Joi.string()
  //   .trim()
  //   .required()
  //   .custom((value, helpers) => {
  //     if (bangladeshiPhoneNumberRegex.test(value) && value.length === 11) {
  //       return value;
  //     } else {
  //       return helpers.message(
  //         "Invalid Bangladeshi phone number format or length"
  //       );
  //     }
  //   }, "Phone Number Validation"),
});

const userUpdateSchema = Joi.object({
  name: Joi.string().trim().allow("", null),
  email: Joi.string().email().allow("", null),
  phone: Joi.string().trim().length(11).allow("", null),
  image: Joi.string().allow("", null),
  location: Joi.string().allow("", null),
  badge: Joi.string().allow("", null),
});

const JoiUserValidationSchema = {
  loginSchema,
  phoneNumberOTPSchema,
  otpVarificationSchema,
  otpVerificationPassswordSchema,
  userCreateSchema,
  phoneNumberRequiredSchema,
  phoneOTPVarificationSchema,
  resetPasswordSchema,
  signupInitSchema,
  otpResendSchema,
  userUpdateSchema,
};

module.exports = JoiUserValidationSchema;
