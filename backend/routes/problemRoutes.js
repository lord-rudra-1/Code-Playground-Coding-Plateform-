const express = require("express");
const Problem = require("../models/Problem");
const User = require("../models/User");
const executeCode = require("../utils/executeCode"); // Assuming this is the correct path

const router = express.Router();

// Create Problem
router.post("/add", async (req, res) => {
    try {
        const { 
            title, 
            description, 
            difficulty, 
            inputFormat, 
            outputFormat, 
            constraints, 
            testCases 
        } = req.body;
        
        const problem = new Problem({ 
            title, 
            description, 
            difficulty, 
            inputFormat, 
            outputFormat, 
            constraints, 
            testCases 
        });
        
        await problem.save();
        res.json(problem);
    } catch (error) {
        console.error("Error creating problem:", error);
        res.status(500).json({ message: "Error creating problem" });
    }
});


router.get('/search', async (req, res) => {
    try {
        const searchTerm = req.query.q;
        
        if (!searchTerm || searchTerm.trim().length < 2) {
            return res.status(400).json([]); // Return empty array for short queries
        }

        const problems = await Problem.find({
            $or: [
                { title: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } },
                { difficulty: { $regex: searchTerm, $options: 'i' } }
            ]
        })
        .select('_id title description difficulty')
        .limit(10)
        .lean();

        // Return as array directly
        res.json(problems); // Just send the array of problems without wrapper

    } catch (error) {
        console.error('Problem search error:', error);
        res.status(500).json([]); // Return empty array on error
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
        
        if (!userId || !code || !language) {
            return res.status(400).json({ message: "UserId, code, and language are required" });
        }
        
        // Get the problem to retrieve test cases
        const problem = await Problem.findById(problemId);
        if (!problem) {
            return res.status(404).json({ message: "Problem not found" });
        }
        
        // Run code against all test cases to determine if accepted
        let allTestsPassed = true;
        let results = [];
        
        for (const testCase of problem.testCases) {
            try {
                const result = await executeCode(code, language, testCase.input);
                const outputMatches = result.output.trim() === testCase.output.trim();
                
                results.push({
                    input: testCase.input,
                    expected: testCase.output,
                    actual: result.output,
                    passed: outputMatches,
                    error: result.error
                });
                
                if (!outputMatches || result.status === "error") {
                    allTestsPassed = false;
                }
            } catch (error) {
                console.error("Error executing test case:", error);
                allTestsPassed = false;
                results.push({
                    input: testCase.input,
                    expected: testCase.output,
                    actual: "",
                    passed: false,
                    error: error.message
                });
            }
        }
        
        // Status based on test results
        const status = allTestsPassed ? "Accepted" : "Wrong Answer";
        
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
            status,
            timestamp: new Date()
        });
        
        // Add to problems solved if accepted and not already solved
        if (status === "Accepted" && !user.problemsSolved.includes(problemId)) {
            user.problemsSolved.push(problemId);
        }
        
        await user.save();
        
        res.json({ 
            status,
            results,
            message: status === "Accepted" ? "Solution accepted! All test cases passed." : "Solution failed one or more test cases."
        });
    } catch (error) {
        console.error("Error submitting solution:", error);
        res.status(500).json({ message: "Error submitting solution" });
    }
});

module.exports = router;
