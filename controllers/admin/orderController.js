const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const mongodb = require("mongodb");
const mongoose = require("mongoose");

const env = require("dotenv").config();
const crypto = require("crypto");


const getOrderListPageAdmin = async (req, res) => {
  try {
    const itemsPerPage = 7;
    const currentPage = parseInt(req.query.page) || 1;
    const status = req.query.status || null;
    
    
    const aggregationPipeline = [];
    

    aggregationPipeline.push({ $unwind: "$orderitems" });
    

    if (status) {
      let formattedStatus;
      
      if (status === 'return-requested') {
        formattedStatus = 'Return requested';
      } else {
        formattedStatus = status.charAt(0).toUpperCase() + status.slice(1);
      }
      
    
      aggregationPipeline.push({
        $match: {
          $or: [
            { 'orderitems.status': formattedStatus },
            { 
              'orderitems.status': { $exists: false }, 
              'status': formattedStatus 
            },
            { 
              'orderitems.status': null, 
              'status': formattedStatus 
            }
          ]
        }
      });
    }
    
   
    const countPipeline = [...aggregationPipeline, { $count: "total" }];
    const countResult = await Order.aggregate(countPipeline);
    const totalOrders = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalOrders / itemsPerPage);
    

    aggregationPipeline.push(
      { $sort: { createdOn: -1 } },
      { $skip: (currentPage - 1) * itemsPerPage },
      { $limit: itemsPerPage }
    );
    

    aggregationPipeline.push(
      { 
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userInfo"
        }
      },
      {
        $lookup: {
          from: "products",
          localField: "orderitems.productId",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      {
        $addFields: {
          userInfo: { $arrayElemAt: ["$userInfo", 0] },
          productInfo: { $arrayElemAt: ["$productInfo", 0] }
        }
      }
    );

  
    const orders = await Order.aggregate(aggregationPipeline);
    
 
    const flattenedOrders = orders.map(order => ({
      _id: order._id,
      orderid: order.orderid,
      userId: { 
        _id: order.userId,
        name: order.userInfo ? order.userInfo.name : 'Unknown'
      },
      createdOn: order.createdOn,
      finalAmount: order.finalAmount,
      orderStatus: order.status,
      paymentMethod: order.paymentMethod,
      productId: order.orderitems.productId,
      productName: order.productInfo ? order.productInfo.name : 'Unknown Product',
      quantity: order.orderitems.quantity,
      price: order.orderitems.price,
      size: order.orderitems.size,
      itemStatus: order.orderitems.status || order.status
    }));

    res.render("order-list", {
      orders: flattenedOrders,
      totalPages,
      currentPage,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
      status
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
      .populate("userId", "name")
      .populate({
        path: "orderitems.productId",
        select: "productName productImage",
      });
 
    
    if (!findOrder) {
      return res.status(404).send("Order not found");
    }

    const AddressId = findOrder.address._id;

    

    const userId = findOrder.userId;


    const findUser = await User.findOne({ _id: userId });

    const findAddress = await Address.findOne({ userId: userId });


    
if (!findAddress || !findAddress.address) {
  return res.status(404).send("Address not found");
}

    const selectedAddress = findAddress.address.find(
      (addr) => addr._id.toString() === AddressId.toString()
    );

    res.render("order-details-admin", {
      order: findOrder,
      address: selectedAddress,
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.redirect("/pageError");
  }
};



const updateOrderStatus = async (req, res) => {
  try {
    const { status, productId, size } = req.body;
    const orderId = req.params.orderId;
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    
    const itemIndex = order.orderitems.findIndex(
      item => 
        item.productId.toString() === productId &&
        item.size === size
    );
    
    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Item not found in order",
      });
    }

    const previousStatus = order.orderitems[itemIndex].status;
    order.orderitems[itemIndex].status = status;
    
    if (status === 'Cancelled' && previousStatus !== 'Cancelled' && order.paymentMethod !== 'COD') {
      const itemToCancel = order.orderitems[itemIndex];
      const itemOriginalCost = itemToCancel.price * itemToCancel.quantity;
      const totalItemsCost = order.totalPrice;
      const remainingCost = totalItemsCost - itemOriginalCost;
      let priceToRefund = itemOriginalCost;
      
      
      if (order.couponApplied) {
        if (remainingCost < order.couponMinimumPrice) {
          priceToRefund = itemOriginalCost - order.discount;
          order.couponApplied = false;
        }
      }
      
     
      const product = await Product.findById(itemToCancel.productId);
      if (product) {
        const sizeObj = product.sizes.find(s => s.size === size);
        if (sizeObj) {
          sizeObj.quantity += itemToCancel.quantity;
          await product.save();
        }
      }
      
   
      const userId = order.userId;
      const productName = product ? product.productName : "Unknown Product";
      
      let wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        wallet = new Wallet({ userId, balance: 0, transactions: [] });
      }
      
      wallet.balance += priceToRefund;
      wallet.transactions.push({
        amount: priceToRefund,
        type: "credit",
        description: `Refund for admin cancelled item: ${productName} (Size: ${size})`,
        date: new Date(),
        orderId: order._id
      });
      await wallet.save();
    }
    
  
    const allDelivered = order.orderitems.every(item => item.status === 'Delivered');
    const allCancelled = order.orderitems.every(item => item.status === 'Cancelled');
    const hasReturnRequested = order.orderitems.some(item => item.status === 'Return requested');
    
    if (allDelivered) {
      order.status = 'Delivered';
    } else if (allCancelled) {
      order.status = 'Cancelled';
    } else if (hasReturnRequested) {
      order.status = 'Return requested';
    } else {
      order.status = 'Pending';
    }
    
    const updatedOrder = await order.save();
    
    res.json({
      success: true,
      message: "Item status updated successfully",
      updatedOrder,
    });
  } catch (error) {
    console.error("Item status update error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const handleReturn = async (req, res) => {
  try {
    const { orderId, status, size, productId } = req.body;
   

    const order = await Order.findById(orderId);

   

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    

    order.orderitems.forEach((item) => {
      if (item.productId == productId && item.size == size) {
        if (status === "Approved") {
          item.status = "Returned";
          
        } else if (status === "Rejected") {
          item.status = "Delivered";
          
        }
      }
    });

    const itemToReturn = order.orderitems.find(
      (item) => item.productId.toString() === productId && item.size === size
    );

   

    if (!itemToReturn) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in the order" });
    }

    const itemOriginalCost = itemToReturn.price * itemToReturn.quantity;
   
    const totalItemsCost = order.totalPrice;
  

    let totalDiscount = order.discount || 0;
   


    const returnedItem = order.orderitems.find(
      (item) => item.productId.toString() === productId && item.size === size
    );
    const remainingItemsCost = returnedItem
      ? order.totalPrice - (returnedItem.price * returnedItem.quantity)
      : order.totalPrice;

     

    let refundAmount;
    if (order.couponApplied && totalDiscount > 0) {
      const couponMinimumThreshold = order.couponMinimumPrice; 

      if (remainingItemsCost > couponMinimumThreshold) {
        refundAmount = itemOriginalCost;
       
      } else {
      
        refundAmount = itemOriginalCost - totalDiscount;
        totalDiscount = 0
      }
    } else {
      refundAmount = itemOriginalCost;
      
    }

    

     order.totalPrice = remainingItemsCost;
    
     if(order.totalPrice==0  ){
      totalDiscount = 0

    
     }
     order.discount = totalDiscount 
    
    order.finalAmount = order.totalPrice - totalDiscount
    
    
   
    //restock
    const product = await Product.findById(itemToReturn.productId);
    if (product) {
      const sizeObj = product.sizes.find((s) => s.size === size);
      if (sizeObj) {
        sizeObj.quantity += itemToReturn.quantity;
        await product.save();
        console.log("Product restocked:", {
          productId: itemToReturn.productId,
          size,
          quantity: itemToReturn.quantity,
        });
      }
    }

   
   
    const userId = order.userId;
  
    const productName = product ? product.productName : "Unknown Product";

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0, transactions: [] });
    }

    wallet.balance += refundAmount;
    wallet.transactions.push({
      amount: refundAmount,
      type: "credit",
      description: `Refund for returned item: ${productName} (Size: ${size})`,
      date: new Date(),
      orderId: order._id

    });
    await wallet.save();
    

    const updatedOrder = await Order.findByIdAndUpdate(order._id, order, {
      new: true,
    });

    const allReturned = updatedOrder.orderitems.every(
      (item) => item.status === "Returned"
    );
    if (allReturned) {
      await Order.updateOne({ _id: orderId }, { $set: { status: "Returned" } });
    }
   

    res.json({
      success: true,
      message: `Return request ${status.toLowerCase()} successfully`,
      order: updatedOrder,
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
  handleReturn,
};
