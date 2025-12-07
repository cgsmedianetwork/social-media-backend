const express = require("express");
const userRouter = require("../app/modules/user/user.router");
const facilityRouter = require("../app/modules/facilities/facilities.route");
const SocialConnectionRouter = require("../app/modules/SocialConnection/SocialConnection.router");
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
];

routes.forEach((route) => router.use(route.path, route.route));

module.exports = router;
