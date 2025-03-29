const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema'); 
const Order = require('../../models/orderSchema'); 

const mongoose = require('mongoose');


// const getWalletTransactions = async (req, res) => {
//     try {
//         const page = parseInt(req.query.page) || 1;
//         const limit = 10;
//         const skip = (page - 1) * limit;
        
//         const searchQuery = req.query.query ? req.query.query.trim() : '';
        
//         let searchFilter = {};
        
//         if (searchQuery) {
//             searchFilter = {
//                 $or: [
//                     // Search by transaction type (case-insensitive)
//                     { "type": { $regex: searchQuery, $options: "i" } },
                    
//                     // Search by transaction description (case-insensitive)
//                     { "description": { $regex: searchQuery, $options: "i" } },
                    
//                     // Search by transaction amount
//                     { "amount": isNaN(searchQuery) ? null : parseFloat(searchQuery) }
//                 ]
//             };

//             // Check if it's a valid date
//             const parsedDate = new Date(searchQuery);
//             if (!isNaN(parsedDate.getTime())) {
//                 searchFilter.$or.push({
//                     "date": {
//                         $gte: parsedDate,
//                         $lt: new Date(parsedDate.getTime() + 24 * 60 * 60 * 1000)
//                     }
//                 });
//             }

//             // Check if it's a valid ObjectId
//             if (mongoose.Types.ObjectId.isValid(searchQuery)) {
//                 searchFilter.$or.push({ 
//                     "_id": new mongoose.Types.ObjectId(searchQuery) 
//                 });
//             }
//         }
        
//         const transactions = await Wallet.aggregate([
//             { $unwind: "$transactions" },
//             {
//                 $lookup: {
//                     from: "users",
//                     localField: "userId",
//                     foreignField: "_id",
//                     as: "userDetails"
//                 }
//             },
//             { $unwind: "$userDetails" },
//             {
//                 $project: {
//                     _id: "$transactions._id",
//                     userId: {
//                         _id: "$userDetails._id",
//                         name: "$userDetails.name"
//                     },
//                     type: "$transactions.type",
//                     amount: "$transactions.amount",
//                     date: "$transactions.date",
//                     description: "$transactions.description",
//                      orderId: "$transactions.orderId"
//                 }
//             },
//             { $match: searchFilter },
//             { $sort: { date: -1 } },
//             { $skip: skip },
//             { $limit: limit }
//         ]);
        
//         const totalTransactionsCount = await Wallet.aggregate([
//             { $unwind: "$transactions" },
//             { $match: searchFilter },
//             { $count: "total" }
//         ]);
        
//         const total = totalTransactionsCount.length > 0 ? totalTransactionsCount[0].total : 0;
//         const totalPages = Math.ceil(total / limit);

   
        
//         res.render("walletTransactionList", {
//             transactions,
//             totalTransactions: total,
//             currentPage: page,
//             totalPages,
//             searchQuery
//         });
//     } catch (error) {
//         console.error("Error fetching wallet transactions:", error);
//         res.status(500).render("adminError", {
//             message: "Error fetching wallet transactions",
//             error: error.message
//         });
//     }
// };




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
                    // Search by transaction type (case-insensitive)
                    { "type": { $regex: searchQuery, $options: "i" } },
                    
                    // Search by transaction description (case-insensitive)
                    { "description": { $regex: searchQuery, $options: "i" } },
                    
                    // Search by transaction amount
                    { "amount": isNaN(searchQuery) ? null : parseFloat(searchQuery) },
                    
                    // Search by transactionId (UUID)
                    { "transactionId": { $regex: searchQuery, $options: "i" } }
                ]
            };

            // Check if it's a valid date
            const parsedDate = new Date(searchQuery);
            if (!isNaN(parsedDate.getTime())) {
                searchFilter.$or.push({
                    "date": {
                        $gte: parsedDate,
                        $lt: new Date(parsedDate.getTime() + 24 * 60 * 60 * 1000)
                    }
                });
            }

            // Check if it's a valid ObjectId
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
                    transactionId: "$transactions.transactionId", // Include transactionId in the projection
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
        res.status(500).render("adminError", {
            message: "Error fetching wallet transactions",
            error: error.message
        });
    }
};




