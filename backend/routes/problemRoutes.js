const express = require("express");
const Problem = require("../models/Problem");

const router = express.Router();

// Create Problem
router.post("/add", async (req, res) => {
    const { title, description, difficulty, testCases } = req.body;
    const problem = new Problem({ title, description, difficulty, testCases });
    await problem.save();
    res.json(problem);
});

// Get All Problems
router.get("/", async (req, res) => {
    const problems = await Problem.find();
    res.json(problems);
});

// Get Single Problem
router.get("/:id", async (req, res) => {
    const problem = await Problem.findById(req.params.id);
    res.json(problem);
});

module.exports = router;
