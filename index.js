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
const MongoStore = require('rate-limit-mongo');


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

app.set('trust proxy', true);

let store;

try {
  // Initialize MongoStore with error handling
  store = new MongoStore({
    uri: 'mongodb+srv://tysev8301:mw0vXtyfkCW5Naat@cluster0.vavrs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', // Updated URI to avoid IPv6
    collectionName: 'rateLimit', // Collection for storing rate limit data
    expireTimeMs: 15 * 60 * 1000, // Expiration time for each entry
    userKey: (req) => req.ip, // Use IP address as the identifier
  });

  // Optional: Add an error listener for runtime errors console.log('MongoStore initialized successfully.');
} catch (error) {
    console.error('Failed to initialize MongoStore:', error.message);
    // Exit the process or use a fallback
    process.exit(1);
  }

const apiLimiter = rateLimit({
    store,
    windowMs: 15 * 60 * 1000, // 15 minutes window
    max: 200, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use(session({
    secret:'secret',
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

const uri = 'mongodb+srv://tysev8301:mw0vXtyfkCW5Naat@cluster0.bwf8u.mongodb.net/e-commerce?retryWrites=true&w=majority';

// Connection options
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 200, // Adjust connection pool size as needed
};

// Connect to MongoDB
mongoose
  .connect(uri, options)
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });

// Listen for successful connection
mongoose.connection.once('open', () => {
  console.log('Connected to MongoDB');
});

// Optional: Additional event listeners for connection management
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB connection disconnected');
});

// mongoose.connect('mongodb+srv://tysev8301:oaWkFBiWMImk6NJg@cluster0.bwf8u.mongodb.net/e-commerce?retryWrites=true&w=majority', {
//     maxPoolSize: 500
// })
// .catch((error) => {
//     console.error('Error connecting to MongoDB', error);
// });
 
// mongoose.connection.once('open', () => {
//     console.log('Connected to MongoDB');
// });


////////////////////////////////////////
////////////////////////////////////////

const userSchema = new mongoose.Schema({
    email: String,
    verifyemail: String,
    otp: String,  
    first_name: String,
    title: String,
    address: String,
    password: String,
    ordered: Boolean,
});


//////////////////////////////////////////
//////////////////////////////////////////

const Users = mongoose.model('users', userSchema);

// ---------------------- //
// ---getting current user info -- //
// ---------------- //

app.post('/', apiLimiter, async(req, res) => {
    try {
        const email = req.session.email
        if(email){
            const sign = await Users.findOne({ email })
            res.json({ user : sign, status : 'online'})
        }else{
            return res.json({user: null, status : 'offline'})
        }
    } catch (error) {
        res.json({ status : 'error'})
    }
})


// ============================================================================================================== //
// ===================================SIGN-UP, LOG-IN & LOG-OUT starts============================================ //

// ---------------------- //
// ---sign up functionality-- //
// ---------------- //


app.post('/signup', apiLimiter, async(req, res) => {
    try {
        if(req.body.email){
            const exist = await Users.findOne({ email: req.body.email})
            if(exist){
                res.json({status: 'error', message:'Email already exists'})
            }else{
                
                const hashedPassword = await argon2.hash(req.body.password);
                const getuid = await Users.create({
                    password: hashedPassword,
                    email: req.body.email,
                });
    
                req.session.email = getuid.email;
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

app.post('/login', apiLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await Users.findOne({ email });

        if (!user) {
            return res.json({ status: 'error', message: 'Account does not exist' });
        }

        const match = await argon2.verify(user.password, password);

        if (!match) {
            return res.json({ status: 'error', message: 'Incorrect password' });
        }

        req.session.email = email;
        req.session.uid = user._id;

        res.json({ status: 'success' });
    } catch (error) {
        console.error('Login error:', error); // Log the error for debugging
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});


app.post('/forget_password', apiLimiter, async(req, res) => {
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


    // ____________________________________=================LIKES FUNCTIION ends==============___________________________________ //

// =================================================ADDING TO CARTS AND LIKES ends================================================== //





// Start the Express server
app.listen(4000, '0.0.0.0');
