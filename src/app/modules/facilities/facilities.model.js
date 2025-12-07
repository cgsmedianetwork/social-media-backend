const mongoose = require("mongoose");
const generateSlug = require("../../../shared/generateSlug");

const facilitiesSchema = new mongoose.Schema(
  {
    facilityName: {
      type: String,
      required: true,
      unique: true,
    },
    slug: {
      type: String,
      lowercase: true,
    },
    icon: {
      link: {
        type: String,
      },
      svg: {
        type: String,
      },
    },
    description: {
      type: String,
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
facilitiesSchema.pre("save", function (next) {
  // Generate slug only if the facility name has changed or if it's a new document
  if (this.isModified("facilityName") || this.isNew) {
    this.slug = generateSlug(this.facilityName);
  }
  next();
});

const FacilitiesModal = mongoose.model("facilities", facilitiesSchema);

module.exports = FacilitiesModal;
