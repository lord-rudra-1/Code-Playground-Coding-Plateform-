const mongoose = require("mongoose");

const ProblemSchema = new mongoose.Schema({
    title: String,
    description: String,
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"] },
    testCases: [{ input: String, output: String }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Problem", ProblemSchema);
