const express = require('express')
const router = express.Router()
const adminController = require('../controllers/admin/adminController')
const {userAuth,adminAuth} = require('../middlewares/auth')
const customerController = require('../controllers/admin/customerController')
const categoryController = require('../controllers/admin/categoryController')
const productController = require('../controllers/admin/productController')
const brandController = require('../controllers/admin/brandController')
const orderController = require('../controllers/admin/orderController')
const multer  = require('multer')
const storage = require('../helpers/multer')
const uploads = multer({ storage: storage });



router.get('/pageError',adminController.pageError)
//Login  management
router.get('/login',adminController.loadLogin)
router.post('/login',adminController.login)
router.get('/dashboard',adminAuth,adminController.loadDashboard)
router.get('/logout',adminController.logout)


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


//product management 
router.get('/products',adminAuth,productController.productInfo)
router.get('/AddProducts', adminAuth, productController.loadAddProduct);  
router.post('/AddProducts', adminAuth, uploads.array("images"), productController.addProduct);
router.get('/blockedProduct',adminAuth,productController.blockedProduct)
router.get('/unblockedProduct',adminAuth,productController.unblockedProduct)
router.get('/editProduct',adminAuth,productController.getEditProduct)
//  router.post('/editProduct:id',adminAuth,uploads.array("images"),productController.editProduct)
 router.post('/editProduct/:id', adminAuth, uploads.array("images"), productController.editProduct);






//brand management
// router.get('/brands',adminAuth,brandController.loadBrand)


//Order management
 router.get("/orderList", adminAuth, orderController.getOrderListPageAdmin)
 router.get('/orders/:orderId',adminAuth,orderController.getOrderDetailsPageAdmin)
 router.post('/update-status/:orderId',adminAuth,orderController.updateOrderStatus)
 router.post('/handleReturn', adminAuth,orderController.handleReturn);





module.exports = router

