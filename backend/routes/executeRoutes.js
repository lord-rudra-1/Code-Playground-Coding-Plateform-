const express = require("express");
const router = express.Router();
const executeCode = require("../utils/executeCode");
const User = require("../models/User");
const Problem = require("../models/Problem");
const Contest = require("../models/Contest");
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;

// Route to execute code
router.post("/", async (req, res) => {
    try {
        const { code, language, input = "" } = req.body;
        
        console.log(`Executing ${language} code with input: ${input ? 'provided' : 'none'}`);
        
        const result = await executeCode(code, language, input);
        console.log(`Execution result: ${result.status}`);
        
        res.json(result);
    } catch (error) {
        console.error("Error executing code:", error);
        res.status(500).json({ 
            status: "error",
            error: error.message || "Failed to execute code" 
        });
    }
});

// Route to test code against test cases
router.post("/test", async (req, res) => {
    try {
        const { code, language, testCases, userId, problemId, contestId } = req.body;
        
        if (!code || !language || !testCases || !Array.isArray(testCases)) {
            return res.status(400).json({ error: "Code, language, and testCases array are required" });
        }
        
        // Run each test case and collect results
        const results = [];
        let allPassed = true;
        
        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            
            try {
                // Execute code with test case input
                const response = await executeCode(code, language, testCase.input);
                
                // Compare output with expected output
                const outputMatches = response.output.trim() === testCase.output.trim();
                
                results.push({
                    testCase: i + 1,
                    input: testCase.input,
                    expectedOutput: testCase.output,
                    actualOutput: response.output,
                    passed: outputMatches,
                    error: response.error
                });
                
                if (!outputMatches) {
                    allPassed = false;
                }
            } catch (error) {
                results.push({
                    testCase: i + 1,
                    input: testCase.input,
                    expectedOutput: testCase.output,
                    actualOutput: "",
                    passed: false,
                    error: error.message
                });
                
                allPassed = false;
            }
        }
        
        const submissionStatus = allPassed ? "Accepted" : "Wrong Answer";
        
        // Store submission in user's record if userId is provided
        if (userId && problemId) {
            try {
                await recordSubmission(userId, problemId, code, language, submissionStatus, contestId);
            } catch (submissionError) {
                console.error("Error recording submission:", submissionError);
                // Continue with response even if recording fails
            }
        }
        
        res.json({
            status: submissionStatus,
            results
        });
    } catch (error) {
        console.error("Error testing code:", error);
        res.status(500).json({ 
            status: "error",
            error: error.message || "Failed to test code" 
        });
    }
});

// Helper function to record submission
async function recordSubmission(userId, problemId, code, language, status, contestId = null) {
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(problemId)) {
        throw new Error("Invalid userId or problemId");
    }

    // Find the user and problem
    const [user, problem] = await Promise.all([
        User.findById(userId),
        Problem.findById(problemId)
    ]);

    if (!user) throw new Error("User not found");
    if (!problem) throw new Error("Problem not found");

    // Create submission entry
    const submission = {
        problem: new ObjectId(problemId),
        language,
        code,
        status,
        timestamp: new Date()
    };

    // Add submission to user's record
    user.submissions.push(submission);

    // If status is Accepted, add to problems solved if not already there
    if (status === "Accepted" && !user.problemsSolved.includes(problemId)) {
        user.problemsSolved.push(new ObjectId(problemId));
    }

    // If this is a contest submission, update contest leaderboard
    if (contestId && mongoose.Types.ObjectId.isValid(contestId)) {
        await updateContestLeaderboard(userId, problemId, status, contestId, problem.difficulty);
    }

    await user.save();
    return submission;
}

// Helper function to update contest leaderboard
async function updateContestLeaderboard(userId, problemId, status, contestId, problemDifficulty) {
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

    // Check if already submitted this problem successfully
    const existingSubmission = leaderboardEntry.submissions.find(
        sub => sub.problem.toString() === problemId && sub.score > 0
    );

    // Only update if status is Accepted and either hasn't solved this problem yet
    if (status === "Accepted" && (!existingSubmission)) {
        // Calculate score based on difficulty (you can adjust scoring as needed)
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
    
    // If not accepted or already solved, return current status
    return { 
        updated: false,
        message: status === "Accepted" ? "Problem already solved" : "Submission was not accepted",
        totalScore: leaderboardEntry.totalScore,
        problemsCount: leaderboardEntry.submissions.filter(sub => sub.score > 0).length
    };
}

// New route to handle contest ending and updating user ratings
router.post("/contest-end/:contestId", async (req, res) => {
    try {
        const { contestId } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(contestId)) {
            return res.status(400).json({ error: "Invalid contest ID" });
        }
        
        const contest = await Contest.findById(contestId)
            .populate('problems')
            .populate('leaderboard.user');
            
        if (!contest) {
            return res.status(404).json({ error: "Contest not found" });
        }
        
        // Check if contest has ended
        const now = new Date();
        if (now < contest.endTime) {
            return res.status(400).json({ error: "Contest has not ended yet" });
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
            message: 'Contest ended and ratings updated'
        });
    } catch (error) {
        console.error("Error ending contest:", error);
        res.status(500).json({ error: error.message || "Failed to end contest" });
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
        // Mid-level users need medium+ problems
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
