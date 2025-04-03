const express = require("express");
const router = express.Router();
const executeCode = require("../utils/executeCode");

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
        const { code, language, testCases } = req.body;
        
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
        
        res.json({
            status: allPassed ? "Accepted" : "Wrong Answer",
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

module.exports = router;
