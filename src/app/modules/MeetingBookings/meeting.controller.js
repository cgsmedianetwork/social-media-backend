const httpStatus = require("http-status");
const catchAsyncError = require("../../../ErrorHandler/catchAsyncError");
const sendResponse = require("../../../shared/sendResponse");
const meetingBookingServices = require("./meeting.services");

const createMeetingBooking = catchAsyncError(async (req, res) => {
  const userId = req.userId;
  const payload = req.body;
  payload.userId = userId;
  const result =
    await meetingBookingServices.createMeetingBookingIntoDB(payload);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Meeting booked successfully",
    data: result,
  });
});

const meetingBookingController = {
  createMeetingBooking,
};

module.exports = meetingBookingController;
