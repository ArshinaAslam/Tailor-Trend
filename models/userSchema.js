const mongoose = require ("mongoose")


const {Schema} = mongoose

const userSchema = new Schema({
    name : {
        type : String,
        required : true ,
    },

    email : {
        type : String,
        required : true ,
        unique : true,
        
    },

    phone : {
        type : String ,
        required : false ,
        unique : false ,
        sparse : true ,
        default : null

    },

    googleId : {
        type : String ,
        unique : true,

    },

    password : {
        type : String ,
        required : false ,
    },

    isBlocked : {
        type : Boolean ,
        default : false
    },

    isAdmin : {
        type : Boolean ,
        default : false
    },

    cart : [{
        type : Schema.Types.ObjectId ,
        ref : "Cart"
    }],

    // wallet: {
    //     type: Number, 
    // },

    wishlist : [{
        type : Schema.Types.ObjectId ,
        ref : "Wishlist"
    }],

    orderHistory : [{
        type : Schema.Types.ObjectId ,
        ref : "Order"

    }],

    CreatedOn : {
        type : Date,
        default : Date.now
    },

    referralCode: {
        type: String,
        unique: true 
    },
    
    wallet: {
        type: Schema.Types.ObjectId,
        ref: "Wallet"
    },
    referralWallet: {
        type: Number,
        default: 0
    },
    
    referredUsers: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }],
    
    referredBy: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    

    searchHistory : [{
        category : {
            type : Schema.Types.ObjectId ,
            ref : "Category"

        },

        brand : {
            type : String
        },

        searchedOn : {
            type : Date ,
            default : Date.now
        }

    }]
 
})



const User = mongoose.model("User",userSchema)

module.exports = User