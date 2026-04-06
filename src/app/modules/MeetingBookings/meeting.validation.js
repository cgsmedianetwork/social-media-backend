const Joi = require("joi");

const meetingCreateValidationSchema = Joi.object({
  meetingWith: Joi.string().trim().allow("", null),
  title: Joi.string().trim().allow("", null),
  date: Joi.date().required().messages({
    "any.required": "Date is required",
    "date.base": "Date must be a valid date",
  }),
  startTime: Joi.date().required().messages({
    "any.required": "Start time is required",
    "date.base": "Start time must be a valid date",
  }),
  endTime: Joi.date().required().messages({
    "any.required": "End time is required",
    "date.base": "End time must be a valid date",
  }),
  status: Joi.string().trim().allow("", null),
  meetingLink: Joi.string().trim().allow("", null),
  description: Joi.string().trim().allow("", null),
  isActive: Joi.boolean().default(true),
});

const meetingUpdateValidationSchema = Joi.object({
  meetingWith: Joi.string().trim().allow("", null),
  title: Joi.string().trim().allow("", null),
  startTime: Joi.date().optional().messages({
    "date.base": "Start time must be a valid date",
  }),
  endTime: Joi.date().optional().messages({
    "date.base": "End time must be a valid date",
  }),
  status: Joi.string()
    .trim()
    .valid("pending", "confirmed", "rejected")
    .allow("", null),
  meetingLink: Joi.string().trim().allow("", null),
  description: Joi.string().trim().allow("", null),
  isActive: Joi.boolean(),
});

const JoiMeetingValidationSchema = {
  meetingCreateValidationSchema,
  meetingUpdateValidationSchema,
};

module.exports = JoiMeetingValidationSchema;
