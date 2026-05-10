const httpStatus = require("http-status");
const ErrorHandler = require("../../../ErrorHandler/errorHandler");
const MeetingBookingsModal = require("./meeting.model");
const { default: mongoose } = require("mongoose");
const moment = require("moment");

//create a meeting booking
const createMeetingBookingIntoDB = async (payload) => {
  const isMeetingExist = await MeetingBookingsModal.findOne({
    meetingWith: payload.meetingWith,
    userId: payload.userId,
    $or: [
      {
        startTime: { $lt: payload.endTime },
        endTime: { $gt: payload.startTime },
      },
    ],
    status: { $in: ["pending", "confirmed"] },
  });
  if (isMeetingExist) {
    throw new ErrorHandler(
      "A meeting already exists in this time range!",
      httpStatus.CONFLICT,
    );
  }

  //end time must be greater than start time
  if (new Date(payload.endTime) <= new Date(payload.startTime)) {
    throw new ErrorHandler(
      "End time must be greater than start time!",
      httpStatus.CONFLICT,
    );
  }

  const meetingBooking = new MeetingBookingsModal(payload);
  const newMeetingBooking = await meetingBooking.save();
  return newMeetingBooking;
};

//get user meeting bookings
const getUserMeetingBookings = async (userId, startDate, endDate) => {
  console.log("startDate and endDate", startDate, endDate);
  // if (isNaN(startDate) || isNaN(endDate)) {
  //   throw new ErrorHandler("Invalid date range", httpStatus.BAD_REQUEST);
  // }
  // if startDate and endDate not found then it would be current month fistDate and lastDate
  if (!startDate && !endDate) {
    const startOfMonth = moment().startOf("month").toDate();
    const endOfMonth = moment().endOf("month").toDate();
    startDate = startOfMonth;
    endDate = endOfMonth;
  }
  //want to populate meetingWith user details
  const meetingBookings = await MeetingBookingsModal.find({
    $or: [
      { userId: new mongoose.Types.ObjectId(userId) },
      { meetingWith: new mongoose.Types.ObjectId(userId) },
    ],
    startTime: { $lte: new Date(endDate) },
    endTime: { $gte: new Date(startDate) },
    isActive: true,
  }).populate({
    path: "meetingWith",
    select: "name email image",
  });

  return meetingBookings;
};

//get meeting with userId by filtering with month and year
const getMeetingBookingByUserIdAndMonthAndYear = async (
  userId,
  month,
  year,
) => {
  const meetingBookings = await MeetingBookingsModal.aggregate([
    { $match: { userId: userId, month: month, year: year } },
  ]);
  return meetingBookings;
};

const meetingBookingServices = {
  createMeetingBookingIntoDB,
  getMeetingBookingByUserIdAndMonthAndYear,
  getUserMeetingBookings,
};

module.exports = meetingBookingServices;
