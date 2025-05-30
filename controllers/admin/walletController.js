const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema'); 
const Order = require('../../models/orderSchema'); 
const Status = require('../statusCodes')
const mongoose = require('mongoose');
const Message = require('../messages')




const getWalletTransactions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        
        const searchQuery = req.query.query ? req.query.query.trim() : '';
        
        let searchFilter = {};
        
        if (searchQuery) {
            searchFilter = {
                $or: [
                  
                    { "type": { $regex: searchQuery, $options: "i" } },
                    
                   
                    { "description": { $regex: searchQuery, $options: "i" } },
                    
                 
                    { "amount": isNaN(searchQuery) ? null : parseFloat(searchQuery) },
                    
                   
                    { "transactionId": { $regex: searchQuery, $options: "i" } }
                ]
            };

          
            const parsedDate = new Date(searchQuery);
            if (!isNaN(parsedDate.getTime())) {
                searchFilter.$or.push({
                    "date": {
                        $gte: parsedDate,
                        $lt: new Date(parsedDate.getTime() + 24 * 60 * 60 * 1000)
                    }
                });
            }

            
            if (mongoose.Types.ObjectId.isValid(searchQuery)) {
                searchFilter.$or.push({ 
                    "_id": new mongoose.Types.ObjectId(searchQuery) 
                });
            }
        }
        
        const transactions = await Wallet.aggregate([
            { $unwind: "$transactions" },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            { $unwind: "$userDetails" },
            {
                $project: {
                    _id: "$transactions._id",
                    transactionId: "$transactions.transactionId", 
                    userId: {
                        _id: "$userDetails._id",
                        name: "$userDetails.name"
                    },
                    type: "$transactions.type",
                    amount: "$transactions.amount",
                    date: "$transactions.date",
                    description: "$transactions.description",
                    orderId: "$transactions.orderId"
                }
            },
            { $match: searchFilter },
            { $sort: { date: -1 } },
            { $skip: skip },
            { $limit: limit }
        ]);
        
        const totalTransactionsCount = await Wallet.aggregate([
            { $unwind: "$transactions" },
            { $match: searchFilter },
            { $count: "total" }
        ]);
        
        const total = totalTransactionsCount.length > 0 ? totalTransactionsCount[0].total : 0;
        const totalPages = Math.ceil(total / limit);

        res.render("walletTransactionList", {
            transactions,
            totalTransactions: total,
            currentPage: page,
            totalPages,
            searchQuery
        });
    } catch (error) {
        console.error("Error fetching wallet transactions:", error);
        res.status(Status.INTERNAL_SERVER_ERROR).render("adminError", {
            message: "Error fetching wallet transactions",
            error: error.message
        });
    }
};




const getTransactionDetails = async (req, res) => {
    try {
        const { transactionId } = req.params;
   
        
     
        if (!mongoose.Types.ObjectId.isValid(transactionId)) {
            return res.status(Status.BAD_REQUEST).render('error', {
                message: 'Invalid transaction ID format'
            });
        }

        
        const wallet = await Wallet.findOne({
            'transactions._id': transactionId
        }).lean();

        if (!wallet) {
            return res.status(Status.NOT_FOUND).render('error', { 
                message: 'Transaction not found' 
            });
        }

       
        const transaction = wallet.transactions.find(t => t._id.toString() === transactionId);

        
        if (!transaction) {
            return res.status(Status.NOT_FOUND).render('error', {
                message: 'Transaction not found in wallet'
            });
        }

       
        const user = await User.findById(wallet.userId).lean();

      
        let relatedOrder = null;
        const isOrderRelated = transaction.description?.match(/returned|cancelled/i);
        
        if (isOrderRelated) {
         
            if (transaction.orderId && mongoose.Types.ObjectId.isValid(transaction.orderId)) {
                relatedOrder = await Order.findById(transaction.orderId).lean();
            }
            console.log("transaction.orderId",transaction.orderId)

          
            if (!relatedOrder) {
                const orderIdMatch = transaction.description?.match(/Order #([a-f\d]{24})/i);
                if (orderIdMatch && mongoose.Types.ObjectId.isValid(orderIdMatch[1])) {
                    relatedOrder = await Order.findById(orderIdMatch[1]).lean();
                }
            }
        }

        res.render('walletTransactionDetails', {
            transaction: {
                ...transaction,
                date: new Date(transaction.date).toLocaleDateString('en-US', {
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric'
                })
            },
            user,
            relatedOrder,
            pageTitle: 'Transaction Details'
        });

    } catch (error) {
        console.error('Error in getTransactionDetails:', error);
        res.status(Status.INTERNAL_SERVER_ERROR).render('adminError', {
            message: Message.SERVER_ERROR,
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
};




module.exports = {
    getWalletTransactions,
    getTransactionDetails

}