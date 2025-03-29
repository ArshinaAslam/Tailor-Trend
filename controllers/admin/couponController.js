const Coupon = require('../../models/couponSchema')

const mongoose = require('mongoose')

const loadCoupon = async (req, res) => {
  try {
    const { page = 1, search = '', ajax } = req.query;
    const limit = 5;
    const isAjax = ajax === 'true';

    const searchQuery = search ? { name: { $regex: new RegExp(search, 'i') } } : {};

    
    if (isAjax) {
      const coupons = await Coupon.find(searchQuery)
        .sort({ createdOn: -1 })
        .limit(search ? 0 : limit)
        .skip(search ? 0 : (page - 1) * limit);

      const totalCoupons = await Coupon.countDocuments(searchQuery);
      const totalPages = search ? 1 : Math.ceil(totalCoupons / limit);

      return res.render('partials/coupons-table', {
        coupons,
        currentPage: page,
        totalPages,
        search
      });
    }

   
    const totalCoupons = await Coupon.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalCoupons / limit);
    const currentPage = Math.min(Math.max(page, 1), totalPages || 1);

    const coupons = await Coupon.find(searchQuery)
      .sort({ createdOn: -1 })
      .skip((currentPage - 1) * limit)
      .limit(limit);

    res.render('coupon', {
      coupons,
      currentPage,
      totalPages,
      search
    });

  } catch (error) {
    console.error("Error loading coupons:", error);
    res.redirect('/pageError');
  }
};

// const createCoupon = async(req,res)=>{
//     try {
//         const data = {
//             couponName : req.body.couponName,
//             startDate : new Date(req.body.startDate + "T00:00:00"),
//             endDate : new Date(req.body.endDate + "T00:00:00"),
//             offerPrice : parseInt(req.body.offerPrice),
//             minimumPrice : parseInt(req.body.minimumPrice),

//         }

//         const newCoupon = new Coupon({
//            name : data.couponName,
//            createdOn : data.startDate,
//            expireOn : data.endDate,
//            offerPrice : data.offerPrice ,
//            minimumPrice : data.minimumPrice

//         })

//         await newCoupon.save()

//         return res.redirect('/admin/coupon')

        
//     } catch (error) {
//         console.error("Error creating coupon:", error); // Log the actual error
//         return res.status(500).send("Internal Server Error. Check the console for details.");
        


//     }
// }
const createCoupon = async (req, res) => {
  try {
      const data = {
          couponName: req.body.couponName?.trim(),
          startDate: req.body.startDate ? new Date(req.body.startDate + "T00:00:00") : null,
          endDate: req.body.endDate ? new Date(req.body.endDate + "T00:00:00") : null,
          offerPrice: parseInt(req.body.offerPrice),
          minimumPrice: parseInt(req.body.minimumPrice),
      };

     
      if (!data.couponName) {
          return res.status(400).json({ success: false, message: "Coupon name is required" });
      }

     
      const existingCoupon = await Coupon.findOne({ 
          name: { $regex: new RegExp(`^${data.couponName}$`, 'i') }
      });
      if (existingCoupon) {
          return res.status(400).json({ 
              success: false, 
              message: "A coupon with this name already exists" 
          });
      }

      if (!data.startDate || isNaN(data.startDate.getTime())) {
          return res.status(400).json({ 
              success: false, 
              message: "Invalid start date. Please provide a valid date in YYYY-MM-DD format." 
          });
      }
      if (!data.endDate || isNaN(data.endDate.getTime())) {
          return res.status(400).json({ 
              success: false, 
              message: "End date is required. Please provide a valid date in YYYY-MM-DD format." 
          });
      }
      if (data.startDate > data.endDate) {
          return res.status(400).json({ 
              success: false, 
              message: "Start date must be before end date" 
          });
      }
      if (isNaN(data.offerPrice) || isNaN(data.minimumPrice)) {
          return res.status(400).json({ 
              success: false, 
              message: "Offer price and minimum price must be valid numbers" 
          });
      }
      if (data.offerPrice >= data.minimumPrice) {
          return res.status(400).json({ 
              success: false, 
              message: "Offer price must be less than minimum price" 
          });
      }

      const newCoupon = new Coupon({
          name: data.couponName,
          createdOn: new Date(), 
          expireOn: data.endDate,
          offerPrice: data.offerPrice,
          minimumPrice: data.minimumPrice,
          isList: true,
          userId: []
      });

      await newCoupon.save();

      return res.status(201).json({
          success: true,
          message: "Coupon created successfully",
          couponId: newCoupon._id 
      });
  } catch (error) {
      console.error("Error creating coupon:", error.message, error.stack);
      return res.status(500).json({
          success: false,
          message: error.message || "Internal Server Error"
      });
  }
};

