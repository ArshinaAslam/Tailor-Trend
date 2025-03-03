
const User = require("../../models/userSchema")
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const Brand = require('../../models/brandSchema')
const nodemailer = require('nodemailer')
const bcrypt = require('bcrypt')
const env = require('dotenv').config()


const loadHomepage = async (req,res)=>{
    try {
        const user = req.session.user
        let userData = null
        if(user){
            userData = await User.findOne({_id:user})
        }
        res.render("home",{user:userData})
    }catch (error){
        console.log("Home page not found")
        res.status(500).send("Server error")
    }

}




const loadSignup=async (req,res)=>{
    try{
    const message = req.session.message; 
    req.session.message = null;
      res.render('signup',{message})

    }catch(error){
        console.log("Home page not loading",error)
        res.status(500).send("Server error")
    }
    
}




function generateOtp(){
    return Math.floor(100000+ Math.random()*900000) .toString()
}


async function sendVerificationEmail(email,otp){
    try {
        const transporter = nodemailer.createTransport({
            service : "gmail" ,
            port : 587 ,
            secure : false ,
            requireTLS : true ,
            auth : {
                user : process.env.NODEMAILER_EMAIL ,
                pass : process.env.NODEMAILER_PASSWORD
            }
        })
        const info = await transporter.sendMail({
            from : "process.env.NODEMAILER_EMAIL",
            to : email,
            subject : "Verify your account" ,
            text : `Your OTP is ${otp}` ,
            html : `<b>Your OTP : ${otp}</b>`



        })

        return info.accepted.length>0

    } catch (error) {
        console.error("Error sending email",error)
        return false
        
    }
}

const signup = async (req,res)=>{
   try {
    const {name,phone,email,password,cPassword} = req.body

    req.session.email = email

    if(password !== cPassword) {
        
        return res.redirect('/signup')
    }


    const existUser = await User.findOne({email})
    if(existUser){
        req.session.message = "User with this email already exist"
        return res.redirect('/signup')
    }

    const otp = generateOtp()

    const emailSent =await sendVerificationEmail(email,otp)

    if (!emailSent){
        return res.json("email-error")
    }


    req.session.userOtp = otp
    req.session.userData ={name,phone,email,password} 

     res.render('verify-otp', { email: email })
    console.log("OTP send",otp)

    



    
   } catch (error) {
    console.error("signup error")
    res.redirect('/pageNotFound')
    
   }
}


const  securePassword = async(password) =>{
    try{
        const hashPassword = await bcrypt.hash(password,10)
        return hashPassword



    }catch(error){
        console.error("Error hashing password:", error);
        throw new Error("Password encryption failed");

    }


}

const verifyOtp = async(req,res)=>{
    try{
        const {otp,timer} = req.body
      
       
        if(otp === req.session.userOtp && timer>0){
            const user = req.session.userData
            const existingUser = await User.findOne({ email: user.email });
            if (existingUser) {
                return res.status(400).json({ success: false, message: "User with this email already exists. Please log in." });
            }
           
           const hashPassword = await securePassword(user.password)
           

           const saveUserData = new User({
            name : user.name ,
            email : user.email ,
            phone : user.phone ,
            password : hashPassword ,

           })
           await saveUserData.save();
           req.session.user = saveUserData._id
           res.json({success:true,redirectUrl:'/'})
        }else{
           res.status(400).json({success:false,message:"Invalid otp,Please try again"})
        }

    }catch(error){
        console.error("Error verifying otp",error)
        res.status(500).json({success:false,message:"An error occured"})

    }




}



const resendOtp = async(req,res)=>{
    try {
        const {email} = req.session.email
        if(!email){
          return  res.status(400).send("Email found in session")
        }

        const otp = generateOtp()
        req.session.userOtp = otp
        const emailSent = await sendVerificationEmail(email,otp)

        if(emailSent){
            console.log("resend otp",req.session.userOtp)
            res.status(200).json({success:true,message:"OTP resend successfully"})
        }else{
            res.status(400).json({success:false,message:"Failed to resend OTP.Please try again"})
        }
        
    } catch (error) {
        
        console.error("Error resending otp",error)
        res.status(500).json({success:false,message:"Internal Server Error.Please try again"})
    }
}




const loadLogin = async (req,res)=>{
    try {
        if(!req.session.user){
            res.render('login')
        }else{
            res.redirect('/')
        }
        
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}


const login = async (req,res)=>{
    try {
        const {email,password} = req.body

        const findUser = await User.findOne({isAdmin:0,email:email})
        if(!findUser){
            return res.render('login',{message:"User not found"})
        }
        if(findUser.isBlocked){
            return res.render('login',{message:"User is blocked by admin"})

        }

        const passwordMatch = await bcrypt.compare(password,findUser.password)
        if(!passwordMatch){
            return res.render('login',{message:"Incorrect password"})

        }

        req.session.user = findUser._id
        res.redirect('/')

        
    } catch (error) {
        console.error("Login error")
        res.render('login',{message:"Login failed.Please try again later"})
        
    }
}


const logout = async (req,res)=>{
    try {
        req.session.user = undefined
        req.session.userData = undefined
        return res.redirect("/")
        }
        
     catch (error) {
        console.log("Logout error")
        res.redirect('/pageNotFound')
        
    }
}




const loadShopping = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });
        const categories = await Category.find({ isListed: true });
        const categoryIds = categories.map((category) => category._id.toString());
        
       
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        
        let sort = {};
        if (req.query.sort === 'price_asc') {
            sort.salePrice = 1;
        } else if (req.query.sort === 'price_desc') {
            sort.salePrice = -1;
        } else {
            sort.createdOn = -1; 
        }

        
        const query = {
            isBlocked: false,
            category: { $in: categoryIds },
        };

        
        const productsQuery = Product.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit);

        const [products, total] = await Promise.all([
            productsQuery.exec(),
            Product.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / limit);
        const brands = await Brand.find({ isBlocked: false });

        res.render('shopping', {
            user: userData,
            products: products,
            category: categories.map(category => ({ _id: category._id, name: category.name })),
            brand: brands,
            currentPage: page,
            totalPages: totalPages,
            sort: req.query.sort 
        });
    } catch (error) {
        console.log("Shopping page not loading", error);
        res.redirect('/pageNotFound');
    }
};




