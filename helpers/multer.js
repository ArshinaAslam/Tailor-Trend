


  const multer = require('multer');
  const path = require('path');

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, path.join(__dirname, "../public/uploads/product-images"));
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + "-" + file.originalname);
    }
  });

  const upload = multer({
    storage: storage,
    limits: {
      fileSize: 10 * 1024 * 1024, 
      fieldSize: 200 * 1024 * 1024 
    }
  });
  
  module.exports = upload 
