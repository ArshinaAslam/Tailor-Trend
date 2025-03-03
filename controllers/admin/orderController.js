const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const mongodb = require("mongodb");
const mongoose = require('mongoose')

const env = require("dotenv").config();
const crypto = require("crypto");

const { v4: uuidv4 } = require('uuid');
const { log } = require("console");




const getOrderListPageAdmin = async (req, res) => {
  try {
      const itemsPerPage = 3;
      const currentPage = parseInt(req.query.page) || 1;
      
      
      const totalOrders = await Order.countDocuments();
      const totalPages = Math.ceil(totalOrders / itemsPerPage);

      
      const orders = await Order.find({}, "orderid totalPrice finalAmount status createdOn userId paymentMethod")
          .populate("userId", "name")
          .sort({ createdOn: -1 })
          .skip((currentPage - 1) * itemsPerPage)
          .limit(itemsPerPage);

      res.render("order-list", { 
          orders, 
          totalPages, 
          currentPage,
          hasNextPage: currentPage < totalPages,
          hasPreviousPage: currentPage > 1
      });
  } catch (error) {
      console.error(error);
      res.redirect("/pageError");
  }
};
  
  const getOrderDetailsPageAdmin = async (req, res) => {
    try {

        const orderId = req.params.orderId;
        const findOrder = await Order.findOne({ _id: orderId })  
            .populate('userId', 'name') 
            .populate('orderitems.productId', 'name'); 

        if (!findOrder) {
            return res.status(404).send('Order not found');
        }

       
        const AddressId = findOrder.address._id

        

        const userId = findOrder.userId

        const findUser = await User.findOne({ _id: userId })

        const findAddress = await Address.findOne({ userId: userId })

        

        const selectedAddress = findAddress.address.find((addr) => addr._id.toString() === AddressId.toString())

      


        res.render("order-details-admin", { order: findOrder, address: selectedAddress });
        
    } catch (error) {
        console.error("Error fetching order details:", error);
        res.redirect("/pageError");
    }
};




const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const orderId = req.params.orderId

    console.log('recieved body in the updateOrderstatus: ', req.body, orderId);

    const order = await Order.findByIdAndUpdate(
      orderId,
      { status: status },
      { new: true}
    );

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    

    res.json({ 
      success: true, 
      message: 'Status updated successfully',
      order 
    });

  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error' 
    });
  }
};



const handleReturn = async (req, res) => {
  try {
    const { orderId, status, finalAmount } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status !== "Return requested" || order.returnRequest.status !== "pending") {
      return res.status(400).json({ success: false, message: "No pending return request" });
    }

    let updateData = {};
    if (status === "Approved") {
      updateData = {
        status: "Returned",
        "returnRequest.status": "approved",
        "returnRequest.resolvedAt": new Date()
      };
     
    } else if (status === "Rejected") {
      updateData = {
        status: "Delivered", 
        "returnRequest.status": "rejected",
        "returnRequest.resolvedAt": new Date()
      };
    }

    const updatedOrder = await Order.findByIdAndUpdate(orderId, updateData, { new: true });

    res.json({
      success: true,
      message: `Return request ${status.toLowerCase()} successfully`,
      order: updatedOrder
    });
  } catch (error) {
    console.error("Error handling return:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


  module.exports = {
    getOrderListPageAdmin,
    getOrderDetailsPageAdmin,
    updateOrderStatus,
    handleReturn
  
}
