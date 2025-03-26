const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const ejs = require("ejs");
const path = require("path");
const app = express();
const connectDB = require("./config/db");

// await connectDB();

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





app.get("/contestpage/:id", (req, res) => {
    const contestId = req.params.id;
    
    const problems = [ // Dummy Data
        { name: "Food Balance", code: "FOODBAL", submissions: 35726, accuracy: 68.05 },
        { name: "Placing 01 And 10", code: "PLACE0110", submissions: 14825, accuracy: 47.89 },
        { name: "Permutation Construct", code: "PERMCON", submissions: 13413, accuracy: 33.07 },
        { name: "Smoothly Increasing", code: "SMOOTHINC", submissions: 599, accuracy: 5.5 },
        { name: "Minimum Colours (Easy)", code: "MINCOL", submissions: 189, accuracy: 5.08 },
    ];

    res.render("contestpage", { contestId, problems }); // Pass problems array
});



/* 
// Database version: Fetch 2 Easy, 2 Medium, and 1 Hard problem randomly
const Problem = require("./models/Problem"); // Assuming you have a Problem model

app.get("/contestpage", async (req, res) => {
    try {
        const easy = await Problem.aggregate([{ $match: { difficulty: "Easy" } }, { $sample: { size: 2 } }]);
        const medium = await Problem.aggregate([{ $match: { difficulty: "Medium" } }, { $sample: { size: 2 } }]);
        const hard = await Problem.aggregate([{ $match: { difficulty: "Hard" } }, { $sample: { size: 1 } }]);

        const problems = [...easy, ...medium, ...hard];
        res.render("contestpage", { problems });
    } catch (error) {
        console.error("Error fetching problems:", error);
        res.status(500).send("Internal Server Error");
    }
});
*/

// Route for Edit Code Page
app.get("/editcode/:problemCode", (req, res) => {
    const problemCode = req.params.problemCode;
    res.render("editcode", { problemCode }); // Render the editcode page with problem code
});


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

app.get("/contestpage/:id", (req, res) => {
    const contestId = req.params.id;
    res.render("contestpage", { contestId });
});



app.get("/about", (req, res) => {
    res.render("about");
});






const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});