const mongoose = require('mongoose')
const {Schema} = mongoose
const {v4:uuidv4} =  require('uuid')

const orderSchema = new Schema ({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
      },   
    orderid : {
        type : String ,
        default : ()=>uuidv4(),
        unique : true
    },
    orderitems : [{
        productId : {
            type : Schema.Types.ObjectId ,
            ref : "Product",
            required : true
        },
        size: {  
            type: String,
            required: false
        },
        quantity : {
            type : Number ,
            required : true
        },
        price : {
            type : Number ,
            default : 0

        },
        status: {
            type: String,
            required: false,
            enum:['Pending', 'Cancelled', 'Placed','Shipped', 'Delivered','Return requested','Returned'],
        },
        returnRequest: {  
            reason: { type: String },
            requestedAt:{ type: Date, default: Date.now },
            status: {
              type: String,
              enum: ["pending", "approved", "rejected"],
              default: "pending"
            }
          }
       
    }],
    totalPrice : {
        type : Number ,
        required : true
    },
    discount : {
         type : Number ,
         default : 0
    },
    finalAmount : {
        type : Number ,
        required : true
    },
    address : {
        type : Schema.Types.ObjectId ,
        ref : "Address" ,
        required : true
    },
    invoiceDate : {
        type : Date 
    },
    
    status: {
        type: String,
        required: true,
        enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Return requested", "Returned","Payment Failed","Pending Payment"],
        default: "Pending"
      },
    createdOn : {
        type : Date ,
        default : Date.now,
        required : true
    },
    couponApplied : {
        type : Boolean ,
        default : false
    },
    // coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' }, // Reference to Coupon
    couponMinimumPrice: { 
        type: Number, default: 0 
    },
    paymentId: {
        type: String,
        required: false
      },
    paymentMethod: {
        type: String,
        enum: ['COD', 'RAZORPAY', 'WALLET']
    },
    // returnRequest: {  
    //     reason: { type: String },
    //     requestedAt:{ type: Date, default: Date.now },
    //     status: {
    //       type: String,
    //       enum: ["pending", "approved", "rejected"],
    //       default: "pending"
    //     }
    //   }
})

const Order = mongoose.model("Order",orderSchema)
module.exports = Order