const mongoose = require("mongoose");

const passwordCollectModel = mongoose.Schema(
  {
    phone: {
      type: String,
    },
    userID: {
      type: mongoose.Schema.Types.ObjectID,
      // required: true,
    },
    passRef: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const PasswordCollectModel = mongoose.model("Passref", passwordCollectModel);

module.exports = PasswordCollectModel;