const getTransactionDetails = async (req, res) => {
    try {
        const { transactionId } = req.params;
        console.log(transactionId, 'gfhdjdgjwegfehjrgfehrgfejhrgfejrferf');
        
        // Validate transaction ID format
        if (!mongoose.Types.ObjectId.isValid(transactionId)) {
            return res.status(400).render('error', {
                message: 'Invalid transaction ID format'
            });
        }

        // Find the wallet containing the transaction
        const wallet = await Wallet.findOne({
            'transactions._id': transactionId
        }).lean();

        if (!wallet) {
            return res.status(404).render('error', { 
                message: 'Transaction not found' 
            });
        }

        // Find the specific transaction
        const transaction = wallet.transactions.find(t => t._id.toString() === transactionId);
        console.log("trabsaction isssss",transaction)
        
        if (!transaction) {
            return res.status(404).render('error', {
                message: 'Transaction not found in wallet'
            });
        }

        // Fetch associated user
        const user = await User.findById(wallet.userId).lean();

        // Order lookup logic
        let relatedOrder = null;
        const isOrderRelated = transaction.description?.match(/returned|cancelled/i);
        
        if (isOrderRelated) {
            // Try direct order ID first
            if (transaction.orderId && mongoose.Types.ObjectId.isValid(transaction.orderId)) {
                relatedOrder = await Order.findById(transaction.orderId).lean();
            }
            console.log("transaction.orderId",transaction.orderId)

            // Fallback to description extraction
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
                date: new Date(transaction.date).toLocaleString()
            },
            user,
            relatedOrder,
            pageTitle: 'Transaction Details'
        });

    } catch (error) {
        console.error('Error in getTransactionDetails:', error);
        res.status(500).render('adminError', {
            message: 'Server Error',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
};




// exports.exportTransactions = async (req, res) => {
//     try {
//         // Fetch all transactions for export
//         const transactions = await Wallet.find()
//             .populate({
//                 path: 'userId',
//                 select: 'name email'
//             })
//             .sort({ date: -1 });

//         // Convert to CSV
//         const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
//         const csvStringifier = createCsvStringifier({
//             header: [
//                 {id: '_id', title: 'Transaction ID'},
//                 {id: 'date', title: 'Date'},
//                 {id: 'userId.name', title: 'User Name'},
//                 {id: 'type', title: 'Type'},
//                 {id: 'amount', title: 'Amount'},
//                 {id: 'description', title: 'Description'}
//             ]
//         });

//         const csvData = csvStringifier.getHeaderString() + 
//             csvStringifier.stringifyRecords(transactions);

//         // Send as downloadable CSV
//         res.setHeader('Content-Type', 'text/csv');
//         res.setHeader('Content-Disposition', 'attachment; filename=wallet-transactions.csv');
//         res.send(csvData);
//     } catch (error) {
//         console.error('Error exporting transactions:', error);
//         res.status(500).render('error', {
//             message: 'Error exporting transactions',
//             error: error.message
//         });
//     }
// };

// // Optional: Add a method for filtering transactions
// exports.filterTransactions = async (req, res) => {
//     try {
//         const { startDate, endDate, type } = req.query;

//         // Build filter object
//         const filter = {};

//         // Add date range filter if provided
//         if (startDate && endDate) {
//             filter.date = {
//                 $gte: new Date(startDate),
//                 $lte: new Date(endDate)
//             };
//         }

//         // Add transaction type filter if provided
//         if (type) {
//             filter.type = type;
//         }

//         // Fetch filtered transactions
//         const transactions = await Wallet.find(filter)
//             .populate({
//                 path: 'userId',
//                 select: 'name email'
//             })
//             .sort({ date: -1 });

//         res.render('wallet/transactions', {
//             transactions,
//             filters: req.query
//         });
//     } catch (error) {
//         console.error('Error filtering transactions:', error);
//         res.status(500).render('error', {
//             message: 'Error filtering transactions',
//             error: error.message
//         });
//     }
// };


module.exports = {
    getWalletTransactions,
    getTransactionDetails

}