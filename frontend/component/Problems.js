import React, { useEffect, useState } from "react";
import axios from "axios";

const Problems = () => {
    const [problems, setProblems] = useState([]);

    useEffect(() => {
        axios.get("http://localhost:5000/problems").then((res) => setProblems(res.data));
    }, []);

    return (
        <div>
            <h1>Problems</h1>
            <ul>
                {problems.map((problem) => (
                    <li key={problem._id}>{problem.title} - {problem.difficulty}</li>
                ))}
            </ul>
        </div>
    );
};

export default Problems;
