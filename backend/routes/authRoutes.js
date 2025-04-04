const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../frontend/imgg/uploads/profile');
        // Create the directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const userId = req.body.userId;
        const fileExt = path.extname(file.originalname);
        const fileName = `profile_${userId}_${Date.now()}${fileExt}`;
        cb(null, fileName);
    }
});

// File filter for image types
const fileFilter = (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'), false);
    }
};

const upload = multer({ 
    storage: storage, 
    fileFilter: fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB limit
    }
});

// Register
router.post("/register", async (req, res) => {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    res.json({ message: "User registered successfully" });
});

// Login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ userId: user._id }, "secret", { expiresIn: "1d" });
    res.json({ token });
});

// Profile picture upload
router.post("/upload-profile-picture", upload.single('profilePicture'), async (req, res) => {
    try {
        const userId = req.body.userId;
        
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }
        
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }
        
        // Get the relative path for the profile picture (for storage in DB)
        const relativePath = `/uploads/profile/${req.file.filename}`;
        
        // Update user's profile picture in the database
        const user = await User.findByIdAndUpdate(
            userId, 
            { profilePicture: relativePath },
            { new: true }
        );
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        res.json({ 
            message: "Profile picture uploaded successfully", 
            profilePicture: relativePath 
        });
    } catch (error) {
        console.error("Error uploading profile picture:", error);
        res.status(500).json({ message: "Error uploading profile picture" });
    }
});

// Get user profile data
router.get("/profile/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await User.findById(userId)
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
                profilePicture: user.profilePicture,
                contestRating: user.contestRating,
                contestsParticipated: user.contestsParticipated,
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

// Get user submissions
router.get("/user/:userId/submissions", async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        res.json(user.submissions);
    } catch (error) {
        console.error("Error fetching user submissions:", error);
        res.status(500).json({ message: "Error fetching user submissions" });
    }
});

// Get specific submission details
router.get("/submissions/:submissionId", async (req, res) => {
    try {
        const submissionId = req.params.submissionId;
        const user = await User.findOne({ "submissions._id": submissionId });
        
        if (!user) {
            return res.status(404).json({ message: "Submission not found" });
        }
        
        const submission = user.submissions.id(submissionId);
        
        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }
        
        res.json(submission);
    } catch (error) {
        console.error("Error fetching submission:", error);
        res.status(500).json({ message: "Error fetching submission" });
    }
});

// Update user profile
router.put("/user/:userId/update", async (req, res) => {
    try {
        const userId = req.params.userId;
        const { username, password } = req.body;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Update username if provided
        if (username) {
            user.username = username;
        }
        
        // Update password if provided
        if (password) {
            user.password = await bcrypt.hash(password, 10);
        }
        
        await user.save();
        
        res.json({ message: "User updated successfully" });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Error updating user" });
    }
});

// Delete user account
router.delete("/user/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        
        const result = await User.findByIdAndDelete(userId);
        if (!result) {
            return res.status(404).json({ message: "User not found" });
        }
        
        res.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Error deleting user" });
    }
});

// Check if user is admin
router.get('/check-admin', async (req, res) => {
    try {
        // List of admin user IDs (could also check user.role === 'admin')
        const ADMIN_USER_IDS = [
            '67ea948007fde9615f747b4d', // Example admin ID
            '67e941f80831114bcb33d6a2'  // Another admin ID
        ];

        const isAdmin = ADMIN_USER_IDS.includes(req.user.id.toString());
        res.json({ isAdmin });
    } catch (error) {
        console.error('Error checking admin status:', error);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;