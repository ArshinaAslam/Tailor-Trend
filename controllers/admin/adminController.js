const User = require('../../models/userSchema')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')



const pageError = async(req,res)=>{
    res.render('adminError')
}




const loadLogin = async(req,res)=>{
    if(req.session.admin){
        res.redirect('/admin/dashboard')
    }else{
        res.render('adminLogin',{message:null})

    }

   
}




const login = async (req, res) => {
    try {
        const { email, password } = req.body;
       
        const admin = await User.findOne({ email, isAdmin: true });
        if (!admin) {
            console.log("Admin not found");
            return res.redirect('/admin/login'); 
        }

        
        const passwordMatch = await bcrypt.compare(password, admin.password);

        if (passwordMatch) {
            req.session.admin = true; 
           
            return res.redirect('/admin/dashboard'); 
        } else {
            console.log("Invalid password");
            return res.render('adminLogin', { message: 'Invaild credentials! '})
        }
    } catch (error) {
        console.error("Login error:", error);
        res.redirect('/pageError');
    }
};





const loadDashboard = async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login'); 
    }

    try {
        res.render('dashboard');
    } catch (error) {
        console.error("Error loading dashboard:", error);
        res.redirect('/pageError');
    }
};



const logout = async (req,res)=>{
    try{
        req.session.destroy(err=>{
            if(err){
                console.log("Error destroying session",err)
                res.redirect("/pageError")
            }else{
                res.redirect('/admin/login')
            }
        })

    }catch(error){
        console.log("Unexpected error during logout",error)
        res.redirect('/pageError')


    }
}

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout



}