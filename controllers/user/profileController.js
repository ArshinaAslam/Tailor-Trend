const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema')
const nodemailer = require('nodemailer')
const bcrypt = require('bcrypt')
const env = require('dotenv').config()
const session = require('express-session')
const { login } = require('./userController')
const Order = require('../../models/orderSchema')
const Wallet = require('../../models/walletSchema')
const Status = require('../statusCodes')
const Message = require('../messages')




async function securePassword (password){
    try {
        const hashPassword = await bcrypt.hash(password,10)
        return hashPassword

        
    } catch (error) {
        console.log("Password do not hashed")
        
    }
}

function generateOtp(){
    const digits = "1234567890"
    let otp = ""
    for(let i=0;i<6;i++){
        otp += digits[Math.floor(Math.random() * digits.length)];

    }
    return otp

}

const sendVerificationEmail = async(email,otp)=>{
    try {
        const transporter = nodemailer.createTransport({
            service : "gmail" ,
            port : 587 ,
            secure : false ,
            requireTLS : true ,
            auth : {
                user : process.env.NODEMAILER_EMAIL ,
                pass : process.env.NODEMAILER_PASSWORD ,

            }
        })

        const mailOptions = {
            from : process.env.NODEMAILER_EMAIL ,
            to : email ,
            subject : "Your OTP for reset password" ,
            text : `Your OTP is ${otp}` ,
            html : `<b><h4>Your OTP : ${otp}</h4><br></b>`
        }

        const info = await transporter.sendMail(mailOptions)
        console.log("Email sent :",info.messageId)
        return true
        
    } catch (error) {
        console.error("Error sending email",error)
        return false
        
    }
}

const getForgotPassword = async(req,res)=>{
    try {
        res.render("forgotPassword")
        
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}




const forgotEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
    
        const findUser = await User.findOne({ email: email });

        if (findUser) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);

            if (emailSent) {
                req.session.userOtp = otp;
                req.session.email = email;
                req.session.otpGeneratedAt = Date.now();
                res.render("forgotPassOtp", { remainingTime: 60, email: email });
                console.log("OTP:", otp);
            } else {
                res.render('forgotPassword', { message: "Failed to send OTP. Please try again." });
            }
        } else {
            
            res.render('forgotPassword', { message: "User with this email does not exist." });
        }
    } catch (error) {
        console.error(error);
        res.redirect('/pageNotFound');
    }
};


const verifyForgotPassOtp = async (req, res) => {
    try {
        const { otp, timer } = req.body;
        console.log('this is the timer: ', timer)

        if (!otp) {
            return res.status(Status.BAD_REQUEST).json({ success: false, message: "OTP is required" });
        }

        if (otp === req.session.userOtp && timer > 0) {
            return res.json({ success: true, message:"Otp verified successfully"});
        } else {
            return res.status(Status.BAD_REQUEST).json({ success: false, message: "The OTP you entered is incorrect. Please try again." });
        }
    } catch (error) {
        console.error("OTP Verification Error:", error);
        res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: "An error occurred. Please try again." });
    }
};



const getResetPassword = async(req,res)=>{
    try {

        res.render('resetPassword')
        
    } catch (error) {
        res.redirect('/pageNotFound')
        
    }
}



const resetPassword = async (req,res)=>{
    try {
        const {newPass1,newPass2} = req.body
        const email = req.session.email
        if(newPass1 === newPass2){
            const hashPassword = await securePassword(newPass1)
            console.log("hashpassword",hashPassword)
            await User.updateOne({email:email},{$set:{password:hashPassword}})

            res.redirect('/login')


        }else{
            res.render('/resetPaswword',{message:"Passwords do not match"})
        }

        
        
    } catch (error) {

        res.redirect('/pageNotFound')
        
    }

}




