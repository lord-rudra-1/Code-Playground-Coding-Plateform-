const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Temporary directory to save code files - use system temp directory to avoid spaces in paths
const tempDir = path.join(os.tmpdir(), "code-playground-temp");

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * Execute code in various programming languages
 * @param {string} code - The source code to execute
 * @param {string} language - The programming language (java, python, cpp, c)
 * @param {string} input - Optional input to be passed to the program
 * @returns {Promise<object>} - Result with status, output, and possible error
 */
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
                    
                    // Extract class name from Java code with better regex
                    const publicClassMatch = code.match(/public\s+class\s+(\w+)/);
                    const classNameMatch = code.match(/class\s+(\w+)/);
                    let className;
                    
                    if (publicClassMatch) {
                        // If there's a public class, the file must be named after it
                        className = publicClassMatch[1];
                        filePath = path.join(tempDir, `${className}.java`);
                    } else if (classNameMatch) {
                        // If no public class but has a class
                        className = classNameMatch[1];
                        filePath = path.join(tempDir, `${fileName}.java`);
                    } else {
                        // If no class found, use a default name
                        className = "Main";
                        filePath = path.join(tempDir, `${fileName}.java`);
                        // Wrap the code in a Main class
                        code = `
class Main {
    public static void main(String[] args) {
        ${code}
    }
}`;
                    }
                    
                    fs.writeFileSync(filePath, code);
                    
                    // Get just the filename for javac (without directory path)
                    const javaFileName = path.basename(filePath);
                    
                    // Compile and run with quoted paths
                    executionCmd = `cd "${tempDir}" && javac "${javaFileName}" && java "${className}"`;
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
                        const execPath = path.join(tempDir, fileName);
                        if (fs.existsSync(execPath)) {
                            fs.unlinkSync(execPath);
                        }
                    }
                    
                    // For Java, remove the class file
                    if (language.toLowerCase() === "java") {
                        // Clean up all class files that match the pattern
                        const classFiles = fs.readdirSync(tempDir)
                            .filter(file => file.endsWith('.class') && file.includes(className));
                        
                        classFiles.forEach(classFile => {
                            const classPath = path.join(tempDir, classFile);
                            if (fs.existsSync(classPath)) {
                                fs.unlinkSync(classPath);
                            }
                        });
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

module.exports = executeCode; 