const User = require('../../models/userSchema')
const Product = require('../../models/productSchema')
const mongodb = require("mongodb");
const mongoose = require('mongoose')
const Cart = require('../../models/cartSchema')
const Address = require("../../models/addressSchema"); 
const Coupon = require("../../models/couponSchema")


// const getCartPage = async (req, res) => {
//   try {
//     const userId = req.session.user;
//     if (!userId) return res.redirect("/login");

//     const user = await User.findById(userId);
//     let cart = await Cart.findOne({ userId }).populate("items.productId");

//     let isBlockedItem = false;
//     const currentPage = parseInt(req.query.page) || 1;
//     const itemsPerPage = 4;

//     if (!cart || cart.items.length === 0) {
//       return res.render("cart", { 
//         user, 
//         data: [], 
//         quantity: 0, 
//         grandTotal: 0,
//         isBlockedItem,
//         currentPage: 1,
//         totalPages: 0
//       });
//     }

   
//     cart.items = cart.items.filter(item => item.productId !== null);
//     await cart.save();

    
//     let grandTotal = 0;
//     let quantity = 0;
//     cart.items.forEach((item) => {
//       quantity += item.quantity;
//       grandTotal += item.productId.salePrice * item.quantity;
//       if (item.productId.isBlocked) {
//         isBlockedItem = true;
//       }
//     });

//     const startIndex = (currentPage - 1) * itemsPerPage;
//     const endIndex = currentPage * itemsPerPage;
//     const totalPages = Math.ceil(cart.items.length / itemsPerPage);

    
//     const paginatedItems = cart.items.slice(startIndex, endIndex);


//     const data = paginatedItems.map((item) => {
//       return {
//         productDetails: [item.productId],
//         quantity: item.quantity,
//         size: item.size,
//         itemId: item._id,
//         isBlocked: item.productId.isBlocked 
//       };
//     });

//     res.render("cart", {
//       user,
//       data,
//       quantity,
//       grandTotal,
//       isBlockedItem,
//       currentPage,
//       totalPages
//     });

//   } catch (error) {
//     console.log("Error fetching cart:", error);
//     res.redirect("/pageNotFound");
//   }
// };



const getCartPage = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.redirect("/login");

    const user = await User.findById(userId);
    let cart = await Cart.findOne({ userId }).populate("items.productId");

    let isBlockedItem = false;
    let hasZeroQuantity = false;
    const currentPage = parseInt(req.query.page) || 1;
    const itemsPerPage = 4;

    if (!cart || cart.items.length === 0) {
      return res.render("cart", {
        user,
        data: [],
        quantity: 0,
        grandTotal: 0,
        isBlockedItem,
        hasZeroQuantity,
        currentPage: 1,
        totalPages: 0,
      });
    }

    // Filter out null productIds and check stock availability
    cart.items = await Promise.all(
      cart.items.filter((item) => item.productId !== null).map(async (item) => {
        const product = item.productId;
        const selectedSize = product.sizes.find((s) => s.size === item.size);
        if (selectedSize && selectedSize.quantity === 0) {
          hasZeroQuantity = true; // Mark as zero quantity if stock is depleted
        }
        return item;
      })
    );
    await cart.save();

    let grandTotal = 0;
    let quantity = 0;
    cart.items.forEach((item) => {
      quantity += item.quantity;
      grandTotal += item.productId.salePrice * item.quantity;
      if (item.productId.isBlocked) isBlockedItem = true;
      const selectedSize = item.productId.sizes.find((s) => s.size === item.size);
      if (selectedSize.quantity === 0) hasZeroQuantity = true; // Check stock, not cart quantity
    });

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = currentPage * itemsPerPage;
    const totalPages = Math.ceil(cart.items.length / itemsPerPage);

    const paginatedItems = cart.items.slice(startIndex, endIndex);

    const data = paginatedItems.map((item) => {
      const selectedSize = item.productId.sizes.find((s) => s.size === item.size);
      return {
        productDetails: [item.productId],
        quantity: item.quantity,
        size: item.size,
        itemId: item._id,
        isBlocked: item.productId.isBlocked,
        isOutOfStock: selectedSize.quantity === 0, // Add flag for out-of-stock items
      };
    });

    res.render("cart", {
      user,
      data,
      quantity,
      grandTotal,
      isBlockedItem, 
      hasZeroQuantity,
      currentPage,
      totalPages,
    });
  } catch (error) {
    console.log("Error fetching cart:", error);
    res.redirect("/pageNotFound");
  }
};


