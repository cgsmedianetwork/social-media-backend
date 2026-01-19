const UserModel = require("../app/modules/user/user.model");
const ErrorHandler = require("../ErrorHandler/errorHandler");
const config = require("../config/config");
const jwt = require("jsonwebtoken");
const httpStatus = require("http-status");

const authVerification = async (req, res, next) => {
  const { authorization } = req.headers;
  const token = authorization?.split(" ")[1];
  try {
    // console.log("token and authorization: ", token, authorization);
    if (!token || !authorization) {
      throw new ErrorHandler("invalid token", httpStatus.BAD_REQUEST);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt_key);
    } catch (error) {
      return next(new ErrorHandler("Unauthorized", 401));
    }
    // console.log("decoded....: ", decoded);
    const { userId } = decoded;
    // console.log("phone from middleware....:", phone);
    // console.log("userId from middleware....:", userId);
    // console.log(userId);

    const rootUser = await UserModel.findById(userId);
    // console.log(rootUser);
    if (!rootUser) {
      throw new ErrorHandler("User not found", 404);
    }
    req.user = rootUser;
    req.userId = userId;
    next();
  } catch (error) {
    console.log(error);
    next(new ErrorHandler("Authentication Failed!", 401));
  }
};

module.exports = authVerification;
