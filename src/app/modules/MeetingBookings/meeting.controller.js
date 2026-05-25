const httpStatus = require("http-status");
const catchAsyncError = require("../../../ErrorHandler/catchAsyncError");
const sendResponse = require("../../../shared/sendResponse");
const meetingBookingServices = require("./meeting.services");
const ErrorHandler = require("../../../ErrorHandler/errorHandler");

const assertAdmin = (req) => {
  if (!["admin", "subAdmin"].includes(req.user?.role)) {
    throw new ErrorHandler(
      "Only admin can perform this action",
      httpStatus.FORBIDDEN,
    );
  }
};

const createMeetingBooking = catchAsyncError(async (req, res) => {
  const userId = req.userId;
  const payload = req.body;
  payload.userId = userId;
  const result =
    await meetingBookingServices.createMeetingBookingIntoDB(payload);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Meeting requested successfully!",
    data: result,
  });
});

const createMeetingBookingByAdmin = catchAsyncError(async (req, res) => {
  assertAdmin(req);
  const result = await meetingBookingServices.createMeetingBookingByAdminIntoDB(
    req.userId,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Meeting booked successfully!",
    data: result,
  });
});

const getUserMeetingBookings = catchAsyncError(async (req, res) => {
  const userId = req.userId;
  // console.log("userId", userId);
  const { startDate, endDate } = req.query;
  // console.log("startDate and endDate", startDate, endDate);
  const result = await meetingBookingServices.getUserMeetingBookings(
    userId,
    startDate,
    endDate,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Meeting bookings fetched successfully!",
    data: result,
  });
});

const getAdminMeetingBookings = catchAsyncError(async (req, res) => {
  assertAdmin(req);
  const { startDate, endDate } = req.query;
  const result = await meetingBookingServices.getAdminMeetingBookings(
    startDate,
    endDate,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Admin meeting bookings fetched successfully!",
    data: result,
  });
});

const getMeetingBookingByUserIdAndMonthAndYear = catchAsyncError(
  async (req, res) => {
    const userId = req.userId;
    const month = req.query.month;
    const year = req.query.year;
    const result =
      await meetingBookingServices.getMeetingBookingByUserIdAndMonthAndYear(
        userId,
        month,
        year,
      );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Meeting bookings fetched successfully!",
      data: result,
    });
  },
);

const updateMeetingBookingStatus = catchAsyncError(async (req, res) => {
  assertAdmin(req);
  const result = await meetingBookingServices.updateMeetingBookingStatusIntoDB(
    req.params.bookingId,
    req.body.status,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Meeting status updated successfully!",
    data: result,
  });
});

const meetingBookingController = {
  createMeetingBooking,
  getMeetingBookingByUserIdAndMonthAndYear,
  getUserMeetingBookings,
  createMeetingBookingByAdmin,
  getAdminMeetingBookings,
  updateMeetingBookingStatus,
};

module.exports = meetingBookingController;
