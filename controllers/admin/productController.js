const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const Brand = require('../../models/brandSchema')
const User = require('../../models/userSchema')

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')




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

      console.log('product data: ', products);

      const productExist = await Product.findOne({ productName: products.productName });

      if (productExist) {
          return res.status(400).json({ success: false, message: 'Product already exists. Please try with another name' });
      }

      let images = [];

      
      if (req.files && req.files.length > 0) {
          for (let i = 0; i < req.files.length; i++) {
              const originalImagePath = req.files[i].path;
              const resizedImagePath = path.join('public', 'uploads', 'product-images', req.files[i].filename);

              const dir = path.dirname(resizedImagePath);
              if (!fs.existsSync(dir)) {
                  fs.mkdirSync(dir, { recursive: true });
              }

              await sharp(originalImagePath).resize({ width: 440, height: 440 }).toFile(resizedImagePath);
              images.push(req.files[i].filename);
          }
      }

      
      if (req.body.images) {
          const base64Images = Array.isArray(req.body.images) ? req.body.images : [req.body.images];
          for (let base64Data of base64Images) {
              const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
              if (matches && matches.length === 3) {
                  const buffer = Buffer.from(matches[2], 'base64');
                  const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.jpg';
                  const imagePath = path.join('public', 'uploads', 'product-images', filename);

                  const dir = path.dirname(imagePath);
                  if (!fs.existsSync(dir)) {
                      fs.mkdirSync(dir, { recursive: true });
                  }

                  await fs.promises.writeFile(imagePath, buffer);
                  images.push(filename);
              }
          }
      }

      
      const categoryId = await Category.findOne({ name: products.category });
      if (!categoryId) {
          return res.status(400).json({ success: false, message: 'Invalid category name' });
      }

             
             let sizes = [];

             if (typeof products.sizeQuantity === 'object' && !Array.isArray(products.sizeQuantity)) {
                
                 sizes = Object.entries(products.sizeQuantity).map(([size, quantity]) => ({
                     size,
                     quantity: parseInt(quantity, 10)
                 }));
             } else if (Array.isArray(products.sizeQuantity)) {
                 
                 sizes = products.sizeQuantity.map(sizeData => {
                     const parsedData = JSON.parse(sizeData);
                     return {
                         size: parsedData.size,
                         quantity: parseInt(parsedData.quantity, 10)
                     };
                 });
             }
     
             console.log("Parsed Sizes:", sizes);

      
      const newProduct = new Product({
          productName: products.productName,
          description: products.description,
          brand: products.brand,
          category: categoryId._id,
          regularPrice: products.regularPrice,
          salePrice: products.salePrice,
          createdOn: new Date(),
          
          sizes: sizes, 
          color: products.color,
          productImage: images,
          status: 'Available',
      });

      await newProduct.save();

      
      res.redirect('/admin/products')
    

     
  } catch (error) {
      console.error('Error saving product', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
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

        const productImages = product.productImage.map(image => `/uploads/product-images/${image}`);

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
        console.log('Received request:', req.body, req.files);

        const id = req.params.id;
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const data = req.body;
        const categoryId = await Category.findOne({ name: data.category });
        if (!categoryId) {
            return res.status(400).json({ success: false, message: `Category '${data.category}' not found.` });
        }

        
        let imageUrls = product.images; 
        if (req.files && req.files.length > 0) {
            imageUrls = req.files.map(file => file.path);
        }

       
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            {
                productName: data.name,
                description: data.description,
                brand: data.brand,
                category: categoryId._id,
                regularPrice: data.price,
                salePrice: data.saleprice,
                quantity: data.quantity,
                size: data.size,
                color: data.color,
                images: imageUrls, 
                status: data.status || 'Available'
            },
            { new: true }
        );

        if (!updatedProduct) {
            return res.status(400).json({ success: false, message: 'Failed to update product' });
        }

        res.status(200).json({ success: true, message: 'product updated successfully!' })

    } catch (error) {
        console.error("Error updating product:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};



  


  
module.exports = {
    productInfo,
    loadAddProduct,
    addProduct,
    blockedProduct,
    unblockedProduct,
    getEditProduct,
    editProduct,

}