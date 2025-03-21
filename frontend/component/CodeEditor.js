import React, { useState } from "react";
import Editor from "@monaco-editor/react";
import axios from "axios";

const CodeEditor = () => {
    const [code, setCode] = useState("");

    const handleRun = async () => {
        const res = await axios.post("http://localhost:5000/execute/run", { code, language: "py" });
        alert(res.data.output);
    };

    return (
        <div>
            <Editor height="300px" language="python" value={code} onChange={setCode} />
            <button onClick={handleRun}>Run Code</button>
        </div>
    );
};

export default CodeEditor;
