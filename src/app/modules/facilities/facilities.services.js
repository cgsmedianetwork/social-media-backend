const httpStatus = require("http-status");
const ErrorHandler = require("../../../ErrorHandler/errorHandler");
const generateSlug = require("../../../shared/generateSlug");
const FacilitiesModal = require("./facilities.model");
const { paginationHelpers } = require("../../../Helper/paginationHelper");
const { searchHelper } = require("../../../Helper/searchHelper");
const facilityConstant = require("./facilities.constant");
const { processFilters } = require("../../../Helper/filterProcessor");
const { filteringHelper } = require("../../../Helper/filteringHelper");
const { sortingHelper } = require("../../../Helper/sortingHelper");

// create individual facility
const createIndividualFacilityIntoDB = async (payload) => {
  const facilitySlug = generateSlug(payload?.facilityName);
  const isExist = await FacilitiesModal.findOne({
    slug: facilitySlug,
  });
  if (isExist) {
    throw new ErrorHandler(
      `${payload?.facilityName}, this facility already exist!`,
      httpStatus.CONFLICT
    );
  }

  const facility = new FacilitiesModal(payload);
  const newFacility = await facility.save();

  return newFacility;
};

// get all facility
const getAllFacilityFromDB = async (filters, paginationOptions) => {
  const { searchTerm, ...filtersData } = filters;
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(paginationOptions);

  const pipeline = [];
  const totalPipeline = [{ $count: "count" }];
  const match = {};

  //?Dynamic search added
  const dynamicSearchQuery = searchHelper.createSearchQuery(
    searchTerm,
    facilityConstant.facilitySearchableFields
  );

  if (dynamicSearchQuery && dynamicSearchQuery.length) {
    match.$or = dynamicSearchQuery;
  }
  // ? Dynamic filtering added
  let dynamicFilter;
  if (facilityConstant.fieldsToModifyFields) {
    // dynamicFilter = processFilters(
    //   filtersData,
    //   trialBalanceConstant.fieldsToModifyFields
    // );
    const processedFilters = processFilters(
      filtersData,
      facilityConstant.fieldsToModifyFields
    );
    // console.log("processedFilters :", processedFilters);
    dynamicFilter = Object.entries(processedFilters).map(([key, value]) => ({
      [key]: value,
    }));
  } else {
    // Use the regular createDynamicFilter when no fields need special processing
    dynamicFilter = filteringHelper.createDynamicFilter(filtersData);
  }

  // console.log("dynamicFilter : ", dynamicFilter);
  if (dynamicFilter && dynamicFilter.length) {
    match.$and = dynamicFilter;
  }
  //   console.log(dynamicFilter);
  // if join projection and otherneeded for before match ar unshift then write here

  if (skip) {
    pipeline.push({ $skip: skip });
  }

  if (limit) {
    pipeline.push({ $limit: limit });
  }

  // sorting
  const dynamicSorting = sortingHelper.createDynamicSorting(sortBy, sortOrder);

  if (dynamicSorting) {
    pipeline.push({
      $sort: dynamicSorting,
    });
  }

  if (Object.keys(match).length) {
    pipeline.unshift({
      $match: match,
    });
    totalPipeline.unshift({
      $match: match,
    });
  }

  const result = await FacilitiesModal.aggregate(pipeline);
  const total = await FacilitiesModal.aggregate(totalPipeline);
  return {
    meta: {
      page,
      limit,
      total: total[0]?.count,
    },
    data: result,
  };
};

// ? update facility
const updateFacilityIntoDB = async (id, payload) => {
  let isExist = await FacilitiesModal.findById(id);
  if (!isExist) {
    throw new ErrorHandler(
      `${id}, this facility is Not Found!`,
      httpStatus.NOT_FOUND
    );
  }
  // if facility updated then slug will also be updated
  if (payload?.facilityName) {
    payload.slug = generateSlug(payload.facilityName);
  }

  const result = await FacilitiesModal.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });

  return result;
};

//? Delete facility
const deleteFacilityIntoDB = async (id) => {
  let isExist = await FacilitiesModal.findById(id);
  if (!isExist) {
    throw new ErrorHandler(
      `${id}, this facility is Not Found!`,
      httpStatus.NOT_FOUND
    );
  }

  const result = await FacilitiesModal.findByIdAndDelete(id);

  return result;
};

const facilityServices = {
  createIndividualFacilityIntoDB,
  getAllFacilityFromDB,
  updateFacilityIntoDB,
  deleteFacilityIntoDB,
};

module.exports = facilityServices;
