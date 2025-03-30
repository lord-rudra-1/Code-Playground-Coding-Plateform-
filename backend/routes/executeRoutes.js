const express = require("express");
const router = express.Router();
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const axios = require("axios"); // Add axios for HTTP requests if needed

// Temporary directory to save code files - use system temp directory to avoid spaces in paths
const tempDir = path.join(os.tmpdir(), "code-playground-temp");

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Function to execute code - extract this for reuse
async function executeCode(code, language, input = "") {
    return new Promise((resolve, reject) => {
        try {
            if (!code || !language) {
                return reject(new Error("Code and language are required"));
            }
            
            // Generate a unique filename based on timestamp + random number
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(2, 8);
            const fileName = `${timestamp}_${randomStr}`;
            let filePath, executionCmd, fileExtension;
            
            // Configure based on language
            switch (language.toLowerCase()) {
                case "java":
                    fileExtension = "java";
                    filePath = path.join(tempDir, `${fileName}.java`);
                    
                    // Extract class name from Java code with better regex
                    const classNameMatch = code.match(/public\s+class\s+(\w+)|class\s+(\w+)/);
                    let className;
                    
                    if (!classNameMatch) {
                        // If no class found, use a default name
                        className = "Main";
                        // Wrap the code in a Main class
                        const wrappedCode = `
class Main {
    public static void main(String[] args) {
        ${code}
    }
}`;
                        fs.writeFileSync(filePath, wrappedCode);
                    } else {
                        // Use the class name found in the code
                        className = classNameMatch[1] || classNameMatch[2];
                        fs.writeFileSync(filePath, code);
                    }
                    
                    // Compile and run with quoted paths
                    executionCmd = `cd "${tempDir}" && javac "${fileName}.java" && java "${className}"`;
                    break;
                    
                case "python":
                    fileExtension = "py";
                    filePath = path.join(tempDir, `${fileName}.py`);
                    fs.writeFileSync(filePath, code);
                    // Use python3 for macOS/Linux and python for Windows
                    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
                    executionCmd = `${pythonCmd} "${filePath}"`;
                    break;
                    
                case "cpp":
                    fileExtension = "cpp";
                    filePath = path.join(tempDir, `${fileName}.cpp`);
                    fs.writeFileSync(filePath, code);
                    // Quote paths to handle spaces
                    const cppOutputPath = path.join(tempDir, fileName);
                    // Use appropriate compiler based on platform
                    const cppCompiler = process.platform === 'darwin' ? 'clang++' : 'g++';
                    executionCmd = `${cppCompiler} -o "${cppOutputPath}" "${filePath}" && "${cppOutputPath}"`;
                    break;
                    
                case "c":
                    fileExtension = "c";
                    filePath = path.join(tempDir, `${fileName}.c`);
                    fs.writeFileSync(filePath, code);
                    // Quote paths to handle spaces
                    const cOutputPath = path.join(tempDir, fileName);
                    // Use appropriate compiler based on platform
                    const cCompiler = process.platform === 'darwin' ? 'clang' : 'gcc';
                    executionCmd = `${cCompiler} -o "${cOutputPath}" "${filePath}" && "${cOutputPath}"`;
                    break;
                    
                default:
                    return reject(new Error("Unsupported language"));
            }
            
            // Create input file if needed
            let inputFilePath = null;
            if (input) {
                inputFilePath = path.join(tempDir, `${fileName}.in`);
                fs.writeFileSync(inputFilePath, input);
                executionCmd += ` < "${inputFilePath}"`;
            }
            
            // Execute with timeout limit (5 seconds)
            exec(executionCmd, { timeout: 5000 }, (error, stdout, stderr) => {
                // Clean up temporary files
                try {
                    // Clean up the source file
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                    
                    // Clean up the input file if it exists
                    if (inputFilePath && fs.existsSync(inputFilePath)) {
                        fs.unlinkSync(inputFilePath);
                    }
                    
                    // For compiled languages, remove the executable
                    if (["cpp", "c"].includes(language.toLowerCase())) {
                        const execPath = language.toLowerCase() === "cpp" ? cppOutputPath : cOutputPath;
                        if (fs.existsSync(execPath)) {
                            fs.unlinkSync(execPath);
                        }
                    }
                    
                    // For Java, remove the class file
                    if (language.toLowerCase() === "java") {
                        const classNameMatch = code.match(/class\s+(\w+)/);
                        if (classNameMatch) {
                            const className = classNameMatch[1];
                            const classPath = path.join(tempDir, `${className}.class`);
                            if (fs.existsSync(classPath)) {
                                fs.unlinkSync(classPath);
                            }
                        }
                    }
                } catch (cleanupError) {
                    console.error("Error during file cleanup:", cleanupError);
                }
                
                // Return execution result
                if (error) {
                    resolve({
                        status: "error",
                        output: "",
                        error: stderr || error.message
                    });
                } else {
                    resolve({
                        status: "success",
                        output: stdout,
                        error: stderr
                    });
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

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
                // Execute code with test case input - use our function directly
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