const checkCartStock = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.status(401).json({ status: false });

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) return res.status(404).json({ status: false });

    const items = cart.items.map((item) => {
      const selectedSize = item.productId.sizes.find((s) => s.size === item.size);
      return {
        productId: item.productId._id,
        size: item.size,
        isOutOfStock: selectedSize.quantity === 0,
      };
    });

    res.json({ status: true, items });
  } catch (error) {
    console.error("Error checking cart stock:", error);
    res.status(500).json({ status: false });
  }
};



// const changeQuantity = async (req, res) => {
//   try {
//     const { productId, count, size } = req.body;
//     const userId = req.session.user;

//     if (!userId) {
//       return res.status(401).json({ status: false, error: "User not authenticated" });
//     }

//     const cart = await Cart.findOne({ userId });
//     console.log(":cart is",cart)
//     if (!cart) {
//       return res.status(404).json({ status: false, error: "Cart not found" });
//     }

//     const product = await Product.findById(productId);

   
//     if (!product) {
//       return res.status(404).json({ status: false, error: "Product not found" });
//     }

//     const selectedSize = product.sizes.find(s => s.size === size);
//     if (!selectedSize) {
//       return res.status(400).json({ status: false, error: "Size not available" });
//     }

//     const cartItem = cart.items.find(item => 
//       item.productId.toString() === productId && item.size === size
//     );
//     if (!cartItem) {
//       return res.status(404).json({ status: false, error: "Product not found in cart" });
//     }

//     const oldQuantity = cartItem.quantity;
//     let newQuantity = oldQuantity + count;

//     if (newQuantity < 1) newQuantity = 1;
//     if (newQuantity > 10) {
//       return res.status(400).json({ 
//         status: false, 
//         error: "Maximum limit of 10 items per product" 
//       });
//     }

   
//     if (count > 0 && newQuantity > selectedSize.quantity) {
//       return res.status(400).json({ 
//         status: false, 
//         error: `Only ${selectedSize.quantity} items available for size ${size}` 
//       });
//     }

//     cartItem.quantity = newQuantity;
//     cartItem.totalPrice = cartItem.price * newQuantity;

//     await cart.save();

//     const grandTotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

//     res.json({
//       status: true,
//       quantityInput: newQuantity,
//       totalAmount: cartItem.totalPrice,
//       grandTotal: grandTotal
//     });

//   } catch (error) {
//     console.error("Error in changeQuantity:", error);
//     res.status(500).json({ status: false, error: "Server error" });
//   }
// };

const changeQuantity = async (req, res) => {
  try {
    const { productId, count, size } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ status: false, error: "User not authenticated" });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ status: false, error: "Cart not found" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ status: false, error: "Product not found" });
    }

    const selectedSize = product.sizes.find((s) => s.size === size);
    if (!selectedSize) {
      return res.status(400).json({ status: false, error: "Size not available" });
    }

    const cartItem = cart.items.find(
      (item) => item.productId.toString() === productId && item.size === size
    );
    if (!cartItem) {
      return res.status(404).json({ status: false, error: "Product not found in cart" });
    }

    const oldQuantity = cartItem.quantity;
    let newQuantity = oldQuantity + count;

    // Prevent quantity from going below 1 when using buttons
    if (newQuantity < 1) {
      return res.status(400).json({
        status: false,
        error: "Quantity cannot be less than 1",
      });
    }
    if (newQuantity > 10) {
      return res.status(400).json({
        status: false,
        error: "Maximum limit of 10 items per product",
      });
    }

    if (count > 0 && newQuantity > selectedSize.quantity) {
      return res.status(400).json({
        status: false,
        error: `Only ${selectedSize.quantity} items available for size ${size}`,
      });
    }

    cartItem.quantity = newQuantity;
    cartItem.totalPrice = cartItem.price * newQuantity;

    await cart.save();

    const grandTotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

    res.json({
      status: true,
      quantityInput: newQuantity,
      totalAmount: cartItem.totalPrice,
      grandTotal: grandTotal,
    });
  } catch (error) {
    console.error("Error in changeQuantity:", error);
    res.status(500).json({ status: false, error: "Server error" });
  }
};