const getEditCoupon = async(req,res)=>{
    try {

        const couponId = req.query.id
      
        const findCoupon = await Coupon.findOne({_id:couponId})
       
        res.render('editCoupon',{findCoupon:findCoupon})
        
    } catch (error) {
        res.redirect('/pageError')
        
    }
}



// const editCoupon = async (req, res) => {
//     try {
//         const couponId = req.body.couponId;
//         const objId = new mongoose.Types.ObjectId(couponId);

//         const selectedCoupon = await Coupon.findOne({ _id: objId });

//         if (selectedCoupon) {
//             const startDate = new Date(req.body.startDate);
//             const endDate = new Date(req.body.endDate);

//            const updatedCoupon = await Coupon.updateOne(
//                 { _id: objId },  
//                 {
//                     $set: {
//                         name: req.body.couponName,
//                         createdOn: startDate,
//                         expireOn: endDate,
//                         offerPrice: parseInt(req.body.offerPrice),  
//                         minimumPrice: parseInt(req.body.minimumPrice),
//                     }
//                 }
//             );

//            if(updatedCoupon !== null){
//             res.send("Coupon updated successfully")
//            }else{
//             res.status(500).send("Coupon update failed")
//            }
//         } 
//     } catch (error) {
//         console.error("Error updating coupon:", error);
//         return redirect('/pageError')
//     }
// };

const editCoupon = async (req, res) => {
  try {
      const couponId = req.body.couponId;
      const objId = new mongoose.Types.ObjectId(couponId);

      const { couponName, startDate, endDate, offerPrice, minimumPrice } = req.body;

      
      if (!couponName || !startDate || !endDate || !offerPrice || !minimumPrice) {
          return res.status(400).json({ success: false, message: "All fields are required" });
      }

      const parsedOfferPrice = parseInt(offerPrice);
      const parsedMinimumPrice = parseInt(minimumPrice);
      if (isNaN(parsedOfferPrice) || isNaN(parsedMinimumPrice)) {
          return res.status(400).json({ success: false, message: "Offer price and minimum price must be valid numbers" });
      }

     
      const existingCoupon = await Coupon.findOne({ 
          name: { $regex: new RegExp(`^${couponName.trim()}$`, 'i') },
          _id: { $ne: objId } 
      });

      if (existingCoupon) {
          return res.status(400).json({ 
              success: false, 
              message: "A coupon with this name already exists" 
          });
      }

      const selectedCoupon = await Coupon.findOne({ _id: objId });
      if (!selectedCoupon) {
          return res.status(404).json({ success: false, message: "Coupon not found" });
      }

      const updatedCoupon = await Coupon.updateOne(
          { _id: objId },
          {
              $set: {
                  name: couponName.trim(),
                  createdOn: new Date(startDate),
                  expireOn: new Date(endDate),
                  offerPrice: parsedOfferPrice,
                  minimumPrice: parsedMinimumPrice,
              }
          }
      );

      if (updatedCoupon.modifiedCount > 0) {
          return res.status(200).json({ 
              success: true, 
              message: "Coupon updated successfully" 
          });
      } else {
          return res.status(400).json({ 
              success: false, 
              message: "No changes were made to the coupon" 
          });
      }
  } catch (error) {
      console.error("Error updating coupon:", error);
      return res.status(500).json({ 
          success: false, 
          message: "Internal Server Error: " + error.message 
      });
  }
};


const deleteCoupon = async(req,res)=>{
    try {
        const couponId = req.query.id
        await Coupon.deleteOne({_id:couponId})
        res.status(200).json({success:true,message:"Coupon deleted successfully"})
        
    } catch (error) {
        console.error("Error deleting coupon",error)
        res.status(500).json({success:false,message:"Failed to delete coupon"})
    }

}

module.exports = {
    loadCoupon,
    createCoupon,
    getEditCoupon,
    editCoupon,
    deleteCoupon
}