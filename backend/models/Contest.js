const mongoose = require('mongoose');

const ContestSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        required: true
    },
    difficulty: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard'],
        default: 'Medium'
    },
    problems: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Problem'
    }],
    participants: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        registeredAt: {
            type: Date,
            default: Date.now
        }
    }],
    contestCode: {
        type: String,
        unique: true,
        required: true
    },
    status: {
        type: String,
        enum: ['Upcoming', 'Ongoing', 'Completed'],
        default: 'Upcoming'
    },
    visibility: {  // Fixed typo from 'visiblity' to 'visibility'
        type: String,
        enum: ['Public', 'Private'],
        default: 'Private'  // Added default value
    },
    leaderboard: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        totalScore: {
            type: Number,
            default: 0
        },
        submissions: [{
            problem: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Problem'
            },
            score: Number,
            timeTaken: Number
        }],
        rank: Number
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
}, {
    timestamps: true
});

// Create a method to update contest status (fixed typo from 'ontestSchema' to 'ContestSchema')
ContestSchema.methods.updateStatus = async function() {
    const now = new Date();
    
    // No need to save if no status change
    if (this.startTime > now && this.status !== 'Upcoming') {
        this.status = 'Upcoming';
        await this.save();
    } else if (this.startTime <= now && this.endTime > now && this.status !== 'Ongoing') {
        this.status = 'Ongoing';
        await this.save();
    } else if (this.endTime <= now && this.status !== 'Completed') {
        this.status = 'Completed';
        await this.save();
    }
    // Return the document whether changed or not
    return this;
};

// Method to calculate final leaderboard
ContestSchema.methods.calculateFinalLeaderboard = async function() {
    // Sort participants by total score and assign ranks
    this.leaderboard.sort((a, b) => b.totalScore - a.totalScore);
    this.leaderboard = this.leaderboard.map((entry, index) => ({
        ...entry.toObject(),
        rank: index + 1
    }));
    return this.save();
};

const Contest = mongoose.model('Contest', ContestSchema);
module.exports = Contest;