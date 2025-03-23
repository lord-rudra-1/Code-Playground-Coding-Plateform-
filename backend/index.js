const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const ejs = require("ejs");
const path = require("path");
const app = express();
const connectDB = require("./config/db");

// Import Routes
const authRoutes = require("./routes/authRoutes");
const problemRoutes = require("./routes/problemRoutes");
const executeRoutes = require("./routes/executeRoutes");


app.set("view engine","ejs");
app.set('views',path.join(__dirname,'../frontend/views'));
app.use('/css',express.static(path.join(__dirname,'../frontend/css')));
app.use('/',express.static(path.join(__dirname,'../frontend/imgg')));

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();



// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/problems", problemRoutes);
app.use("/api/execute", require("./routes/executeRoutes"));






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






const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});