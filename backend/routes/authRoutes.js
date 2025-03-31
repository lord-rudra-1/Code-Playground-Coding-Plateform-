const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

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

module.exports = router;