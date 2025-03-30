const express = require("express");
const Problem = require("../models/Problem");
const User = require("../models/User");

const router = express.Router();

// Create Problem
router.post("/add", async (req, res) => {
    try {
        const { title, description, difficulty, testCases } = req.body;
        const problem = new Problem({ title, description, difficulty, testCases });
        await problem.save();
        res.json(problem);
    } catch (error) {
        console.error("Error creating problem:", error);
        res.status(500).json({ message: "Error creating problem" });
    }
});

// Get All Problems
router.get("/", async (req, res) => {
    try {
        const { difficulty, topic, sort } = req.query;
        let query = {};
        
        // Apply filters if provided
        if (difficulty && difficulty !== 'all') {
            query.difficulty = difficulty;
        }
        
        if (topic && topic !== 'all') {
            query.topic = topic;
        }
        
        // Build sort configuration
        let sortConfig = {};
        if (sort === 'difficulty') {
            sortConfig = { difficulty: 1 };
        } else if (sort === 'newest') {
            sortConfig = { createdAt: -1 };
        }
        
        const problems = await Problem.find(query).sort(sortConfig);
        res.json(problems);
    } catch (error) {
        console.error("Error fetching problems:", error);
        res.status(500).json({ message: "Error fetching problems" });
    }
});

// Get Single Problem
router.get("/:id", async (req, res) => {
    try {
        const problem = await Problem.findById(req.params.id);
        if (!problem) {
            return res.status(404).json({ message: "Problem not found" });
        }
        res.json(problem);
    } catch (error) {
        console.error("Error fetching problem:", error);
        res.status(500).json({ message: "Error fetching problem" });
    }
});

// Submit solution
router.post("/:id/submit", async (req, res) => {
    try {
        const { userId, code, language } = req.body;
        const problemId = req.params.id;
        
        // Get the problem to retrieve test cases
        const problem = await Problem.findById(problemId);
        if (!problem) {
            return res.status(404).json({ message: "Problem not found" });
        }
        
        // In a real implementation, you would run code against test cases here
        // For now, we'll just simulate a successful submission
        const status = "Accepted"; // This would be determined by test case results
        
        // Update user's submissions and problems solved if accepted
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Add submission
        user.submissions.push({
            problem: problemId,
            language,
            code,
            status
        });
        
        // Add to problems solved if accepted and not already solved
        if (status === "Accepted" && !user.problemsSolved.includes(problemId)) {
            user.problemsSolved.push(problemId);
        }
        
        await user.save();
        
        res.json({ 
            status,
            message: status === "Accepted" ? "Solution accepted!" : "Solution failed test cases"
        });
    } catch (error) {
        console.error("Error submitting solution:", error);
        res.status(500).json({ message: "Error submitting solution" });
    }
});

module.exports = router;
