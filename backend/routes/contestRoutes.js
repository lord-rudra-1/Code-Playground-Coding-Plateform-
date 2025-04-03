const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Contest = require('../models/Contest');
const mongoose = require('mongoose');

// List of admin user IDs (replace with your actual admin IDs)
const ADMIN_USER_IDS = [
    '67ea948007fde9615f747b4d', // Example admin ID
    '67e941f80831114bcb33d6a2',
    '67e3a9e27dcd5a5316f96300'  // Another admin ID
];

// @route   GET /api/contests
// @desc    Get all contests
// @access  Public
router.get('/', async (req, res) => {
    try {
        // Get and populate contests
        console.log("Starting contest fetch...");

        const contests = await Contest.find()
            .populate({
                path: 'participants.user',
                select: 'username'
            })
            .populate({
                path: 'leaderboard.user',
                select: 'username'
            })
            .populate({
                path: 'createdBy',
                select: 'username'
            });

        // Process contests sequentially to avoid parallel saves
        const updatedContests = []; // Fixed: Correct variable name
        for (const contest of contests) {
            await contest.updateStatus();
            updatedContests.push(contest); // Fixed: Using correct variable name
        }

        // No need to fetch again - we already have updated contests
        // Remove this duplicate fetch:
        // const updatedContests = await Contest.find()...
        
        // Filter contests
        const currentContests = updatedContests.filter(c => c.status !== 'Completed');
        const pastContests = updatedContests.filter(c => c.status === 'Completed');

        // Format response
        res.json({
            currentContests: currentContests.map(c => ({
                _id: c._id,
                name: c.name,
                description: c.description,
                startTime: c.startTime,
                endTime: c.endTime,
                difficulty: c.difficulty,
                participants: c.participants,
                status: c.status,
                visibility: c.visibility
            })),
            pastContests: pastContests.map(c => ({
                _id: c._id,
                name: c.name,
                description: c.description,
                startTime: c.startTime,
                endTime: c.endTime,
                difficulty: c.difficulty,
                leaderboard: c.leaderboard,
                status: c.status,
                visibility: c.visibility
            }))
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch contests' });
    }
});

// @route   POST /api/contests
// @desc    Create a new contest
// @access  Public
router.post('/', [
    check('name', 'Contest name is required').not().isEmpty(),
    check('contestCode', 'Contest code is required').not().isEmpty(),
    check('startTime', 'Start time is required').not().isEmpty(),
    check('endTime', 'End time is required').not().isEmpty(),
    check('problems', 'At least one problem is required').isArray({ min: 1 }),
    check('userId', 'User ID is required').not().isEmpty(),
    check('visibility', 'Visibility is required').isIn(['Public', 'Private'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const {
            name,
            contestCode,
            description,
            startTime,
            endTime,
            difficulty,
            problems,
            userId,
            visibility
        } = req.body;

        // Verify contest code is unique
        const existingContest = await Contest.findOne({ contestCode });
        if (existingContest) {
            return res.status(400).json({ msg: 'Contest code already exists' });
        }

        // // Check if user is admin
        const isAdmin = ADMIN_USER_IDS.includes(userId);

        // Validate visibility for non-admin users
        if (!isAdmin && visibility === 'Public') {
            return res.status(403).json({ 
                success: false,
                msg: 'Only admins can create public contests' 
            });
        }

        // Create new contest with all required fields
        const newContest = new Contest({
            _id: new mongoose.Types.ObjectId(),
            name,
            contestCode,
            description: description || 'No description provided',
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            difficulty: difficulty || 'Medium',
            problems: problems.map(id => new mongoose.Types.ObjectId(id)),
            participants: [],
            status: 'Upcoming',
            visibility : visibility , // Use selected visibility for admins, force Private for others
            leaderboard: [],
            createdBy: new mongoose.Types.ObjectId(userId)
        });

        const contest = await newContest.save();
        
        res.json({
            success: true,
            contest: {
                _id: contest._id,
                name: contest.name,
                contestCode: contest.contestCode,
                startTime: contest.startTime,
                endTime: contest.endTime,
                status: contest.status,
                visibility: contest.visibility,
                isAdmin: isAdmin // Include this info in response if needed by frontend
            }
        });
    } catch (error) {
        console.error('Error creating contest:', error);
        res.status(500).json({ 
            success: false,
            msg: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});


// @route   POST /api/contests/join-by-code
// @desc    Join a contest by code
// @access  Public
// @route   POST /api/contests/join-by-code
// @desc    Join a contest by code
// @access  Public


router.post('/join-by-code', [
    check('contestCode', 'Contest code is required').not().isEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { contestCode } = req.body;
        
        // Find contest by contestCode (not _id)
        const contest = await Contest.findOne({ contestCode: contestCode })
            .select('_id visibility')
            .lean();

        if (!contest) {
            return res.status(404).json({ 
                success: false,
                msg: 'Contest not found with this code' 
            });
        }

        res.json({
            success: true,
            contestId: contest._id
        });

    } catch (error) {
        console.error('Error joining contest by code:', error);
        res.status(500).json({ 
            success: false,
            msg: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;