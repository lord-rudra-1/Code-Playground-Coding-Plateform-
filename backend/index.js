const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const ejs = require("ejs");
const path = require("path");
const app = express();
const connectDB = require("./config/db");
const USER = require("./models/User");
const bcrypt = require("bcrypt");
const Problem = require("./models/Problem");
const Contest = require("./models/Contest");
const SALT_ROUNDS = 10;
const mongoose = require('mongoose');
// await connectDB();

// Import Routes
const authRoutes = require("./routes/authRoutes");
const problemRoutes = require("./routes/problemRoutes");
const executeRoutes = require("./routes/executeRoutes");
const discussRoutes = require("./routes/discussRoutes");
const contestRoutes = require("./routes/contestRoutes"); 
const contestjoinRoutes = require("./routes/contestjoinRoutes");
const TEMP_DIR = path.join(__dirname, 'temp');

app.set("view engine", "ejs");
app.set('views', path.join(__dirname, '../frontend/views'));
app.use('/css', express.static(path.join(__dirname, '../frontend/css')));
app.use('/', express.static(path.join(__dirname, '../frontend/imgg')));

// Static files
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../frontend/imgg/uploads')));

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();


// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// app.use(bodyParser.json());
// Routes
app.use("/api/auth", authRoutes);
app.use("/api/problems", problemRoutes);
app.use("/api/execute", executeRoutes);
app.use("/api/discuss", discussRoutes);
app.use("/api/contests", contestRoutes); // Add this line
app.use("/api/contests/join",contestjoinRoutes);




app.get("/contestpage/:id", async (req, res) => {
    try {
        const contestId = req.params.id;
        
        // Validate ID format
        if (!mongoose.Types.ObjectId.isValid(contestId)) {
            return res.status(400).render('error', { message: 'Invalid contest ID format' });
        }

        // Fetch contest with modified population
        const contest = await Contest.findById(contestId)
            .populate({
                path: 'problems',
                select: 'title description difficulty', // Updated to match your problem schema
                options: { lean: true }
            })
            .populate({
                path: 'participants.user',
                select: 'username', // Assuming your User model has username
                options: { lean: true }
            })
            .lean();

        if (!contest) {
            return res.status(404).render('error', { message: 'Contest not found' });
        }

        // Safely check participant status
        let isParticipant = false;
        if (req.user && contest.participants) {
            const userId = req.user._id.toString();
            isParticipant = contest.participants.some(p => 
                p.user && p.user._id.toString() === userId
            );
        }

        // Transform problems to match what your EJS template expects
        const problems = contest.problems ? contest.problems.map(problem => ({
            name: problem.title,
            code: problem._id.toString(), // Using ID as code since no code field exists
            submissions: 0, // Default value since not in schema
            accuracy: 0 // Default value since not in schema
        })) : [];

        res.render('contestpage', {
            contestId: contest._id,
            problems,
            // isParticipant
        });

    } catch (error) {
        console.error('Full error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).render('error', { 
            message: 'Failed to fetch contest details',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});


// Route for Edit Code Page
app.get("/editcode/:problemId", async (req, res) => {
    try {
        const problemId = req.params.problemId;
        const problem = await Problem.findById(problemId);

        if (!problem) {
            return res.status(404).send("Problem not found");
        }

        res.render("editcode", { problem });
    } catch (error) {
        console.error("Error fetching problem for edit:", error);
        res.status(500).send("Internal Server Error");
    }
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

app.get("/problems", async (req, res) => {
    try {
        // We'll fetch problems in the template itself via client-side API call
        res.render("problems");
    } catch (error) {
        console.error("Error fetching problems:", error);
        res.status(500).send("Internal Server Error");
    }
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

app.get("/create_contest", (req, res) => {
    res.render("create_contest");
});

app.post("/signup", async (req, res) => {
    try {
        const { name, email, password, confirm_password } = req.body;
        
        console.log("Signup request received:", { name, email, password: "***", confirm_password: "***" });

        // Check if user already exists
        const user_exist = await USER.findOne({ email });
        if (user_exist) {
            return res.render("signup", { message: "User already exists" });
        }

        // Validate password match
        if (password !== confirm_password) {
            return res.render("signup", { message: "Passwords do not match" });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Create new user
        const user = await USER.create({
            username: name,
            email: email,
            password: hashedPassword,
        });
        
        console.log("User created successfully:", { userId: user._id, email: user.email });
        return res.redirect("/signin");
    } catch (error) {
        console.error("Signup error:", error);
        return res.render("signup", { message: "Error creating user: " + error.message });
    }
});

app.post("/signin", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

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

        // Successful login
        res.json({
            email: user.email,
            userId: user._id,
            username: user.username,
            message: "Signin successful"
        });

    } catch (error) {
        console.error("Signin error:", error);
        res.status(500).json({ message: "Error signing in" });
    }
});

// Profile route
app.get("/profile", async (req, res) => {
    // We'll render the profile page without data, as we'll fetch it with AJAX
    res.render("profile");
});

// API endpoint to get user profile data
app.get("/api/auth/profile/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await USER.findById(userId)
            .select("-password")  // Exclude password from the result
            .populate("problemsSolved");  // Populate the problems

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Get total submission count
        const submissionCount = user.submissions ? user.submissions.length : 0;

        // Get total accepted solutions
        const acceptedCount = user.submissions
            ? user.submissions.filter(sub => sub.status === "Accepted").length
            : 0;

        // Calculate relevant stats
        const stats = {
            problemsSolved: user.problemsSolved ? user.problemsSolved.length : 0,
            totalSubmissions: submissionCount,
            acceptedSubmissions: acceptedCount,
            acceptanceRate: submissionCount > 0 ? Math.round((acceptedCount / submissionCount) * 100) : 0
        };

        // Send combined response
        res.json({
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                createdAt: user.createdAt
            },
            stats,
            submissions: user.submissions ? user.submissions.slice(0, 5) : [] // Get 5 most recent
        });
    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ message: "Error fetching user profile" });
    }
});

app.get("/contest/:id/leaderboard", async (req, res) => {
    try {
        const contestId = req.params.id;
        
        // Validate ID format
        if (!mongoose.Types.ObjectId.isValid(contestId)) {
            return res.status(400).render('error', { message: 'Invalid contest ID format' });
        }

        // Fetch contest with leaderboard data
        const contest = await Contest.findById(contestId)
            .populate({
                path: 'leaderboard.user',
                select: 'username',
                options: { lean: true }
            })
            .lean();

        if (!contest) {
            return res.status(404).render('error', { message: 'Contest not found' });
        }

        // Check if contest has ended
        if (contest.status !== 'Completed') {
            return res.render('contest_not_ended', { 
                contestId: contest._id,
                contestName: contest.name,
                endTime: contest.endTime
            });
        }

        // Sort and format leaderboard for display
        const leaderboard = contest.leaderboard
            .filter(entry => entry.user) // Ensure user exists
            .map((entry, index) => ({
                rank: index + 1,
                username: entry.user.username || 'Unknown',
                score: entry.totalScore || 0,
                problemsSolved: entry.submissions ? entry.submissions.length : 0
            }))
            .sort((a, b) => b.score - a.score); // Sort by score

        res.render('leaderboard', {
            contestId: contest._id,
            contestName: contest.name,
            leaderboard: leaderboard
        });

    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).render('error', { 
            message: 'Failed to fetch leaderboard details',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});