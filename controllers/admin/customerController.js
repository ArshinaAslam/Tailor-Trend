const User = require('../../models/userSchema')
const Status = require('../statusCodes')
const Message = require('../messages')



const customerInfo = async (req, res) => {
    try {
        let search = req.query.search || "";
        let page = parseInt(req.query.page) || 1;  

        const limit = 3;

        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        })
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();

        const count = await User.countDocuments({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        });

        res.render('customers', {
            data: userData,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
            search
        });

    } catch (error) {
        console.error("Error fetching customer data:", error);
        res.status(Status.INTERNAL_SERVER_ERROR).send(Message.SERVER_ERROR);
    }
};



const customerBlocked = async(req,res)=>{
   try {
    let id = req.query.id
    await User.updateOne({_id:id},{$set:{isBlocked:true}})
    res.redirect('/admin/users')
   } catch (error) {
    res.redirect('/pageError')
    
   }
}

const customerUnblocked = async (req,res)=>{
    try {
    let id= req.query.id
    await User.updateOne({_id:id},{$set:{isBlocked:false}})
    res.redirect('/admin/users')
        
    } catch (error) {

        res.redirect('/pageError')
    
        
    }

}


module.exports ={
    customerInfo,
    customerBlocked,
    customerUnblocked,

}