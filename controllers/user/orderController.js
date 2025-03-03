const User = require('../../models/userSchema')
const Product = require('../../models/productSchema')
const mongodb = require("mongodb");
const mongoose = require('mongoose')
const Cart = require('../../models/cartSchema')
const Address = require("../../models/addressSchema"); 
const Order = require('../../models/orderSchema');
const { v4: uuidv4 } = require('uuid');


const placeOrder = async (req, res) => {
    try {
        const { addressId, paymentMethod } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not logged in" });
        }

        if (!addressId) {
            return res.status(400).json({ success: false, message: "Address ID is required" });
        }

        const userAddress = await Address.findOne({ userId });
        if (!userAddress) {
            return res.status(404).json({ success: false, message: "User address not found" });
        }

        const selectedAddress = userAddress.address.find(addr => addr._id.toString() === addressId);
        if (!selectedAddress) {
            return res.status(404).json({ success: false, message: "Selected address not found" });
        }

        const cart = await Cart.findOne({ userId }).populate('items.productId'); // Populate product details
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        
        const blockedProducts = cart.items.filter(item => item.productId.isBlocked);

        if (blockedProducts.length > 0) {
            return res.status(403).json({
                success: false,
                message: `The product "${blockedProducts[0].productId.productName}" has been blocked by the admin. Please remove it from the cart before placing the order.`,
            });
        }

        let totalPrice = 0;
        cart.items.forEach(item => {
            totalPrice += item.totalPrice;
        });

        const newOrder = new Order({
            userId: userId,
            orderitems: cart.items,
            totalPrice,
            finalAmount: totalPrice,
            address: addressId,
            status: "Pending",
            invoiceDate: new Date(),
            couponApplied: false,
            paymentMethod: paymentMethod.toUpperCase()
        });

        await newOrder.save();

        
        await Cart.findOneAndUpdate({ userId }, { items: [] });

        res.status(201).json({ success: true, message: "Order placed successfully", order: newOrder });

    } catch (error) {
        console.error("Error while placing the order:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};


const getOrderDetails = async (req, res) => {
    try {
        const userId = req.session.user;

        const order = await Order.findById(req.query.id)
            .populate({
                path: "orderitems.productId",
                select: "productName productImage"
            })
            .lean();

        if (!order) {
            return res.status(404).send("Order not found");
        }

        console.log('Order Details:', order);
        console.log('Order Address ID:', order.address);
        const addressId = order.address._id; 

        const userAddress = await Address.findOne({ userId })

        console.log('User Address Document:', userAddress);

        console.log('user.address: ', userAddress.address[0]._id.toString() === addressId.toString());
        console.log(userAddress.address[0]._id);
        console.log(addressId);

        const selectedAddress = userAddress.address.find(addr => addr._id.toString() === addressId.toString());

        console.log('Selected Address:', selectedAddress);

        console.log('name of the address: ', selectedAddress.name);

        res.render("orderDetails", { orders: order, address: selectedAddress });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Server error");
    }
};


const orderConfirm = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect('/login');
        }

        const user = await User.findById(userId);
        const order = await Order.findOne({ userId })
            .sort({ createdOn: -1 })
            .limit(1);

        res.render('orderConfirm', { 
            user,
            orderId: order?.orderid || 'N/A'
        });
        
    } catch (error) {
        console.error('Error in order confirmation:', error);
        res.redirect('/pageNotFound');
    }
};


  
const returnOrder = async (req, res) => {
    try {
      const userId = req.session.user;
      const { orderId, returnReason } = req.body;
  
      const findUser = await User.findOne({ _id: userId });
      if (!findUser) {
        return res.status(404).json({ message: "User not found" });
      }
  
      const findOrder = await Order.findOne({ _id: orderId });
      if (!findOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
  
      if (findOrder.status === "Returned") {
        return res.status(400).json({ message: "Order is already returned" });
      }
  
      // Update the order with return request details
      await Order.updateOne(
        { _id: orderId },
        {
          status: "Return requested",
          returnRequest: {
            reason: returnReason,
            requestedAt: new Date() 
          }
        }
      );
  
      res.status(200).json({ message: "Return request initiated successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  };


const cancelOrder = async(req,res)=>{
    
  try {
    const { orderId } = req.body;

    if (!orderId) {
        return res.status(400).json({ message: "Order ID is required" });
    }

    const order = await Order.findById(orderId);

    if (!order) {
        return res.status(404).json({ message: "Order not found" });
    }

   
    if (order.status === "Cancelled") {
        return res.status(400).json({ message: "Order is already cancelled" });
    }

    
    const updatedOrder = await Order.updateOne(
        { _id: orderId },
        { $set: { status: "Cancelled" } }
    );

    if (updatedOrder.modifiedCount === 1) {
        return res.json({
            result: updatedOrder,
            message: "Order cancelled successfully"
        });
    } else {
        return res.status(500).json({ message: "Failed to cancel order" });
    }
} catch (error) {
    console.error("Error cancelling order:", error);
    return res.status(500).json({ message: "Internal Server Error" });
}
}

module.exports = {
    placeOrder ,
    getOrderDetails,
    orderConfirm,
    returnOrder,
   cancelOrder,


}
