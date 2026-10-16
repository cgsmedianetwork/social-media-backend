const axios = require("axios");
const config = require("../config/config");

// BulkSMSBD expects a number in international form, such as 8801766069458.
const toInternational = (number) => {
  const digits = String(number || "").replace(/\D/g, "");
  if (digits.startsWith("88")) return digits;
  if (digits.startsWith("0")) return `88${digits.slice(1)}`;
  return `88${digits}`;
};

exports.sendOTPForOrderConfirmation = async (toNumber, message) => {
  const apiKey = config.bulksmsbdApiKey;
  const sender_id = config.bulksmsbdSenderId;

  if (!apiKey || !sender_id) {
    console.log("OTP send Failed: the SMS credentials are absent");
    return { status: false, error: "Missing SMS credentials" };
  }

  const number = toInternational(toNumber);

  try {
    const { data: response } = await axios.get(
      "http://bulksmsbd.net/api/smsapi",
      {
        params: {
          api_key: apiKey,
          type: "text",
          number,
          senderid: sender_id,
          message,
        },
        timeout: 15000,
      },
    );

    console.log("OTP send response :", response);

    // 202 is the only code that means the provider accepted the message.
    if (response?.response_code === 202) {
      console.log(`OTP send Successfully to ${number}`);
      return { status: true, response };
    }

    console.log(
      `OTP send Failed to ${number}. Code: ${response?.response_code}. ` +
        `Message: ${response?.error_message || response?.success_message}`,
    );
    return { status: false, response };
  } catch (error) {
    console.log("OTP send Failed:", error.toString());
    return { status: false, error: error.toString() };
  }
};