const resendOtp = async (req, res) => {
    try {
       

        const email = req.session.email;

        
       

        if (!email) {
            console.error("No email found in session");
            return res.status(Status.BAD_REQUEST).json({ success: false, message: "No email found in session. Please restart the process." });
        }

        

        const otp = generateOtp();
        console.log("Generated OTP:", otp);

        req.session.userOtp = otp; 
        console.log("Updated session OTP:", req.session.userOtp);

        const emailSent = await sendVerificationEmail(email, otp);
        
        if (emailSent) {
            return res.status(Status.OK).json({ success: true, message: "OTP resent successfully" });
        } else {
            return res.status(Status.BAD_REQUEST).json({ success: false, message: "Failed to resend OTP. Please try again." });
        }

    } catch (error) {
        console.error("Error resending OTP:", error);
        return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: Message.SERVER_ERROR });
    }
};



const userProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect("/login");
        }

        
        const userData = await User.findById(userId);

       
        const addressData = await Address.findOne({ userId: userId });

       
        const orders = await Order.find({ userId: userId })
            .populate("address")
            .sort({ createdOn: -1 });

         const walletData = await Wallet.findOne({ userId: userId });
         const walletTransactions = walletData ? walletData.transactions.sort((a, b) => b.date - a.date) : [];
         
      
       
        res.render("dashboard-user", {
            user: userData,
            userAddress: addressData, 
            orders: orders || [],
            page:"dashboard",
            wallet: walletData || { balance: 0 }, 
            walletTransactions: walletTransactions,
        });

    } catch (error) {
        console.error("Error in userProfile:", error);
        res.redirect("/pageNotFound");
    }
};

  
 const updateUserDetails = async (req, res) => {
    try {
        const userId = req.session.user; 
        const { name, phone } = req.body;



        const nameRegex = /^[A-Za-z\s]+$/;
        const phoneRegex = /^\d{10}$/;

       
        if (!name || !nameRegex.test(name)) {
            return res.status(Status.BAD_REQUEST).json({ 
                success: false, 
                message: "Name must contain only alphabets and spaces!" 
            });
        }



        if (!phone || !phoneRegex.test(phone)) {
            return res.status(Status.BAD_REQUEST).json({ 
                success: false, 
                message: "Phone number must be 10 digits!" 
            });
        }
        
        const updatedUser = await User.findByIdAndUpdate(userId, { name, phone }, { new: true });

        if (!updatedUser) {
            return res.status(Status.NOT_FOUND).json({ message: "User not found!" });
        }

        res.json({ 
            success: true, 
            message: "Profile updated successfully!",
            user: updatedUser
        });

    
    } catch (error) {
        console.error("Error updating user details:", error);
        res.status(Status.INTERNAL_SERVER_ERROR).json({ message: Message.SERVER_ERROR });
    }
};




const verifyChangeEmailOtp = async(req,res)=>{
    try {
        const enteredOtp = req.body.otp
        console.log("entered otp:",enteredOtp)
        if(enteredOtp === req.session.userOtp){
            req.session.userData = req.body.userData
            res.render('newEmailPage',{
                userData : req.session.userData

            })
        }else{
            res.render('changeEmail-Otp',{
                message : "Invalid OTP",
                userData : req.session.userData
            })
        }
        
    } catch (error) {
        res.redirect('/pageNotFound')
    }
    
}





const getUpdateEmail = async (req, res) => {
    try {
    const user = req.session.user
    let userData = null
    if(user){
        userData = await User.findOne({_id:user})
        if(!user && userData.isBlocked){
            res.redirect("/login")
        }
    }
     
   
        res.render('newEmailPage',{user:userData});
    } catch (error) {
        res.redirect('/pageNotFound');
    }
};

