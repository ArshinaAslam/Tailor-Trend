const Category  = require('../../models/categorySchema')


const categoryInfo = async(req,res)=>{
    try {
        const page = parseInt(req.query.page) || 1
        const limit = 4 
        const skip = (page - 1)*limit
        const searchQuery = req.query.search || ""; 
        
        let query = {};
        if (searchQuery) {
            query = {
                name: { $regex: searchQuery, $options: "i" } 
            };
        }



        const categoryData = await Category.find(query)
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit)

        

        const totalCategories = await Category.countDocuments()
        const totalPages = Math.ceil(totalCategories / limit)
        res.render('category',{
            cat:categoryData,
            currentPage:page,
            totalPages:totalPages,
            totalCategories:totalCategories,
            search: searchQuery

        })
    } catch (error) {
        console.error(error)
        res.redirect('/pageError')
    }
}


const loadAddCategory = async (req, res) => {
    try {
        res.render("addCategory");
    } catch (error) {
        console.error("Error loading addCategory page", error);
        res.redirect('/pageError');
    }
};


const addCategory = async (req, res) => {

    const { name, description } = req.body;
    try {

        const categoryName = name.toLowerCase()
        console.log('category name: ', categoryName);
        
        const existingCategory = await Category.findOne({ name: categoryName });
        if (existingCategory) {
            return res.status(400).json({ error: "Category already exists" });
        }

        const newCategory = new Category({
            name: categoryName,
            description,
            createdAt : new Date()
        });

        await newCategory.save();
        
       
        return res.status(200).json({ success: true, message: "Category added successfully" });
        
    } catch (error) {
        return res.status(500).json({ error: "Internal server error" });
    }
};


const getListCategory = async(req,res)=>{
    try {
        let id = req.query.id
        await Category.updateOne({_id:id},{$set:{isListed:false}})
        res.redirect('/admin/category')

        
    } catch (error) {
        res.redirect('/pageError')
    }
}

const getUnlistCategory = async(req,res)=>{
   try {
    let id = req.query.id
    await Category.updateOne({_id:id},{$set:{isListed:true}})
    res.redirect('/admin/category')
    
   } catch (error) {
    res.redirect('/pageError')
    
   }
}



const getEditCategory = async (req,res)=>{
    try {
       const id = req.query.id
       const category = await Category.findOne({_id:id})
       res.render("editCategory",{category:category})


    } catch (error) {
        
        res.redirect('/pageError')
    }

}


const editCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const { name, description } = req.body;
        
       
        const existCategory = await Category.findOne({ name });
        if (existCategory && existCategory._id.toString() !== id) {
            return res.json({ error: "Category exists. Please choose another name" });
        }

       
        const updateCategory = await Category.findByIdAndUpdate(id, {
            name: name,
            description: description
        }, { new: true });

        if (updateCategory) {
             res.status(200).json({ success: true, message: "Category updated successfully" });
        } else {
            res.status(400).json({ error: "Category not found" });
        }

    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
};



module.exports = {
    categoryInfo,
    loadAddCategory,
    addCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory,


}