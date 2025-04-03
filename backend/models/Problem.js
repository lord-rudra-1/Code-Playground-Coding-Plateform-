const mongoose = require("mongoose");

const ProblemSchema = new mongoose.Schema({
    title: String,
    description: String,
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"] },
    inputFormat: String,
    outputFormat: String,
    constraints: {
        type: Map,
        of: String
    },
    testCases: [{ input: String, output: String }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Problem", ProblemSchema);
