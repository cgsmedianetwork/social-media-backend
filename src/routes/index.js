const express = require("express");
const userRouter = require("../app/modules/user/user.router");
const facilityRouter = require("../app/modules/facilities/facilities.route");
const SocialConnectionRouter = require("../app/modules/SocialConnection/SocialConnection.router");
const meetingBookingRouter = require("../app/modules/MeetingBookings/meeting.router");
const router = express.Router();

const routes = [
  {
    path: "/user",
    route: userRouter,
  },
  {
    path: "/facility",
    route: facilityRouter,
  },
  {
    path: "/social-connection",
    route: SocialConnectionRouter,
  },
  {
    path: "/meeting-bookings",
    route: meetingBookingRouter,
  },
];

routes.forEach((route) => router.use(route.path, route.route));

module.exports = router;
