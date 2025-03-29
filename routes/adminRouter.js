const express = require('express')
const router = express.Router()
const adminController = require('../controllers/admin/adminController')
const {userAuth,adminAuth} = require('../middlewares/auth')
const customerController = require('../controllers/admin/customerController')
const categoryController = require('../controllers/admin/categoryController')
const productController = require('../controllers/admin/productController')
const brandController = require('../controllers/admin/brandController')
const orderController = require('../controllers/admin/orderController')
const couponController = require('../controllers/admin/couponController')
const walletController = require('../controllers/admin/walletController');
const uploads = require('../helpers/multer');



router.get('/pageError',adminController.pageError)
//Login  management
router.get('/login',adminController.loadLogin)
router.post('/login',adminController.login)
router.get('/dashboard',adminAuth,adminController.loadDashboard)
router.get('/logout',adminController.logout)

router.get('/exportExcel', adminAuth,adminController.exportExcel)
router.get('/exportPdf', adminAuth, adminController.exportPdf);
router.get('/sales-report',adminAuth, adminController.salesReport)






//customer management
router.get('/users',adminAuth,customerController.customerInfo)
router.get('/blockCustomer',adminAuth,customerController.customerBlocked)
router.get('/unblockCustomer',adminAuth,customerController.customerUnblocked)


//category management
router.get('/category',adminAuth,categoryController.categoryInfo)
router.get('/addCategory', adminAuth, categoryController.loadAddCategory);  
router.post('/addCategory',adminAuth,categoryController.addCategory)
router.get('/listCategory',adminAuth,categoryController.getListCategory)
router.get('/unlistCategory',adminAuth,categoryController.getUnlistCategory)
router.get('/editCategory',adminAuth,categoryController.getEditCategory)
router.post('/editCategory/:id',adminAuth,categoryController.editCategory)
router.post('/addOffer-category',adminAuth,categoryController.addCategoryOffer)
router.post('/removeOffer-category',adminAuth,categoryController.removeCategoryOffer)


//product management 
router.get('/products',adminAuth,productController.productInfo)
router.get('/AddProducts', adminAuth, productController.loadAddProduct);  
router.post('/AddProducts', adminAuth, uploads.array("images"), productController.addProduct);
router.get('/blockedProduct',adminAuth,productController.blockedProduct)
router.get('/unblockedProduct',adminAuth,productController.unblockedProduct)
router.get('/editProduct',adminAuth,productController.getEditProduct)
//  router.post('/editProduct:id',adminAuth,uploads.array("images"),productController.editProduct)
 router.post('/editProduct/:id', adminAuth, uploads.array("images"), productController.editProduct);
 router.post('/addOffer-product',adminAuth,productController.addProductOffer)
 router.post('/removeOffer-product',adminAuth,productController.removeProductOffer)



 //Coupon management
 router.get('/coupon',adminAuth,couponController.loadCoupon)
 router.post('/createCoupon',adminAuth,couponController.createCoupon)
 router.get('/editCoupon',adminAuth,couponController.getEditCoupon)
 router.post('/editCoupon',adminAuth,couponController.editCoupon)
 router.get('/deleteCoupon',adminAuth,couponController.deleteCoupon)


//wallet management


router.get('/wallet-transaction', 
  
    adminAuth, 
    walletController.getWalletTransactions
);

router.get('/wallet-transaction/:transactionId', 
   
    adminAuth, 
    walletController.getTransactionDetails
);




//Order management
 router.get("/orderList", adminAuth, orderController.getOrderListPageAdmin)
 router.get('/orders/:orderId',adminAuth,orderController.getOrderDetailsPageAdmin)
 router.post('/update-item-status/:orderId',adminAuth,orderController.updateOrderStatus)

 router.post('/handleReturn', adminAuth,orderController.handleReturn);





module.exports = router

