const UserModel = require("../app/modules/user/user.model");
const ErrorHandler = require("../ErrorHandler/errorHandler");
const config = require("../config/config");
const jwt = require("jsonwebtoken");
const httpStatus = require("http-status");
const authVerification = async (req, res, next) => {
  const { authorization } = req.headers;
  const token = authorization?.split(" ")[1];
  try {
    // console.log("first....: ", token);
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
    // console.log(error);
    next("Authentication Failed!");
  }
};

module.exports = authVerification;

// const jwt = require("jsonwebtoken");
// const ErrorHandler = require("../ErrorHandler/errorHandler");

// const httpStatus = require("http-status");
// const config = require("../config/config");
// const jwtHandle = require("../shared/createToken");
// const UserModel = require("../app/modules/user/user.model");

// const authVerification = async (req, res, next) => {
//   try {
//     let token;

//     if (req.cookies.accessToken) {
//       token = req.cookies.accessToken;
//     } else {
//       const { authorization } = req.headers;

//       token = authorization?.split(" ")[1];
//     }
//     if (!token) {
//       throw new ErrorHandler("Please login to access the resource", 401);
//     }

//     let decoded;

//     try {
//       decoded = jwt.verify(token, config.jwt_key);
//       const { email, userId } = decoded;
//       req.email = email;

//       const rootUser = await UserModel.findOne({ email: email });

//       if (!rootUser) {
//         throw new ErrorHandler("User not found", 404);
//       }

//       req.user = rootUser;
//       req.userId = userId;
//       req.email = email;
//     } catch (error) {
//       if (error.name === "TokenExpiredError") {
//         // Access token has expired, try to refresh it using the refreshToken
//         const refreshToken = req.cookies.refreshToken;
//         if (!refreshToken) {
//           throw new ErrorHandler(
//             "Access token expired. Please login again.",
//             401
//           );
//         }

//         try {
//           // Verify the refreshToken and check for validity
//           const refreshTokenDecoded = jwt.verify(
//             refreshToken,
//             config.jwt_refresh_key
//           );
//           const { email, userId } = refreshTokenDecoded;

//           // If the refreshToken is valid, generate a new accessToken
//           const newAccessToken = await jwtHandle(
//             { id: userId, email: email },
//             config.jwt_key,
//             config.jwt_token_expire
//           );

//           req.cookies.accessToken = newAccessToken;

//           //
//           if (newAccessToken) {
//             let cookieOptions = {
//               secure: config.env === "production",
//               httpOnly: true,
//             };
//             res.cookie("accessToken", newAccessToken, cookieOptions);
//           }

//           const rootUser = await UserModel.findOne({ email: email });

//           if (!rootUser) {
//             throw new ErrorHandler("User not found", 404);
//           }

//           req.user = rootUser;
//           req.userId = userId;
//           req.email = email;
//         } catch (error) {
//           console.log(error);
//           throw new ErrorHandler(
//             "Refresh token is invalid. Please login again.",
//             401
//           );
//         }
//       } else {
//         throw error;
//       }
//     }
//     // Continue with the next middleware
//     next();
//   } catch (error) {
//     next(error, httpStatus.UNAUTHORIZED);
//   }
// };

// module.exports = authVerification;
