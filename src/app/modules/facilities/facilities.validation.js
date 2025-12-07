const Joi = require("joi");

const facilityCreateSchema = Joi.object({
  facilityName: Joi.string().required().messages({
    "string.base": "facility must be a string",
    "string.empty": "Facility cannot be empty",
    "any.required": "Facility is required",
  }),

  slug: Joi.string().lowercase().optional().messages({
    "string.base": "Slug must be a string",
    "string.lowercase": "Slug must be lowercase",
  }),

  icon: Joi.object({
    link: Joi.string().uri().optional().messages({
      "string.base": "Icon link must be a string",
      "string.uri": "Icon link must be a valid URL",
    }),

    svg: Joi.string()
      .optional()
      .pattern(/^<svg[\s\S]*<\/svg>$/)
      .messages({
        "string.base": "svg link must be a string",
        "string.pattern.base": "Provide a valid svg.",
      }),
  }).optional(),

  isActive: Joi.boolean().optional().messages({
    "boolean.base": "IsActive must be a boolean",
  }),

  description: Joi.string().optional().messages({
    "string.base": "Description must be a string",
  }),

  displayOrder: Joi.number().integer().optional().messages({
    "number.base": "Display order must be a number.",
  }),
});
const JoiFacilityValidationSchema = {
  facilityCreateSchema,
};

module.exports = JoiFacilityValidationSchema;
