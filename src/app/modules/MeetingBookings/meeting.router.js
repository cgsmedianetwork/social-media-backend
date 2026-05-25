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

router.post(
  "/admin/create",
  authVerification,
  validateRequest(
    JoiMeetingValidationSchema.adminMeetingCreateValidationSchema,
  ),
  meetingBookingController.createMeetingBookingByAdmin,
);

router.get(
  "/admin/bookings",
  authVerification,
  meetingBookingController.getAdminMeetingBookings,
);

router.patch(
  "/admin/:bookingId/status",
  authVerification,
  validateRequest(
    JoiMeetingValidationSchema.meetingStatusUpdateValidationSchema,
  ),
  meetingBookingController.updateMeetingBookingStatus,
);

const meetingBookingRouter = router;

module.exports = meetingBookingRouter;
