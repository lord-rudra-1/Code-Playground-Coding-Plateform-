const express = require("express");
const Problem = require("../models/Problem");
const User = require("../models/User");
const Contest = require("../models/Contest");
const executeCode = require("../utils/executeCode"); // Assuming this is the correct path
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;

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
        const { userId, code, language, contestId } = req.body;
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
        const submissionData = {
            problem: problemId,
            language,
            code,
            status,
            timestamp: new Date()
        };
        
        user.submissions.push(submissionData);
        
        // Add to problems solved if accepted and not already solved
        if (status === "Accepted" && !user.problemsSolved.includes(problemId)) {
            user.problemsSolved.push(problemId);
        }
        
        // Handle contest submission if this is part of a contest
        let contestUpdateResult = null;
        if (contestId && mongoose.Types.ObjectId.isValid(contestId)) {
            try {
                contestUpdateResult = await updateContestLeaderboard(userId, problemId, status, contestId, problem.difficulty);
            } catch (contestError) {
                console.error("Error updating contest leaderboard:", contestError);
                // Continue with the submission even if contest update fails
            }
        }
        
        await user.save();
        
        res.json({ 
            status,
            results,
            message: status === "Accepted" ? "Solution accepted! All test cases passed." : "Solution failed one or more test cases.",
            contestUpdate: contestUpdateResult
        });
    } catch (error) {
        console.error("Error submitting solution:", error);
        res.status(500).json({ message: "Error submitting solution" });
    }
});

// Helper function to update contest leaderboard
async function updateContestLeaderboard(userId, problemId, status, contestId, problemDifficulty) {
    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(problemId) || !mongoose.Types.ObjectId.isValid(contestId)) {
        throw new Error("Invalid userId, problemId, or contestId");
    }

    const contest = await Contest.findById(contestId);
    if (!contest) throw new Error("Contest not found");

    // Check if contest is still ongoing
    const now = new Date();
    if (now < contest.startTime || now > contest.endTime) {
        throw new Error("Contest is not active");
    }

    // Check if the problem is part of the contest
    const isProblemInContest = contest.problems.some(p => p.toString() === problemId);
    if (!isProblemInContest) {
        throw new Error("Problem is not part of this contest");
    }

    // Find user's entry in the leaderboard
    let leaderboardEntry = contest.leaderboard.find(
        entry => entry.user && entry.user.toString() === userId
    );

    // If user is not in leaderboard, check if they're a participant
    const isParticipant = contest.participants.some(p => 
        p.user && p.user.toString() === userId
    );

    // If user is a participant but not in leaderboard, add them
    if (!leaderboardEntry && isParticipant) {
        leaderboardEntry = {
            user: new mongoose.Types.ObjectId(userId),
            totalScore: 0,
            submissions: []
        };
        contest.leaderboard.push(leaderboardEntry);
    }
    
    // If user is not in participants, add them first
    if (!isParticipant) {
        contest.participants.push({ 
            user: new mongoose.Types.ObjectId(userId),
            registeredAt: new Date()
        });
        
        // If not in leaderboard, create a new entry
        if (!leaderboardEntry) {
            leaderboardEntry = {
                user: new mongoose.Types.ObjectId(userId),
                totalScore: 0,
                submissions: []
            };
            contest.leaderboard.push(leaderboardEntry);
        }
    }
    
    // Now we have a leaderboard entry for sure
    
    // Check if user has already solved this problem successfully
    const existingSubmission = leaderboardEntry.submissions.find(
        sub => sub.problem.toString() === problemId
    );

    // Only update if status is Accepted
    if (status === "Accepted") {
        // If problem was already solved, don't update score (avoids multiple submissions increasing score)
        if (existingSubmission && existingSubmission.score > 0) {
            return {
                updated: false,
                message: "Problem already solved",
                totalScore: leaderboardEntry.totalScore,
                problemsCount: leaderboardEntry.submissions.length
            };
        }

        // Calculate score based on difficulty
        let score = 0;
        switch (problemDifficulty) {
            case "Easy":
                score = 100;
                break;
            case "Medium":
                score = 200;
                break;
            case "Hard":
                score = 300;
                break;
            default:
                score = 100;
        }

        // Add or update submission record
        if (existingSubmission) {
            existingSubmission.score = score;
        } else {
            leaderboardEntry.submissions.push({
                problem: new mongoose.Types.ObjectId(problemId),
                score: score,
                timeTaken: now - contest.startTime // in milliseconds
            });
        }

        // Recalculate total score
        leaderboardEntry.totalScore = leaderboardEntry.submissions.reduce(
            (total, sub) => total + sub.score, 0
        );

        await contest.save();

        return {
            updated: true,
            message: "Leaderboard updated successfully",
            totalScore: leaderboardEntry.totalScore,
            problemsCount: leaderboardEntry.submissions.length
        };
    }
    // If not accepted, just return current status
    return { 
        updated: false,
        message: "Submission was not accepted",
        totalScore: leaderboardEntry.totalScore,
        problemsCount: leaderboardEntry.submissions.filter(sub => sub.score > 0).length
    };
}