const updateEmail = async (req, res) => {





    try {
        const user = req.session.user
    let userData = null
    if(user){
        userData = await User.findOne({_id:user})
        if(!user && userData.isBlocked){
            res.redirect("/login")
        }
    }

        const { newEmail } = req.body;

        
        const existEmail = await User.findOne({ email: newEmail });
        if (!existEmail) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(newEmail, otp);
            if (emailSent) {
                req.session.userOtp = otp;
                console.log("userOtp in session:", req.session.userOtp);
                req.session.userData = req.body;
                req.session.email = newEmail;
                res.render('changeEmail-otp',{ email: newEmail ,user:userData});
                console.log("OTP:", otp);
            } else {
                res.json("email error");
            }
        } else {
            res.render('NewEmailPage', {
                user:userData,
                message: "User with this email already exists"
            });
        }
    } catch (error) {
        res.redirect('/pageNotFound');
    }
};



const resendOtpUpdateEmail = async(req,res)=>{
    try {
        const otp = generateOtp(); 
        req.session.userOtp = otp; 

        const emailSent = await sendVerificationEmail(req.session.email, otp);
        if (emailSent) {
            console.log("New OTP Sent:", otp);
            return res.json({ success: true });
        } else {
            return res.json({ success: false, message: "Failed to send OTP. Try again!" });
        }
    } catch (error) {
        console.error("Error resending OTP:", error);
        return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: Message.SERVER_ERROR });
    }
}



const saveNewEmail = async (req, res) => {
    try {
        const { otp } = req.body;
        const newEmail = req.session.email; 
        const userId = req.session.user; 
        console.log("Received OTP from frontend:", otp);
        console.log("Stored OTP in session:", req.session.userOtp);
        console.log("User ID:", userId);
        console.log("Email to update:", newEmail);

        if (!req.session.userOtp) {
            return res.json({ success: false, message: "OTP expired. Request a new one." });
        }

        if (otp != req.session.userOtp) {  
            return res.json({ success: false, message: "Invalid OTP" });
        }

        const user = await User.findByIdAndUpdate(
            userId,  
            { email: newEmail },
            { new: true }
        );

        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        req.session.userOtp = null; 
        req.session.user = user._id;  

        console.log("Email updated successfully for user:", user);

        return res.json({ success: true, redirectUrl: '/userProfile' });

    } catch (error) {
        console.error("Error in saveNewEmail:", error);
        return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: Message.SERVER_ERROR });
    }
};



const getUpdatePassword = async(req,res)=>{
    try {

        const userId = req.session.user;
        if (!userId) {
            return res.redirect("/login");
        }

        
        const userData = await User.findById(userId);


        res.render('updatePassword',{user:userData})


        
    } catch (error) {
        res.redirect('pageNotFound')
        
    }
}

const updatePassword = async(req,res)=>{
    try {
        const { currentPassword, newPassword } = req.body;
        
       const userId = req.session.user
       console.log(userId)
        const user = await User.findById(userId);

        if (!user) {
            return res.status(Status.BAD_REQUEST).json({ success: false, message: 'User not found' });
        }

        
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(Status.BAD_REQUEST).json({ success: false, message: 'Current password is incorrect' });
        }

        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        
        user.password = hashedPassword;
        await user.save();

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: Message.SERVER_ERROR });
    }
}





const getAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect("/login");
        }

      
        const userData = await User.findById(userId);

       
        const page = parseInt(req.query.page) || 1; 
        const limit = 2; 
        const skip = (page - 1) * limit;

       
        const addressData = await Address.findOne({ userId: userId });
        const totalAddresses = addressData ? addressData.address.length : 0;
        const paginatedAddresses = addressData ? addressData.address.slice(skip, skip + limit) : [];

        
        const totalPages = Math.ceil(totalAddresses / limit);

        
        res.render("address", {
            user: userData,
            userAddress: { address: paginatedAddresses },
            currentPage: page,
            totalPages: totalPages,
            page: "Myaddress"
        });

    } catch (error) {
        console.error("Error in address:", error);
        res.redirect("/pageNotFound");
    }
};


