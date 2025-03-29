const Category  = require('../../models/categorySchema')
const Product = require('../../models/productSchema')


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

        const categoryName = name.trim();
        if (!categoryName) {
            return res.status(400).json({ error: "Category name cannot be empty" });
        }
        
        const existingCategory = await Category.findOne({ 
            name: { $regex: new RegExp(`^${categoryName}$`, 'i') }
        });
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

       
        const categoryName = name.trim();
        if (!categoryName) {
            return res.status(400).json({ error: "Category name cannot be empty" });
        }

        
        const existCategory = await Category.findOne({ 
            name: { $regex: new RegExp(`^${categoryName}$`, 'i') }
        });

        
        if (existCategory && existCategory._id.toString() !== id) {
            return res.status(400).json({ 
                error: "Category already exists. Please choose another name" 
            });
        }

       
        const updateCategory = await Category.findByIdAndUpdate(
            id,
            {
                name: categoryName,  
                description: description.trim()
            }, 
            { new: true }
        );

        if (updateCategory) {
            return res.status(200).json({ 
                success: true, 
                message: "Category updated successfully" 
            });
        } else {
            return res.status(404).json({ error: "Category not found" });
        }

    } catch (error) {
        console.error("Error editing category:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const addCategoryOffer = async (req, res) => {
    try {
        const percentage = parseInt(req.body.percentage);
        const categoryId = req.body.categoryId;
        const category = await Category.findById(categoryId);

        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }


        if (percentage < 1 || percentage > 99) {
            return res.status(400).json({ status: false, message: "Offer must be between 1% and 99%" });
        }

        const products = await Product.find({ category: category._id });
        
        await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: percentage } });

        for (const product of products) {
            const higherOffer = Math.max(percentage,product.productOffer)
            product.salePrice = product.regularPrice - Math.floor(product.regularPrice * (higherOffer/100))
            await product.save()
          }

        res.json({ status: true,message: "Category offer added successfully." });
    } catch (error) {
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};


  

const removeCategoryOffer = async (req, res) => {
    try {
        const { categoryId } = req.body;
        const category = await Category.findById(categoryId);

        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }

        
        category.categoryOffer = 0;
        const products = await Product.find({category:categoryId});
        await category.save();

       
        for(const product of products){
            const productOffer = product.productOffer
            product.salePrice = product.regularPrice - Math.floor(product.regularPrice * (productOffer/100))
            await product.save()
          }
          await category.save()
        res.json({ status: true });
    } catch (error) {
        res.status(500).json({ status: false, message: "Internal Server Error" });
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
    addCategoryOffer,
    removeCategoryOffer


}