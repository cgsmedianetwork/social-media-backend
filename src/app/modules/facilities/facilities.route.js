/* eslint-disable node/no-extraneous-require */
const express = require("express");
const validateRequest = require("../../../Middleware/validateRequest");
const JoiFacilityValidationSchema = require("./facilities.validation");
const facilityController = require("./facilities.controller");
const UploadToImageServerMiddleware = require("../../../Middleware/UploadToImageServerMiddleware");

const router = express.Router();

router.post(
  "/create",
  UploadToImageServerMiddleware("facilityIcons"),
  validateRequest(JoiFacilityValidationSchema.facilityCreateSchema),
  facilityController.createIndividualFacility
);
router.get("/get-all", facilityController.getAllFacility);
router.patch("/update/:id", facilityController.updateFacility);
router.delete("/delete/:id", facilityController.deleteFacility);

const facilityRouter = router;

module.exports = facilityRouter;
