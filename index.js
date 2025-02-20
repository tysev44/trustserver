const cors = require('cors');
const express = require('express');
const session = require('express-session');
const cookie = require('cookie-parser');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const argon2 = require('argon2');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const MongoStore = require("connect-mongo");


// ---------------------- // 
// ---give permission to client-- //
// ---------------- //

const corsOptions = {
    origin: ["http://localhost:3000", "*"],
    methods: ['GET', 'POST'],
    credentials: true,
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());
app.use(bodyParser.json());
app.use(express.static('contents'));
app.use(cookie());

// ---------------------- //
// ---setting the session cookie-- //
// ---------------- //

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit to 100 requests per window
    message: "Too many requests, please try again later."
});
app.use(limiter);

app.set('trust proxy', true);

const uri = 'mongodb+srv://tysev8301:mw0vXtyfkCW5Naat@cluster0.vavrs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';


app.use(session({
    secret: 'd1baa1e6977dace2652701ad3a7310e84e498d81f1378b308c766cc9b308e6fccd95d09a806d130313bc422c80b6e8c933d5a3545a2c20cf876d8bf33ad1b7ac', // Change this to a secure key
    resave: true,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
        expires: new Date(Date.now() + (1000 * 60 * 60 * 24 * 30)) // Expires 30 days from now
    }
}));




// ---------------------- //
// ---connecting to database-- //
// ---------------- //


mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
}).then(() => {
    console.error('✅ Connected to MongoDB');
}).catch((error) => {
    console.error('❌ MongoDB Connection Error:', error);
});

// Handle MongoDB Connection Events
mongoose.connection.on('error', (err) => console.error('MongoDB Error:', err));
mongoose.connection.on('disconnected', () => {
    console.log('MongoDB Disconnected'); 
    mongoose.connect(uri)
});




////////////////////////////////////////
////////////////////////////////////////

const userSchema = new mongoose.Schema({
    email: String,
    verifyemail: String,
    balance: Number,  
    first_name: String,
    title: String,
    location: String,
    password: String,
    ordered: Boolean,
});

//////////////////////////////////////////
//////////////////////////////////////////

const Users = mongoose.model('users', userSchema);

// ---------------------- //
// ---getting current user info -- //
// ---------------- //

app.post('/', async(req, res) => {
    try {
        const uid = req.session.uid
        if(uid){
            const sign = await Users.findOne({_id: uid })
            res.json({ user : sign, status : 'online'})
        }else{
            return res.json({user: null, status : 'logout'})
        }
    } catch (error) {
        res.json({ status : 'error'})
    }
})

process.on('uncaughtException', (err) => {
    console.error('🔥 Unhandled Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Promise Rejection:', reason);
    process.exit(1);
});


// ============================================================================================================== //
// ===================================SIGN-UP, LOG-IN & LOG-OUT starts============================================ //

// ---------------------- //
// ---sign up functionality-- //
// ---------------- //


app.post('/signup', async(req, res) => {
    try {
        if(req.body.email){
            const exist = await Users.findOne({ email: req.body.email})
            if(exist){
                res.json({status: 'error', message:'Email already exists'})
            }else{
                
                const hashedPassword = await argon2.hash(req.body.password);
                const getuid = await Users.create({
                    first_name: req.body.name,
                    password: hashedPassword,
                    email: req.body.email,
                });
    
                req.session.uid = getuid._id
                req.session.save()
    
                res.json({status: 'success'})
            }
        }
    } catch (error) {
        res.json({ status : 'error'})
    }
})

// ---------------------- //
// ---logout functionality-- //
// ---------------- //

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.json({ status: 'Error', error: err });
        }
        res.clearCookie('connect.sid'); // Clear the session cookie manually
        res.json({ status: 'success', message: 'Logged out successfully' });
    });
});


// ---------------------- //
// ---login functionality-- //
// ---------------- //

app.post('/login', async(req, res) => {
    try {
        const email = req.body.email;
        const updt = await Users.findOne({ email });

        if (!updt) {
            return res.json({ status: 'error', message: 'Account does not exist' });
        }

        const match = await argon2.verify(updt.password, req.body.password);
        
        if (!match) {
            return res.json({ status: 'error', message: 'Incorrect password' });
        }

        req.session.uid = updt._id;
        await req.session.save();
        res.json({ status: 'success' });

    } catch (error) {
        console.error(error);
        res.json({ status: 'error', message: 'Server error' });
    }
});


// ---------------------- //
// ---login functionality-- //
// ---------------- //
app.post('/forget_password', async(req, res) => {
    try {
        const email = req.body.email;

        await Users.findOne({ email : email }).then((updt)=>{
            if(updt){
                res.json({ status: 'success'})
            }else{
                res.json({ status: 'error', message : 'Account does not exist' });
            }
        });
    } catch (error) {
        res.json({ status: 'error', message: 'Server error' });
    }
})


// ===================================== SIGN-UP, LOG-IN & LOG-OUT ends============================================ //
// =============================================================================================================== //





// Start the Express server
app.listen(4000, '0.0.0.0');
