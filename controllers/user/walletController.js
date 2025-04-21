const Razorpay = require("razorpay");
const crypto = require('crypto');
const mongoose = require('mongoose');
const Wallet = require('../../models/walletSchema'); 
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Coupon = require('../../models/couponSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema')
const Status = require('../statusCodes')
const Message = require('../messages')



const walletStatus = async(req,res)=>{
  try {
    const userId = req.session.user;
      if (!userId) {
          return res.redirect("/login");
      }

      
      const userData = await User.findById(userId);

      const walletData = await Wallet.findOne({ userId: userId });
      


       res.render("walletStatus", {
        user: userData,
        page:"wallet-status",
        wallet: walletData || { balance: 0 }, 
       
    });
    
  } catch (error) {
    console.error("Error in wallet status:", error);
      res.redirect("/pageNotFound");
    
  }

}


const walletHistory = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/login");
    }

    const userData = await User.findById(userId);
    
    const page = parseInt(req.query.page) || 1; 
    const limit = 10; 
    const skip = (page - 1) * limit;

    const walletData = await Wallet.findOne({ userId });

    if (!walletData || !walletData.transactions.length) {
      return res.render("walletHistory", {
        user: userData,
        page: "wallet-history",
        walletTransactions: [],
        currentPage: page,
        totalPages: 1,
      });
    }

    const totalTransactions = walletData.transactions.length;
    const totalPages = Math.ceil(totalTransactions / limit);

    const walletTransactions = walletData.transactions
      .sort((a, b) => b.date - a.date)
      .slice(skip, skip + limit); 

    res.render("walletHistory", {
      user: userData,
      page: "wallet-history",
      walletTransactions,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error("Error in wallet history:", error);
    res.redirect("/pageNotFound");
  }
};

const referralPage = async (req, res) => {
  try {
      const userId = req.session.user;
      console.log("req,reached here",userId);
      

      if (!userId) {
          return res.redirect('/login'); 
      }

      const user = await User.findById(userId).populate('wallet');

      if (!user) {
          return res.status(Status.NOT_FOUND).send("User not found");
      }

      const page = parseInt(req.query.page) || 1;
      const limit = 5;
      const skip = (page - 1) * limit;

      
      const referredUsers = user.referredUsers || [];
      const totalReferredUsers = referredUsers.length;

      const paginatedReferredUsers = await User.find({
          _id: { $in: referredUsers }
      })
          .skip(skip)
          .limit(limit);

      const totalPages = Math.ceil(totalReferredUsers / limit);

     
      const wallet = await Wallet.findOne({ userId: userId });

     
      
      const walletBalance = wallet ? wallet.balance : 0;



      const referralWallet = user.referralWallet || 0;

      res.render("referralPage", {
          user,
          referredUsers: paginatedReferredUsers,
          currentPage: page,
          totalPages,
          walletBalance,
          referralWallet, 
          page: "referrals"
      });
  } catch (err) {
      console.log("Error loading referral page:", err);
      res.status(Status.INTERNAL_SERVER_ERROR).send("Something went wrong");
  }
};

const transferWallet = async (req, res) => {
  try {
    const userId = req.session.user;
    
    if (!userId) {
      return res.status(Status.UNAUTHORIZED).json({ success: false, message: "Please log in first" });
    }
    
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(Status.NOT_FOUND).json({ success: false, message: "User not found" });
    }
    

    const referralAmount = user.referralWallet || 0;
    if (referralAmount <= 0) {
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "No funds in referral wallet to transfer" });
    }
    
    
    const wallet = await Wallet.findOne({ userId: userId });
    if (!wallet) {
     
      return res.status(Status.NOT_FOUND).json({ success: false, message: "Wallet not found" });
    }
    
  
    wallet.balance += referralAmount;
    wallet.transactions.push({
      type: "credit",
      amount: referralAmount,
      description: "Transfer from referral wallet"
    });
    await wallet.save();
    
    
    user.referralWallet = 0;
    await user.save();
    
    return res.status(Status.OK).json({ 
      success: true, 
      message: `Successfully transferred ₹${referralAmount} to your main wallet` 
    });
    
  } catch (error) {
    console.error("Error transferring wallet funds:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ 
      success: false, 
      message: "An error occurred while transferring funds" 
    });
  }
};