const addToCart = async (req, res) => {
  try {
    const { productId, size } = req.body;
    const userId = req.session.user;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: "Login before adding to the cart!" });
    }
    
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }
    
    const product = await Product.findById(new mongoose.Types.ObjectId(productId));
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found!" });
    }
    
    const sizeObj = product.sizes.find(s => s.size === size);
    if (!sizeObj || sizeObj.quantity <= 0) {
      return res.status(400).json({ success: false, message: "Selected size is out of stock" });
    }
    
   
    const realAvailableQty = await getRealAvailableQuantity(productId, size);
    if (realAvailableQty <= 0) {
      return res.status(400).json({
        success: false,
        message: "This item is out of stock"
      });
    }
    
    let cart = await Cart.findOne({ userId });
    
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }
    
    const existingItem = cart.items.find(item => 
      item.productId.equals(product._id) && item.size === size
    );
    
    
    const currentCartQuantity = existingItem ? existingItem.quantity : 0;
    
    
    if (currentCartQuantity + 1 > realAvailableQty) {
      return res.status(400).json({
        success: false,
        message: "Cannot add more of this item. Maximum available quantity reached."
      });
    }
    
    if (existingItem) {
      existingItem.quantity += 1;
      existingItem.totalPrice = existingItem.quantity * product.salePrice;
    } else {
      cart.items.push({
        productId: product._id,
        size: size,
        price: product.salePrice,
        quantity: 1,
        totalPrice: product.salePrice
      });
    }
    
    await cart.save();
    
    return res.status(200).json({ 
      success: true, 
      message: "Product added successfully to the cart!" 
    });
  } catch (error) {
    console.log("Error while adding to cart:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


const getRealAvailableQuantity = async (productId, size) => {
  try {
   
    const product = await Product.findById(productId);
    if (!product) return 0;
    
    const sizeObj = product.sizes.find(s => s.size === size);
    const totalInventory = sizeObj ? sizeObj.quantity : 0;
    
   
    const cartItems = await Cart.aggregate([
      { $unwind: "$items" },
      { 
        $match: { 
          "items.productId": new mongoose.Types.ObjectId(productId),
          "items.size": size
        }
      },
      {
        $group: {
          _id: null,
          totalInCarts: { $sum: "$items.quantity" }
        }
      }
    ]);
    
    const inCarts = cartItems.length > 0 ? cartItems[0].totalInCarts : 0;
    return totalInventory - inCarts;
  } catch (error) {
    console.log("Error in getRealAvailableQuantity:", error);
    return 0; 
  }
};




// const loadCheckout = async (req, res) => {
//   try {
//     const userId = req.session.user;
    
//     if (!userId) {
//       return res.redirect("/login");
//     }

    
//     const cart = await Cart.findOne({ userId }).populate("items.productId");
    
    
//     let grandTotal = 0;
//     if (cart && cart.items.length > 0) {
//       for (let i = 0; i < cart.items.length; i++) {
//         grandTotal += cart.items[i].totalPrice;
//       }
//     }

   
//     const userAddress = await Address.findOne({ userId });
    
    
//     const user = await User.findById(userId);
    
   

//     const coupons = await Coupon.find({
//       expireOn: { $gte: new Date() }, 
//          isList: true 
//     })

//     let offerPrice = 0;
    
//     if (cart) {
     
//       offerPrice = cart.offerPrice || 0;
      
    
//       if (cart.coupon) {
//         const appliedCoupon = await Coupon.findById(cart.coupon);
//         if (appliedCoupon && grandTotal >= appliedCoupon.minimumPrice) {
//           offerPrice = appliedCoupon.offerPrice;
//         } else if (appliedCoupon && grandTotal < appliedCoupon.minimumPrice) {
         
//           await Cart.updateOne({ userId }, { $unset: { coupon: "" }, offerPrice: 0 });
//           offerPrice = 0;
//         }
//       }
//     }
    
    
//     res.render("checkout", {
//       product: cart?.items || [],
//       userAddress,
//       grandTotal,
//       offerPrice,
//       user,
//       Coupon: coupons,
//       isCart: !!cart
//     });
//   } catch (error) {
//     console.error("Error loading checkout:", error);
//     res.status(500).send("Internal Server Error");
//   }
// };


const loadCheckout = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      return res.redirect("/login");
    }

    // Fetch the cart and populate product details
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    let grandTotal = 0;
    let hasOutOfStock = false; // Flag to track if any item is out of stock

    if (cart && cart.items.length > 0) {
      for (let i = 0; i < cart.items.length; i++) {
        const item = cart.items[i];
        grandTotal += item.totalPrice;

        // Check if the product is out of stock for the selected size
        const selectedSize = item.productId.sizes.find((s) => s.size === item.size);
        if (selectedSize && selectedSize.quantity === 0) {
          hasOutOfStock = true; // Mark if any item is out of stock
        }
      }
    }

    // Fetch user address and user details
    const userAddress = await Address.findOne({ userId });
    const user = await User.findById(userId);

    // Fetch available coupons
    const coupons = await Coupon.find({
      expireOn: { $gte: new Date() },
      isList: true,
    });

    let offerPrice = 0;

    if (cart) {
      offerPrice = cart.offerPrice || 0;

      if (cart.coupon) {
        const appliedCoupon = await Coupon.findById(cart.coupon);
        if (appliedCoupon && grandTotal >= appliedCoupon.minimumPrice) {
          offerPrice = appliedCoupon.offerPrice;
        } else if (appliedCoupon && grandTotal < appliedCoupon.minimumPrice) {
          await Cart.updateOne(
            { userId },
            { $unset: { coupon: "" }, offerPrice: 0 }
          );
          offerPrice = 0;
        }
      }
    }

    
    res.render("checkout", {
      product: cart?.items || [],
      userAddress,
      grandTotal,
      offerPrice,
      user,
      Coupon: coupons,
      isCart: !!cart,
      hasOutOfStock, 
    });
  } catch (error) {
    console.error("Error loading checkout:", error);
    res.status(500).send("Internal Server Error");
  }
};


