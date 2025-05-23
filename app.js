require('dotenv').config();

const express = require('express')
const app = express()
const path = require('path')

const session = require('express-session')
const MongoStore = require('connect-mongo');
const db = require('./config/db')
const userRouter = require('./routes/userRouter')
const adminRouter = require('./routes/adminRouter')
const passport = require('./config/passport')
 const User = require('./models/userSchema')
const morgan = require('morgan')
db()

app.use(express.json())
app.use(express.urlencoded({extended:true}))

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', 
    httpOnly: true,
    maxAge: 72 * 60 * 60 * 1000
  }
}));


//morgan middleware
//  app.use(morgan())


app.use(passport.initialize())
app.use(passport.session())

app.set("view engine","ejs")
app.set("views",[path.join(__dirname,"views/user"),(__dirname,"views/admin")])
app.use(express.static(path.join(__dirname,"public")))




app.use('/',userRouter)
app.use('/admin',adminRouter)

app.use((err, req, res, next) => {
    console.error(err.stack);
    
    res.status(err.status || 500).json({
      message: err.message || "An internal server error occurred",
      success: false,
    });
  });
  
  
  


app.listen(process.env.PORT,()=>{
    console.log(`server running on port :${process.env.PORT}`)
})



module.exports = app