// Add new route to check contest end and update ratings
router.post("/contest/:contestId/end", async (req, res) => {
    try {
        const { contestId } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(contestId)) {
            return res.status(400).json({ message: "Invalid contest ID" });
        }
        
        const contest = await Contest.findById(contestId)
            .populate('problems')
            .populate('leaderboard.user');
            
        if (!contest) {
            return res.status(404).json({ message: "Contest not found" });
        }
        
        // Check if contest has ended
        const now = new Date();
        if (now < contest.endTime) {
            return res.status(400).json({ message: "Contest has not ended yet" });
        }
        
        // Calculate final leaderboard
        await contest.calculateFinalLeaderboard();
        
        // Update user ratings based on contest performance
        for (const entry of contest.leaderboard) {
            await updateUserRating(entry.user, contest, entry);
        }
        
        // Update contest status to Completed if needed
        if (contest.status !== 'Completed') {
            contest.status = 'Completed';
            await contest.save();
        }
        
        res.json({
            success: true,
            message: 'Contest ended and ratings updated',
            leaderboard: contest.leaderboard.map(entry => ({
                username: entry.user.username,
                totalScore: entry.totalScore,
                rank: entry.rank,
                problemsSolved: entry.submissions.length
            }))
        });
    } catch (error) {
        console.error("Error ending contest:", error);
        res.status(500).json({ message: "Error ending contest" });
    }
});

async function updateUserRating(user, contest, performance) {
    // Skip if user object is not valid or doesn't contain ID
    if (!user || !user._id) return;
    
    // Find user document if we only have the ID
    const userDoc = user.username ? user : await User.findById(user._id);
    if (!userDoc) return;
    
    // Calculate new rating based on performance and problem difficulty
    let ratingChange = 0;
    const currentRating = userDoc.contestRating.current;
    
    // Count problems solved by difficulty
    const problemsBySolved = {
        Easy: 0,
        Medium: 0,
        Hard: 0
    };
    
    // Count problems solved by difficulty level
    for (const submission of performance.submissions) {
        if (submission.score > 0) {
            // Find the problem to get its difficulty
            const problem = contest.problems.find(p => 
                p._id.toString() === submission.problem.toString()
            );
            
            if (problem && problem.difficulty) {
                problemsBySolved[problem.difficulty]++;
            }
        }
    }
    
    // Apply rating change based on difficulty and user's current rating
    if (currentRating < 1000) {
        // For beginners, any problem type increases rating
        ratingChange += problemsBySolved.Easy * 100;
        ratingChange += problemsBySolved.Medium * 150;
        ratingChange += problemsBySolved.Hard * 200;
    } else if (currentRating < 1600) {
        // Mid-level users need medium+ problems for significant rating increase
        ratingChange += problemsBySolved.Easy * 50;
        ratingChange += problemsBySolved.Medium * 100;
        ratingChange += problemsBySolved.Hard * 150;
    } else {
        // Advanced users mainly benefit from hard problems
        ratingChange += problemsBySolved.Easy * 25;
        ratingChange += problemsBySolved.Medium * 50;
        ratingChange += problemsBySolved.Hard * 100;
    }
    
    // Calculate new rating
    const newRating = Math.max(0, currentRating + ratingChange);
    
    // Update user's contest rating
    userDoc.contestRating.current = newRating;
    userDoc.contestRating.highest = Math.max(userDoc.contestRating.highest, newRating);
    
    // Add to rating history
    userDoc.contestRating.history.push({
        contestId: contest._id,
        contestName: contest.name,
        rating: newRating,
        change: ratingChange,
        timestamp: new Date()
    });
    
    // Add to contests participated
    const contestEntry = {
        contest: contest._id,
        rank: performance.rank || 0,
        score: performance.totalScore || 0,
        problemsSolved: Object.values(problemsBySolved).reduce((a, b) => a + b, 0),
        timestamp: new Date()
    };
    
    // Check if already exists
    const existingIndex = userDoc.contestsParticipated.findIndex(
        cp => cp.contest.toString() === contest._id.toString()
    );
    
    if (existingIndex >= 0) {
        userDoc.contestsParticipated[existingIndex] = contestEntry;
    } else {
        userDoc.contestsParticipated.push(contestEntry);
    }
    
    await userDoc.save();
    return userDoc;
}

module.exports = router;
