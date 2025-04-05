const User = require('../../models/userSchema')
const Product = require('../../models/productSchema')
const mongodb = require("mongodb");
const mongoose = require('mongoose')
const Cart = require('../../models/cartSchema')
const Address = require("../../models/addressSchema"); 
const Order = require('../../models/orderSchema');
const Coupon = require('../../models/couponSchema');


const Wallet = require('../../models/walletSchema');
const Razorpay = require("razorpay");

const path = require("path");
const PDFDocument = require("pdfkit");
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const getOrders = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/login");
    }
    
    const userData = await User.findById(userId);
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;
    
    let searchQuery = { userId: userId };
    if (req.query.search) {
      const searchTerm = req.query.search.trim();
      searchQuery = {
        userId: userId,
        $or: [
          { orderid: { $regex: searchTerm, $options: "i" } },
          { status: { $regex: searchTerm, $options: "i" } }
        ]
      };
    }
    
    const orders = await Order.find(searchQuery)
      .populate("address")
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalOrders = await Order.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalOrders / limit);
    
   
    const isAjaxRequest = req.xhr || req.query.ajax === 'true' || req.headers.accept.includes('application/json');
    
    if (isAjaxRequest) {
      return res.json({ 
        orders,
        currentPage: page,
        totalPages: totalPages,
        totalOrders: totalOrders
      });
    }
    
    
    res.render("orders", {
      user: userData,
      orders: orders || [],
      page: "orders",
      currentPage: page,
      totalPages,
      searchQuery: req.query.search || "",
    });
    
  } catch (error) {
    console.error("Error in getOrders:", error);
    
    
    if (req.xhr || req.query.ajax === 'true' || req.headers.accept.includes('application/json')) {
      return res.status(500).json({ error: "An error occurred while fetching orders" });
    }
    
    res.redirect("/pageNotFound");
  }
};


const placeOrder = async (req, res) => {
  try {
    console.log("Request body:", req.body);
    console.log("Session user:", req.session.user);

    const { addressId, paymentMethod, discountAmount, grandTotal } = req.body;
    const finalAmount = grandTotal;
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

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const orderItems = cart.items.map(item => ({
      productId: item.productId._id,
      size: item.size,
      quantity: item.quantity,
      price: item.productId.salePrice,
      status: 'Pending'
    }));

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

    const couponCode = req.body.couponCode;
    let couponMinimumPrice = 0;
    let couponApplied = false;

    if (couponCode && discountAmount > 0) {
      const coupon = await Coupon.findOne({ name: couponCode });
      if (coupon) {
        couponMinimumPrice = coupon.minimumPrice;
        couponApplied = true;
      }
    }

    const newOrder = new Order({
      userId: userId,
      orderitems: orderItems,
      totalPrice: totalPrice,
      discount: discountAmount,
      finalAmount: finalAmount,
      address: addressId,
      status: paymentMethod === 'razorpay' ? 'Pending Payment' : 'Pending',
      invoiceDate: new Date(),
      couponApplied: couponApplied,
      couponMinimumPrice,
      paymentMethod: paymentMethod.toUpperCase(),
      orderid: req.body.razorpay_order_id 
    });

    await newOrder.save();
    console.log("Order saved successfully:", newOrder);

    // Stock reduction
    for (const item of cart.items) {
      console.log("Processing item:", item);
      const productId = item.productId._id;
      const product = await Product.findById(productId);
      if (product) {
        console.log("Product found:", product);
        const updatedSizeStock = product.sizes.map(size => {
          if (size.size === item.size) {
            size.quantity = Math.max(0, size.quantity - item.quantity);
          }
          return size;
        });
        product.sizes = updatedSizeStock;
        await product.save();
        console.log("Product updated:", product);
      }
    }

    await Cart.findOneAndUpdate({ userId }, { items: [] });
    console.log("Cart cleared");

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order: newOrder,
      orderId: newOrder._id
    });
  } catch (error) {
    console.error("Detailed error while placing order:", error.stack);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


const getOrderDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);
        

        const order = await Order.findById(req.query.id)
            .populate({
                path: "orderitems.productId",
                select: "productName productImage"
            })
            .lean();

          

        if (!order) {
            return res.status(404).send("Order not found");
        }

       
        const addressId = order.address._id; 
       

        const userAddress = await Address.findOne({ userId })
       

    
       
        
      

        const selectedAddress = userAddress.address.find(addr => addr._id.toString() === addressId.toString());
  

      

        res.render("orderDetails", { orders: order, address: selectedAddress,user:user });

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
            orderId: order?.orderid || 'N/A',
            dOrderId : order.orderid.toString().slice(-6)
        });
        
    } catch (error) {
        console.error('Error in order confirmation:', error);
        res.redirect('/pageNotFound');
    }
};



