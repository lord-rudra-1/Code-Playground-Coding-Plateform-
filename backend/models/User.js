const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePicture: { 
        type: String, 
        default: "/profile.png" // Default profile picture path
    },
    problemsSolved: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Problem' }],
    submissions: [{
        problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem' },
        language: String,
        code: String,
        status: { type: String, enum: ["Accepted", "Wrong Answer", "Time Limit Exceeded", "Runtime Error"] },
        timestamp: { type: Date, default: Date.now }
    }],
    contestsParticipated: [{
        contest: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest' },
        rank: Number,
        score: Number,
        problemsSolved: Number,
        timestamp: { type: Date, default: Date.now }
    }],
    contestRating: {
        current: { type: Number, default: 1500 },
        highest: { type: Number, default: 1500 },
        history: [{
            contestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest' },
            contestName: String,
            rating: Number,
            change: Number,
            timestamp: { type: Date, default: Date.now }
        }]
    },
    createdAt: { type: Date, default: Date.now }
});

const USER = mongoose.model("User", UserSchema);

module.exports = USER;
