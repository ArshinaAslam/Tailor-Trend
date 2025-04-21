const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const Brand = require('../../models/brandSchema')
const User = require('../../models/userSchema')
const {cloudinary} = require('../../config/cloudinary')
const Status = require('../statusCodes')
const { v4: uuidv4 } = require('uuid');
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const upload =require("multer")




const productInfo = async (req, res) => {
  try {
      let search = req.query.search || "";
      const page = parseInt(req.query.page) || 1;  
      const limit = 4;

      const productData = await Product.find({
          $or: [
              { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
              { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }
          ]
      })
      .populate({
          path: 'category',
          select: 'name'  
      })
      .sort({ createdAt: -1 }) 
      .limit(limit)
      .skip((page - 1) * limit) 
      .exec();

      const count = await Product.countDocuments({
          $or: [
              { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
              { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }
          ]
      });

      const category = await Category.find({ isListed: true });
      const brand = await Brand.find({ isBlocked: false });

      if (category && brand) {
          res.render("products", {
              data: productData,
              currentPage: page,  
              totalPages: Math.ceil(count / limit),
              cat: category,
              brand: brand,
              search: search
          });
      } else {
          res.render('page-404');
      }
  } catch (error) {
      res.redirect('/pageError');
  }
};



const loadAddProduct = async (req,res)=>{
    try {
        const category = await Category.find({isListed:true})
        const brand = await Brand.find({isBlocked:false})
        res.render('addProduct',{
            cat : category ,
            brand : brand ,
        })
    } catch (error) {

        res.redirect('/pageError')
        
    }
}




const addProduct = async (req, res) => {
  try {
    const products = req.body;

    const productExist = await Product.findOne({ 
      productName: { 
        $regex: new RegExp(`^${products.productName}$`, 'i') 
      } 
    });
    
    if (productExist) {
      return res.status(Status.BAD_REQUEST).json({ 
        success: false, 
        message: 'Product already exists. Please try with another name' 
      });
    }

    let images = [];
    
    
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];

        console.log(req.files)
        
    
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'products',
          width: 440,
          height: 440,
          crop: 'fill',
          quality: 'auto'
        });
         console.log(result)
        
        images.push(result.secure_url);
        
  
        fs.unlinkSync(file.path);
      }
    }

  
    if (req.body.images) {
      const base64Images = Array.isArray(req.body.images) ? req.body.images : [req.body.images];
      for (let base64Data of base64Images) {
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
   
          const result = await cloudinary.uploader.upload(base64Data, {
            folder: 'products',
            width: 440,
            height: 440,
            crop: 'fill',
            quality: 'auto'
          });
          
      
          images.push(result.secure_url);
        }
      }
    }

    const categoryId = await Category.findOne({ name: products.category });
    if (!categoryId) {
      return res.status(Status.BAD_REQUEST).json({ 
        success: false, 
        message: 'Invalid category name' 
      });
    }

    let sizes = [];
    
    if (typeof products.sizeQuantity === 'object' && !Array.isArray(products.sizeQuantity)) {
      sizes = Object.entries(products.sizeQuantity)
        .map(([size, quantity]) => ({
          size: size.trim(),
          quantity: parseInt(quantity, 10) || 0
        }))
        .filter(item => item.size && !isNaN(item.quantity));
    } else if (Array.isArray(products.sizeQuantity)) {
      sizes = products.sizeQuantity
        .map(sizeData => {
          try {
            const parsedData = typeof sizeData === 'string' ? JSON.parse(sizeData) : sizeData;
            return {
              size: parsedData.size?.toString().trim(),
              quantity: parseInt(parsedData.quantity, 10) || 0
            };
          } catch (e) {
            return null;
          }
        })
        .filter(item => item && item.size && !isNaN(item.quantity));
    }

    if (Array.isArray(sizes)) {
      for (const sizeObj of sizes) {
        if (sizeObj.quantity < 0) {
          return res.status(Status.BAD_REQUEST).json({ 
            success: false, 
            message: 'Quantity cannot be a negative value' 
          });
        }
      }
    }





    const newProduct = new Product({
      productName: products.productName,
      description: products.description,
      brand: products.brand,
      category: categoryId._id,
      regularPrice: products.regularPrice,
      salePrice: products.regularPrice, 
      createdOn: new Date(),
      sizes: sizes,
      color: products.color,
      productImage: images,
      status: 'Available',
    });


    const category = await Category.findById(categoryId._id);
    if (category && category.categoryOffer > 0) {
  
      const higherOffer = Math.max(category.categoryOffer, newProduct.productOffer || 0);

      newProduct.salePrice = newProduct.regularPrice - Math.floor(newProduct.regularPrice * (higherOffer/100));
    }

    await newProduct.save();

    return res.status(Status.OK).json({ 
      success: true, 
      message: 'Product added successfully',
      redirect: '/admin/products'
    });
     
  } catch (error) {
    console.error('Error saving product', error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ 
      success: false, 
      message: error.message || Message.SERVER_ERROR 
    });
  }
};

  const blockedProduct = async (req,res)=>{
    try {
        const id = req.query.id
        await Product.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect('/admin/products')
        
    } catch (error) {
        res.redirect('/pageError')
        
    }
  }


  const unblockedProduct = async (req,res)=>{
    try {
        const id = req.query.id
        await Product.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect("/admin/products")
        
    } catch (error) {
        res.redirect('/pageError')
        
    }

  }





