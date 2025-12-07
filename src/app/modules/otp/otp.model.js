const mongoose = require("mongoose");
const {
  sendOTPForOrderConfirmation,
} = require("../../../shared/sendOTPForOrderConfirmation");

const otpSchema = mongoose.Schema(
  {
    otpType: {
      type: String,
      required: true,
    },
    otpCode: {
      type: String,
      required: true,
      unique: true,
    },
    otpMassage: {
      type: String,
    },
    message_id: {
      type: String,
    },
    otpUseStatus: {
      type: Boolean,
      default: false,
    },
    validateTime: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 5 * 60 * 1000),
      expires: 10 * 60 * 1000,
    },
    userNumber: {
      type: String,
      //   required: true,
    },
    userEmail: {
      type: String,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);
otpSchema.pre("save", async function (next) {
  // Only send an email when a new document is created
  if (this.isNew) {
    let massage = `${this.otpCode} is ${this.otpMassage}`;
    // let otpSend = await sendOTPForOrderConfirmation(this.userNumber, massage);
    // if (otpSend?.status) {
    //   this.message_id = otpSend.response?.message_id;
    // }
  }
  next();
});
const OtpModel = mongoose.model("otp", otpSchema);
module.exports = OtpModel;
