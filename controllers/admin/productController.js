const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const Brand = require('../../models/brandSchema')
const User = require('../../models/userSchema')
const {cloudinary} = require('../../config/cloudinary')
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


// const addProduct = async (req, res) => {
//     try {
//       const products = req.body;
  
//       const productExist = await Product.findOne({ 
//         productName: { 
//           $regex: new RegExp(`^${products.productName}$`, 'i') 
//         } 
//       });
      
//       if (productExist) {
//         return res.status(400).json({ 
//           success: false, 
//           message: 'Product already exists. Please try with another name' 
//         });
//       }
  
//       let images = [];
      
//       if (req.files && req.files.length > 0) {
//         for (let i = 0; i < req.files.length; i++) {
//           const originalImagePath = req.files[i].path;
//           const resizedImagePath = path.join('public', 'uploads', 'product-images', req.files[i].filename);
  
//           const dir = path.dirname(resizedImagePath);
//           if (!fs.existsSync(dir)) {
//             fs.mkdirSync(dir, { recursive: true });
//           }
  
//           await sharp(originalImagePath)
//             .resize({ width: 440, height: 440 })
//             .toFile(resizedImagePath);
//           images.push(req.files[i].filename);
//         }
//       }
  
//       if (req.body.images) {
//         const base64Images = Array.isArray(req.body.images) ? req.body.images : [req.body.images];
//         for (let base64Data of base64Images) {
//           const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
//           if (matches && matches.length === 3) {
//             const buffer = Buffer.from(matches[2], 'base64');
//             const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.jpg';
//             const imagePath = path.join('public', 'uploads', 'product-images', filename);
  
//             const dir = path.dirname(imagePath);
//             if (!fs.existsSync(dir)) {
//               fs.mkdirSync(dir, { recursive: true });
//             }
  
//             await fs.promises.writeFile(imagePath, buffer);
//             images.push(filename);
//           }
//         }
//       }
  
//       const categoryId = await Category.findOne({ name: products.category });
//       if (!categoryId) {
//         return res.status(400).json({ 
//           success: false, 
//           message: 'Invalid category name' 
//         });
//       }
  
//       let sizes = [];
      
//       if (typeof products.sizeQuantity === 'object' && !Array.isArray(products.sizeQuantity)) {
//         sizes = Object.entries(products.sizeQuantity)
//           .map(([size, quantity]) => ({
//             size: size.trim(),
//             quantity: parseInt(quantity, 10) || 0
//           }))
//           .filter(item => item.size && !isNaN(item.quantity));
//       } else if (Array.isArray(products.sizeQuantity)) {
//         sizes = products.sizeQuantity
//           .map(sizeData => {
//             try {
//               const parsedData = typeof sizeData === 'string' ? JSON.parse(sizeData) : sizeData;
//               return {
//                 size: parsedData.size?.toString().trim(),
//                 quantity: parseInt(parsedData.quantity, 10) || 0
//               };
//             } catch (e) {
//               return null;
//             }
//           })
//           .filter(item => item && item.size && !isNaN(item.quantity));
//       }
  
//       if (sizes.length === 0) {
//         return res.status(400).json({ 
//           success: false, 
//           message: 'Please provide at least one valid size with quantity' 
//         });
//       }
  
//       const newProduct = new Product({
//         productName: products.productName,
//         description: products.description,
//         brand: products.brand,
//         category: categoryId._id,
//         regularPrice: products.regularPrice,
//         salePrice: products.regularPrice, // Default to regular price initially
//         createdOn: new Date(),
//         sizes: sizes,
//         color: products.color,
//         productImage: images,
//         status: 'Available',
//       });
  
//       // Check if the category has an offer
//       const category = await Category.findById(categoryId._id);
//       if (category && category.categoryOffer > 0) {
//         // Get higher offer between category offer and product offer (if any)
//         const higherOffer = Math.max(category.categoryOffer, newProduct.productOffer || 0);
//         // Calculate sale price based on the offer
//         newProduct.salePrice = newProduct.regularPrice - Math.floor(newProduct.regularPrice * (higherOffer/100));
//       }
  
//       await newProduct.save();
  
