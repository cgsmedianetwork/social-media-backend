const Joi = require("joi");
const meetingCreateValidationSchema = Joi.object({
  meetingWith: Joi.string().trim().allow("", null),
  time: Joi.date().required().messages({
    "any.required": "Time is required",
    "date.base": "Time must be a valid date",
  }),
});

const JoiMeetingValidationSchema = {
  meetingCreateValidationSchema,
};

module.exports = JoiMeetingValidationSchema;
