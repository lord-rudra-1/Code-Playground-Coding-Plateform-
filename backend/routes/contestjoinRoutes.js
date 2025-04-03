const express = require('express');
const router = express.Router();
const Contest = require('../models/Contest');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

router.post('/:contestId', async (req, res) => {
    try {
        const { userId } = req.body;
        const { contestId } = req.params;

        // Validate IDs
        if (!ObjectId.isValid(userId) || !ObjectId.isValid(contestId)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid ID format' 
            });
        }

        const contest = await Contest.findById(contestId);
        
        if (!contest) {
            return res.status(404).json({ 
                success: false,
                message: 'Contest not found' 
            });
        }

        // Check if user already joined
        const isParticipant = contest.participants.some(p => 
            p.user.toString() === userId
        );
        
        if (isParticipant) {
            return res.status(200).json({ 
                success: true, 
                message: 'Already registered', 
                contestId: contest._id 
            });
        }

        // Add to participants and initialize leaderboard
        contest.participants.push({ user: new ObjectId(userId) });
        contest.leaderboard.push({
            user: new ObjectId(userId),
            totalScore: 0,
            submissions: []
        });

        await contest.save();

        res.json({ 
            success: true,
            message: 'Successfully joined contest',
            contestId: contest._id
        });
    } catch (error) {
        console.error('Error joining contest:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;