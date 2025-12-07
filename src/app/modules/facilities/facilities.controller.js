const httpStatus = require("http-status");
const catchAsyncError = require("../../../ErrorHandler/catchAsyncError");
const sendResponse = require("../../../shared/sendResponse");
const facilityServices = require("./facilities.services");
const pick = require("../../../shared/pick");
const facilityConstant = require("./facilities.constant");
const paginationFields = require("../../../constant/pagination");

// ? create individual facility
const createIndividualFacility = catchAsyncError(async (req, res) => {
  // console.log("in controller :", req.uploadedImageUrl);
  req.body.icon = { link: req.uploadedImageUrl };

  // const result = await facilityServices.createIndividualFacilityIntoDB(
  //   req.body
  // );

  // sendResponse(res, {
  //   statusCode: httpStatus.CREATED,
  //   success: true,
  //   message: "Facility created successfully",
  //   data: {
  //     result,
  //   },
  // });
});

// get all facility
const getAllFacility = catchAsyncError(async (req, res) => {
  const filters = pick(req.query, facilityConstant.facilityFilterableFields);

  const paginationOptions = pick(req.query, paginationFields);
  const result = await facilityServices.getAllFacilityFromDB(
    filters,
    paginationOptions
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Facility Get successfully",
    data: {
      result,
    },
  });
});

// ? update facility
const updateFacility = catchAsyncError(async (req, res, next) => {
  const result = await facilityServices.updateFacilityIntoDB(
    req.params.id,
    req.body
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Facility Updated Successfully",
    data: {
      result,
    },
  });
});

// ? delete facility
const deleteFacility = catchAsyncError(async (req, res, next) => {
  const result = await facilityServices.deleteFacilityIntoDB(req.params.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Facility Deleted Successfully",
    data: {
      result,
    },
  });
});

const facilityController = {
  createIndividualFacility,
  getAllFacility,
  updateFacility,
  deleteFacility,
};
module.exports = facilityController;
