const { default: axios } = require("axios");
const multer = require("multer");
const config = require("../config/config");
const FormData = require("form-data");
const storage = multer.memoryStorage();
const uploadImgbb = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

const uploadToImgbb = async (req, res, next) => {
  try {
    if (!req.file) return next();

    const formData = new FormData();
    formData.append("image", req.file.buffer.toString("base64"));

    const response = await axios.post(
      `https://api.imgbb.com/1/upload?key=${config.imgbb_key}`,
      formData,
      {
        headers: {
          // eslint-disable-next-line node/no-unsupported-features/es-syntax
          ...formData.getHeaders(),
        },
      }
    );
    req.body.image = response?.data.data.url;
    next();
  } catch (error) {
    console.log(error);
    next(
      new Error(error?.response?.data?.error?.message || "ImgBB upload failed")
    );
  }
};

module.exports = { uploadToImgbb, uploadImgbb };
