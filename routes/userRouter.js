const express = require("express")
const router = express.Router()
const userController =  require('../controllers/user/userController')
const passport = require("passport")
const {userAuth,adminAuth} = require('../middlewares/auth')
const profileController = require('../controllers/user/profileController')
const productController = require('../controllers/user/productController')
const wishlistController = require('../controllers/user/wishlistController')
const cartController = require('../controllers/user/cartController')
const orderController = require('../controllers/user/orderController')
const walletController = require('../controllers/user/walletController')



//Error management
router.get('/pageNotFound',userController.pageNotFound)

//Sign up management

router.get('/signup',userController.loadSignup)
router.post('/signup',userController.signup)
router.post('/verifyOtp',userController.verifyOtp)
router.post('/resendOtpp',profileController.resendOtp)

router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}))
router.get('/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    req.session.user = req.user._id;
    res.redirect('/')
})


//Login management

router.get('/login',userController.loadLogin)
router.post('/login',userController.login)
router.get('/logout',userController.logout)


//Home page
router.get('/',userAuth,userController.loadHomepage)
router.get('/shop',userController.loadShopping)
router.get('/product-sizes/:productId',userController.productSize)

router.get('/filter', userController.filterProduct);

router.post('/search',userController.search)



//Product management
router.get('/productDetails',productController.productDetails)





//Profile management
router.get('/forgotPassword',profileController.getForgotPassword)
router.post('/forgotEmailValid', profileController.forgotEmailValid);
router.post('/verifyForgotPassOtp',profileController.verifyForgotPassOtp)
router.get('/resetPassword',profileController.getResetPassword)
router.post('/forgotResendOtp',profileController.resendOtp)
router.post('/resetPassword',profileController.resetPassword)

router.get('/userProfile',userAuth,profileController.userProfile)
router.post('/updateUserDetails',userAuth,profileController.updateUserDetails)

router.get('/updateEmail',userAuth,profileController.getUpdateEmail)
router.post('/updateEmail',userAuth,profileController.updateEmail)
router.post('/changeEmail-verifyOtp',userAuth,profileController.verifyChangeEmailOtp)
router.post('/resendOtpUpdateEmail',adminAuth,profileController.resendOtpUpdateEmail)
router.post('/saveNewEmail', userAuth, profileController.saveNewEmail)

router.get('/updatePassword',userAuth,profileController.getUpdatePassword)
router.post('/updatePassword',userAuth,profileController.updatePassword)



//Address management
router.get('/address',userAuth,profileController.getAddress)
router.get('/addAddress',userAuth,profileController.getAddAddress)
router.post('/addAddress',userAuth,profileController.addAddress)
router.get('/editAddress',userAuth,profileController.getEditAddress)
router.post('/editAddress',userAuth,profileController.editAddress)
router.get('/deleteAddress',userAuth,profileController.deleteAddress)

//Wishlist management
 router.get('/wishlist',userAuth,wishlistController.getWishlist)
 router.post('/AddToWishlist',userAuth,wishlistController.addToWishlist)
 router.post('/removeFromWishlist/:id',userAuth,wishlistController.removeFromWishlist)



//Cart management 
router.get('/cart',userAuth,cartController.getCartPage)

router.post('/add-to-cart',userAuth, cartController.addToCart)
router.post('/changeQuantity',userAuth, cartController.changeQuantity)
router.delete('/removeCartItem', userAuth, cartController.removeCartItem)

router.get('/checkout',userAuth,cartController.loadCheckout)
router.post('/apply-coupon',userAuth,cartController.applyCoupon)
router.post('/remove-coupon',userAuth,cartController.removeCoupon)


router.get('/wallet-status',userAuth,walletController.walletStatus)
router.get('/wallet-history',userAuth,walletController.walletHistory)
router.post('/wallet-payment', userAuth,walletController.walletPayment);
router.post('/create-razorpay-order',userAuth,walletController.razorpayOrder)
router.post('/verify-payment',userAuth,walletController.verifyPayment)
router.post('/cleanup-order',userAuth,walletController.cleanupOrder)






router.get('/orders',userAuth,orderController.getOrders)
router.put("/place-order", userAuth,orderController.placeOrder);
router.get('/orderDetails', userAuth, orderController.getOrderDetails)
router.post("/returnOrder",userAuth,orderController.returnOrder);
router.post("/cancelOrder",userAuth,orderController.cancelOrder);

router.get('/orderConfirm',userAuth,orderController.orderConfirm)
router.get('/orderFailure',userAuth,orderController.orderFailure)


router.get('/download-invoice/:id',userAuth,orderController.orderInvoice)

module.exports = router