//       return res.status(200).json({ 
//         success: true, 
//         message: 'Product added successfully',
//         redirect: '/admin/products'
//       });
       
//     } catch (error) {
//       console.error('Error saving product', error);
//       return res.status(500).json({ 
//         success: false, 
//         message: error.message || 'Internal server error' 
//       });
//     }
//   };



const addProduct = async (req, res) => {
  try {
    const products = req.body;

    const productExist = await Product.findOne({ 
      productName: { 
        $regex: new RegExp(`^${products.productName}$`, 'i') 
      } 
    });
    
    if (productExist) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product already exists. Please try with another name' 
      });
    }

    let images = [];
    
    // Handle uploaded files with multer
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];

        console.log(req.files)
        
        // Upload image to Cloudinary
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'products',
          width: 440,
          height: 440,
          crop: 'fill',
          quality: 'auto'
        });
         console.log(result)
        // Push the Cloudinary URL to the images array
        images.push(result.secure_url);
        
        // Remove temp file after uploading to Cloudinary
        fs.unlinkSync(file.path);
      }
    }

    // Handle base64 images
    if (req.body.images) {
      const base64Images = Array.isArray(req.body.images) ? req.body.images : [req.body.images];
      for (let base64Data of base64Images) {
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          // Upload base64 image to Cloudinary
          const result = await cloudinary.uploader.upload(base64Data, {
            folder: 'products',
            width: 440,
            height: 440,
            crop: 'fill',
            quality: 'auto'
          });
          
          // Push the Cloudinary URL to the images array
          images.push(result.secure_url);
        }
      }
    }

    const categoryId = await Category.findOne({ name: products.category });
    if (!categoryId) {
      return res.status(400).json({ 
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

    if (sizes.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide at least one valid size with quantity' 
      });
    }

    const newProduct = new Product({
      productName: products.productName,
      description: products.description,
      brand: products.brand,
      category: categoryId._id,
      regularPrice: products.regularPrice,
      salePrice: products.regularPrice, // Default to regular price initially
      createdOn: new Date(),
      sizes: sizes,
      color: products.color,
      productImage: images,
      status: 'Available',
    });

    // Check if the category has an offer
    const category = await Category.findById(categoryId._id);
    if (category && category.categoryOffer > 0) {
      // Get higher offer between category offer and product offer (if any)
      const higherOffer = Math.max(category.categoryOffer, newProduct.productOffer || 0);
      // Calculate sale price based on the offer
      newProduct.salePrice = newProduct.regularPrice - Math.floor(newProduct.regularPrice * (higherOffer/100));
    }

    await newProduct.save();

    return res.status(200).json({ 
      success: true, 
      message: 'Product added successfully',
      redirect: '/admin/products'
    });
     
  } catch (error) {
    console.error('Error saving product', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Internal server error' 
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




// const getEditProduct = async (req, res) => {
//     try {
//         const id = req.query.id;
//         const successMessage = req.query.successMessage || null;
//         const product = await Product.findOne({ _id: id }).populate('category'); 
//         const category = await Category.find({});
//         const brand = await Brand.find({});

//         if (!product) {
//             return res.redirect('/admin/products');
//         }

//         const productImages = product.productImage.map(image => `/uploads/product-images/${image}`);

//         res.render('editProduct', {
//             product: product,
//             cat: category,
//             brand: brand,
//             productImages: productImages,
//             errorMessage: null,
//             successMessage: successMessage,
//             selectedCategory: product.category ? product.category.name : '' 
//         });

//     } catch (error) {
//         console.error(error);
//         res.redirect('/pageError');
//     }
// };


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




// const editProduct = async (req, res) => {     
//     try {         
//         const id = req.params.id;                 
//         const {             
//             productName,             
//             description,             
//             regularPrice,             
//             salePrice,             
//             color,             
//             category,             
//             sizeQuantities,             
//             removeImages,             
//             editedImages,
//             editedImagePositions         
//         } = req.body;          
        
        
//         const existingProduct = await Product.findOne({ 
//             _id: { $ne: id }, 
//             productName: { $regex: new RegExp(`^${productName}$`, 'i') }
//         });
        
//         if (existingProduct) {
//             return res.status(400).json({ 
//                 success: false, 
//                 message: 'Product name already exists', 
//                 isNameDuplicate: true
//             });
//         }
        
//         const sizes = JSON.parse(sizeQuantities);         
//         const product = await Product.findOne({ _id: id });          
        
//         if (!product) {             
//             return res.status(404).json({ success: false, message: 'Product not found' });         
//         }          
        
//         let images = [...product.productImage];                  
        
//         const editsMap = [];
//         if (editedImages && editedImagePositions) {
//             const editedImagesArray = Array.isArray(editedImages) ? editedImages : [editedImages];
//             const positionsArray = Array.isArray(editedImagePositions) ? editedImagePositions : [editedImagePositions];
            
//             for (let i = 0; i < editedImagesArray.length; i++) {
//                 const base64Data = editedImagesArray[i];
//                 const position = parseInt(positionsArray[i], 10);
                
//                 if (base64Data.startsWith('data:image')) {
//                     const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
                    
//                     if (matches && matches.length === 3) {
//                         const buffer = Buffer.from(matches[2], 'base64');
//                         const filename = `edited-${Date.now()}-${i}-${Math.round(Math.random() * 1E9)}.jpg`;
//                         const imagePath = path.join('public', 'uploads', 'product-images', filename);
                        
//                         await fs.promises.writeFile(imagePath, buffer);
                        
//                         editsMap.push({
//                             position: position,
//                             filename: filename
//                         });
//                     }
//                 }
//             }
//         }
        
//         if (removeImages) {             
//             const removeImagesArray = Array.isArray(removeImages) ? removeImages : [removeImages];   
            
//             const normalizedRemoveImages = removeImagesArray.map(img => img.includes('/') ? img.split('/').pop() : img);
//             images = images.filter(img => !normalizedRemoveImages.includes(img));         
//         }
        
//         for (const edit of editsMap) {
//             if (Number.isInteger(edit.position) && edit.position >= 0 && edit.position < images.length) {
//                 images[edit.position] = edit.filename;
//             } else {
//                 images.push(edit.filename);
//             }
//         }
        
//         if (req.body.images) {
//             const newImagesArray = Array.isArray(req.body.images) ? req.body.images : [req.body.images];
            
//             for (const base64Data of newImagesArray) {
//                 if (base64Data.startsWith('data:image')) {
//                     const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
                    
//                     if (matches && matches.length === 3) {
//                         const buffer = Buffer.from(matches[2], 'base64');
//                         const filename = `new-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
//                         const imagePath = path.join('public', 'uploads', 'product-images', filename);
                        
//                         await fs.promises.writeFile(imagePath, buffer);
                        
                       
//                         images.push(filename);
//                     }
//                 }
//             }
//         }
        
      
//         if (req.files && req.files.length > 0) {             
//             for (const file of req.files) {                 
//                 images.push(file.filename);             
//             }         
//         }          
        
//         const categoryDoc = await Category.findOne({ name: category });         
//         if (!categoryDoc) {             
//             return res.status(404).json({ success: false, message: 'Category not found' });         
//         }          
        
//         console.log("Updated images array:", images); 
        
//         const updatedProduct = await Product.findByIdAndUpdate(             
//             id,             
//             {                  
//                 productName,                 
//                 description,                 
//                 regularPrice,                 
//                 salePrice,                 
//                 color,                 
//                 category: categoryDoc._id,                 
//                 sizes,                 
//                 productImage: images              
//             },             
//             { new: true }         
//         );          
        
//         res.status(200).json({ success: true, message: 'Successfully updated!', product: updatedProduct });      
//     } catch (error) {         
//         console.error("Error updating product:", error);         
//         return res.status(500).json({ success: false, message: error.message });     
//     } 
// };


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
          return res.status(400).json({ 
              success: false, 
              message: 'Product name already exists', 
              isNameDuplicate: true
          });
      }
      
      const sizes = JSON.parse(sizeQuantities);         
      const product = await Product.findOne({ _id: id });          
      
      if (!product) {             
          return res.status(404).json({ success: false, message: 'Product not found' });         
      }          
      
      let images = [...product.productImage];                  
      
      // Handle removed images
      if (removeImages) {             
          const removeImagesArray = Array.isArray(removeImages) ? removeImages : [removeImages];   
          images = images.filter(img => !removeImagesArray.includes(img));         
      }
      
      // Handle edited images
      if (editedImages && editedImagePositions) {
          const editedImagesArray = Array.isArray(editedImages) ? editedImages : [editedImages];
          const positionsArray = Array.isArray(editedImagePositions) ? editedImagePositions : [editedImagePositions];
          
          for (let i = 0; i < editedImagesArray.length; i++) {
              const base64Data = editedImagesArray[i];
              const position = parseInt(positionsArray[i], 10);
              
              if (base64Data.startsWith('data:image')) {
                  const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
                  
                  if (matches && matches.length === 3) {
                      // Upload edited image to Cloudinary
                      const result = await cloudinary.uploader.upload(base64Data, {
                          folder: 'products',
                          width: 440,
                          height: 440,
                          crop: 'fill',
                          quality: 'auto'
                      });
                      
                      // Replace or add image URL based on position
                      if (Number.isInteger(position) && position >= 0 && position < images.length) {
                          images[position] = result.secure_url;
                      } else {
                          images.push(result.secure_url);
                      }
                  }
              }
          }
      }
      
      // Handle new base64 images
      if (req.body.images) {
          const newImagesArray = Array.isArray(req.body.images) ? req.body.images : [req.body.images];
          
          for (const base64Data of newImagesArray) {
              if (base64Data.startsWith('data:image')) {
                  const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
                  
                  if (matches && matches.length === 3) {
                      // Upload new image to Cloudinary
                      const result = await cloudinary.uploader.upload(base64Data, {
                          folder: 'products',
                          width: 440,
                          height: 440,
                          crop: 'fill',
                          quality: 'auto'
                      });
                      
                      // Add new image URL to images array
                      images.push(result.secure_url);
                  }
              }
          }
      }
      
      // Handle uploaded files with multer
      if (req.files && req.files.length > 0) {
          for (const file of req.files) {
              // Upload to Cloudinary
              const result = await cloudinary.uploader.upload(file.path, {
                  folder: 'products',
                  width: 440,
                  height: 440,
                  crop: 'fill',
                  quality: 'auto'
              });
              
              // Push the Cloudinary URL to the images array
              images.push(result.secure_url);
              
              // Remove temp file after uploading to Cloudinary
              fs.unlinkSync(file.path);
          }
      }          
      
      const categoryDoc = await Category.findOne({ name: category });         
      if (!categoryDoc) {             
          return res.status(404).json({ success: false, message: 'Category not found' });         
      }          
      
      console.log("Updated images array:", images); 
      
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
      
      res.status(200).json({ success: true, message: 'Successfully updated!', product: updatedProduct });      
  } catch (error) {         
      console.error("Error updating product:", error);         
      return res.status(500).json({ success: false, message: error.message });     
  } 
};

