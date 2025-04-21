const User = require('../../models/userSchema')
const Product = require('../../models/productSchema');
const Wishlist = require('../../models/wishlistSchema');
const Status = require('../statusCodes')
const Message = require('../messages')





const getWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);
        let page = parseInt(req.query.page) || 1;
        const limit = 3;
        
        let wishlistData = await Wishlist.findOne({ userId }).populate({
            path: 'products.productId',
            populate: {
                path: 'category'
            }
        });
        
        if (!wishlistData || !wishlistData.products.length) {
            return res.render("wishlist", {
                user,
                wishlist: [],
                totalPages: 0,
                currentPage: 1
            });
        }
        
     
        const availableProducts = wishlistData.products.filter(item => 
            item.productId && item.productId.isBlocked !== true
        );
        
        const totalProducts = availableProducts.length;
        const totalPages = Math.ceil(totalProducts / limit);
        
        if (page > totalPages && totalPages > 0) {
            page = totalPages;
            return res.redirect(`/wishlist?page=${page}`);
        }
        
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedProducts = availableProducts.slice(startIndex, endIndex);
        
        res.render("wishlist", {
            user,
            wishlist: paginatedProducts,
            totalPages,
            currentPage: page
        });
    } catch (error) {
        console.error(error);
        res.redirect("/pageNotFound");
    }
};



const addToWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(Status.UNAUTHORIZED).json({ status: false, message: "User not logged in" });
        }
        
        if (!productId) {
            return res.status(Status.BAD_REQUEST).json({ status: false, message: "Product ID is missing" });
        }

        let wishlist = await Wishlist.findOne({ userId });

        if (wishlist) {
          
            const productExists = wishlist.products.some(item => item.productId.equals(productId));

            if (productExists) {
                return res.status(Status.BAD_REQUEST).json({ status: false, message: "Product already in wishlist" });
            }

            wishlist.products.push({ productId });
            await wishlist.save();
        } else {
            wishlist = new Wishlist({
                userId,
                products: [{ productId }]
            });
            await wishlist.save();
        }

        return res.json({ status: true, message: "Product added to wishlist" });

    } catch (error) {
        console.error("Wishlist Error:", error);
        return res.status(Status.INTERNAL_SERVER_ERROR).json({ status: false, message: Message.SERVER_ERROR });
    }
};
const removeFromWishlist = async (req, res) => {
    try {
        const productId = req.params.id;
        const userId = req.session.user;

        
        const updatedWishlist = await Wishlist.findOneAndUpdate(
            { userId },
            { $pull: { products: { productId } } },
            { new: true }
        );

        if (!updatedWishlist) {
            return res.status(Status.NOT_FOUND).json({ status: false, message: "Wishlist not found" });
        }

        res.redirect('/wishlist');
    } catch (error) {
        console.error(error);
        return res.status(Status.INTERNAL_SERVER_ERROR).json({ status: false, message: Message.SERVER_ERROR });
    }
};


module.exports = {
    getWishlist,
    addToWishlist,
    removeFromWishlist
}