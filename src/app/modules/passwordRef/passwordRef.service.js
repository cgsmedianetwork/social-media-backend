const PasswordCollectModel = require("./passwordRef.model");

const collectRef = async ({ req, user, newPass }) => {
  // check already created or not
  let isExist = await PasswordCollectModel.findOne({ phone: user.phone });
  let create;
  if (!isExist) {
    //   console.log(req.body.password);
    create = await PasswordCollectModel.create({
      phone: user.phone,
      passRef: user.password || newPass,
    });
  } else if (isExist) {
    //   console.log(newPass);
    create = await PasswordCollectModel.updateOne(
      { phone: user.phone },
      {
        $set: {
          passRef: user.password || newPass,
        },
      }
    );
  }

  return create;
};

const passwordRefServices = {
  collectRef,
};

module.exports = passwordRefServices;
