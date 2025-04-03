const express = require("express");
const router = express.Router();
const Discussion = require("../models/Discussion");
const Comment = require("../models/Comment");
const User = require("../models/User");

// Get all discussions with pagination
router.get("/", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        // Apply filters if provided
        let query = {};
        if (req.query.tag) {
            query.tags = req.query.tag;
        }
        
        // Apply search if provided
        if (req.query.search) {
            query.$or = [
                { title: { $regex: req.query.search, $options: 'i' } },
                { content: { $regex: req.query.search, $options: 'i' } }
            ];
        }
        
        // Get discussions with pagination
        const discussions = await Discussion.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("author", "username");
        
        // Get total count for pagination
        const totalDiscussions = await Discussion.countDocuments(query);
        
        res.json({
            discussions,
            totalPages: Math.ceil(totalDiscussions / limit),
            currentPage: page
        });
    } catch (error) {
        console.error("Error fetching discussions:", error);
        res.status(500).json({ message: "Error fetching discussions" });
    }
});

// Create a new discussion
router.post("/", async (req, res) => {
    try {
        const { title, content, tags, userId } = req.body;
        
        if (!title || !content || !userId) {
            return res.status(400).json({ message: "Title, content, and userId are required" });
        }
        
        // Get user information
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Create discussion
        const discussion = new Discussion({
            title,
            content,
            author: userId,
            authorName: user.username,
            tags: tags || []
        });
        
        await discussion.save();
        
        res.status(201).json(discussion);
    } catch (error) {
        console.error("Error creating discussion:", error);
        res.status(500).json({ message: "Error creating discussion" });
    }
});

// Get single discussion with comments
router.get("/:id", async (req, res) => {
    try {
        const discussion = await Discussion.findById(req.params.id)
            .populate({
                path: "comments",
                options: { sort: { createdAt: 1 } }
            });
        
        if (!discussion) {
            return res.status(404).json({ message: "Discussion not found" });
        }
        
        res.json(discussion);
    } catch (error) {
        console.error("Error fetching discussion:", error);
        res.status(500).json({ message: "Error fetching discussion" });
    }
});

// Add comment to a discussion
router.post("/:id/comments", async (req, res) => {
    try {
        const { content, userId } = req.body;
        const discussionId = req.params.id;
        
        if (!content || !userId) {
            return res.status(400).json({ message: "Content and userId are required" });
        }
        
        // Check if discussion exists
        const discussion = await Discussion.findById(discussionId);
        if (!discussion) {
            return res.status(404).json({ message: "Discussion not found" });
        }
        
        // Get user information
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Create comment
        const comment = new Comment({
            content,
            author: userId,
            authorName: user.username,
            discussion: discussionId
        });
        
        // Save comment
        await comment.save();
        
        // Add comment to discussion
        discussion.comments.push(comment._id);
        await discussion.save();
        
        res.status(201).json(comment);
    } catch (error) {
        console.error("Error adding comment:", error);
        res.status(500).json({ message: "Error adding comment" });
    }
});

// Update discussion upvotes/downvotes
router.put("/:id/vote", async (req, res) => {
    try {
        const { vote, userId } = req.body;
        const discussionId = req.params.id;
        
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }
        
        if (vote !== "up" && vote !== "down") {
            return res.status(400).json({ message: "Vote must be 'up' or 'down'" });
        }
        
        // Find discussion
        const discussion = await Discussion.findById(discussionId);
        if (!discussion) {
            return res.status(404).json({ message: "Discussion not found" });
        }

        // Check if user has already voted
        const hasUpvoted = discussion.upvotedBy.includes(userId);
        const hasDownvoted = discussion.downvotedBy.includes(userId);

        if (vote === "up") {
            if (hasUpvoted) {
                // Remove upvote
                discussion.upvotes -= 1;
                discussion.upvotedBy = discussion.upvotedBy.filter(id => id.toString() !== userId);
            } else {
                // Add upvote
                discussion.upvotes += 1;
                discussion.upvotedBy.push(userId);
                
                // Remove downvote if exists
                if (hasDownvoted) {
                    discussion.downvotes -= 1;
                    discussion.downvotedBy = discussion.downvotedBy.filter(id => id.toString() !== userId);
                }
            }
        } else {
            if (hasDownvoted) {
                // Remove downvote
                discussion.downvotes -= 1;
                discussion.downvotedBy = discussion.downvotedBy.filter(id => id.toString() !== userId);
            } else {
                // Add downvote
                discussion.downvotes += 1;
                discussion.downvotedBy.push(userId);
                
                // Remove upvote if exists
                if (hasUpvoted) {
                    discussion.upvotes -= 1;
                    discussion.upvotedBy = discussion.upvotedBy.filter(id => id.toString() !== userId);
                }
            }
        }
        
        await discussion.save();
        
        res.json({
            upvotes: discussion.upvotes,
            downvotes: discussion.downvotes,
            upvotedBy: discussion.upvotedBy,
            downvotedBy: discussion.downvotedBy
        });
    } catch (error) {
        console.error("Error voting:", error);
        res.status(500).json({ message: "Error voting" });
    }
});

// Get popular tags
router.get("/tags/popular", async (req, res) => {
    try {
        const tags = await Discussion.aggregate([
            { $unwind: "$tags" },
            { $group: { _id: "$tags", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        
        res.json(tags);
    } catch (error) {
        console.error("Error fetching popular tags:", error);
        res.status(500).json({ message: "Error fetching popular tags" });
    }
});

module.exports = router; 