const orderFailure = async(req,res)=>{
  try {
    const { orderId } = req.query;

   
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).send('Order not found');
    }

   
    const userId = req.session.user; 
    if (!userId) {
      return res.status(401).send('User not authenticated');
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }


    res.render('orderFailure', { order, user });
  } catch (error) {
    console.error('Error in orderFailure route:', error);
    res.status(500).send('Internal Server Error');
  }

}



const returnOrder = async (req, res) => {
  try {
    const { orderId, productId, size, returnReason } = req.body;
    
  
    
  
    const order = await Order.findOne({ _id: orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    
   
    const itemIndex = order.orderitems.findIndex(
      item => item._id.toString() === productId && item.size === size
    );
    
    if (itemIndex === -1) {
      console.log("Item not found in order items");
      return res.status(404).json({ success: false, message: "Item not found in order" });
    }
    
    
    order.orderitems[itemIndex].status = "Return requested";
    
    
    if (!order.orderitems[itemIndex].returnRequest) {
      order.orderitems[itemIndex].returnRequest = {};
    }
    
    order.orderitems[itemIndex].returnRequest.reason = returnReason;
    
    
    await order.save();
    
   
    const allReturned = order.orderitems.every(item => item.status === "Return requested");
    if (allReturned) {
      order.status = "Return requested";
      await order.save();
      console.log("All items Return requested, order status updated");
    }
    
    res.json({ success: true, message: "Item return request initiated successfully" });
  } catch (error) {
    console.error("Error in return order:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


const cancelOrder = async (req, res) => {
  try {
    const { orderId, productId, size, cancelReason } = req.body; 

    const order = await Order.findOne({ _id: orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    
    const itemToCancel = order.orderitems.find(
      item => item._id.toString() === productId && item.size === size
    );
   
    if (!itemToCancel) {
      return res.status(404).json({ success: false, message: "Item not found in the order" });
    }

    const itemOriginalCost = itemToCancel.price * itemToCancel.quantity;
    const totalItemsCost = order.totalPrice;
    const remainingCost = totalItemsCost - itemOriginalCost;
    let priceToRefund = itemOriginalCost;

    
    if(order.couponApplied){
      if(remainingCost < order.couponMinimumPrice){
        priceToRefund = itemOriginalCost - order.discount;
        await Order.updateOne({_id: orderId}, {$set: { couponApplied: false}});
      }
    }

    // Restock the product
    const product = await Product.findById(itemToCancel.productId);
    if (product) {
      const sizeObj = product.sizes.find(s => s.size === size);
      if (sizeObj) {
        sizeObj.quantity += itemToCancel.quantity;
        await product.save();
      }
    }
    
  
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId, "orderitems._id": itemToCancel._id },
      { 
        $set: { 
          "orderitems.$.status": "Cancelled",
          "orderitems.$.cancelRequest.reason": cancelReason,
          "orderitems.$.cancelRequest.requestedAt": new Date()
        } 
      },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: "Order update failed" });
    }

   
    const allCancelled = updatedOrder.orderitems.every(item => item.status === "Cancelled");
    if (allCancelled) {
      await Order.updateOne({ _id: orderId }, { $set: { status: "Cancelled" } });
    }


    let refundProcessed = false;
    if (order.paymentMethod !== "COD") {
      const userId = req.session.user;
      const productName = product ? product.productName : "Unknown Product";

      let wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        wallet = new Wallet({ userId, balance: 0, transactions: [] });
      }

      wallet.balance += priceToRefund;
      wallet.transactions.push({
        amount: priceToRefund,
        type: "credit",
        description: `Refund for cancelled item: ${productName} (Size: ${size}), Reason: ${cancelReason}`,
        date: new Date(),
        orderId: order._id
      });
      await wallet.save();
      refundProcessed = true;
    }

   
    if (order.paymentMethod === "COD") {
      res.json({ 
        success: true, 
        message: "Item cancelled successfully", 
        refundAmount: 0,
        paymentMethod: "COD"
      });
    } else {
      res.json({ 
        success: true, 
        message: "Item cancelled successfully", 
        refundAmount: priceToRefund,
        paymentMethod: order.paymentMethod
      });
    }
  } catch (error) {
    console.error("Error in cancelOrder:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


const orderInvoice = async (req, res) => {
  try {
      const orderId = req.params.id;
    
      const userId = req.session.user;
      
      const order = await Order.findOne({ orderid: orderId })
          .populate("userId")
          .populate('orderitems.productId');
      console.log("order ??", order);
      
      if (!order) {
          return res.status(404).json({ success: false, message: "Order not found" });
      }

      const addressId = order.address;
      console.log("address of invoice", addressId);

      const userAddress = await Address.findOne({ userId: userId });
      if (!userAddress || !userAddress.address) {
          return res.status(404).json({ success: false, message: "Address not found" });
      }

      const addresses = userAddress.address;
      let selectedAddress = null;

      for (var i = 0; i < addresses.length; i++) {
          if (addresses[i]._id.toString() === addressId.toString()) {
              selectedAddress = addresses[i];
              break;
          }
      }

      if (!selectedAddress) {
          return res.status(404).json({ success: false, message: "Selected address not found" });
      }

      const invoicesDir = path.join(__dirname, "../invoices");
      if (!fs.existsSync(invoicesDir)) {
          fs.mkdirSync(invoicesDir, { recursive: true });
      }

      const filePath = path.join(invoicesDir, `invoice-${orderId}.pdf`);
      const doc = new PDFDocument({ margin: 50 });

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

     
      try {
          doc.fontSize(22).text("Tailor Trend", { align: "center", underline: true });
          doc.moveDown();
          doc.fontSize(18).text("INVOICE", { align: "center" });
          doc.moveDown();
      } catch (err) {
          console.error("Error in header section:", err);
      }

     
      try {
          doc.fontSize(12).text(`Order ID: ${order.orderid || 'N/A'}`);
          doc.text(`Invoice Date: ${new Date().toDateString()}`);
          doc.text(`Customer: ${order.userId?.name || 'N/A'} (${order.userId?.email || 'N/A'})`);
          doc.moveDown();
      } catch (err) {
          console.error("Error in order details section:", err);
      }

      
      try {
          doc.fontSize(14).text("Shipping Address", { underline: true });
          doc.fontSize(12).text(`${selectedAddress.name || 'N/A'}`);
          doc.text(`${selectedAddress.city || 'N/A'}, ${selectedAddress.state || 'N/A'}, ${selectedAddress.pincode || 'N/A'}`);
          doc.text(`Phone: ${selectedAddress.phone || 'N/A'}`);
          doc.moveDown();
      } catch (err) {
          console.error("Error in shipping address section:", err);
      }

     
      try {
          doc.fontSize(14).text("Order Items", { underline: true });
          doc.moveDown();
          doc.fontSize(12);
          doc.text("Product Name", 50);
          doc.text("Qty", 350);
          doc.text("Price", 450);
          doc.moveDown();
          doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
          doc.moveDown();
      } catch (err) {
          console.error("Error in order items header:", err);
      }

     
      try {
          if (order.orderitems && order.orderitems.length > 0) {
              for (const item of order.orderitems) {
                  try {
                      const productName = item.productId?.productName || 'Unknown Product';
                      const quantity = Number(item.quantity) || 0;
                      const price = Number(item.price) || 0;
                      
                      doc.text(productName, 50);
                      doc.text(quantity.toString(), 350);
                      doc.text(`₹${price.toFixed(2)}`, 450);
                      doc.moveDown();
                  } catch (itemErr) {
                      console.error("Error processing item:", itemErr);
                      doc.text("Error displaying this item", 50);
                      doc.moveDown();
                  }
              }
          } else {
              doc.text("No items in this order", 50);
              doc.moveDown();
          }
      } catch (err) {
          console.error("Error in order items section:", err);
      }

      try {
          doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
          doc.moveDown();
      } catch (err) {
          console.error("Error drawing line:", err);
      }

     
      try {
          doc.moveDown();
          
         
          doc.fontSize(14);
          doc.text("Order Summary", 50);
          doc.moveDown();
          
          doc.fontSize(12);
          
          
          console.log("Total Price:", order.totalPrice, typeof order.totalPrice);
          console.log("Discount:", order.discount, typeof order.discount);
          console.log("Final Amount:", order.finalAmount, typeof order.finalAmount);
          
         
          const totalPrice = Number(order.totalPrice || 0);
          const discount = Number(order.discount || 0);
          const finalAmount = Number(order.finalAmount || 0);
          
         
          console.log("Converted Total Price:", totalPrice, typeof totalPrice);
          console.log("Converted Discount:", discount, typeof discount);
          console.log("Converted Final Amount:", finalAmount, typeof finalAmount);
          
         
          doc.text(`Total Price: ₹${totalPrice.toFixed(2)}`, 50);
          doc.text(`Discount: ₹${discount.toFixed(2)}`, 50);
          doc.text(`Final Amount: ₹${finalAmount.toFixed(2)}`, 50);
          doc.moveDown();
          doc.text(`Payment Method: ${order.paymentMethod || 'N/A'}`, 50);
          doc.moveDown();
          doc.text(`Order Status: ${order.status || 'N/A'}`, 50);
          doc.moveDown();
          doc.text("Thank you for shopping with us!", { align: "center" });
      } catch (err) {
          console.error("Error in order summary section:", err, err.stack);
      }

      
      doc.end();

      writeStream.on("finish", () => {
          res.download(filePath, `invoice-${orderId}.pdf`, (err) => {
              if (err) {
                  console.error("Error sending file:", err);
                  res.status(500).json({ success: false, message: "Failed to download invoice" });
              }
             
              if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
              }
          });
      });

      writeStream.on("error", (err) => {
          console.error("File writing error:", err);
          res.status(500).json({ success: false, message: "Error generating invoice" });
      });

  } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
    getOrders,
    placeOrder ,
    getOrderDetails,
    orderConfirm,
    orderFailure,
    returnOrder,
   cancelOrder,
   orderInvoice,


}