const getEditProduct = async (req, res) => {
  try {
      const id = req.query.id;
      const successMessage = req.query.successMessage || null;
      const product = await Product.findOne({ _id: id }).populate('category'); 
      const category = await Category.find({});
      const brand = await Brand.find({});

      if (!product) {
          return res.redirect('/admin/products');
      }

      const productImages = product.productImage;

      res.render('editProduct', {
          product: product,
          cat: category,
          brand: brand,
          productImages: productImages,
          errorMessage: null,
          successMessage: successMessage,
          selectedCategory: product.category ? product.category.name : '' 
      });

  } catch (error) {
      console.error(error);
      res.redirect('/pageError');
  }
};



const editProduct = async (req, res) => {     
  try {         
      const id = req.params.id;                 
      const {             
          productName,             
          description,             
          regularPrice,             
          salePrice,             
          color,             
          category,             
          sizeQuantities,             
          removeImages,             
          editedImages,
          editedImagePositions         
      } = req.body;          
      
      const existingProduct = await Product.findOne({ 
          _id: { $ne: id }, 
          productName: { $regex: new RegExp(`^${productName}$`, 'i') }
      });
      
      if (existingProduct) {
          return res.status(Status.BAD_REQUEST).json({ 
              success: false, 
              message: 'Product name already exists', 
              isNameDuplicate: true
          });
      }
      
      const sizes = JSON.parse(sizeQuantities);         
      const product = await Product.findOne({ _id: id });          
      
      if (!product) {             
          return res.status(Status.NOT_FOUND).json({ success: false, message: 'Product not found' });         
      }          
      
      let images = [...product.productImage];                  
      
      
      if (removeImages) {             
          const removeImagesArray = Array.isArray(removeImages) ? removeImages : [removeImages];
         
          
          
          images = images.filter(img => !removeImagesArray.includes(img));
      }
      
     
      if (editedImages && editedImagePositions) {
          const editedImagesArray = Array.isArray(editedImages) ? editedImages : [editedImages];
          const positionsArray = Array.isArray(editedImagePositions) ? editedImagePositions : [editedImagePositions];
          
          for (let i = 0; i < editedImagesArray.length; i++) {
              const base64Data = editedImagesArray[i];
              const position = parseInt(positionsArray[i], 10);
              
              if (base64Data.startsWith('data:image')) {
                  const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
                  
                  if (matches && matches.length === 3) {
                     
                      const result = await cloudinary.uploader.upload(base64Data, {
                          folder: 'products',
                          width: 440,
                          height: 440,
                          crop: 'fill',
                          quality: 'auto'
                      });
                      
                      
                      if (Number.isInteger(position) && position >= 0 && position < images.length) {
                          images[position] = result.secure_url;
                      } else {
                          images.push(result.secure_url);
                      }
                  }
              }
          }
      }
      

      if (req.body.images) {
          const newImagesArray = Array.isArray(req.body.images) ? req.body.images : [req.body.images];
          
          for (const base64Data of newImagesArray) {
              if (base64Data.startsWith('data:image')) {
                  const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
                  
                  if (matches && matches.length === 3) {
                   
                      const result = await cloudinary.uploader.upload(base64Data, {
                          folder: 'products',
                          width: 440,
                          height: 440,
                          crop: 'fill',
                          quality: 'auto'
                      });
                      
                    
                      images.push(result.secure_url);
                  }
              }
          }
      }
      
     
      if (req.files && req.files.length > 0) {
          for (const file of req.files) {
           
              const result = await cloudinary.uploader.upload(file.path, {
                  folder: 'products',
                  width: 440,
                  height: 440,
                  crop: 'fill',
                  quality: 'auto'
              });
              
             
              images.push(result.secure_url);
              
             
              fs.unlinkSync(file.path);
          }
      }          
      
      const categoryDoc = await Category.findOne({ name: category });         
      if (!categoryDoc) {             
          return res.status(Status.NOT_FOUND).json({ success: false, message: 'Category not found' });         
      }          
      
      
      
      const updatedProduct = await Product.findByIdAndUpdate(             
          id,             
          {                  
              productName,                 
              description,                 
              regularPrice,                 
              salePrice,                 
              color,                 
              category: categoryDoc._id,                 
              sizes,                 
              productImage: images              
          },             
          { new: true }         
      );          
      
      res.status(Status.OK).json({ success: true, message: 'Successfully updated!', product: updatedProduct });      
  } catch (error) {         
      console.error("Error updating product:", error);         
      return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });     
  } 
};