const razorpayOrder = async (req, res) => {
  try {
    const { amount, walletTopup } = req.body;

    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await instance.orders.create({
      amount: amount, 
      currency: 'INR',
      receipt: `order_${Date.now()}`,
    });

    res.json({
      success: true,
      key_id: process.env.RAZORPAY_KEY_ID,
      order_id: order.id,
      amount: order.amount,
    });
  } catch (error) {
    console.error('Razorpay Error:', error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};
  
 
const verifyPayment = async (req, res) => {
  try {
    const { payment_id, order_id, signature, mongoOrderId,amount,walletTopup } = req.body;

    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(order_id + '|' + payment_id);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature !== signature) {
      return res.status(Status.BAD_REQUEST).json({ success: false, message: 'Invalid signature' });
    }


    if (walletTopup) {
            const userId = req.session.user; 
            if (!userId) {
              return res.status(Status.UNAUTHORIZED).json({ success: false, message: 'User not authenticated' });
            }
            
            const wallet = await Wallet.findOneAndUpdate(
              { userId },
              {
                $inc: { balance: amount },
                $push: {
                  transactions: {
                    type: "credit",
                    amount: amount,
                    date: new Date(),
                    description: "Wallet Top-up"
                  }
                }
              },
              { new: true, upsert: true }
            );
            
            return res.json({ success: true, message: 'Wallet top-up successful' });
          }
          


    
    let order;
    if (mongoOrderId) {
     
      order = await Order.findByIdAndUpdate(
        mongoOrderId,
        {
          paymentId: payment_id,
          orderId: order_id,
          status: 'Pending', 
          paymentMethod: 'RAZORPAY'
        },
        { new: true }
      );
    } else {
     
      order = await Order.findOneAndUpdate(
        { orderid: order_id },
        {
          paymentId: payment_id,
          status: 'Pending',
          paymentMethod: 'RAZORPAY'
        },
        { new: true }
      );
    }

    if (!order) {
      return res.status(Status.NOT_FOUND).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, message: 'Payment verified successfully' });
  } catch (error) {
    console.error('Verification Error:', error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};



const cleanupOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);

    if (order && order.status === 'Pending Payment') {
      
      res.json({ success: true, message: 'Order remains in Pending Payment state' });
    }
  } catch (error) {
    res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};




const walletPayment = async (req, res) => {
  try {
    const userId = req.session.user;
    const { mongoOrderId, amount } = req.body;

   
    if (!userId) {
      return res.status(Status.UNAUTHORIZED).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

   
    const wallet = await Wallet.findOne({ userId });

   
    if (!wallet || wallet.balance < amount) {
      return res.status(Status.BAD_REQUEST).json({ 
        success: false, 
        message: 'Insufficient wallet balance' 
      });
    }

    
    const order = await Order.findById(mongoOrderId);

    if (!order) {
      return res.status(Status.NOT_FOUND).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    
    wallet.balance -= amount;
    
    
    wallet.transactions.push({
      type: 'debit',
      amount: amount,
      date: new Date(),
      description: `Payment for Order #${order._id}`,
      orderId: order._id
    });

   
    order.paymentMethod = 'WALLET';
    order.status = 'Pending';
    order.paymentId = `wallet_${Date.now()}`;

    
    await wallet.save();
    await order.save();

    res.json({ 
      success: true, 
      message: 'Payment completed successfully from wallet' 
    });

  } catch (error) {
    console.error('Wallet Payment Error:', error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({ 
      success: false, 
      message: 'An error occurred during wallet payment' 
    });
  }
};


module.exports = {
  walletStatus,
  walletHistory,
  razorpayOrder,
  verifyPayment,
  cleanupOrder,

  walletPayment,

  referralPage,
  transferWallet

};