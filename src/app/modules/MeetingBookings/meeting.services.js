const httpStatus = require("http-status");
const ErrorHandler = require("../../../ErrorHandler/errorHandler");
const MeetingBookingsModal = require("./meeting.model");

//create a meeting booking
const createMeetingBookingIntoDB = async (payload) => {
  // check for if meeting in the same time could have start time but not end time
  const isMeetingExist = await MeetingBookingsModal.findOne({
    time: payload.time,
    meetingWith: payload.meetingWith,
    userId: payload.userId,
  });
  if (isMeetingExist) {
    throw new ErrorHandler(
      "Already have a meeting in this time",
      httpStatus.CONFLICT
    );
  }
  const meetingBooking = new MeetingBookingsModal(payload);
  const newMeetingBooking = await meetingBooking.save();
  return newMeetingBooking;
};

const meetingBookingServices = {
  createMeetingBookingIntoDB,
};

module.exports = meetingBookingServices;