const addProductOffer = async (req, res) => {
    try {
        const { percentage, productId } = req.body;

        const parsedPercentage = parseInt(percentage);
        if (isNaN(parsedPercentage) || parsedPercentage < 1 || parsedPercentage > 99) {
            return res.status(Status.BAD_REQUEST).json({ 
                status: false, 
                message: "Offer must be between 1% and 99%" 
            });
        }

        const findProduct = await Product.findOne({ _id: productId });
        if (!findProduct) {
            return res.status(Status.NOT_FOUND).json({ 
                status: false, 
                message: "Product not found" 
            });
        }

        const findCategory = await Category.findOne({ _id: findProduct.category });
        if (!findCategory) {
            return res.status(Status.NOT_FOUND).json({ 
                status: false, 
                message: "Category not found" 
            });
        }

        const higherOffer = Math.max(findCategory.categoryOffer || 0, parsedPercentage);
        
        findProduct.salePrice = findProduct.regularPrice - Math.floor(findProduct.regularPrice * (higherOffer / 100));
        findProduct.productOffer = parsedPercentage;
        await findProduct.save();
        
        return res.status(Status.OK).json({ 
            status: true, 
            message: "Offer added successfully" 
        });

    } catch (error) {
        console.error("Error in addProductOffer:", error);
        return res.status(Status.INTERNAL_SERVER_ERROR).json({ 
            status: false, 
            message: Message.SERVER_ERROR
        });
    }
};





const removeProductOffer=async(req,res)=>{
    try {
        const {productId} = req.body
        const findProduct = await Product.findOne({_id:productId});
        const findCategory = await Category.findOne({_id:findProduct.category}) 
        const categoryOffer = findCategory.categoryOffer || 0
        findProduct.salePrice = findProduct.regularPrice - Math.floor(findProduct.regularPrice*(categoryOffer/100))
        findProduct.productOffer = 0
        await findProduct.save();
        res.json({status:true});

    } catch (error) {
        res.redirect('/pageerror')
    }
}

  
module.exports = {
    productInfo,
    loadAddProduct,
    addProduct,
    blockedProduct,
    unblockedProduct,
    getEditProduct,
    editProduct,
    addProductOffer,
    removeProductOffer

}