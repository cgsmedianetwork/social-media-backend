const express = require("express");
const meetingBookingController = require("./meeting.controller");
const authVerification = require("../../../Middleware/authVarification");
const JoiMeetingValidationSchema = require("./meeting.validation");
const validateRequest = require("../../../Middleware/validateRequest");

const router = express.Router();

router.post(
  "/create",
  authVerification,
  validateRequest(JoiMeetingValidationSchema.meetingCreateValidationSchema),
  meetingBookingController.createMeetingBooking,
);

router.get(
  "/user-meeting-bookings",
  authVerification,
  meetingBookingController.getUserMeetingBookings,
);

const meetingBookingRouter = router;

module.exports = meetingBookingRouter;
