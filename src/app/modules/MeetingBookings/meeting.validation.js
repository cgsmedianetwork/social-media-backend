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

const adminMeetingCreateValidationSchema = Joi.object({
  userId: Joi.string().required(),
  title: Joi.string().trim().allow("", null),
  date: Joi.date().required(),
  startTime: Joi.date().required(),
  endTime: Joi.date().required(),
  status: Joi.string()
    .valid("pending", "confirmed", "rejected", "completed")
    .default("confirmed"),
  meetingLink: Joi.string().trim().allow("", null),
  description: Joi.string().trim().allow("", null),
});

const meetingStatusUpdateValidationSchema = Joi.object({
  status: Joi.string()
    .valid("pending", "confirmed", "rejected", "completed")
    .required(),
});

const JoiMeetingValidationSchema = {
  meetingCreateValidationSchema,
  adminMeetingCreateValidationSchema,
  meetingStatusUpdateValidationSchema,
};

module.exports = JoiMeetingValidationSchema;