const getAddAddress = async (req, res) => {
    try {

        const user = req.session.user

           if (!user) {
            return res.redirect('/login'); 
         }
        
        let userData = null
        if(user){
            userData = await User.findOne({_id:user})
            if(userData.isBlocked){
                res.redirect("/login")
            }
        }
        res.render("addAddress",{user:userData})




        
    } catch (error) {
        console.error("Error fetching address page:", error);
        res.redirect('/pageNotFound');
    }
};



const addAddress = async(req,res)=>{
    try {

        const userId = req.session.user
        const {addressType,name,city,landMark,state,pincode,phone,altPhone} = req.body

       

        const userAddress = await Address.findOne({userId:userId})

        if(!userAddress){
            const newAddress = new Address({
                userId : userId ,
                address : [{addressType,name,city,landMark,state,pincode,phone,altPhone}]
            })
            await newAddress.save()
        }else{
            userAddress.address.push({addressType,name,city,landMark,state,pincode,phone,altPhone})
            await userAddress.save()
        }

        res.redirect('/address')
        
    } catch (error) {
        console.error("Error adding address:",error)
        res.redirect('/pageNotFound')
        
    }
}









const getEditAddress = async (req, res) => {
    try {
        const addressId = req.query.id;
        const userId = req.session.user
        let userData = null
        if(userId){
            userData = await User.findOne({_id:userId})
            if(userData.isBlocked){
                res.redirect("/login")
            }
        }

        
        const userAddress = await Address.findOne({ userId: userId });
       
        if (!userAddress) {
            return res.redirect("/pageNotFound");
        }
        
        const addressData = userAddress.address.find(addr => addr._id.toString() === addressId);
       

        if (!addressData) {
            return res.redirect("/pageNotFound");
        }



        
       
        res.render("editAddress", { address:addressData ,user:userId,user:userData});
    } catch (error) {
        console.error("Error in edit address",error);
        res.status(Status.INTERNAL_SERVER_ERROR).send(Message.SERVER_ERROR);
    }
};
const editAddress = async(req,res)=>{
    try {
        const data = req.body
        const addressId = req.query.id;
        const userId = req.session.user;
        
        const findAddress = await Address.findOne({ "address._id": addressId });
       
        if (!findAddress) {
            return res.redirect("/pageNotFound");
        }
        await Address.updateOne({"address._id": addressId},
            {$set: {
                "address.$":{
                    _id : addressId ,
                    addressType : data.addressType ,
                    name : data.name ,
                    city : data.city ,
                    landMark : data.landMark ,
                    state : data.state ,
                    pincode : data.pincode ,
                    phone : data.phone,
                    altPhone : data.altPhone 
                }
            }}
        )

        res.redirect('/address')



        
    } catch (error) {
        console.error("Error in edit address",error)
        res.redirect('/pageNotFound')
        
    }
}



const deleteAddress = async(req,res)=>{
    try {

        const addressId = req.query.id
       
        const findAddress = await Address.findOne({ "address._id": addressId });
        
       
        if (!findAddress) {
            return res.status(Status.NOT_FOUND).send("Address not found")
        }

        await Address.updateOne({
            "address._id":addressId
        },
        {
            $pull : {
                address : {
                    _id:addressId
                }
            }

        }
        
        )

        res.redirect('/address')

        
    } catch (error) {
        console.error("Error in delete address",error)
        res.redirect('/pageNotFound')
        
    }
}


module.exports = {
    getForgotPassword ,
    forgotEmailValid ,
    verifyForgotPassOtp,
    getResetPassword,
    resendOtp,
    resetPassword,
    userProfile,

    updateUserDetails,
    
    verifyChangeEmailOtp,
    getUpdateEmail,
    updateEmail,
    resendOtpUpdateEmail,
    saveNewEmail,
    getUpdatePassword,
    updatePassword,
    getAddress,
    getAddAddress,
    addAddress,
    getEditAddress,
    editAddress,
    deleteAddress,

}