const Joi = require("joi");

const otpCreateValidationSchema = Joi.object({
  otpType: Joi.string().required().messages({
    "any.required": "OTP type is required.",
    "string.empty": "OTP type cannot be empty.",
  }),
  otpCode: Joi.string().required().messages({
    "any.required": "OTP code is required.",
    "string.empty": "OTP code cannot be empty.",
  }),
  otpUseStatus: Joi.boolean().default(false),
  validateTime: Joi.date().required().messages({
    "any.required": "Validation time is required.",
    "date.base": "Validation time must be a valid date.",
  }),
  userNumber: Joi.string().messages({
    "string.empty": "User number cannot be empty.",
  }),
  userEmail: Joi.string().email().messages({
    "string.email": "User email must be a valid email address.",
  }),
});

const otpValidation = {
  otpCreateValidationSchema,
};

module.exports = otpValidation;
