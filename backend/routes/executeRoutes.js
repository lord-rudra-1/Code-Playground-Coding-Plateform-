const express = require("express");
const router = express.Router();

// Sample route for execution endpoint
router.post("/", (req, res) => {
    res.json({ message: "Code execution endpoint (not implemented yet)" });
});

module.exports = router;
