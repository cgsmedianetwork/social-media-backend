const { google } = require("googleapis");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const httpStatus = require("http-status");
const { createReadStream } = require("fs");
const ErrorHandler = require("../ErrorHandler/errorHandler");
// const DriveTokenModel = require("../app/modules/driveTokens/driveTokens.model");
const config = require("../config/config");

const storage = multer.diskStorage({
  destination: "temp/resumes/",
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(
      new ErrorHandler("Only PDF files are allowed!", httpStatus.BAD_REQUEST),
      false
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const authorizeServiceAccount = async () => {
  const authClient = new google.auth.GoogleAuth({
    credentials: {
      type: config.googleServiceAccount.type,
      project_id: config.googleServiceAccount.project_id,
      private_key: config.googleServiceAccount.private_key,
      client_email: config.googleServiceAccount.client_email,
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return authClient.getClient();
};

const resumeUploadMiddleware = (fieldName) => {
  // console.log("field name: ", fieldName);
  return [
    // authGoogleDriveAuthorization(),
    async (req, res, next) => {
      try {
        await new Promise((resolve, reject) => {
          upload.single(fieldName)(req, res, (err) => {
            if (err) reject(err);
            resolve();
          });
        });

        if (!req.file) {
          throw new ErrorHandler("No file uploaded", httpStatus.BAD_REQUEST);
        }

        const filePath = req.file.path;
        const authClient = await authorizeServiceAccount();

        const drive = google.drive({
          version: "v3",
          auth: authClient,
        });

        const response = await drive.files.create({
          requestBody: {
            name: req.file.originalname,
            mimeType: "application/pdf",
            parents: [config.googleServiceAccount.drive_folder_id],
          },
          media: {
            mimeType: "application/pdf",
            body: createReadStream(filePath),
          },
        });

        // Make file publicly accessible
        await drive.permissions.create({
          fileId: response.data.id,
          requestBody: {
            role: "reader",
            type: "anyone",
          },
        });

        // Get public URL
        const publicFile = await drive.files.get({
          fileId: response.data.id,
          fields: "webViewLink, webContentLink",
        });

        // Cleanup local file
        await fs.unlink(filePath);
        req.body.resumeLink = publicFile.data.webViewLink;
        next();
      } catch (error) {
        console.error("Resume upload error:", error);
        next(
          new ErrorHandler(
            "Failed to upload resume to Google Drive",
            httpStatus.INTERNAL_SERVER_ERROR
          )
        );
      }
    },
  ];
};

const extractIdFromDriveUrl = (url) => {
  const match = url?.match(/[-\w]{25,}/);
  return match ? match[0] : null;
};

const resumeDeleteMiddleware = async (url) => {
  console.log("checking url: ", url);
  try {
    if (!url) return true;

    // extracting file id
    const fileId = extractIdFromDriveUrl(url);
    console.log("checking file id: ", fileId);
    if (!fileId) {
      throw new ErrorHandler(
        "Invalid Google Drive URL.",
        httpStatus.BAD_REQUEST
      );
    }

    const authClient = await authorizeServiceAccount();
    const drive = google.drive({
      version: "v3",
      auth: authClient,
    });

    // Delete the file
    await drive.files.delete({ fileId });
    return true;
  } catch (error) {
    console.error("Error deleting file from Google Drive:", error);
    throw new ErrorHandler(
      "Failed to delete file from Google Drive",
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};

module.exports = {
  resumeUploadMiddleware,
  resumeDeleteMiddleware,
};