const applyCoupon = async(req,res)=>{
  try {
    const { couponCode, grandTotal } = req.body;
    const userId = req.session.user;

    

   
    const coupon = await Coupon.findOne({ 
      name: couponCode,
      isList: true,
     
  });
console.log("coupon is",coupon)
  if (!coupon) {
    return res.status(400).json({
        success: false,
        message: 'Invalid coupon code'
    });
}


if (coupon.userId.length > 0 && !coupon.userId.includes(userId)) {
  return res.status(400).json({
      success: false,
      message: 'This coupon is not available for your account'
  });
}

if (grandTotal < coupon.minimumPrice) {
  return res.status(400).json({
      success: false,
      message: `Minimum purchase of ₹${coupon.minimumPrice} required`
  });
}

const discountAmount = coupon.offerPrice;
const updatedTotal = grandTotal - discountAmount;


await Cart.findOneAndUpdate(
  { userId },
  { 
      coupon: coupon._id,
      offerPrice: discountAmount,
      total: updatedTotal
  }
);



res.json({
  success: true,
  message: 'Coupon applied successfully',
  discountAmount,
  updatedTotal
});

    
  } catch (error) {

    console.error('Error applying coupon:', error);
    res.status(500).json({
        success: false,
        message: 'Server error while applying coupon'
    });
    
  }
}


const removeCoupon = async(req,res)=>{
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId });

    if (!cart) {
        return res.status(400).json({ success: false, message: 'Cart not found' });
    }

    
    const grandTotal = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);
    
    
    cart.coupon = undefined;
    cart.offerPrice = 0;
    cart.total = grandTotal;
    await cart.save();

    res.json({
        success: true,
        grandTotal,
        message: 'Coupon removed successfully'
    });
} catch (error) {
    console.error('Error removing coupon:', error);
    res.status(500).json({ success: false, message: 'Server error' });
}
}


const removeCartItem = async (req, res) => {

  
  try {
    const { itemId } = req.body;
    const userId = req.session.user;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    const removedItem = cart.items[itemIndex];
    cart.items.splice(itemIndex, 1);

    

    await cart.save();

    res.status(200).json({ success: true, message: "Item removed successfully", updatedCart: cart });
  } catch (error) {
    console.error("Error removing item from cart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};






  module.exports = {
    getCartPage,
    addToCart,
    changeQuantity,
    removeCartItem,
    loadCheckout,
    applyCoupon,
    removeCoupon,


    checkCartStock
   

  
  } 