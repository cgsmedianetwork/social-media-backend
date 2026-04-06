const httpStatus = require("http-status");
const ErrorHandler = require("../../../ErrorHandler/errorHandler");
const MeetingBookingsModal = require("./meeting.model");

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

//get meeting with userId by filtering with month and year
const getMeetingBookingByUserIdAndMonthAndYear = async (
  userId,
  month,
  year,
) => {
  const meetingBookings = await MeetingBookingsModal.aggregate([
    { $match: { userId: userId, month: month, year: year } },
    {
      $project: {
        _id: 1,
        startTime: 1,
        endTime: 1,
        status: 1,
        meetingWith: 1,
        title: 1,
        description: 1,
        meetingLink: 1,
      },
    },
  ]);
  return meetingBookings;
};

const meetingBookingServices = {
  createMeetingBookingIntoDB,
};

module.exports = meetingBookingServices;
