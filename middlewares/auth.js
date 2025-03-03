const User = require('../models/userSchema')


// const userAuth = (req,res,next)=>{
//     if(req.session.user){
//        User.findById(req.session.user)
//        .then(data=>{
//         if(data && !data.isBlocked){
//             next()
//         }else{
//             res.redirect('/login')
//         }

//        })
//        .catch(error=>{
//         console.log("Error in userAuth middleware")
//         res.status(500).send("Internal server error")
//        })
//     }else{
//         res.redirect('/login')
//     }
// }


// const adminAuth = (req,res,next)=>{
//     if(req.session.admin){
//          User.findOne({isAdmin:true})
//          .then(data=>{
//             if(data){
//                 next()
//             }else{
//                 res.redirect('/admin/login')
//             }
//         })
//         .catch(error=>{
//             console.log("Error in adminAuth middleware")
//             res.status(500).send("Internal Server Error")
//         })

//     }else{
//         res.redirect('/admin/login')

//     }
// }





// const userAuth = async (req, res, next) => {
//     try {
//         if (!req.session.user) {
//             return res.redirect('/login'); 
//         }

//         const user = await User.findById(req.session.user._id); 
        
//         if (!user || user.isBlocked) {
//             req.session.destroy((err)=>{
//                 console.log("error destroying session",err)
//             }); 
//             return res.redirect('/login');
//         }

//         next(); 
//     } catch (error) {
//         console.log("Error in userAuth middleware:", error);
//         res.status(500).send("Internal server error");



const userAuth = async (req, res, next) => {
    try {
        const user = req.session.user
        
        
        const findUser = await User.findOne({_id:user, isBlocked:false})

        if(user && findUser){
            next()
        }else{
            req.session.user = undefined
            req.session.userData = undefined
            res.render("home")
        }
       
    } catch (error) {
        console.log("Error in userAuth middleware:", error);
        res.status(500).send("Internal server error");
    }
};







const adminAuth = (req, res, next) => {
    if (req.session.admin) {
        return next(); 
    } else {
        return res.redirect('/admin/login'); 
    }
};



module.exports ={
    userAuth,
    adminAuth,
    
}