const productSize = async (req, res) => {
    try {
        const product = await Product.findById(req.params.productId);
        res.json(product.sizes);
    } catch (error) {
        console.error("Error fetching sizes:", error);
        res.status(500).json({ error: 'Error fetching sizes' });
    }
};


    


const filterProduct = async (req, res) => {
    try {


        
        const user = req.session.user;
       
        const category = req.query.category;
        const brand = req.query.brand;

       
        const findCategory = category ? await Category.findOne({ _id: category }).lean() : null;
          console.log("Found Category:", findCategory);
 
        const findBrand = brand ? await Brand.findOne({ _id: brand }) : null;

        const brands = await Brand.find({}).lean();

        const query = {
            isBlocked: false,
            
        };

       
        if (findCategory) {
            query.category = findCategory._id;
        }
        
        if (findBrand) {
            query.brand = findBrand.brandName;
        }
        

        let findProducts = await Product.find(query).lean();
        findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

        const categories = await Category.find({ isListed: true });

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);

        const currentProduct = findProducts.slice(startIndex, endIndex);

        let userData = null;
        if (user) {
            userData = await User.findOne({ _id: user });
            if (userData) {
                const searchEntry = {
                    category: findCategory ? findCategory._id : null,
                    brand: findBrand ? findBrand.brandName : null,
                    searchedOn: new Date(),
                };
                userData.searchHistory.push(searchEntry);
                await userData.save();
            }
        }

        res.render('shopping', {
            user: userData,
            products: currentProduct,
            category: categories,
            brand: brands,
            totalPages,
            currentPage,
            selectedCategory: category || null,
            selectedBrand: brand || null,
        });
    } catch (error) {
        console.error("Error in filter Product:", error);
        res.redirect('/pageNotFound');
    }
};


const filterPrice = async(req,res)=>{
    try {
        const user = req.session.user
        const userData = await User.findOne({_id:user})
        const brands = await  Brand.find({}).lean()
        const categories = await Category.find({isListed:true}).lean()


        let minPrice = parseInt(req.query.gt) || 0;
        let maxPrice = parseInt(req.query.lt) || 1000000;


        let findProducts = await Product.find({
            salePrice : {$gt:minPrice,$lt:maxPrice},
            isBlocked : false ,
            // quantity : {$gt:0}
        }).lean()

        findProducts.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn))

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);

        const currentProduct = findProducts.slice(startIndex, endIndex);

        req.session.filteredProducts = findProducts 

        res.render('shopping', {
            user: userData,
            products: currentProduct,
            category: categories,
            brand: brands,
            totalPages,
            currentPage,
           
        });




    } catch (error) {
        console.error("Error in filter Price:", error);
        res.redirect('/pageNotFound');
        
    }
}









const search = async (req,res)=>{
    try {
        
        const user = req.session.user 
        const userData = await User.findOne({_id:user})
        let search = req.body.query 
        const brands = await Brand.find({}).lean()
        const categories = await Category.find({isListed:true})
        const categoryIds = categories.map((category)=>category._id.toString())

        let searchResult = []

        if(req.session.filteredProducts && req.session.filteredProducts>0 ){
            searchResult = req.session.filteredProducts.filter((product)=>
                product.productName.toLowerCase().includes(search.tpLowerCase())
            )
        }else {
            searchResult= await Product.find({
                productName: {$regex:".*"+search+".*",$options:"i"},
                isBlocked:false ,
                
                category:{$in:categoryIds}
            })
        }

        searchResult.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn))



        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(searchResult.length / itemsPerPage);

        const currentProduct = searchResult.slice(startIndex, endIndex);

        res.render('shopping',{
            user: userData,
            products: currentProduct,
            category: categories,
            brand: brands,
            totalPages,
            currentPage,
            count:searchResult.length

        })







    } catch (error) {

        console.error("Error in searching:", error);
        res.redirect('/pageNotFound');
        
        
    }
}






const pageNotFound = async (req,res)=>{
    try{
        res.render("page-404")
    }catch(error){
        res.redirect('/pageNotFound')
    }
} 





module.exports = {
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadHomepage,
    loadLogin,
    login,
    logout,
    pageNotFound,
    loadShopping,
    productSize,
    filterProduct,
    filterPrice,
    search,



}


