const User = require('../../models/userSchema')
const Product = require('../../models/productSchema')
const mongodb = require("mongodb");
const mongoose = require('mongoose')
const Cart = require('../../models/cartSchema')
const Address = require("../../models/addressSchema"); 



const getCartPage = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.redirect("/login");

    const user = await User.findById(userId);
    let cart = await Cart.findOne({ userId }).populate("items.productId");

    let isBlockedItem = false;

    if (!cart || cart.items.length === 0) {
      return res.render("cart", { user, data: [], quantity: 0, grandTotal: 0 ,isBlockedItem});
    }

    

    let grandTotal = 0;
    let quantity = 0;
    

    
    cart.items = cart.items.filter(item => item.productId !== null);
    await cart.save();

    const data = cart.items.map((item) => {
      quantity += item.quantity;
      grandTotal += item.productId.salePrice * item.quantity;
      if (item.productId.isBlocked) {
        isBlockedItem = true;
      }

      return {
        productDetails: [item.productId],
        quantity: item.quantity,
        size: item.size,
        itemId: item._id,
        isBlocked: item.productId.isBlocked 
      };
    });

    res.render("cart", {
      user,
      data,
      quantity,
      grandTotal,
      isBlockedItem
    });

  } catch (error) {
    console.log("Error fetching cart:", error);
    res.redirect("/pageNotFound");
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

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

   
    const existingItem = cart.items.find(item => 
      item.productId.equals(product._id) && item.size === size
    );

    if (existingItem) {
      
      if (sizeObj.quantity < 1) {
        return res.status(400).json({ success: false, message: "Insufficient stock for selected size" });
      }
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

    
    sizeObj.quantity -= 1;
    await product.save();

    await cart.save();

    return res.status(200).json({ success: true, message: "Product added successfully to the cart!" });

  } catch (error) {
    console.log("Error while adding to cart:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


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

    const selectedSize = product.sizes.find(s => s.size === size);
    if (!selectedSize) {
      return res.status(400).json({ status: false, error: "Size not available" });
    }

    const cartItem = cart.items.find(item => 
      item.productId.toString() === productId && item.size === size
    );
    if (!cartItem) {
      return res.status(404).json({ status: false, error: "Product not found in cart" });
    }

    const oldQuantity = cartItem.quantity;
    let newQuantity = oldQuantity + count;

    if (newQuantity < 1) newQuantity = 1;
    if (newQuantity > 10) {
      return res.status(400).json({ 
        status: false, 
        error: "Maximum limit of 10 items per product" 
      });
    }

    
    if (count === 1 && selectedSize.quantity < 1) {
      return res.status(400).json({ 
        status: false, 
        error: `Insufficient stock for size ${size}` 
      });
    }

    
    if (count === 1) {
      selectedSize.quantity -= 1;
    } else if (count === -1 && newQuantity < oldQuantity) {
      selectedSize.quantity += 1;
    }

    cartItem.quantity = newQuantity;
    cartItem.totalPrice = cartItem.price * newQuantity;

    await product.save();
    await cart.save();

    const grandTotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

    res.json({
      status: true,
      quantityInput: newQuantity,
      totalAmount: cartItem.totalPrice,
      grandTotal: grandTotal
    });

  } catch (error) {
    console.error("Error in changeQuantity:", error);
    res.status(500).json({ status: false, error: "Server error" });
  }
};


const loadCheckout = async (req, res) => {
  try {
   
      const userId = req.session.user; 
    
      if (!userId) {
          return res.redirect("/login");
      }

      
      const cart = await Cart.findOne({ userId }).populate("items.productId");

     

      
      const userAddress = await Address.findOne({ userId });

      
      const user = await User.findById(userId);

     
      let grandTotal = 0;
      if (cart) {
          cart.items.forEach((item) => {
              grandTotal += item.price * item.quantity;
          });
      }

      
      const offerPrice = cart?.offerPrice || 0;

      res.render("checkout", {
          product: cart ? cart.items : [],
          userAddress,
         
          grandTotal,
         
          user,
          isCart: cart ? "true" : "false",
      });
  } catch (error) {
      console.error("Error loading checkout:", error);
      res.status(500).send("Internal Server Error");
  }
};



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

    const product = await Product.findById(removedItem.productId);
    if (product) {
      const sizeObj = product.sizes.find(s => s.size === removedItem.size);
      if (sizeObj) {
        sizeObj.quantity += removedItem.quantity;
        await product.save();
      }
    }

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
  
  } 