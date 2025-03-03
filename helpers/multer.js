
// const multer = require('multer');
// const path = require('path');

// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null,path.join(__dirname,"../public/uploads/product-image"));
//   },
//   filename: function (req, file, cb) {
//     cb(null, Date.now() + "-" +file.originalname);
//   }
// });

// // const uploads = multer({ storage: storage });
// module.exports = storage


const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../public/uploads/product-image"));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

module.exports = {
    storage: storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB for file uploads
      fieldSize: 200 * 1024 * 1024 // Increase to 200MB if needed
    }
};

  