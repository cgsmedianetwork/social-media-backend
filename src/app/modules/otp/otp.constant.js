const otpFilterableFields = ["phone", "email", "otpType", "otpCode"];

const otpSearchableFields = ["phone", "email", "otpType", "otpCode"];
const otpTypeConstant = [
  "login_registation_number_varification",
  "order_place",
  "promotional",
];

module.exports = {
  otpFilterableFields,
  otpSearchableFields,
  otpTypeConstant,
};
