const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const ejs = require("ejs");
const path = require("path");
const app = express();
const connectDB = require("./config/db");
const USER = require("./models/User");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;


app.set("view engine", "ejs");
app.set('views', path.join(__dirname, '../frontend/views'));
app.use('/css', express.static(path.join(__dirname, '../frontend/css')));
app.use('/', express.static(path.join(__dirname, '../frontend/imgg')));

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();


// Middleware
app.use(cors());
app.use(express.json());

app.use(express.urlencoded({ extended: false }));


// Root Route
app.get("/", (req, res) => {
    res.render("home");
});

app.get("/signin", (req, res) => {
    res.render("signin");
});

app.get("/signup", (req, res) => {
    res.render("signup");
});

app.get("/contact", (req, res) => {
    res.render("contact");
});

app.get("/explore", (req, res) => {
    res.render("explore");
});

app.get("/problems", (req, res) => {
    res.render("problems");
});

app.get("/contests", (req, res) => {
    res.render("contests");
});

app.get("/discuss", (req, res) => {
    res.render("discuss");
});


app.get("/about", (req, res) => {
    res.render("about");
});

app.post("/signup", async (req, res) => {
    try {
        const { name, email, password, confirm_password } = req.body;

        // Check if user already exists
        const user_exist = await USER.findOne({ email });
        if (user_exist) {
            res.render("signup", { message: "User already exists" });
        }

        // Validate password match
        if (password !== confirm_password) {
            res.render("signup", { message: "Passwords do not match" });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Create new user
        const user = await USER.create({
            username: name,
            email: email,
            password: hashedPassword,
        });
        res.redirect("/signin");
    } catch (error) {
        console.error("Signup error:", error);
        res.render("signup", { message: "Error creating user" })
    }
});

app.post("/signin", async (req, res) => {
    try {
        const { email, password } = req.body;
        // Find user
        const user = await USER.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Incorrect password" });
        }

        res.json({
            email: user.email,
            userId: user._id,
            message: "Signin successful"
        });

    } catch (error) {
        console.error("Signin error:", error);
        res.status(500).json({ message: "Error signing in" });
    }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});