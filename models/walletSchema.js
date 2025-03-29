const mongoose = require("mongoose")
const {Schema} = mongoose
const { v4: uuidv4 } = require("uuid");

const walletSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
     
    },
    balance: {
      type: Number,
      default: 0,
    },
    transactions: [
      {
        transactionId: {
          type: String,
          default: () => uuidv4(), // Automatically generate UUID for each transaction
        },
        type: {
          type: String,
          enum: ["credit", "debit"],
        },
        amount: {
          type: Number,
          required: true,
        },
        date: {
          type: Date,
          default: Date.now,
        },
        description: {
          type: String,
        },
        orderId: {
          type: mongoose.Schema.Types.ObjectId,  
          ref: "Order",
        },
      },
    ],
  });


  
  
  





  const Wallet = mongoose.model("Wallet",walletSchema)
  
  module.exports = Wallet


