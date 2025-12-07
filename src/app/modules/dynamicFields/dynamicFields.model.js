const mongoose = require("mongoose");
const generateSlug = require("../../../shared/generateSlug");
const dynamicFieldConstant = require("./dynamicFields.constant");

const dynamicFieldsSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    label: {
      type: String,
    },
    placeholder: {
      type: String,
      trim: true,
    },
    slug: {
      type: String,
      lowercase: true,
    },
    type: {
      type: String,
      required: true,
      enum: dynamicFieldConstant.dynamicInputTypes,
    },
    options: {
      type: [String],
      validate: {
        validator: function (v) {
          // Options are required for radio, select and checkbox
          if (["radio", "select", "checkbox"].includes(this.type)) {
            return v && v.length > 0;
          }
          // For other types, options are optional
          return true;
        },
        message: (props) => `Options are required for ${props.value} type`,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Middleware to create a slug before saving
dynamicFieldsSchema.pre("save", function (next) {
  // Generate slug only if the categoryName has changed or if it's a new document
  if (this.isModified("name") || this.isNew) {
    this.slug = generateSlug(this.name);
  }
  next();
});

const DynamicFieldModel = mongoose.model("dynamicField", dynamicFieldsSchema);

module.exports = DynamicFieldModel;