const addProductOffer = async (req, res) => {
    try {
        const { percentage, productId } = req.body;

        const parsedPercentage = parseInt(percentage);
        if (isNaN(parsedPercentage) || parsedPercentage < 1 || parsedPercentage > 99) {
            return res.status(400).json({ 
                status: false, 
                message: "Offer must be between 1% and 99%" 
            });
        }

        const findProduct = await Product.findOne({ _id: productId });
        if (!findProduct) {
            return res.status(404).json({ 
                status: false, 
                message: "Product not found" 
            });
        }

        const findCategory = await Category.findOne({ _id: findProduct.category });
        if (!findCategory) {
            return res.status(404).json({ 
                status: false, 
                message: "Category not found" 
            });
        }

        const higherOffer = Math.max(findCategory.categoryOffer || 0, parsedPercentage);
        
        findProduct.salePrice = findProduct.regularPrice - Math.floor(findProduct.regularPrice * (higherOffer / 100));
        findProduct.productOffer = parsedPercentage;
        await findProduct.save();
        
        return res.status(200).json({ 
            status: true, 
            message: "Offer added successfully" 
        });

    } catch (error) {
        console.error("Error in addProductOffer:", error);
        return res.status(500).json({ 
            status: false, 
            message: "Internal Server Error" 
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