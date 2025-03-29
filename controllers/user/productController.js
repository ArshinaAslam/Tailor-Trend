const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const User = require('../../models/userSchema')

const productDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const productId = req.query.productId;

        const product = await Product.findById(productId).populate('category').lean();
        
        if (!product) {
            return res.redirect('/pageNotFound');
        }

        if (!product.category || !product.category.isListed) {
            return res.render("page-404");
        }

        if(!product || product.isBlocked){
            return res.render("page-404")
        }

        

        const findCategory = product.category;
        const categoryOffer = findCategory?.categoryOffer || 0;
        const productOffer = product.productOffer || 0;
        
       
        res.render('productDetails', {
            user: userData,
            product: product,
            productOffer,
            categoryOffer:categoryOffer,
            category: findCategory,
            sizes: product.sizes
        });

    } catch (error) {
        console.log("Error fetching product details", error);
        res.redirect('/pageNotFound');
    }
};




module.exports = {
    productDetails,
}